/**
 * Strict PIN Encryption Key Validator
 * 
 * Enforces production-grade validation for PIN_ENCRYPTION_KEY.
 * Fails fast with clear error messages if validation fails.
 * Never exposes the actual key value in error messages.
 */

export interface PINKeyValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    isSet: boolean;
    length?: number;
    isHexFormat?: boolean;
    isCorrectLength?: boolean;
  };
}

/**
 * Validate PIN_ENCRYPTION_KEY with strict requirements
 * 
 * Requirements:
 * 1. Must be set (not undefined or empty)
 * 2. Must be exactly 64 hex characters (32 bytes)
 * 3. Must only contain hex characters (0-9, a-f, A-F)
 * 4. No spaces, newlines, or other whitespace
 * 5. No special characters
 */
export function validatePINEncryptionKey(): PINKeyValidationResult {
  const key = process.env.PIN_ENCRYPTION_KEY;
  const details: PINKeyValidationResult['details'] = {
    isSet: !!key,
  };

  // Check 1: Key must be set
  if (!key) {
    return {
      valid: false,
      error:
        'PIN_ENCRYPTION_KEY environment variable is not set.\n' +
        'This is a REQUIRED variable for production deployment.\n' +
        '\n' +
        'To fix this:\n' +
        '1. Generate a new 32-byte hex key:\n' +
        '   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
        '2. Set the environment variable:\n' +
        '   export PIN_ENCRYPTION_KEY=<generated-key>\n' +
        '3. Restart the application',
      details,
    };
  }

  // Check 2: Key must not contain whitespace
  if (/\s/.test(key)) {
    return {
      valid: false,
      error:
        'PIN_ENCRYPTION_KEY contains whitespace characters (spaces, tabs, newlines).\n' +
        'The key must be a continuous hex string without any whitespace.\n' +
        '\n' +
        'To fix this:\n' +
        '1. Generate a new key without whitespace:\n' +
        '   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
        '2. Ensure no whitespace when setting the environment variable\n' +
        '3. Restart the application',
      details: { ...details, length: key.length },
    };
  }

  // Check 3: Key must be exactly 64 characters
  details.length = key.length;
  if (key.length !== 64) {
    const expectedBytes = 32;
    const actualBytes = Math.floor(key.length / 2);
    return {
      valid: false,
      error:
        `PIN_ENCRYPTION_KEY has incorrect length.\n` +
        `Expected: 64 hex characters (${expectedBytes} bytes)\n` +
        `Received: ${key.length} characters (${actualBytes} bytes)\n` +
        '\n' +
        'To fix this:\n' +
        '1. Generate a new 32-byte hex key:\n' +
        '   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
        '2. Set the environment variable with the correct key\n' +
        '3. Restart the application',
      details: { ...details, isCorrectLength: false },
    };
  }

  // Check 4: Key must be valid hex format
  details.isCorrectLength = true;
  const hexRegex = /^[0-9a-fA-F]{64}$/;
  if (!hexRegex.test(key)) {
    // Determine what's wrong
    const isHexFormat = /^[0-9a-fA-F]+$/.test(key);
    details.isHexFormat = isHexFormat;

    if (!isHexFormat) {
      return {
        valid: false,
        error:
          'PIN_ENCRYPTION_KEY contains invalid characters.\n' +
          'The key must only contain hexadecimal characters (0-9, a-f, A-F).\n' +
          'No special characters, spaces, or other characters are allowed.\n' +
          '\n' +
          'To fix this:\n' +
          '1. Generate a new valid hex key:\n' +
          '   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
          '2. Set the environment variable with the valid key\n' +
          '3. Restart the application',
        details,
      };
    }
  }

  details.isHexFormat = true;

  // All checks passed
  return {
    valid: true,
    details,
  };
}

/**
 * Assert PIN_ENCRYPTION_KEY is valid
 * Throws an error immediately if validation fails
 * 
 * This is called at application startup to fail fast
 */
export function assertPINEncryptionKeyValid(): void {
  const result = validatePINEncryptionKey();

  if (!result.valid) {
    const errorMessage =
      '\n' +
      '═══════════════════════════════════════════════════════════════\n' +
      '❌ STARTUP FAILED: PIN_ENCRYPTION_KEY VALIDATION ERROR\n' +
      '═══════════════════════════════════════════════════════════════\n' +
      '\n' +
      result.error +
      '\n' +
      '═══════════════════════════════════════════════════════════════\n' +
      'For more information, see ENVIRONMENT_SETUP.md\n' +
      '═══════════════════════════════════════════════════════════════\n';

    console.error(errorMessage);
    process.exit(1);
  }
}

/**
 * Get PIN_ENCRYPTION_KEY with validation
 * Returns the key if valid, throws if invalid
 */
export function getPINEncryptionKey(): string {
  const result = validatePINEncryptionKey();

  if (!result.valid) {
    throw new Error(
      'PIN_ENCRYPTION_KEY validation failed. ' +
      'See startup error messages for details.'
    );
  }

  const key = process.env.PIN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('PIN_ENCRYPTION_KEY is not set');
  }

  return key;
}

/**
 * Log validation status without exposing key value
 */
export function logPINKeyValidationStatus(): void {
  const result = validatePINEncryptionKey();

  if (result.valid) {
    console.log('✅ PIN_ENCRYPTION_KEY is properly configured');
  } else {
    console.error('❌ PIN_ENCRYPTION_KEY validation failed');
    if (result.details) {
      console.error(`   - Is set: ${result.details.isSet}`);
      if (result.details.length !== undefined) {
        console.error(`   - Length: ${result.details.length} (expected 64)`);
      }
      if (result.details.isHexFormat !== undefined) {
        console.error(`   - Valid hex format: ${result.details.isHexFormat}`);
      }
    }
  }
}
