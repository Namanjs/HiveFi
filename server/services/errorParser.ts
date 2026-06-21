export function parseHiveFiError(error: any): string {
  if (!error) return "System Error: An unexpected architecture error occurred.";
  
  const msg = error.message || error.reason || error.toString();
  
  // Blockchain Errors
  if (msg.includes("insufficient allowance")) {
    return "Transaction Failed: You must approve USDC spending in your wallet settings.";
  }
  if (msg.includes("transfer amount exceeds balance")) {
    return "Transaction Failed: Your wallet has insufficient USDC balance.";
  }
  if (msg.includes("Provider inactive")) {
    return "Execution Failed: The selected AI specialist is currently inactive.";
  }
  if (msg.includes("Provider under-staked")) {
    return "Execution Failed: The specialist does not have enough staked USDC.";
  }
  if (msg.includes("Price exceeds cap")) {
    return "Execution Failed: Your max budget is lower than the specialist's required fee.";
  }
  if (msg.includes("Invalid provider signature")) {
    return "Verification Failed: The specialist returned an invalid cryptographic signature.";
  }
  
  // Orchestrator Errors
  if (msg.includes("No specialist for niche") || msg.includes("No registered specialized AI found for niche")) {
    return "Orchestration Failed: No active specialists found for this niche within your budget.";
  }
  if (msg.includes("offline or unreachable")) {
    return "Connection Failed: The specialist for this task is offline or unreachable.";
  }
  if (msg.includes("Wallet not connected")) {
    return "Authentication Error: Please connect your Web3 wallet to authorize payments.";
  }
  
  // Specialist Errors
  if (msg.includes("Escrow verification failed") || msg.includes("Payment Required")) {
    return "Escrow Verification Failed: Specialist rejected the task because funds were not locked on-chain.";
  }
  if (msg.includes("ECONNREFUSED") || msg.includes("timeout") || msg.includes("fetch failed")) {
    return "AI Execution Failed: The underlying LLM provider timed out or returned an error.";
  }
  
  // Return cleaned original message if it's already a custom HiveFi error, otherwise generic
  if (msg.includes("execution reverted") || msg.includes("0x")) {
    return "System Error: An unexpected architecture error occurred. Escrow funds (if any) will expire and return to you.";
  }

  return msg;
}
