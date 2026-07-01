import { Socket } from "socket.io";
import * as llm from "./llm";
import * as blockchain from "./blockchain";
import * as registry from "./registry";
import * as taskHistory from "./taskHistory";
import { ethers } from "ethers";
import { logger } from "./logger";
import { isCancelled, clearCancellation } from "./orchestrator";
import type { SpecialistInfo } from "./registry";
import type { ProjectState, CodeGenPlan, FileOperation, ReviewResult } from "./projectState";
import { MAX_CODE_GEN_ITERATIONS, CODE_GEN_TOKEN_LIMIT } from "./projectState";
import { parseFileOperations, applyOperations, validateOperations, normalizePathForNiche } from "./fileParser";
import { injectToolsContext, parseToolCall, executeToolCall } from "./toolExecutor";
import * as fs from "fs";
import * as path from "path";
import { buildContext } from "./contextPacker";
import type { OrchestrationResult } from "./orchestrator";
import { reviewProject } from "./codeReviewer";
import { rateLimitedDelay } from "./llm";

export async function orchestrateCodeGen(
  plan: CodeGenPlan,
  socket: Socket | any,
  maxFee?: number,
  clientWallet?: string,
): Promise<OrchestrationResult> {
  const projectState: ProjectState = {
    files: {},
    metadata: {
      name: plan.projectName,
      prompt: plan.description,
      currentStep: 0,
      totalSteps: plan.plan.length,
      currentIteration: 0,
      maxIterations: MAX_CODE_GEN_ITERATIONS,
      totalCost: 0,
      specialists: plan.plan.map(s => s.niche),
    },
  };

  let totalCost = 0;
  const allStepOutputs: string[] = [];
  let finalReviewFeedback: string | undefined;
  const originalPrompts = new Map(plan.plan.map(s => [s.step, s.prompt]));

  try {
    for (let iteration = 0; iteration < MAX_CODE_GEN_ITERATIONS; iteration++) {
    projectState.metadata.currentIteration = iteration;
    socket.emit("STATUS_UPDATE", {
      status: "CODE_GEN_ITERATION",
      iteration: iteration + 1,
      maxIterations: MAX_CODE_GEN_ITERATIONS,
    });

    for (let stepIndex = 0; stepIndex < plan.plan.length; stepIndex++) {
      const step = plan.plan[stepIndex];
      const niche = step.niche.toUpperCase();
      projectState.metadata.currentStep = stepIndex;

      let specialist: SpecialistInfo;
      try {
        specialist = await findSpecialist(niche, maxFee);
      } catch (err: any) {
        socket.emit("STATUS_UPDATE", { status: "SPECIALIST_UNAVAILABLE", niche });
        if (stepIndex === 0) {
          const allSpecialists = await registry.getAllSpecialists();
          const availableNiches = [...new Set(allSpecialists.map(s => s.niche))];
          return {
            delegate: true,
            niche: "error",
            text: `❌ **Code generation aborted**\n\nCannot find a **${niche}** specialist. Currently available: ${availableNiches.join(", ") || "None"}.\n\nDeploy a ${niche} specialist node first, then try again.`,
          };
        }
        socket.emit("STATUS_UPDATE", { status: "CODE_GEN_SKIP_STEP", niche, reason: err.message });
        continue;
      }

      socket.emit("STATUS_UPDATE", {
        status: "CODE_GEN_STEP_START",
        step: step.step, niche,
        stepIndex: stepIndex + 1,
        totalSteps: plan.plan.length,
        iteration: iteration + 1,
      });

      const previousOutput = iteration > 0
        ? allStepOutputs[stepIndex]
        : stepIndex > 0
          ? allStepOutputs[stepIndex - 1]
          : undefined;

      const context = buildContext(projectState, niche, {
        stepName: step.step, iteration,
        previousStepOutput: previousOutput,
        reviewFeedback: finalReviewFeedback,
      });

      if (isCancelled(socket.id)) {
        logger.info(`Code-Gen aborted at step ${step.step} due to cancellation`);
        socket.emit("STATUS_UPDATE", { status: "ERROR", message: "Execution cancelled by user." });
        break;
      }

      step.prompt = llm.sanitizePrompt(step.prompt);

      let taskId = "";
      if (clientWallet) {
        socket.emit("STATUS_UPDATE", { status: "ESCROW_TX_PENDING", niche, price: specialist.price, modelName: specialist.modelName });
        const escrowAmount = maxFee !== undefined ? maxFee.toString() : "1.0";
        try {
          const escrowReceipt = await blockchain.requestTaskOnChain(clientWallet, specialist.id, escrowAmount, step.prompt, 0);
          taskId = escrowReceipt.taskId;
          socket.emit("STATUS_UPDATE", { status: "ESCROW_LOCKED", taskId, txHash: escrowReceipt.txHash, amount: escrowAmount, niche });
        } catch (escrowErr: any) {
          logger.error("Failed to request task on chain:", escrowErr);
          socket.emit("STATUS_UPDATE", { status: "CODE_GEN_EXECUTION_FAILED", niche, error: `Escrow lock failed: ${escrowErr.message}` });
          throw escrowErr;
        }
      }

      const fullPrompt = buildSpecialistPrompt(step, context);

      let currentPrompt = injectToolsContext(fullPrompt, niche);
      let specResponse;
      let loopCount = 0;
      const maxToolCalls = 10;
      const projectRoot = path.resolve(__dirname, "..", "..");

      try {
        while (true) {
          if (isCancelled(socket.id)) {
            logger.info("Code-Gen tool loop cancelled");
            break;
          }
          socket.emit("STATUS_UPDATE", { status: "CODE_GEN_EXECUTING", niche, step: step.step });
          await rateLimitedDelay();
          specResponse = await llm.callSpecialistEndpoint(
            specialist.endpoint, 
            currentPrompt, 
            niche,
            JSON.stringify(context),
            taskId.toString(),
            specialist.id,
            maxFee
          );

          const toolCall = parseToolCall(specResponse.result);
          if (!toolCall || loopCount >= maxToolCalls || isCancelled(socket.id)) {
            break;
          }

          loopCount++;
          socket.emit("STATUS_UPDATE", { 
            status: "EXECUTING_TOOL", 
            niche, 
            tool: toolCall.tool,
            params: toolCall.params
          });

          const toolResult = await executeToolCall(toolCall.tool, toolCall.params, projectRoot, socket);

          // Append turn to prompt accumulator
          currentPrompt += `\n\n[ASSISTANT RESPONSE]\n${specResponse.result}`;
          currentPrompt += `\n\n[TOOL RESULT]\nTool: ${toolCall.tool}\nOutput:\n${toolResult}\n\nPlease proceed with the task.`;
        }
      } catch (err: any) {
        socket.emit("STATUS_UPDATE", { status: "CODE_GEN_EXECUTION_FAILED", niche, error: err.message });
        if (stepIndex > 0) continue;
        throw err;
      }

      const operations = parseFileOperations(specResponse.result);
      let { valid, invalid } = validateOperations(operations);

      if (invalid.length > 0) {
        socket.emit("STATUS_UPDATE", {
          status: "CODE_GEN_INVALID_OPS", niche,
          invalid: invalid.map(i => `${i.operation.path}: ${i.reason}`),
        });
      }

      if (valid.length === 0) {
        const unparsedPath = `_unparsed/${niche.toLowerCase()}-step-${step.step}-iter-${iteration}.md`;
        valid.push({
          type: "write",
          path: unparsedPath,
          content: `# Unparsed Output from ${niche} Specialist (Step: ${step.step}, Iteration: ${iteration})\n\n` +
            `The specialist's output did not contain file:annotated code blocks.\n` +
            `Raw output is below for manual inspection:\n\n---\n\n${specResponse.result}`,
        });

        socket.emit("STATUS_UPDATE", {
          status: "CODE_GEN_UNPARSED_OUTPUT",
          niche,
          message: `No file: annotations found. Raw output saved to ${unparsedPath}.`,
        });
      }

      // Normalize paths in valid operations
      valid = valid.map(op => ({
        ...op,
        path: normalizePathForNiche(op.path, niche)
      }));

      projectState.files = applyOperations(projectState, valid).files;

      const stepCost = parseFloat(ethers.formatUnits(specResponse.final_amount_base, 6));
      totalCost += stepCost;
      projectState.metadata.totalCost = totalCost;

      for (const op of valid) {
        const fullPath = path.resolve(projectRoot, op.path);
        if (op.type === "write" && op.content !== undefined) {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, op.content, "utf8");
          
          socket.emit("FILE_UPDATE", { path: op.path, content: op.content });
        }
        if (op.type === "delete") {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
          socket.emit("FILE_DELETE", { path: op.path });
        }
      }

      if (clientWallet && taskId) {
        socket.emit("STATUS_UPDATE", { status: "SETTLEMENT_TX_PENDING", niche });
        try {
          const settleReceipt = await blockchain.settleTaskOnChain(taskId, specResponse.final_amount_base, specResponse.result_hash, specResponse.signature);
          socket.emit("STATUS_UPDATE", { status: "FUNDS_RELEASED", taskId, txHash: settleReceipt.txHash, amount: ethers.formatUnits(specResponse.final_amount_base, 6), niche });
          
          await taskHistory.appendTask({
            taskId,
            modelId: specialist.id,
            specialistWallet: specialist.wallet,
            clientWallet,
            niche,
            amount: specResponse.final_amount_base,
            status: 'approved',
            timestamp: Date.now(),
            prompt: step.prompt,
            txHash: settleReceipt.txHash,
          });
        } catch (settleErr: any) {
          logger.error("Failed to settle code-gen task on chain:", settleErr);
          socket.emit("STATUS_UPDATE", { status: "CODE_GEN_EXECUTION_FAILED", niche, error: `On-chain settlement failed: ${settleErr.message}` });
          throw settleErr;
        }
      }

      allStepOutputs[stepIndex] = specResponse.result;

      socket.emit("STATUS_UPDATE", {
        status: "CODE_GEN_STEP_COMPLETE", step: step.step, niche,
        filesCreated: valid.filter(o => o.type === "write").length,
      });
    }

    if (iteration < MAX_CODE_GEN_ITERATIONS - 1) {
      socket.emit("STATUS_UPDATE", { status: "CODE_GEN_REVIEWING", iteration: iteration + 1 });

      const review = await reviewProject(projectState, plan);
      finalReviewFeedback = review.feedback;

      socket.emit("STATUS_UPDATE", {
        status: "CODE_GEN_REVIEW_RESULT",
        passed: review.passed,
        score: review.score,
        issues: review.issues,
        iteration: iteration + 1,
      });

      if (review.passed) {
        socket.emit("STATUS_UPDATE", { status: "CODE_GEN_PASSED", iteration: iteration + 1 });
        break;
      }

      for (const step of plan.plan) {
        step.prompt = originalPrompts.get(step.step)!;
        step.prompt += `\n\n[REVIEW FEEDBACK (Iteration ${iteration + 1})]\n${review.feedback}`;
        if (review.stepFeedback && review.stepFeedback[step.step]) {
          step.prompt += `\n${review.stepFeedback[step.step]}`;
        }
      }
    }
  }

  if (clientWallet) {
    socket.emit("STATUS_UPDATE", {
      status: "CODE_GEN_SESSION_COMPLETE",
      totalCost: totalCost.toFixed(4),
      message: `Session complete. Total cost: ${totalCost.toFixed(4)} USDC (single settlement).`,
    });
  }

  socket.emit("CODE_GEN_COMPLETE", {
    files: projectState.files,
    metadata: projectState.metadata,
  });

  const fileCount = Object.keys(projectState.files).length;
  const specialistsUsed = [...new Set(plan.plan.map(s => s.niche))].join(", ");
  const costLine = clientWallet
    ? `- Total cost: ${totalCost.toFixed(4)} USDC (settled in 1 transaction)\n`
    : `- Total cost: ${totalCost.toFixed(4)} USDC (demo mode — on-chain settlement skipped)\n`;
  const responseText = `✅ **Code generation complete for "${plan.projectName}"**\n\n` +
    `- ${fileCount} file${fileCount !== 1 ? 's' : ''} created\n` +
    `- Specialists: ${specialistsUsed}\n` +
    `- Iterations: ${projectState.metadata.currentIteration + 1}\n` +
      costLine +
      `\nSwitch to the **Workspace** tab to view and edit the code, or **Preview** to see it running.`;

    return {
      delegate: true,
      niche: specialistsUsed,
      text: responseText,
    };
  } finally {
    clearCancellation(socket.id);
  }
}

