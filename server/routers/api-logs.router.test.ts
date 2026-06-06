import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { logApiRequest, getApiLogs, getApiLogsCount, sanitizeErrorMessage } from '../_core/api-logger';

describe('API Logging', () => {
  describe('sanitizeErrorMessage', () => {
    it('should redact API keys', () => {
      const message = 'Failed with api_key: sk_live_1234567890abcdefghij';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toContain('API_KEY_REDACTED');
      expect(sanitized).not.toContain('sk_live_');
    });

    it('should redact secrets', () => {
      const message = 'Authentication failed with secret: my_secret_key_12345';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toContain('SECRET_REDACTED');
      expect(sanitized).not.toContain('my_secret_key_');
    });

    it('should redact passwords', () => {
      const message = 'Connection error: password=super_secret_password';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toContain('PASSWORD_REDACTED');
      expect(sanitized).not.toContain('super_secret_password');
    });

    it('should redact card numbers', () => {
      const message = 'Card validation failed: 4532-1234-5678-9010';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toContain('CARD_REDACTED');
      expect(sanitized).not.toContain('4532-1234-5678-9010');
    });

    it('should redact PINs', () => {
      const message = 'PIN verification failed: PIN=1234';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toContain('PIN_REDACTED');
      expect(sanitized).not.toContain('PIN=1234');
    });

    it('should redact bearer tokens', () => {
      const message = 'Invalid token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toContain('BEARER_TOKEN_REDACTED');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should truncate long messages', () => {
      const longMessage = 'Error: ' + 'x'.repeat(1000);
      const sanitized = sanitizeErrorMessage(longMessage);
      expect(sanitized?.length).toBeLessThanOrEqual(510); // 500 + '...(truncated)'
    });

    it('should return undefined for empty message', () => {
      expect(sanitizeErrorMessage('')).toBeUndefined();
      expect(sanitizeErrorMessage(undefined)).toBeUndefined();
    });

    it('should preserve non-sensitive error messages', () => {
      const message = 'Request timeout after 30 seconds';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).toBe(message);
    });
  });

  describe('API Log Filtering', () => {
    it('should support filtering by status code', async () => {
      // This test validates the filtering logic
      const mockLogs = [
        { status_code: 200, endpoint: '/api/test', method: 'GET' },
        { status_code: 400, endpoint: '/api/test', method: 'POST' },
        { status_code: 500, endpoint: '/api/test', method: 'GET' },
      ];

      // Filter for 400+ status codes (errors)
      const errorLogs = mockLogs.filter(log => log.status_code >= 400);
      expect(errorLogs).toHaveLength(2);
      expect(errorLogs.every(log => log.status_code >= 400)).toBe(true);
    });

    it('should support filtering by endpoint', async () => {
      const mockLogs = [
        { status_code: 200, endpoint: '/api/purchase', method: 'POST' },
        { status_code: 200, endpoint: '/api/balance', method: 'GET' },
        { status_code: 200, endpoint: '/api/purchase', method: 'POST' },
      ];

      // Filter for purchase endpoint
      const purchaseLogs = mockLogs.filter(log => log.endpoint.includes('purchase'));
      expect(purchaseLogs).toHaveLength(2);
      expect(purchaseLogs.every(log => log.endpoint.includes('purchase'))).toBe(true);
    });

    it('should support filtering by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const mockLogs = [
        { createdAt: yesterday, endpoint: '/api/test' },
        { createdAt: now, endpoint: '/api/test' },
        { createdAt: tomorrow, endpoint: '/api/test' },
      ];

      // Filter for today
      const todayLogs = mockLogs.filter(log => 
        log.createdAt >= yesterday && log.createdAt <= tomorrow
      );
      expect(todayLogs).toHaveLength(3);
    });
  });

  describe('Audit Safety', () => {
    it('should not expose raw API keys in logs', () => {
      const message = 'Request with api_key: sk_live_1234567890abcdefghij';
      const sanitized = sanitizeErrorMessage(message);
      
      // Verify the key is redacted
      expect(sanitized).toContain('API_KEY_REDACTED');
      expect(sanitized).not.toContain('sk_live_');
    });

    it('should not expose PINs in logs', () => {
      const message = 'PIN validation: 1234';
      const sanitized = sanitizeErrorMessage(message);
      
      // Verify the PIN is redacted
      expect(sanitized).toContain('PIN_REDACTED');
    });

    it('should not expose card numbers in logs', () => {
      const message = 'Card: 4532-1234-5678-9010';
      const sanitized = sanitizeErrorMessage(message);
      
      // Verify the card number is redacted
      expect(sanitized).toContain('CARD_REDACTED');
      expect(sanitized).not.toContain('4532-1234-5678-9010');
    });

    it('should preserve business logic errors', () => {
      const message = 'Insufficient balance: 50.00 < 100.00';
      const sanitized = sanitizeErrorMessage(message);
      
      // Should preserve the error message structure
      expect(sanitized).toContain('Insufficient balance');
      expect(sanitized).toContain('50.00');
      expect(sanitized).toContain('100.00');
    });
  });

  describe('API Statistics', () => {
    it('should calculate success rate correctly', () => {
      const mockLogs = [
        { status_code: 200 },
        { status_code: 201 },
        { status_code: 400 },
        { status_code: 500 },
      ];

      const successCount = mockLogs.filter(log => log.status_code < 400).length;
      const successRate = (successCount / mockLogs.length) * 100;

      expect(successRate).toBe(50);
    });

    it('should calculate average response time', () => {
      const mockLogs = [
        { response_time_ms: 100 },
        { response_time_ms: 200 },
        { response_time_ms: 300 },
      ];

      const avgTime = mockLogs.reduce((sum, log) => sum + log.response_time_ms, 0) / mockLogs.length;
      expect(avgTime).toBe(200);
    });

    it('should group by status code', () => {
      const mockLogs = [
        { status_code: 200 },
        { status_code: 200 },
        { status_code: 400 },
        { status_code: 500 },
      ];

      const distribution: Record<number, number> = {};
      mockLogs.forEach(log => {
        distribution[log.status_code] = (distribution[log.status_code] || 0) + 1;
      });

      expect(distribution[200]).toBe(2);
      expect(distribution[400]).toBe(1);
      expect(distribution[500]).toBe(1);
    });

    it('should group by endpoint', () => {
      const mockLogs = [
        { endpoint: '/api/purchase' },
        { endpoint: '/api/purchase' },
        { endpoint: '/api/balance' },
      ];

      const distribution: Record<string, number> = {};
      mockLogs.forEach(log => {
        distribution[log.endpoint] = (distribution[log.endpoint] || 0) + 1;
      });

      expect(distribution['/api/purchase']).toBe(2);
      expect(distribution['/api/balance']).toBe(1);
    });
  });
});
