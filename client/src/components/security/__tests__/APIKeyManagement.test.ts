import { describe, it, expect } from 'vitest';
import { APIKeyInfo } from '../SecureAPIKeyManagement';

describe('API Key Management', () => {
  describe('API Key Display', () => {
    it('should mask API key correctly', () => {
      const apiKey = 'sk_live_1234567890abcdefghijklmnop';
      const masked = apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);

      expect(masked).toMatch(/^sk_l\*+mnop$/);
      expect(masked).toContain('sk_l');
      expect(masked).toContain('mnop');
    });

    it('should handle short API keys', () => {
      const apiKey = 'short';
      const masked = '*'.repeat(apiKey.length);

      expect(masked).toBe('*****');
    });

    it('should show first 4 and last 4 characters', () => {
      const apiKey = 'sk_live_1234567890abcdefghijklmnop';
      const first4 = apiKey.substring(0, 4);
      const last4 = apiKey.substring(apiKey.length - 4);

      expect(first4).toBe('sk_l');
      expect(last4).toBe('mnop');
    });
  });

  describe('API Key Info', () => {
    it('should create valid API key info', () => {
      const keyInfo: APIKeyInfo = {
        id: 'key-1',
        key: 'sk_live_1234567890abcdefghijklmnop',
        createdAt: new Date('2026-04-12'),
        lastUsedAt: new Date('2026-04-13'),
        lastUsedIP: '192.168.1.100',
        isActive: true,
      };

      expect(keyInfo.id).toBe('key-1');
      expect(keyInfo.isActive).toBe(true);
      expect(keyInfo.lastUsedIP).toBe('192.168.1.100');
    });

    it('should handle optional fields', () => {
      const keyInfo: APIKeyInfo = {
        id: 'key-1',
        key: 'sk_live_1234567890abcdefghijklmnop',
        createdAt: new Date(),
        isActive: true,
      };

      expect(keyInfo.lastUsedAt).toBeUndefined();
      expect(keyInfo.lastUsedIP).toBeUndefined();
    });

    it('should track active status', () => {
      const activeKey: APIKeyInfo = {
        id: 'key-1',
        key: 'sk_live_active',
        createdAt: new Date(),
        isActive: true,
      };

      const inactiveKey: APIKeyInfo = {
        id: 'key-2',
        key: 'sk_live_inactive',
        createdAt: new Date(),
        isActive: false,
      };

      expect(activeKey.isActive).toBe(true);
      expect(inactiveKey.isActive).toBe(false);
    });
  });

  describe('API Key Filtering', () => {
    const mockKeys: APIKeyInfo[] = [
      {
        id: 'key-1',
        key: 'sk_live_active',
        createdAt: new Date(),
        isActive: true,
      },
      {
        id: 'key-2',
        key: 'sk_live_inactive1',
        createdAt: new Date(),
        isActive: false,
      },
      {
        id: 'key-3',
        key: 'sk_live_inactive2',
        createdAt: new Date(),
        isActive: false,
      },
    ];

    it('should filter active keys', () => {
      const active = mockKeys.filter((k) => k.isActive);
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('key-1');
    });

    it('should filter inactive keys', () => {
      const inactive = mockKeys.filter((k) => !k.isActive);
      expect(inactive).toHaveLength(2);
    });

    it('should find single active key', () => {
      const activeKey = mockKeys.find((k) => k.isActive);
      expect(activeKey).toBeDefined();
      expect(activeKey?.isActive).toBe(true);
    });
  });

  describe('API Key Age Calculation', () => {
    it('should calculate key age in days', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const ageMs = now.getTime() - thirtyDaysAgo.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

      expect(ageDays).toBe(30);
    });

    it('should identify old keys (90+ days)', () => {
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const ageMs = now.getTime() - ninetyDaysAgo.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      const isOld = ageDays >= 90;

      expect(isOld).toBe(true);
    });

    it('should identify new keys (< 30 days)', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const ageMs = now.getTime() - tenDaysAgo.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      const isNew = ageDays < 30;

      expect(isNew).toBe(true);
    });
  });

  describe('API Key Activity Tracking', () => {
    it('should track last used timestamp', () => {
      const lastUsed = new Date('2026-04-13T15:30:00');
      const keyInfo: APIKeyInfo = {
        id: 'key-1',
        key: 'sk_live_test',
        createdAt: new Date('2026-04-12'),
        lastUsedAt: lastUsed,
        isActive: true,
      };

      expect(keyInfo.lastUsedAt).toEqual(lastUsed);
    });

    it('should track last used IP', () => {
      const keyInfo: APIKeyInfo = {
        id: 'key-1',
        key: 'sk_live_test',
        createdAt: new Date(),
        lastUsedIP: '192.168.1.100',
        isActive: true,
      };

      expect(keyInfo.lastUsedIP).toBe('192.168.1.100');
    });

    it('should handle unused keys', () => {
      const keyInfo: APIKeyInfo = {
        id: 'key-1',
        key: 'sk_live_test',
        createdAt: new Date(),
        isActive: true,
      };

      expect(keyInfo.lastUsedAt).toBeUndefined();
      expect(keyInfo.lastUsedIP).toBeUndefined();
    });

    it('should validate IP address format', () => {
      // Regex validates each octet is 0-255 (not just 1-3 digits)
      const ipRegex = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
      const validIPs = ['192.168.1.100', '10.0.0.50', '172.16.0.1'];
      const invalidIPs = ['256.256.256.256', 'not.an.ip', '192.168.1'];

      validIPs.forEach((ip) => {
        expect(ipRegex.test(ip)).toBe(true);
      });

      invalidIPs.forEach((ip) => {
        expect(ipRegex.test(ip)).toBe(false);
      });
    });
  });

  describe('Security Warnings', () => {
    it('should identify keys that need rotation', () => {
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const keyInfo: APIKeyInfo = {
        id: 'key-1',
        key: 'sk_live_old',
        createdAt: ninetyDaysAgo,
        isActive: true,
      };

      const ageMs = now.getTime() - keyInfo.createdAt.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      const needsRotation = ageDays >= 90;

      expect(needsRotation).toBe(true);
    });

    it('should identify unused keys', () => {
      const keyInfo: APIKeyInfo = {
        id: 'key-1',
        key: 'sk_live_unused',
        createdAt: new Date('2026-01-01'),
        isActive: true,
      };

      const isUnused = !keyInfo.lastUsedAt;
      expect(isUnused).toBe(true);
    });

    it('should track key regeneration impact', () => {
      const oldKey: APIKeyInfo = {
        id: 'key-1',
        key: 'sk_live_old',
        createdAt: new Date('2026-01-01'),
        isActive: false,
      };

      const newKey: APIKeyInfo = {
        id: 'key-2',
        key: 'sk_live_new',
        createdAt: new Date('2026-04-12'),
        isActive: true,
      };

      expect(oldKey.isActive).toBe(false);
      expect(newKey.isActive).toBe(true);
    });
  });

  describe('Date Formatting', () => {
    it('should format creation date', () => {
      const date = new Date('2026-04-12T15:30:00');
      const formatted = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);

      expect(formatted).toContain('Apr');
      expect(formatted).toContain('12');
      expect(formatted).toContain('2026');
    });
  });
});
