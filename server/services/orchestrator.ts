import * as llm from "./llm";
import * as blockchain from "./blockchain";
import { Socket } from "socket.io";
import * as registry from "./registry";
import type { SpecialistInfo } from "./registry";
import * as taskHistory from "./taskHistory";
import { ethers } from "ethers";

export interface OrchestrationResult {
  delegate: boolean;
  niche?: string;
  result?: string;
  text: string;
}

async function orchestrateChain(
  chain: { niche: string; sub_prompt: string }[],
  socket: Socket | any,
  maxFee?: number,
  clientWallet?: string,
  nicheModels?: Record<string, string>
): Promise<OrchestrationResult> {
  const chainResults: { niche: string; modelName: string; output: string; price: string }[] = [];
  let previousOutput = "";

  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    const niche = step.niche.toUpperCase();
    
    let specialist;
    if (nicheModels && nicheModels[niche]) {
      specialist = await registry.getSpecialistById(nicheModels[niche]);
    } else {
      specialist = await registry.getSpecialistByNiche(niche, maxFee);
    }
    
    if (!specialist) throw new Error(`No specialist for niche: ${niche} within budget`);

    // Emit chain step indicator
    socket.emit("STATUS_UPDATE", {
      status: "CHAIN_STEP",
      stepIndex: i + 1,
      totalSteps: chain.length,
      niche
    });

    // Health Check
    const isHealthy = await llm.checkSpecialistHealth(specialist.endpoint);
    if (!isHealthy) {
      socket.emit("STATUS_UPDATE", { status: "SPECIALIST_UNAVAILABLE", niche });
      throw new Error(`Specialist for ${niche} is currently offline or unreachable. No funds locked.`);
    }

    if (!clientWallet) {
      throw new Error("Wallet not connected. Connect your Web3 wallet in settings to authorize payments.");
    }

    // Escrow
    socket.emit("STATUS_UPDATE", { status: "ESCROW_TX_PENDING", niche, price: specialist.price, modelName: specialist.modelName });
    const escrowAmount = maxFee !== undefined ? maxFee.toString() : "1.0";
    const escrowReceipt = await blockchain.requestTaskOnChain(clientWallet, specialist.id, escrowAmount, step.sub_prompt, 1); // 1 = CHAT mode
    const taskId = escrowReceipt.taskId;
    socket.emit("STATUS_UPDATE", { status: "ESCROW_LOCKED", taskId, txHash: escrowReceipt.txHash, amount: escrowAmount, niche });

    // Execute
    socket.emit("STATUS_UPDATE", { status: "EXECUTING_SPECIALIST", niche });
    const specResponse = await llm.callSpecialistEndpoint(specialist.endpoint, step.sub_prompt, niche, previousOutput || undefined, taskId.toString(), specialist.id);

    // Evaluate
    socket.emit("STATUS_UPDATE", { status: "EVALUATING_RESULT", niche });
    const evaluation = await llm.evaluateResult(step.sub_prompt, niche, specResponse.result);

    if (evaluation === "YES") {
      socket.emit("STATUS_UPDATE", { status: "SETTLEMENT_TX_PENDING", niche });
      const settleReceipt = await blockchain.settleTaskOnChain(taskId, specResponse.final_amount_base, specResponse.result_hash, specResponse.signature);
      await taskHistory.appendTask({
        taskId,
        modelId: specialist.id,
        specialistWallet: specialist.wallet,
        niche,
        amount: specResponse.final_amount_base, // Could be formatted, but keep as is for history
        status: 'approved',
        timestamp: Date.now()
      });
      socket.emit("STATUS_UPDATE", { status: "FUNDS_RELEASED", txHash: settleReceipt.txHash, amount: ethers.formatUnits(specResponse.final_amount_base, 6), niche, modelId: specialist.id, taskId });
      previousOutput = specResponse.result;
      chainResults.push({ niche, modelName: specialist.modelName, output: specResponse.result, price: ethers.formatUnits(specResponse.final_amount_base, 6) });
    } else {
      socket.emit("STATUS_UPDATE", { status: "SETTLEMENT_TX_PENDING", niche });
      await blockchain.rejectTaskOnChain(taskId, specResponse.final_amount_base, specResponse.result_hash, specResponse.signature);
      await taskHistory.appendTask({
        taskId,
        modelId: specialist.id,
        specialistWallet: specialist.wallet,
        niche,
        amount: specResponse.final_amount_base,
        status: 'rejected',
        timestamp: Date.now()
      });
      socket.emit("STATUS_UPDATE", { status: "TASK_REJECTED", niche });
      throw new Error(`Chain failed at step ${i + 1}/${chain.length} (${niche}). Specialist output rejected.`);
    }
  }

  // Build combined response text
  const responseText = chainResults.map(r => {
    if (r.output.includes('```')) {
      return `**${r.modelName} (${r.niche}):**\n\n${r.output}`;
    }
    return `**${r.modelName} (${r.niche}):**\n\n\`\`\`${r.niche.toLowerCase()}\n${r.output}\n\`\`\``;
  }).join("\n\n---\n\n");
  const totalCost = chainResults.reduce((sum, r) => sum + parseFloat(r.price), 0).toFixed(4);

  return {
    delegate: true,
    niche: chainResults.map(r => r.niche).join(" → "),
    result: chainResults.map(r => r.output).join("\n\n"),
    text: `Chained ${chainResults.length} specialists (${chainResults.map(r => r.niche).join(" → ")}):\n\n${responseText}\n\nTotal cost: ${totalCost} USDC`,
  };
}

