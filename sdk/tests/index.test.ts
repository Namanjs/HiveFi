import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HiveFi, HiveFiError, HiveFiClient } from '../src/index';

const MOCK_API_URL = 'http://localhost:8080';
const MOCK_API_KEY = 'test-key';

describe('HiveFi SDK', () => {
  let hiveFi: HiveFi;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    hiveFi = new HiveFi({
      apiKey: MOCK_API_KEY,
      baseUrl: MOCK_API_URL,
      timeout: 100,
      maxRetries: 1
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export HiveFiClient as alias of HiveFi', () => {
    expect(HiveFiClient).toBe(HiveFi);
  });

  describe('orchestrate', () => {
    it('should send correct headers', async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({ success: true, taskId: '123' }) };
      (global.fetch as any).mockResolvedValue(mockResponse);

      await hiveFi.orchestrate('test prompt');

      expect(global.fetch).toHaveBeenCalledWith(
        `${MOCK_API_URL}/api/orchestrate`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': MOCK_API_KEY
          },
          body: JSON.stringify({ prompt: 'test prompt' })
        })
      );
    });

    it('should throw TIMEOUT error when fetch is delayed', async () => {
      (global.fetch as any).mockImplementation((url: string, options: any) => new Promise((resolve, reject) => {
        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            const err = new Error('The user aborted a request.');
            err.name = 'AbortError';
            reject(err);
          });
        }
        setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({}) }), 200);
      }));

      await expect(hiveFi.orchestrate('timeout test')).rejects.toThrowError(
        new HiveFiError('Request timed out', 'TIMEOUT')
      );
    });

    it('should retry on network failure the correct number of times', async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({ success: true }) };
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse);

      await hiveFi.orchestrate('retry test');

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSpecialists', () => {
    it('should filter by niche correctly', async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({ success: true, models: [] }) };
      (global.fetch as any).mockResolvedValue(mockResponse);

      await hiveFi.getSpecialists('DEFI');

      expect(global.fetch).toHaveBeenCalledWith(
        `${MOCK_API_URL}/api/registry`,
        expect.any(Object)
      );
    });
  });

  describe('getRegistry', () => {
    it('should call the registry endpoint correctly', async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({ success: true, specialists: [] }) };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const res = await hiveFi.getRegistry();

      expect(res).toEqual({ success: true, specialists: [] });
      expect(global.fetch).toHaveBeenCalledWith(
        `${MOCK_API_URL}/api/registry`,
        expect.objectContaining({
          headers: {
            'x-api-key': MOCK_API_KEY
          }
        })
      );
    });
  });

  describe('getBalances', () => {
    it('should call the balances endpoint correctly', async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({ success: true, orchestratorBalance: '10', specialistBalances: {} }) };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const res = await hiveFi.getBalances();

      expect(res).toEqual({ success: true, orchestratorBalance: '10', specialistBalances: {} });
      expect(global.fetch).toHaveBeenCalledWith(
        `${MOCK_API_URL}/api/balances`,
        expect.objectContaining({
          headers: {
            'x-api-key': MOCK_API_KEY
          }
        })
      );
    });
  });

  describe('submitRating', () => {
    it('should send correct payload shape', async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({ success: true }) };
      (global.fetch as any).mockResolvedValue(mockResponse);

      await hiveFi.submitRating('model-1', 'task-1', 5, 'DEFI');

      expect(global.fetch).toHaveBeenCalledWith(
        `${MOCK_API_URL}/api/ratings`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            modelId: 'model-1',
            taskId: 'task-1',
            score: 5,
            niche: 'DEFI'
          })
        })
      );
    });
  });
});
