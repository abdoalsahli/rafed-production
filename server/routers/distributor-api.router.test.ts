import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as dbModule from '../db';

// Mock before importing the router
vi.mock('../db', () => ({
  getDb: vi.fn(),
}));

import { distributorApiRouter } from './distributor-api.router';

describe('Distributor API Router', () => {
  let mockDb: any;
  const mockGetDb = dbModule.getDb as any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({ insertId: 1 }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };
    mockGetDb.mockResolvedValue(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCredentials', () => {
    it('should return null when no active credentials exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      
      const caller = distributorApiRouter.createCaller({
        user: { id: 1, openId: 'test', role: 'user' },
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.getCredentials();
      expect(result).toBeNull();
    });

    it('should return credentials when they exist', async () => {
      const mockCredentials = {
        id: 1,
        keyId: 'sk_live_abc123',
        maskedKey: 'sk_live_xyz',
        webhookUrl: 'https://example.com/webhook',
        lastUsedAt: null,
        createdAt: new Date(),
        status: 'active',
      };

      mockDb.limit.mockResolvedValueOnce([mockCredentials]);
      
      const caller = distributorApiRouter.createCaller({
        user: { id: 1, openId: 'test', role: 'user' },
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.getCredentials();
      expect(result).toEqual(mockCredentials);
    });
  });

  describe('generateApiKey', () => {
    it('should throw error if credentials already exist', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: 1 }]);
      
      const caller = distributorApiRouter.createCaller({
        user: { id: 1, openId: 'test', role: 'user' },
        req: {} as any,
        res: {} as any,
      });

      await expect(caller.generateApiKey()).rejects.toThrow(
        'Active API credentials already exist'
      );
    });

    it('should generate new API key when none exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      
      const caller = distributorApiRouter.createCaller({
        user: { id: 1, openId: 'test', role: 'user' },
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.generateApiKey();
      
      expect(result).toHaveProperty('keyId');
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('maskedKey');
      expect(result.keyId).toMatch(/^sk_live_/);
      expect(result.maskedKey).toMatch(/^sk_live_/);
      expect(result.message).toContain('API key generated successfully');
    });
  });

  describe('rotateApiKey', () => {
    it('should throw error if no active credentials exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      
      const caller = distributorApiRouter.createCaller({
        user: { id: 1, openId: 'test', role: 'user' },
        req: {} as any,
        res: {} as any,
      });

      await expect(caller.rotateApiKey()).rejects.toThrow(
        'No active API credentials found'
      );
    });

    it('should rotate existing API key', async () => {
      const oldCredentials = {
        id: 1,
        keyId: 'sk_live_old',
        maskedKey: 'sk_live_old_masked',
        status: 'active',
      };

      mockDb.limit.mockResolvedValueOnce([oldCredentials]);
      
      const caller = distributorApiRouter.createCaller({
        user: { id: 1, openId: 'test', role: 'user' },
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.rotateApiKey();
      
      expect(result).toHaveProperty('keyId');
      expect(result).toHaveProperty('secret');
      expect(result.message).toContain('API key rotated successfully');
      expect(result.keyId).not.toBe(oldCredentials.keyId);
    });
  });

  describe('updateWebhookUrl', () => {
    it('should throw error if no active credentials exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      
      const caller = distributorApiRouter.createCaller({
        user: { id: 1, openId: 'test', role: 'user' },
        req: {} as any,
        res: {} as any,
      });

      await expect(
        caller.updateWebhookUrl({ webhookUrl: 'https://example.com/webhook' })
      ).rejects.toThrow('No active API credentials found');
    });

    it('should update webhook URL', async () => {
      const credentials = {
        id: 1,
        keyId: 'sk_live_abc',
        maskedKey: 'sk_live_xyz',
        webhookUrl: 'https://old.example.com/webhook',
      };

      mockDb.limit.mockResolvedValueOnce([credentials]);
      
      const caller = distributorApiRouter.createCaller({
        user: { id: 1, openId: 'test', role: 'user' },
        req: {} as any,
        res: {} as any,
      });

      const newUrl = 'https://new.example.com/webhook';
      const result = await caller.updateWebhookUrl({ webhookUrl: newUrl });
      
      expect(result.success).toBe(true);
      expect(result.webhookUrl).toBe(newUrl);
      expect(result.message).toContain('Webhook URL updated successfully');
    });
  });

  describe('getApiLogs', () => {
    it('should return empty array when no credentials exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      
      const caller = distributorApiRouter.createCaller({
        user: { id: 1, openId: 'test', role: 'user' },
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.getApiLogs({ limit: 10 });
      expect(result).toEqual([]);
    });

    it('should return empty array for now (logs not yet implemented)', async () => {
      const credentials = {
        id: 1,
        keyId: 'sk_live_abc',
      };

      mockDb.limit.mockResolvedValueOnce([credentials]);
      
      const caller = distributorApiRouter.createCaller({
        user: { id: 1, openId: 'test', role: 'user' },
        req: {} as any,
        res: {} as any,
      });

      const result = await caller.getApiLogs({ limit: 10 });
      expect(result).toEqual([]);
    });
  });
});
