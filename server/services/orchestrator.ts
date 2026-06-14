import * as llm from "./llm";
import * as blockchain from "./blockchain";
import { Socket } from "socket.io";
import * as registry from "./registry";
import type { SpecialistInfo } from "./registry";
import * as taskHistory from "./taskHistory";

export interface OrchestrationResult {
  delegate: boolean;
  niche?: string;
  result?: string;
  text: string;
}

async function orchestrateChain(
  chain: { niche: string; sub_prompt: string }[],
  socket: Socket | any,
  maxFee?: number
): Promise<OrchestrationResult> {
  const chainResults: { niche: string; modelName: string; output: string; price: string }[] = [];
  let previousOutput = "";

  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    const niche = step.niche.toUpperCase();
    const specialist = await registry.getSpecialistByNiche(niche, maxFee);
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

    // Escrow
    socket.emit("STATUS_UPDATE", { status: "ESCROW_TX_PENDING", niche, price: specialist.price, modelName: specialist.modelName });
    const escrowReceipt = await blockchain.requestTaskOnChain(specialist.wallet, specialist.id, specialist.price, step.sub_prompt);
    const taskId = escrowReceipt.taskId;
    socket.emit("STATUS_UPDATE", { status: "ESCROW_LOCKED", taskId, txHash: escrowReceipt.txHash, amount: specialist.price, niche });

    // Execute — pass previous output as context explicitly
    socket.emit("STATUS_UPDATE", { status: "EXECUTING_SPECIALIST", niche });
    const result = await llm.callSpecialistEndpoint(specialist.endpoint, step.sub_prompt, niche, previousOutput || undefined);

    // Evaluate
    socket.emit("STATUS_UPDATE", { status: "EVALUATING_RESULT", niche });
    const evaluation = await llm.evaluateResult(niche, result);

    if (evaluation === "YES") {
      socket.emit("STATUS_UPDATE", { status: "SETTLEMENT_TX_PENDING", niche });
      const settleReceipt = await blockchain.approveTaskOnChain(taskId, result);
      await taskHistory.appendTask({
        taskId,
        modelId: specialist.id,
        specialistWallet: specialist.wallet,
        niche,
        amount: specialist.price,
        status: 'approved',
        timestamp: Date.now()
      });
      const balances = await blockchain.getBalances();
      socket.emit("STATUS_UPDATE", { status: "FUNDS_RELEASED", txHash: settleReceipt.txHash, amount: specialist.price, niche, balances, modelId: specialist.id, taskId });
      previousOutput = result;
      chainResults.push({ niche, modelName: specialist.modelName, output: result, price: specialist.price });
    } else {
      socket.emit("STATUS_UPDATE", { status: "SETTLEMENT_TX_PENDING", niche });
      await blockchain.rejectTaskOnChain(taskId);
      await taskHistory.appendTask({
        taskId,
        modelId: specialist.id,
        specialistWallet: specialist.wallet,
        niche,
        amount: specialist.price,
        status: 'rejected',
        timestamp: Date.now()
      });
      const balances = await blockchain.getBalances();
      socket.emit("STATUS_UPDATE", { status: "TASK_REJECTED", niche, balances });
      throw new Error(`Chain failed at step ${i + 1}/${chain.length} (${niche}). Specialist output rejected.`);
    }
  }

  // Build combined response text
  const responseText = chainResults.map(r =>
    `**${r.modelName} (${r.niche}):**\n\n\`\`\`${r.niche.toLowerCase()}\n${r.output}\n\`\`\``
  ).join("\n\n---\n\n");
  const totalCost = chainResults.reduce((sum, r) => sum + parseFloat(r.price), 0).toFixed(2);

  return {
    delegate: true,
    niche: chainResults.map(r => r.niche).join(" → "),
    result: chainResults.map(r => r.output).join("\n\n"),
    text: `Chained ${chainResults.length} specialists (${chainResults.map(r => r.niche).join(" → ")}):\n\n${responseText}\n\nTotal cost: ${totalCost} USDC`,
  };
}

