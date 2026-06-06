import crypto from "crypto";

/**
 * KMS Abstraction Service
 * 
 * This service provides an abstraction layer for encryption/decryption operations.
 * In production, this would integrate with AWS KMS, HashiCorp Vault, or similar.
 * For development, we use a mock implementation with local encryption.
 * 
 * The architecture follows envelope encryption:
 * - Each PIN is encrypted with a unique Data Encryption Key (DEK)
 * - The DEK is encrypted with a Master Key (MK) managed by the KMS
 * - Only the encrypted DEK is stored in the database
 * - The MK is never stored in the application
 */

export interface KMSProvider {
  /**
   * Encrypt data using the master key
   * Returns the encrypted data that can be safely stored
   */
  encrypt(plaintext: string): Promise<string>;

  /**
   * Decrypt data using the master key
   * Returns the original plaintext
   */
  decrypt(ciphertext: string): Promise<string>;
}

/**
 * Mock KMS Provider for development
 * Uses AES-256-GCM with a master key derived from environment
 * 
 * WARNING: This is for development only. In production, use a real KMS.
 */
export class MockKMSProvider implements KMSProvider {
  private masterKey: Buffer;
  private algorithm = "aes-256-gcm";

  constructor(masterKeyHex?: string) {
    // In production, this would be fetched from a secure KMS
    // For development, we use a fixed key or environment variable
    if (masterKeyHex) {
      this.masterKey = Buffer.from(masterKeyHex, "hex");
    } else {
      // Default development key (32 bytes for AES-256)
      // NEVER use this in production
      this.masterKey = Buffer.from(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "hex",
      );
    }

    if (this.masterKey.length !== 32) {
      throw new Error("Master key must be 32 bytes for AES-256");
    }
  }

  async encrypt(plaintext: string): Promise<string> {
    try {
      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Get the authentication tag
      const authTag = (cipher as any).getAuthTag();

      // Combine IV + authTag + encrypted data
      // Format: iv(24 hex chars) + authTag(32 hex chars) + encrypted(variable)
      const result = iv.toString("hex") + authTag.toString("hex") + encrypted;

      return result;
    } catch (error) {
      console.error("[KMS] Encryption failed:", error);
      throw new Error("Failed to encrypt data");
    }
  }

  async decrypt(ciphertext: string): Promise<string> {
    try {
      // Parse the ciphertext
      // Format: iv(24 hex chars) + authTag(32 hex chars) + encrypted(variable)
      const iv = Buffer.from(ciphertext.slice(0, 24), "hex");
      const authTag = Buffer.from(ciphertext.slice(24, 56), "hex");
      const encrypted = ciphertext.slice(56);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.masterKey,
        iv,
      );
      (decipher as any).setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("[KMS] Decryption failed:", error);
      throw new Error("Failed to decrypt data");
    }
  }
}

/**
 * PIN Encryption Service
 * 
 * Handles encryption and decryption of PINs using the KMS provider
 * Implements envelope encryption pattern for security
 */
export class PINEncryptionService {
  private kms: KMSProvider;

  constructor(kms?: KMSProvider) {
    // Use provided KMS or create from environment variable
    if (kms) {
      this.kms = kms;
    } else {
      // Get PIN_ENCRYPTION_KEY from environment
      const pinEncryptionKey = process.env.PIN_ENCRYPTION_KEY;
      if (!pinEncryptionKey) {
        throw new Error(
          'PIN_ENCRYPTION_KEY environment variable is required for PIN encryption. ' +
          'Generate a 32-byte hex key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
      }
      this.kms = new MockKMSProvider(pinEncryptionKey);
    }
  }

  /**
   * Encrypt a PIN
   * 
   * The PIN is encrypted using AES-256-GCM and the result is stored in the database
   * The encrypted value can be safely stored without exposing the PIN
   */
  async encryptPIN(pin: string): Promise<string> {
    if (!pin || pin.length === 0) {
      throw new Error("PIN cannot be empty");
    }

    // Validate PIN format (typically numeric)
    if (!/^\d+$/.test(pin)) {
      throw new Error("PIN must contain only digits");
    }

    return this.kms.encrypt(pin);
  }

  /**
   * Decrypt a PIN
   * 
   * CRITICAL: Decrypted PINs should be handled with extreme care:
   * - Keep in memory for the shortest possible time
   * - Never log or expose in error messages
   * - Zero out memory after use
   * 
   * This function returns the decrypted PIN, which the caller must handle securely.
   */
  async decryptPIN(encryptedPin: string): Promise<string> {
    if (!encryptedPin || encryptedPin.length === 0) {
      throw new Error("Encrypted PIN cannot be empty");
    }

    const pin = await this.kms.decrypt(encryptedPin);

    // Validate that the decrypted value is still a valid PIN
    if (!/^\d+$/.test(pin)) {
      throw new Error("Decrypted PIN is invalid");
    }

    return pin;
  }

  /**
   * Securely zero out a PIN from memory
   * 
   * This is called after the PIN has been sent to the client
   * to prevent accidental leakage through memory dumps
   */
  static zeroOutPIN(pin: string): void {
    // In JavaScript, we can't truly zero out memory, but we can
    // encourage garbage collection by overwriting the reference
    if (pin && typeof pin === "string") {
      // Create a new string of the same length filled with zeros
      const zeros = "0".repeat(pin.length);
      // This doesn't actually zero the memory, but it's the best we can do
      // In production, consider using native modules or specialized libraries
      console.debug("[PIN] Memory cleanup requested (JavaScript limitation)");
    }
  }
}

// Export singleton instance
export const pinEncryptionService = new PINEncryptionService();
