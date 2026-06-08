import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireApiKey } from '../services/auth';
import * as fileUtils from '../services/fileUtils';

vi.mock('../services/fileUtils', () => ({
  readJSON: vi.fn()
}));

describe('Auth Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { headers: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it('should reject if x-api-key is missing', async () => {
    req.headers['x-api-key'] = undefined;
    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or missing API key', code: 'UNAUTHORIZED' });
  });

  it('should pass with a valid active key', async () => {
    req.headers['x-api-key'] = 'valid-key';
    (fileUtils.readJSON as any).mockResolvedValue({
      'valid-key': { isActive: true }
    });
    await requireApiKey(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject with a revoked key', async () => {
    req.headers['x-api-key'] = 'revoked-key';
    (fileUtils.readJSON as any).mockResolvedValue({
      'revoked-key': { isActive: false }
    });
    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or missing API key', code: 'UNAUTHORIZED' });
  });

  it('should reject with an unknown key', async () => {
    req.headers['x-api-key'] = 'unknown-key';
    (fileUtils.readJSON as any).mockResolvedValue({
      'valid-key': { isActive: true }
    });
    await requireApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or missing API key', code: 'UNAUTHORIZED' });
  });
});
