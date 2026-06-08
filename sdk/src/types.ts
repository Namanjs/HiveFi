export interface HiveFiConfig {
  apiKey: string;
  baseUrl?: string;
  onStatusUpdate?: (event: StatusEvent) => void;
}

export interface StatusEvent {
  status: string;
  niche?: string;
  taskId?: string;
  txHash?: string;
  amount?: string;
  isMock?: boolean;
}

export interface OrchestrationResult {
  success: boolean;
  text: string;
  delegate: boolean;
  niche?: string;
  result?: string;
  totalCost?: string;
  error?: string;
}

export interface Specialist {
  id: string;
  name: string;
  niche: string;
  pricePerQuery: string;
  wallet: string;
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
