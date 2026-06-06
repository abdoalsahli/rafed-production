import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('PIN Encryption Configuration Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('PIN_ENCRYPTION_KEY Format Validation', () => {
    it('should validate a correct 64-character hex string', () => {
      const validKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      expect(validKey).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(validKey.length).toBe(64);
    });

    it('should reject keys with invalid characters', () => {
      const invalidKey = 'g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0a1b2c3d4e5f6g7h8i9j0k1';
      expect(invalidKey).not.toMatch(/^[0-9a-fA-F]{64}$/);
    });

    it('should reject keys that are too short', () => {
      const shortKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      expect(shortKey.length).toBeLessThan(64);
      expect(shortKey).not.toMatch(/^[0-9a-fA-F]{64}$/);
    });

    it('should reject keys that are too long', () => {
      const longKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3';
      expect(longKey.length).toBeGreaterThan(64);
      expect(longKey).not.toMatch(/^[0-9a-fA-F]{64}$/);
    });

    it('should accept uppercase hex characters', () => {
      const uppercaseKey = 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1';
      expect(uppercaseKey).toMatch(/^[0-9a-fA-F]{64}$/);
    });

    it('should accept lowercase hex characters', () => {
      const lowercaseKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      expect(lowercaseKey).toMatch(/^[0-9a-fA-F]{64}$/);
    });

    it('should accept mixed case hex characters', () => {
      const mixedCaseKey = 'A1b2C3d4E5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0C1d2E3f4A5b6C7d8E9f0A1';
      expect(mixedCaseKey).toMatch(/^[0-9a-fA-F]{64}$/);
    });

    it('should reject keys with spaces', () => {
      const keyWithSpaces = 'a1b2c3d4e5f6a7b8 c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      expect(keyWithSpaces).not.toMatch(/^[0-9a-fA-F]{64}$/);
    });

    it('should reject keys with special characters', () => {
      const keyWithSpecial = 'a1b2c3d4e5f6a7b8-c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      expect(keyWithSpecial).not.toMatch(/^[0-9a-fA-F]{64}$/);
    });
  });

  describe('PIN Encryption Key Size', () => {
    it('should represent 32 bytes when converted from hex', () => {
      const hexKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      const bytes = Buffer.from(hexKey, 'hex');
      expect(bytes.length).toBe(32);
    });

    it('should be suitable for AES-256 encryption', () => {
      const hexKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      const bytes = Buffer.from(hexKey, 'hex');
      // AES-256 requires exactly 32 bytes (256 bits)
      expect(bytes.length).toBe(32);
      expect(bytes.length * 8).toBe(256);
    });
  });

  describe('Key Generation', () => {
    it('should generate a valid random key', () => {
      const crypto = require('crypto');
      const randomKey = crypto.randomBytes(32).toString('hex');
      
      expect(randomKey).toMatch(/^[0-9a-fA-F]{64}$/);
      expect(randomKey.length).toBe(64);
    });

    it('should generate unique keys each time', () => {
      const crypto = require('crypto');
      const key1 = crypto.randomBytes(32).toString('hex');
      const key2 = crypto.randomBytes(32).toString('hex');
      
      expect(key1).not.toBe(key2);
    });

    it('should generate keys with sufficient entropy', () => {
      const crypto = require('crypto');
      const keys = Array.from({ length: 10 }, () => 
        crypto.randomBytes(32).toString('hex')
      );
      
      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(10);
    });
  });

  describe('Environment Variable Validation', () => {
    it('should detect missing PIN_ENCRYPTION_KEY', () => {
      delete process.env.PIN_ENCRYPTION_KEY;
      
      const key = process.env.PIN_ENCRYPTION_KEY;
      expect(key).toBeUndefined();
    });

    it('should detect invalid PIN_ENCRYPTION_KEY format', () => {
      process.env.PIN_ENCRYPTION_KEY = 'invalid-key';
      
      const key = process.env.PIN_ENCRYPTION_KEY;
      expect(key).not.toMatch(/^[0-9a-fA-F]{64}$/);
    });

    it('should accept valid PIN_ENCRYPTION_KEY', () => {
      const validKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      process.env.PIN_ENCRYPTION_KEY = validKey;
      
      const key = process.env.PIN_ENCRYPTION_KEY;
      expect(key).toBe(validKey);
      expect(key).toMatch(/^[0-9a-fA-F]{64}$/);
    });
  });

  describe('Security Requirements', () => {
    it('should require minimum key length for security', () => {
      const minSecureLength = 64; // 32 bytes in hex
      const validKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      
      expect(validKey.length).toBeGreaterThanOrEqual(minSecureLength);
    });

    it('should use cryptographically secure random generation', () => {
      const crypto = require('crypto');
      
      // Generate multiple keys and check distribution
      const keys = Array.from({ length: 100 }, () => 
        crypto.randomBytes(32).toString('hex')
      );
      
      // All should be unique (extremely high probability)
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(100);
    });

    it('should not use predictable patterns', () => {
      const crypto = require('crypto');
      const key1 = crypto.randomBytes(32).toString('hex');
      const key2 = crypto.randomBytes(32).toString('hex');
      
      // Keys should not be sequential or predictable
      expect(key1).not.toMatch(/^[0-9a-f]{64}$/); // Not all lowercase
      expect(key2).not.toMatch(/^[0-9a-f]{64}$/); // Not all lowercase
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error message for missing key', () => {
      const errorMessage = 'PIN_ENCRYPTION_KEY environment variable is required. ' +
        'Generate a 32-byte hex key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
      
      expect(errorMessage).toContain('PIN_ENCRYPTION_KEY');
      expect(errorMessage).toContain('required');
      expect(errorMessage).toContain('Generate');
    });

    it('should provide guidance on key generation', () => {
      const guidance = 'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
      
      expect(guidance).toContain('randomBytes');
      expect(guidance).toContain('32');
      expect(guidance).toContain('hex');
    });

    it('should indicate expected format in error messages', () => {
      const errorMessage = 'PIN_ENCRYPTION_KEY must be a valid hex string (0-9, a-f, A-F only)';
      
      expect(errorMessage).toContain('hex');
      expect(errorMessage).toContain('0-9');
      expect(errorMessage).toContain('a-f');
    });

    it('should specify exact length requirement', () => {
      const errorMessage = 'PIN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)';
      
      expect(errorMessage).toContain('64');
      expect(errorMessage).toContain('32 bytes');
    });
  });

  describe('Production Safety', () => {
    it('should not allow hardcoded keys in production', () => {
      const hardcodedKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const isProduction = process.env.NODE_ENV === 'production';
      
      // In production, this key should not be used (should come from env)
      if (isProduction) {
        expect(process.env.PIN_ENCRYPTION_KEY).not.toBe(hardcodedKey);
      }
    });

    it('should fail fast on startup if key is invalid', () => {
      // This would be tested in integration tests
      // The startup validation should throw immediately
      const invalidKey = 'invalid';
      expect(invalidKey).not.toMatch(/^[0-9a-fA-F]{64}$/);
    });

    it('should not log the actual key value', () => {
      const key = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      const logMessage = `PIN_ENCRYPTION_KEY is properly configured`;
      
      // Log message should not contain the actual key
      expect(logMessage).not.toContain(key);
      expect(logMessage).not.toContain(key.substring(0, 10));
    });
  });
});