export async function analyzeIntent(
  prompt: string,
  delegationMode?: string,
  maxFee?: number,
  clientWallet?: string,
  customEndpoint?: string
) {
  let intent: any = {};
  if (delegationMode === "personal") {
    if (!customEndpoint) throw new Error("Custom Endpoint URL is required for Personal AI mode");
    try {
      const resp = await fetch(customEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      intent = await resp.json();
    } catch (e: any) {
      throw new Error(`Personal AI Endpoint failed: ${e.message}`);
    }
  } else if (delegationMode === "hired") {
    const orchestratorModel = await registry.getSpecialistByNiche("ORCHESTRATOR", maxFee);
    if (!orchestratorModel) throw new Error("No Orchestrator models available on-chain");
    if (!clientWallet) throw new Error("Wallet not connected");

    const escrowAmount = maxFee !== undefined ? maxFee.toString() : "1.0";
    const escrowReceipt = await blockchain.requestTaskOnChain(clientWallet, orchestratorModel.id, escrowAmount, prompt, 0);
    const taskId = escrowReceipt.taskId;
    
    const specResponse = await llm.callSpecialistEndpoint(orchestratorModel.endpoint, prompt, "ORCHESTRATOR", undefined, taskId, orchestratorModel.id);
    
    try {
      intent = JSON.parse(specResponse.result);
      await blockchain.settleTaskOnChain(taskId, specResponse.final_amount_base, specResponse.result_hash, specResponse.signature);
    } catch (e) {
      await blockchain.rejectTaskOnChain(taskId, specResponse.final_amount_base, specResponse.result_hash, specResponse.signature);
      throw new Error("Hired Orchestrator did not return valid JSON intent. Escrow refunded.");
    }
  } else {
    intent = await llm.detectIntent(prompt);
  }
  return intent;
}

export async function orchestrate(
  prompt: string, 
  socket: Socket | any, 
  maxFee?: number, 
  clientWallet?: string,
  delegationMode?: string,
  manualModelId?: string,
  customEndpoint?: string,
  preAnalyzedIntent?: any,
  nicheModels?: Record<string, string>
): Promise<OrchestrationResult> {

  socket.emit("STATUS_UPDATE", { status: "ANALYZING_INTENT" });

  let intent: any = preAnalyzedIntent;

  if (!intent) {
    if (delegationMode === "manual" && manualModelId) {
      const spec = await registry.getSpecialistById(manualModelId);
      if (!spec) throw new Error("Selected model not found in registry");
      
      intent = {
        delegate: true,
        niche: "MANUAL_OVERRIDE",
        targetModelId: manualModelId,
        sub_prompt: prompt
      };
    } else {
      socket.emit("STATUS_UPDATE", { status: "ANALYZING_INTENT", message: delegationMode === "hired" ? "Hiring Orchestrator on-chain..." : "Analyzing intent..." });
      intent = await analyzeIntent(prompt, delegationMode, maxFee, clientWallet, customEndpoint);
    }
  }

  if (intent.chain && intent.chain.length > 0) {
    return await orchestrateChain(intent.chain, socket, maxFee, clientWallet, nicheModels);
  }

  if (!intent.delegate || !intent.niche || !intent.sub_prompt) {
    socket.emit("STATUS_UPDATE", {
      status: "DIRECT_RESPONSE",
      message: "Orchestrator handled this directly — no delegation needed."
    });
    return {
      delegate: false,
      text: intent.text || "Direct reply generated",
    };
  }

  const niche = intent.niche.toUpperCase();
  let specialist;
  
  if (nicheModels && nicheModels[niche]) {
    specialist = await registry.getSpecialistById(nicheModels[niche]);
    if (specialist && maxFee !== undefined && parseFloat(specialist.price) > maxFee) {
      throw new Error(`Selected model price (${specialist.price}) exceeds maximum budget (${maxFee})`);
    }
  } else if (niche === "MANUAL_OVERRIDE" && intent.targetModelId) {
    specialist = await registry.getSpecialistById(intent.targetModelId);
    if (specialist && maxFee !== undefined && parseFloat(specialist.price) > maxFee) {
      throw new Error(`Selected manual model price (${specialist.price}) exceeds maximum budget (${maxFee})`);
    }
  } else {
    specialist = await registry.getSpecialistByNiche(niche, maxFee);
  }

  if (!specialist) {
    throw new Error(`No registered specialized AI found for niche: ${niche} within budget`);
  }

  const isHealthy = await llm.checkSpecialistHealth(specialist.endpoint);
  if (!isHealthy) {
    socket.emit("STATUS_UPDATE", { status: "SPECIALIST_UNAVAILABLE", niche });
    throw new Error(`Specialist for ${niche} is currently offline or unreachable. No funds locked.`);
  }
  
  if (!clientWallet) {
    throw new Error("Wallet not connected. Connect your Web3 wallet in settings to authorize payments.");
  }

  socket.emit("STATUS_UPDATE", {
    status: "ESCROW_TX_PENDING",
    niche,
    price: specialist.price,
    modelName: specialist.modelName
  });

  const escrowAmount = maxFee !== undefined ? maxFee.toString() : "1.0";
  const escrowReceipt = await blockchain.requestTaskOnChain(
    clientWallet,
    specialist.id,
    escrowAmount,
    intent.sub_prompt,
    1
  );

  const taskId = escrowReceipt.taskId;

  socket.emit("STATUS_UPDATE", {
    status: "ESCROW_LOCKED",
    taskId,
    txHash: escrowReceipt.txHash,
    amount: escrowAmount,
    niche
  });

  socket.emit("STATUS_UPDATE", { status: "EXECUTING_SPECIALIST", niche });

  const specResponse = await llm.callSpecialistEndpoint(specialist.endpoint, intent.sub_prompt, niche, undefined, taskId.toString(), specialist.id);

  socket.emit("STATUS_UPDATE", { status: "EVALUATING_RESULT" });

  const evaluation = await llm.evaluateResult(intent.sub_prompt, niche, specResponse.result);

  if (evaluation === "YES") {
    socket.emit("STATUS_UPDATE", { status: "SETTLEMENT_TX_PENDING" });

    const settleReceipt = await blockchain.settleTaskOnChain(taskId, specResponse.final_amount_base, specResponse.result_hash, specResponse.signature);
    await taskHistory.appendTask({
      taskId,
      modelId: specialist.id,
      specialistWallet: specialist.wallet,
      niche,
      amount: specResponse.final_amount_base,
      status: 'approved',
      timestamp: Date.now()
    });

    socket.emit("STATUS_UPDATE", {
      status: "FUNDS_RELEASED",
      txHash: settleReceipt.txHash,
      amount: ethers.formatUnits(specResponse.final_amount_base, 6),
      niche,
      modelId: specialist.id,
      taskId
    });

    let resultText = specResponse.result;
    const backtickCount = (resultText.match(/```/g) || []).length;
    if (backtickCount % 2 !== 0) {
      resultText += '\n```\n';
    }

    let finalText = `Here is the analysis from ${specialist.modelName}:\n\n\`\`\`${niche.toLowerCase()}\n${resultText}\n\`\`\`\n\nI verified the ${niche} syntax and approved the payment on-chain using the cryptographically verified receipt!`;
    if (resultText.includes('```')) {
      finalText = `Here is the analysis from ${specialist.modelName}:\n\n${resultText}\n\nI verified the ${niche} syntax and approved the payment on-chain using the cryptographically verified receipt!`;
    }

    return {
      delegate: true,
      niche,
      result: specResponse.result,
      text: finalText,
    };
  } else {
    socket.emit("STATUS_UPDATE", { status: "SETTLEMENT_TX_PENDING" });

    const refundReceipt = await blockchain.rejectTaskOnChain(taskId, specResponse.final_amount_base, specResponse.result_hash, specResponse.signature);
    await taskHistory.appendTask({
      taskId,
      modelId: specialist.id,
      specialistWallet: specialist.wallet,
      niche,
      amount: specResponse.final_amount_base,
      status: 'rejected',
      timestamp: Date.now()
    });

    socket.emit("STATUS_UPDATE", {
      status: "TASK_REJECTED",
      txHash: refundReceipt.txHash
    });

    throw new Error(
      `Specialist output failed quality checks. Evaluator returned: NO. Transaction rejected, 3-way penalty applied.`
    );
  }
}