function buildSpecialistPrompt(
  step: { step: string; niche: string; prompt: string },
  context: any,
): string {
  let fullPrompt = `## Role: ${step.niche} Specialist\n\n`;
  fullPrompt += `## Current Step: ${step.step}\n\n`;
  fullPrompt += `## Project Context\n\n`;
  fullPrompt += `### File Tree\n\`\`\`\n${context.fileTree}\n\`\`\`\n\n`;

  if (Object.keys(context.relevantFiles).length > 0) {
    fullPrompt += `### Current Files\n\n`;
    for (const [path, content] of Object.entries(context.relevantFiles) as [string, string][]) {
      if (path.startsWith("__SKIPPED__")) continue;
      fullPrompt += `\`\`\`file:${path}\n${content}\n\`\`\`\n\n`;
    }
  }

  if (context.metadata.previousStepOutput) {
    fullPrompt += `### Output From Previous Step\n\n`;
    fullPrompt += `The previous specialist produced this output. Use it as reference:\n\n${context.metadata.previousStepOutput.slice(0, 2000)}\n\n`;
  }

  if (context.metadata.reviewFeedback) {
    fullPrompt += `### Review Feedback (Iteration ${context.metadata.currentIteration})\n\n`;
    fullPrompt += `The review identified these issues that need to be fixed:\n\n${context.metadata.reviewFeedback}\n\n`;
  }

  fullPrompt += `## Task\n\n${step.prompt}\n\n`;

  fullPrompt += `## Output Format Instructions\n\n`;
  fullPrompt += `IMPORTANT: You MUST output your code using file-annotated code blocks so the system knows where to place each file:\n\n`;
  fullPrompt += `\`\`\`file:path/to/file.tsx\n// your code here\n\`\`\`\n\n`;
  fullPrompt += `Create ALL necessary files for your step. If a file already exists and needs modification, output it again with the updated content.\n\n`;
  fullPrompt += `If you delete a file, use: \`\`\`delete:path/to/file.tsx\`\`\`\n\n`;

  return fullPrompt;
}

async function findSpecialist(
  niche: string, maxFee?: number
): Promise<SpecialistInfo> {
  const specialist = await registry.getSpecialistByNiche(niche, maxFee);
  if (!specialist) {
    throw new Error(`No registered specialist found for niche: ${niche} within budget`);
  }

  const isHealthy = await llm.checkSpecialistHealth(specialist.endpoint);
  if (!isHealthy) {
    throw new Error(`Specialist for ${niche} is currently offline`);
  }

  if (!specialist.endpoint) {
    throw new Error(`Specialist for ${niche} has no configured endpoint`);
  }

  return specialist;
}
