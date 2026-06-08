import { orchestrate } from '../services/orchestrator';
import * as registry from '../services/registry';
import * as llm from '../services/llm';
import * as blockchain from '../services/blockchain';
import * as taskHistory from '../services/taskHistory';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

vi.mock('../services/registry');
vi.mock('../services/llm');
vi.mock('../services/blockchain');
vi.mock('../services/taskHistory');

describe('Orchestrator Integration Tests', () => {
  let mockSocket: any;
  let statusUpdates: any[];

  beforeEach(() => {
    vi.resetAllMocks();
    statusUpdates = [];
    mockSocket = {
      emit: vi.fn((event, data) => {
        if (event === 'STATUS_UPDATE') {
          statusUpdates.push(data.status);
        }
      })
    };
  });

  it('should successfully orchestrate a full delegation flow', async () => {
    // 1. Mock intent detection
    vi.mocked(llm.detectIntent).mockResolvedValue({
      delegate: true,
      chain: undefined,
      niche: 'PYTHON',
      sub_prompt: 'Write a python script',
      text: undefined
    });

    // 2. Mock specialist registry
    vi.mocked(registry.getSpecialistByNiche).mockResolvedValue({
      id: '1',
      wallet: '0xabc',
      price: '5.0',
      endpoint: 'http://test',
      modelName: 'Test Python Model',
      stakedAmount: '10',
      slashCount: 0
    });

    // 3. Mock health check
    vi.mocked(llm.checkSpecialistHealth).mockResolvedValue(true);

    // 4. Mock escrow transaction
    vi.mocked(blockchain.requestTaskOnChain).mockResolvedValue({
      taskId: '123',
      txHash: '0x123'
    });

    // 5. Mock specialist execution
    vi.mocked(llm.callSpecialistEndpoint).mockResolvedValue('print("hello")');

    // 6. Mock evaluation
    vi.mocked(llm.evaluateResult).mockResolvedValue('YES');

    // 7. Mock settlement and task history
    vi.mocked(blockchain.approveTaskOnChain).mockResolvedValue({
      txHash: '0x456'
    });
    vi.mocked(blockchain.getBalances).mockResolvedValue({
      orchestrator: '100',
      specialists: { 'PYTHON': '5' }
    });
    vi.mocked(taskHistory.appendTask).mockResolvedValue(undefined);

    const result = await orchestrate('Write a python script', mockSocket);

    expect(result.delegate).toBe(true);
    expect(result.niche).toBe('PYTHON');
    expect(result.result).toBe('print("hello")');

    // Verify expected event flow
    expect(statusUpdates).toEqual([
      'ANALYZING_INTENT',
      'ESCROW_TX_PENDING',
      'ESCROW_LOCKED',
      'EXECUTING_SPECIALIST',
      'EVALUATING_RESULT',
      'SETTLEMENT_TX_PENDING',
      'FUNDS_RELEASED'
    ]);

    expect(blockchain.requestTaskOnChain).toHaveBeenCalledWith('0xabc', '1', '5.0', 'Write a python script');
    expect(blockchain.approveTaskOnChain).toHaveBeenCalledWith('123', 'print("hello")');
    expect(taskHistory.appendTask).toHaveBeenCalled();
  });

  it('should handle reject on poor quality evaluation', async () => {
    vi.mocked(llm.detectIntent).mockResolvedValue({
      delegate: true,
      chain: undefined,
      niche: 'SQL',
      sub_prompt: 'Query users',
      text: undefined
    });

    vi.mocked(registry.getSpecialistByNiche).mockResolvedValue({
      id: '2',
      wallet: '0xdef',
      price: '2.0',
      endpoint: 'http://test-sql',
      modelName: 'Bad SQL Model',
      stakedAmount: '10',
      slashCount: 0
    });

    vi.mocked(llm.checkSpecialistHealth).mockResolvedValue(true);
    vi.mocked(blockchain.requestTaskOnChain).mockResolvedValue({ taskId: '124', txHash: '0xabc' });
    vi.mocked(llm.callSpecialistEndpoint).mockResolvedValue('SELECT * FROM');
    vi.mocked(llm.evaluateResult).mockResolvedValue('NO');
    vi.mocked(blockchain.rejectTaskOnChain).mockResolvedValue({ txHash: '0xdef' });
    vi.mocked(blockchain.getBalances).mockResolvedValue({ orchestrator: '100', specialists: {} });

    await expect(orchestrate('Query users', mockSocket)).rejects.toThrow(/Specialist output failed quality checks/);

    expect(statusUpdates).toEqual([
      'ANALYZING_INTENT',
      'ESCROW_TX_PENDING',
      'ESCROW_LOCKED',
      'EXECUTING_SPECIALIST',
      'EVALUATING_RESULT',
      'SETTLEMENT_TX_PENDING',
      'TASK_REJECTED'
    ]);

    expect(blockchain.rejectTaskOnChain).toHaveBeenCalledWith('124');
    expect(taskHistory.appendTask).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected' }));
  });
  
  it('should return direct response without delegating', async () => {
    vi.mocked(llm.detectIntent).mockResolvedValue({
      delegate: false,
      chain: undefined,
      niche: undefined,
      sub_prompt: undefined,
      text: 'I can help with that directly'
    });

    const result = await orchestrate('Hello', mockSocket);

    expect(result.delegate).toBe(false);
    expect(result.text).toBe('I can help with that directly');
    expect(statusUpdates).toEqual([
      'ANALYZING_INTENT',
      'DIRECT_RESPONSE'
    ]);
  });
});
