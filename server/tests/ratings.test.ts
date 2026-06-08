import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as ratings from '../services/ratings';
import * as fileUtils from '../services/fileUtils';

vi.mock('../services/fileUtils', () => ({
  readJSON: vi.fn(),
  atomicWriteJSON: vi.fn()
}));

describe("Ratings Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should calculate running average correctly without race conditions", async () => {
    const mockState = {
      'model-1': { totalRatings: 1, totalScore: 4, averageScore: 4, history: [] }
    };
    (fileUtils.readJSON as any).mockResolvedValue(mockState);

    await ratings.submitRating('model-1', 'task-1', 5, 'SQL');

    expect(fileUtils.atomicWriteJSON).toHaveBeenCalled();
    const saveCall = (fileUtils.atomicWriteJSON as any).mock.calls[0][1];
    
    expect(saveCall['model-1'].totalRatings).toBe(2);
    expect(saveCall['model-1'].totalScore).toBe(9);
    expect(saveCall['model-1'].averageScore).toBe(4.5);
  });

  it("should reject invalid scores", async () => {
    await expect(ratings.submitRating('model-1', 'task-1', 6, 'SQL')).rejects.toThrow();
    await expect(ratings.submitRating('model-1', 'task-1', 0, 'SQL')).rejects.toThrow();
  });
});
