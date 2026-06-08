import { HiveFiConfig, OrchestrationResult, Specialist, StatusEvent, RegistryResponse, BalancesResponse } from './types';
import { SocketManager } from './socket';

export * from './types';

export class HiveFiError extends Error {
  public code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'HiveFiError';
    this.code = code;
  }
}

export interface HiveFiConfigExt extends Pick<HiveFiConfig, 'apiKey' | 'baseUrl' | 'onStatusUpdate'> {
  timeout?: number;
  maxRetries?: number;
}

export class HiveFi {
  private config: Required<Pick<HiveFiConfigExt, 'apiKey' | 'baseUrl'>> & Pick<HiveFiConfigExt, 'onStatusUpdate' | 'timeout' | 'maxRetries'>;

  constructor(config: HiveFiConfigExt) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'http://localhost:3001',
      onStatusUpdate: config.onStatusUpdate,
      timeout: config.timeout || 120000,
      maxRetries: config.maxRetries ?? 2
    };
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchWithRetry(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= (this.config.maxRetries ?? 2); attempt++) {
      try {
        return await this.fetchWithTimeout(url, options, timeoutMs);
      } catch (err: any) {
        lastError = err;
        if (err.name === 'AbortError') throw new HiveFiError('Request timed out', 'TIMEOUT');
        if (attempt < (this.config.maxRetries ?? 2)) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    throw new HiveFiError(lastError?.message || 'Request failed after retries', 'NETWORK_ERROR');
  }

  public async orchestrate(prompt: string): Promise<OrchestrationResult> {
    let socketManager: SocketManager | null = null;
    let socketId: string | undefined = undefined;

    if (this.config.onStatusUpdate) {
      socketManager = new SocketManager(this.config.baseUrl, this.config.onStatusUpdate);
      try {
        socketId = await socketManager.connect();
      } catch (err: any) {
        throw new HiveFiError(`Failed to connect socket: ${err.message}`, 'SOCKET_ERROR');
      }
    }

    try {
      const response = await this.fetchWithRetry(`${this.config.baseUrl}/api/orchestrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey
        },
        body: JSON.stringify({ prompt, socketId })
      }, this.config.timeout!);

      const data = await response.json();

      if (!response.ok) {
        throw new HiveFiError(data.error || 'Orchestration failed', data.code || 'HTTP_ERROR');
      }

      if (!data.success) {
        throw new HiveFiError(data.error || 'Orchestration failed', 'ORCHESTRATION_ERROR');
      }

      return data as OrchestrationResult;
    } catch (error: any) {
      if (error instanceof HiveFiError) throw error;
      throw new HiveFiError(error.message, 'NETWORK_ERROR');
    } finally {
      if (socketManager) {
        socketManager.disconnect();
      }
    }
  }

  public async getSpecialists(niche?: string): Promise<Specialist[]> {
    try {
      const response = await this.fetchWithRetry(`${this.config.baseUrl}/api/registry`, {
        headers: {
          'x-api-key': this.config.apiKey
        }
      }, 30000);

      const data = await response.json();
      if (!response.ok) {
        throw new HiveFiError(data.error || 'Failed to get specialists', data.code || 'HTTP_ERROR');
      }

      let specialists: Specialist[] = data.specialists || [];
      if (niche) {
        const upperNiche = niche.toUpperCase();
        specialists = specialists.filter((s: Specialist) => s.niche.toUpperCase() === upperNiche);
      }
      return specialists;
    } catch (error: any) {
      if (error instanceof HiveFiError) throw error;
      throw new HiveFiError(error.message, 'NETWORK_ERROR');
    }
  }

  public async getRegistry(): Promise<RegistryResponse> {
    try {
      const response = await this.fetchWithRetry(`${this.config.baseUrl}/api/registry`, {
        headers: {
          'x-api-key': this.config.apiKey
        }
      }, 30000);

      const data = await response.json();
      if (!response.ok) {
        throw new HiveFiError(data.error || 'Failed to get registry', data.code || 'HTTP_ERROR');
      }
      return data as RegistryResponse;
    } catch (error: any) {
      if (error instanceof HiveFiError) throw error;
      throw new HiveFiError(error.message, 'NETWORK_ERROR');
    }
  }

  public async getBalances(): Promise<BalancesResponse> {
    try {
      const response = await this.fetchWithRetry(`${this.config.baseUrl}/api/balances`, {
        headers: {
          'x-api-key': this.config.apiKey
        }
      }, 30000);

      const data = await response.json();
      if (!response.ok) {
        throw new HiveFiError(data.error || 'Failed to get balances', data.code || 'HTTP_ERROR');
      }
      return data as BalancesResponse;
    } catch (error: any) {
      if (error instanceof HiveFiError) throw error;
      throw new HiveFiError(error.message, 'NETWORK_ERROR');
    }
  }

  public async submitRating(modelId: string, taskId: string, score: number, niche: string): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${this.config.baseUrl}/api/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey
        },
        body: JSON.stringify({ modelId, taskId, score, niche })
      }, 30000);

      const data = await response.json();
      if (!response.ok) {
        throw new HiveFiError(data.error || 'Failed to submit rating', data.code || 'HTTP_ERROR');
      }
    } catch (error: any) {
      if (error instanceof HiveFiError) throw error;
      throw new HiveFiError(error.message, 'NETWORK_ERROR');
    }
  }
}

export { HiveFi as HiveFiClient };
