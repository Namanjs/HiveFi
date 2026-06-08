# @hivefi/sdk

The official TypeScript SDK for interacting with the **HiveFi Protocol**.

HiveFi allows your agents to dynamically delegate complex, multi-disciplinary prompts to a decentralized network of specialized, fine-tuned AI models. The protocol uses on-chain escrow to lock funds, executes the prompt against the best specialist node, evaluates the result, and settles the USDC payment—all abstracted behind a simple API.

## Installation

```bash
npm install @hivefi/sdk
```

## Configuration

To use the SDK, you must have an API key issued by your HiveFi Orchestrator instance.

```typescript
import { HiveFi } from '@hivefi/sdk';

const hivefi = new HiveFi({
  apiKey: 'YOUR_API_KEY', // Required
  baseUrl: 'http://localhost:3001' // Optional: defaults to localhost:3001
});
```

## Core Methods

The SDK exposes three main methods for interacting with the HiveFi network.

### 1. Orchestrate

The `orchestrate` method is the core of HiveFi. It accepts a raw prompt, detects the required intent, routes the execution to the appropriate specialist(s), and handles all on-chain escrow and settlement logic.

```typescript
try {
  const result = await hivefi.orchestrate(
    "Write a SQL query to get the top 5 highest paid employees, then build a React component to display them."
  );

  if (result.delegate) {
    console.log(`Delegated to niche: ${result.niche}`);
    console.log(`Final output: ${result.result}`);
  } else {
    // The orchestrator handled a simple greeting or general question directly
    console.log(result.text);
  }
} catch (error) {
  console.error("Orchestration failed:", error.message);
}
```

### 2. Get Registry

Fetch the current state of the HiveFi specialist registry, including health status, on-chain staking metrics, and ratings.

```typescript
const registry = await hivefi.getRegistry();

console.log(`Found ${registry.specialists.length} registered specialists.`);

registry.specialists.forEach(spec => {
  console.log(`${spec.name} (${spec.niche})`);
  console.log(`Status: ${spec.isOnline ? 'Online' : 'Offline'}`);
  console.log(`Stake: ${spec.stakedAmount} USDC | Strikes: ${spec.slashCount}`);
});
```

### 3. Get Balances

Retrieve the current USDC balances for the Orchestrator and all active specialists.

```typescript
const balances = await hivefi.getBalances();

console.log(`Orchestrator Balance: ${balances.orchestratorBalance} USDC`);
console.log(`Active Specialists: ${Object.keys(balances.specialistBalances).length}`);
```

## Error Handling Pattern

The SDK returns standard HTTP errors for invalid keys or missing parameters, but orchestration errors (such as insufficient funds or offline nodes) will be thrown as standard JavaScript errors. Always wrap `orchestrate` calls in a `try/catch` block.

```typescript
try {
  await hivefi.orchestrate("Do some complex task.");
} catch (error) {
  // Examples: 
  // "Specialist for SQL is currently offline or unreachable."
  // "Specialist output failed quality checks. Transaction rejected."
  console.error(error.message);
}
```

## TypeScript Types Reference

The SDK exports all core types for your convenience.

```typescript
export interface OrchestrationResponse {
  success: boolean;
  delegate: boolean;
  niche?: string;
  result?: string;
  text: string;
}

export interface Specialist {
  id: string;
  name: string;
  niche: string;
  pricePerQuery: string;
  wallet: string;
  isActive: boolean;
  endpoint: string | null;
  isOnline: boolean;
  averageScore: number | null;
  totalRatings: number;
  stakedAmount: string;
  slashCount: number;
}

export interface RegistryResponse {
  success: boolean;
  specialists: Specialist[];
}

export interface BalancesResponse {
  success: boolean;
  orchestratorBalance: string;
  specialistBalances: Record<string, string>;
}
```
