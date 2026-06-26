import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import * as auth from '../services/auth';
import * as fileUtils from '../services/fileUtils';

vi.mock('../services/auth', () => ({
  requireApiKey: vi.fn((req, res, next) => next())
}));

describe('API Input Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/orchestrate', () => {
    it('should reject requests with missing prompt', async () => {
      const res = await request(app)
        .post('/api/orchestrate')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Prompt must be a non-empty string');
    });

    it('should reject requests with oversized prompt', async () => {
      const res = await request(app)
        .post('/api/orchestrate')
        .send({ prompt: 'A'.repeat(10001) });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Prompt exceeds maximum length of 10000 characters');
    });
  });

  describe('POST /api/registry/register-endpoint', () => {
    it('should reject invalid endpoint URL format', async () => {
      const res = await request(app)
        .post('/api/registry/register-endpoint')
        .send({ modelId: '1', endpointUrl: 'not-a-url' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid endpoint URL format');
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/registry/register-endpoint')
        .send({ modelId: '1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields (providerId and endpointUrl)');
    });
  });

  describe('GET /api/dashboard/:walletAddress', () => {
    it('should reject invalid wallet address formats', async () => {
      const res = await request(app)
        .get('/api/dashboard/0xinvalid')
        .send();
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid wallet address format');
    });
  });

  describe('POST /api/ratings', () => {
    it('should reject score=0', async () => {
      const res = await request(app).post('/api/ratings').send({ modelId: '1', score: 0, niche: 'TEST' });
      expect(res.status).toBe(400);
    });
    it('should reject score=6', async () => {
      const res = await request(app).post('/api/ratings').send({ modelId: '1', score: 6, niche: 'TEST' });
      expect(res.status).toBe(400);
    });
    it('should reject missing niche', async () => {
      const res = await request(app).post('/api/ratings').send({ modelId: '1', score: 5 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/health', () => {
    it('should return 200 ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