export async function orchestrate(prompt: string, socket: Socket | any, maxFee?: number): Promise<OrchestrationResult> {

  // 1. Emit ANALYZING_INTENT
  socket.emit("STATUS_UPDATE", { status: "ANALYZING_INTENT" });

  // Pass 1: Intent Detection
  const intent = await llm.detectIntent(prompt);

  // If chain detected
  if (intent.chain && intent.chain.length > 0) {
    return await orchestrateChain(intent.chain, socket, maxFee);
  }

  if (!intent.delegate || !intent.niche || !intent.sub_prompt) {
    // Branch A: Non-delegation path
    socket.emit("STATUS_UPDATE", {
      status: "DIRECT_RESPONSE",
      message: "Orchestrator handled this directly — no delegation needed."
    });
    return {
      delegate: false,
      text: intent.text || "Direct reply generated",
    };
  }

  // Branch B: Delegation Path
  const niche = intent.niche.toUpperCase();
  const specialist = await registry.getSpecialistByNiche(niche, maxFee);

  if (!specialist) {
    throw new Error(`No registered specialized AI found for niche: ${niche} within budget`);
  }

  // Health Check
  const isHealthy = await llm.checkSpecialistHealth(specialist.endpoint);
  if (!isHealthy) {
    socket.emit("STATUS_UPDATE", { status: "SPECIALIST_UNAVAILABLE", niche });
    throw new Error(`Specialist for ${niche} is currently offline or unreachable. No funds locked.`);
  }

  // 2. Emit ESCROW_TX_PENDING
  socket.emit("STATUS_UPDATE", {
    status: "ESCROW_TX_PENDING",
    niche,
    price: specialist.price,
    modelName: specialist.modelName
  });

  // Call Web3: Lock USDC in escrow contract
  const escrowReceipt = await blockchain.requestTaskOnChain(
    specialist.wallet,
    specialist.id,
    specialist.price,
    intent.sub_prompt
  );

  const taskId = escrowReceipt.taskId;

  // 3. Emit ESCROW_LOCKED
  socket.emit("STATUS_UPDATE", {
    status: "ESCROW_LOCKED",
    taskId,
    txHash: escrowReceipt.txHash,
    amount: specialist.price,
    niche
  });

  // 4. Emit EXECUTING_SPECIALIST
  socket.emit("STATUS_UPDATE", { status: "EXECUTING_SPECIALIST", niche });

  // Pass 2: Execute Specialist (Real External Node)
  const specialistResult = await llm.callSpecialistEndpoint(specialist.endpoint, intent.sub_prompt, niche);

  // 5. Emit EVALUATING_RESULT
  socket.emit("STATUS_UPDATE", { status: "EVALUATING_RESULT" });

  // Pass 3: Evaluate output quality
  const evaluation = await llm.evaluateResult(niche, specialistResult);

  if (evaluation === "YES") {
    // 6. Emit SETTLEMENT_TX_PENDING
    socket.emit("STATUS_UPDATE", { status: "SETTLEMENT_TX_PENDING" });

    // Call Web3: Approve task and release funds to specialist
    const settleReceipt = await blockchain.approveTaskOnChain(taskId, specialistResult);
    await taskHistory.appendTask({
      taskId,
      modelId: specialist.id,
      specialistWallet: specialist.wallet,
      niche,
      amount: specialist.price,
      status: 'approved',
      timestamp: Date.now()
    });

    // Fetch updated balances
    const balances = await blockchain.getBalances();

    // 7. Emit FUNDS_RELEASED
    socket.emit("STATUS_UPDATE", {
      status: "FUNDS_RELEASED",
      txHash: settleReceipt.txHash,
      amount: specialist.price,
      niche,
      balances,
      modelId: specialist.id,
      taskId
    });

    return {
      delegate: true,
      niche,
      result: specialistResult,
      text: `Here is the analysis from ${specialist.modelName}:\n\n\`\`\`${niche.toLowerCase()}\n${specialistResult}\n\`\`\`\n\nI verified the ${niche} syntax and approved the payment of ${specialist.price} USDC on-chain.`,
    };
  } else {
    // Branch C: Rejection Path
    socket.emit("STATUS_UPDATE", { status: "SETTLEMENT_TX_PENDING" });

    // Call Web3: Reject task, returning USDC to orchestrator
    const refundReceipt = await blockchain.rejectTaskOnChain(taskId);
    await taskHistory.appendTask({
      taskId,
      modelId: specialist.id,
      specialistWallet: specialist.wallet,
      niche,
      amount: specialist.price,
      status: 'rejected',
      timestamp: Date.now()
    });

    // Fetch updated balances
    const balances = await blockchain.getBalances();

    socket.emit("STATUS_UPDATE", {
      status: "TASK_REJECTED",
      txHash: refundReceipt.txHash,
      balances
    });

    throw new Error(
      `Specialist output failed quality checks. Evaluator returned: NO. Transaction rejected, ${specialist.price} USDC refunded to Orchestrator.`
    );
  }
}
