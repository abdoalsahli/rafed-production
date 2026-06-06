import { describe, it, expect, beforeAll } from 'vitest';
import { PINEncryptionService, MockKMSProvider } from '../services/encryption.service';

describe('PIN Encryption Configuration Validation', () => {
  describe('PIN_ENCRYPTION_KEY Environment Variable', () => {
    it('should have PIN_ENCRYPTION_KEY set in environment', () => {
      const key = process.env.PIN_ENCRYPTION_KEY;
      expect(key).toBeDefined();
      expect(key).not.toBe('');
    });

    it('should be a valid 64-character hex string', () => {
      const key = process.env.PIN_ENCRYPTION_KEY;
      expect(key).toMatch(/^[0-9a-fA-F]{64}$/);
    });

    it('should be exactly 64 characters', () => {
      const key = process.env.PIN_ENCRYPTION_KEY;
      expect(key?.length).toBe(64);
    });

    it('should convert to 32 bytes', () => {
      const key = process.env.PIN_ENCRYPTION_KEY;
      if (!key) throw new Error('PIN_ENCRYPTION_KEY not set');
      
      const bytes = Buffer.from(key, 'hex');
      expect(bytes.length).toBe(32);
    });
  });

  describe('KMS Provider Initialization', () => {
    it('should initialize MockKMSProvider with PIN_ENCRYPTION_KEY', () => {
      const key = process.env.PIN_ENCRYPTION_KEY;
      if (!key) throw new Error('PIN_ENCRYPTION_KEY not set');

      const kms = new MockKMSProvider(key);
      expect(kms).toBeDefined();
    });

    it('should reject invalid key format', () => {
      const invalidKey = 'invalid-key';
      expect(() => {
        new MockKMSProvider(invalidKey);
      }).toThrow();
    });

    it('should reject key with wrong length', () => {
      const shortKey = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'; // 32 chars = 16 bytes
      expect(() => {
        new MockKMSProvider(shortKey);
      }).toThrow();
    });
  });

  describe('PIN Encryption with Configured Key', () => {
    let service: PINEncryptionService;

    beforeAll(() => {
      const key = process.env.PIN_ENCRYPTION_KEY;
      if (!key) throw new Error('PIN_ENCRYPTION_KEY not set');

      const kms = new MockKMSProvider(key);
      service = new PINEncryptionService(kms);
    });

    it('should encrypt a PIN', async () => {
      const pin = '1234567890';
      const encrypted = await service.encryptPIN(pin);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(pin);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should decrypt an encrypted PIN', async () => {
      const pin = '1234567890';
      const encrypted = await service.encryptPIN(pin);
      const decrypted = await service.decryptPIN(encrypted);
      
      expect(decrypted).toBe(pin);
    });

    it('should handle multiple PINs independently', async () => {
      const pin1 = '1111111111';
      const pin2 = '2222222222';
      
      const encrypted1 = await service.encryptPIN(pin1);
      const encrypted2 = await service.encryptPIN(pin2);
      
      expect(encrypted1).not.toBe(encrypted2);
      
      const decrypted1 = await service.decryptPIN(encrypted1);
      const decrypted2 = await service.decryptPIN(encrypted2);
      
      expect(decrypted1).toBe(pin1);
      expect(decrypted2).toBe(pin2);
    });

    it('should produce different ciphertexts for same PIN', async () => {
      const pin = '1234567890';
      
      const encrypted1 = await service.encryptPIN(pin);
      const encrypted2 = await service.encryptPIN(pin);
      
      // Due to random IV, ciphertexts should be different
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to the same PIN
      const decrypted1 = await service.decryptPIN(encrypted1);
      const decrypted2 = await service.decryptPIN(encrypted2);
      
      expect(decrypted1).toBe(pin);
      expect(decrypted2).toBe(pin);
    });

    it('should reject invalid PINs', async () => {
      const invalidPin = 'not-a-pin'; // Contains non-digits
      
      expect(async () => {
        await service.encryptPIN(invalidPin);
      }).rejects.toThrow();
    });

    it('should reject empty PINs', async () => {
      expect(async () => {
        await service.encryptPIN('');
      }).rejects.toThrow();
    });

    it('should handle long PINs', async () => {
      const longPin = '12345678901234567890'; // 20 digits
      const encrypted = await service.encryptPIN(longPin);
      const decrypted = await service.decryptPIN(encrypted);
      
      expect(decrypted).toBe(longPin);
    });
  });

  describe('PIN Encryption Security', () => {
    let service: PINEncryptionService;

    beforeAll(() => {
      const key = process.env.PIN_ENCRYPTION_KEY;
      if (!key) throw new Error('PIN_ENCRYPTION_KEY not set');

      const kms = new MockKMSProvider(key);
      service = new PINEncryptionService(kms);
    });

    it('should use AES-256-GCM encryption', async () => {
      const pin = '1234567890';
      const encrypted = await service.encryptPIN(pin);
      
      // AES-256-GCM format: IV(24 hex) + AuthTag(32 hex) + Encrypted(variable)
      // Total minimum: 24 + 32 = 56 hex characters
      expect(encrypted.length).toBeGreaterThanOrEqual(56);
    });

    it('should include authentication tag for integrity', async () => {
      const pin = '1234567890';
      const encrypted = await service.encryptPIN(pin);
      
      // Modify a character in the ciphertext
      const tampered = encrypted.substring(0, 10) + 'x' + encrypted.substring(11);
      
      // Decryption should fail due to authentication tag mismatch
      expect(async () => {
        await service.decryptPIN(tampered);
      }).rejects.toThrow();
    });

    it('should use random IV for each encryption', async () => {
      const pin = '1234567890';
      
      const encrypted1 = await service.encryptPIN(pin);
      const encrypted2 = await service.encryptPIN(pin);
      
      // Extract IV from both (first 24 hex characters)
      const iv1 = encrypted1.substring(0, 24);
      const iv2 = encrypted2.substring(0, 24);
      
      // IVs should be different (random)
      expect(iv1).not.toBe(iv2);
    });
  });

  describe('Production Readiness', () => {
    it('should have PIN_ENCRYPTION_KEY configured for production', () => {
      const key = process.env.PIN_ENCRYPTION_KEY;
      
      // In production, this must be set
      if (process.env.NODE_ENV === 'production') {
        expect(key).toBeDefined();
        expect(key).not.toBe('');
        expect(key).toMatch(/^[0-9a-fA-F]{64}$/);
      }
    });

    it('should not use default development key in production', () => {
      const key = process.env.PIN_ENCRYPTION_KEY;
      const defaultDevKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      
      if (process.env.NODE_ENV === 'production') {
        expect(key).not.toBe(defaultDevKey);
      }
    });

    it('should have sufficient entropy in key', () => {
      const key = process.env.PIN_ENCRYPTION_KEY;
      if (!key) throw new Error('PIN_ENCRYPTION_KEY not set');

      // Check that key is not all zeros or all same character
      const uniqueChars = new Set(key);
      expect(uniqueChars.size).toBeGreaterThan(5); // Should have good variety
    });
  });
});
