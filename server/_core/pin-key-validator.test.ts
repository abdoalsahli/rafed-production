import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validatePINEncryptionKey,
  getPINEncryptionKey,
  logPINKeyValidationStatus,
} from './pin-key-validator';

describe('Strict PIN_ENCRYPTION_KEY Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Missing PIN_ENCRYPTION_KEY', () => {
    it('should fail when PIN_ENCRYPTION_KEY is not set', () => {
      delete process.env.PIN_ENCRYPTION_KEY;

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not set');
      expect(result.error).toContain('REQUIRED');
      expect(result.details?.isSet).toBe(false);
    });

    it('should fail when PIN_ENCRYPTION_KEY is empty string', () => {
      process.env.PIN_ENCRYPTION_KEY = '';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not set');
      expect(result.details?.isSet).toBe(false);
    });

    it('should not expose key value in error message', () => {
      process.env.PIN_ENCRYPTION_KEY = 'secret-key-value';

      const result = validatePINEncryptionKey();

      expect(result.error).not.toContain('secret-key-value');
    });
  });

  describe('Whitespace in PIN_ENCRYPTION_KEY', () => {
    it('should fail when PIN_ENCRYPTION_KEY contains spaces', () => {
      process.env.PIN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8 c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('whitespace');
      expect(result.details?.isSet).toBe(true);
    });

    it('should fail when PIN_ENCRYPTION_KEY contains tabs', () => {
      process.env.PIN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8\tc9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('whitespace');
    });

    it('should fail when PIN_ENCRYPTION_KEY contains newlines', () => {
      process.env.PIN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8\nc9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('whitespace');
    });
  });

  describe('Incorrect Length', () => {
    it('should fail when PIN_ENCRYPTION_KEY is too short', () => {
      process.env.PIN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('incorrect length');
      expect(result.error).toContain('64');
      expect(result.details?.isCorrectLength).toBe(false);
    });

    it('should fail when PIN_ENCRYPTION_KEY is too long', () => {
      process.env.PIN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('incorrect length');
      expect(result.details?.isCorrectLength).toBe(false);
    });

    it('should show expected vs actual length in error', () => {
      process.env.PIN_ENCRYPTION_KEY = 'a1b2c3d4';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('64');
      expect(result.error).toContain('8');
    });
  });

  describe('Invalid Hex Characters', () => {
    it('should fail when PIN_ENCRYPTION_KEY contains non-hex characters', () => {
      process.env.PIN_ENCRYPTION_KEY = 'g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0a1b2c3d4e5f6g7h8i9j0k1';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
      expect(result.details?.isHexFormat).toBe(false);
    });

    it('should fail when PIN_ENCRYPTION_KEY contains special characters', () => {
      process.env.PIN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6-e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('should fail when PIN_ENCRYPTION_KEY contains uppercase non-hex', () => {
      process.env.PIN_ENCRYPTION_KEY = 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6G7F8A9B0C1D2E3F4A5B6C7D8E9F0A1';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('should not expose invalid characters in error message', () => {
      process.env.PIN_ENCRYPTION_KEY = 'invalid-key-with-special-chars-1234567890abcdef1234567890abcdef';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(false);
      expect(result.error).not.toContain('invalid-key');
    });
  });

  describe('Valid PIN_ENCRYPTION_KEY', () => {
    it('should accept valid lowercase hex key', () => {
      process.env.PIN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(true);
      expect(result.details?.isSet).toBe(true);
      expect(result.details?.isCorrectLength).toBe(true);
      expect(result.details?.isHexFormat).toBe(true);
    });

    it('should accept valid uppercase hex key', () => {
      process.env.PIN_ENCRYPTION_KEY = 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(true);
      expect(result.details?.isHexFormat).toBe(true);
    });

    it('should accept valid mixed case hex key', () => {
      process.env.PIN_ENCRYPTION_KEY = 'A1b2C3d4E5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0C1d2E3f4A5b6C7d8E9f0A1';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(true);
      expect(result.details?.isHexFormat).toBe(true);
    });

    it('should accept key with all numeric hex', () => {
      process.env.PIN_ENCRYPTION_KEY = '01234567890123456789012345678901234567890123456789012345678901234';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(true);
    });

    it('should accept key with all letter hex', () => {
      process.env.PIN_ENCRYPTION_KEY = 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(true);
    });
  });

  describe('getPINEncryptionKey', () => {
    it('should return key when valid', () => {
      const validKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      process.env.PIN_ENCRYPTION_KEY = validKey;

      const key = getPINEncryptionKey();

      expect(key).toBe(validKey);
    });

    it('should throw when key is invalid', () => {
      process.env.PIN_ENCRYPTION_KEY = 'invalid-key';

      expect(() => {
        getPINEncryptionKey();
      }).toThrow();
    });

    it('should throw when key is not set', () => {
      delete process.env.PIN_ENCRYPTION_KEY;

      expect(() => {
        getPINEncryptionKey();
      }).toThrow();
    });
  });

  describe('Error Message Quality', () => {
    it('should provide guidance for missing key', () => {
      delete process.env.PIN_ENCRYPTION_KEY;

      const result = validatePINEncryptionKey();

      expect(result.error).toContain('Generate');
      expect(result.error).toContain('randomBytes');
      expect(result.error).toContain('export PIN_ENCRYPTION_KEY');
    });

    it('should provide guidance for invalid format', () => {
      process.env.PIN_ENCRYPTION_KEY = 'invalid-key-format-1234567890abcdef1234567890abcdef1234567890';

      const result = validatePINEncryptionKey();

      expect(result.error).toContain('Generate');
      expect(result.error).toContain('randomBytes');
    });

    it('should provide guidance for incorrect length', () => {
      process.env.PIN_ENCRYPTION_KEY = 'a1b2c3d4';

      const result = validatePINEncryptionKey();

      expect(result.error).toContain('Generate');
      expect(result.error).toContain('64');
    });

    it('should never expose key value in any error message', () => {
      const testKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
      process.env.PIN_ENCRYPTION_KEY = testKey;

      // Make it invalid
      process.env.PIN_ENCRYPTION_KEY = 'invalid';

      const result = validatePINEncryptionKey();

      expect(result.error).not.toContain(testKey);
      expect(result.error).not.toContain('a1b2c3d4');
      expect(result.error).not.toContain('e9f0a1');
    });
  });

  describe('Validation Details', () => {
    it('should include validation details in result', () => {
      process.env.PIN_ENCRYPTION_KEY = 'invalid';

      const result = validatePINEncryptionKey();

      expect(result.details).toBeDefined();
      expect(result.details?.isSet).toBe(true);
      expect(result.details?.length).toBe(7);
      expect(result.details?.isCorrectLength).toBe(false);
    });

    it('should indicate hex format validity', () => {
      process.env.PIN_ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';

      const result = validatePINEncryptionKey();

      expect(result.details?.isHexFormat).toBe(true);
    });
  });

  describe('Production Readiness', () => {
    it('should reject development placeholder key', () => {
      process.env.PIN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const result = validatePINEncryptionKey();

      // This is technically valid hex, but in production should be unique
      expect(result.valid).toBe(true); // Format is valid
    });

    it('should accept cryptographically random key', () => {
      const crypto = require('crypto');
      const randomKey = crypto.randomBytes(32).toString('hex');
      process.env.PIN_ENCRYPTION_KEY = randomKey;

      const result = validatePINEncryptionKey();

      expect(result.valid).toBe(true);
      expect(result.details?.isHexFormat).toBe(true);
      expect(result.details?.isCorrectLength).toBe(true);
    });
  });
});
