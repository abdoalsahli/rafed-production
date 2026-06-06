/**
 * Startup Validation Module
 * 
 * Validates critical environment variables and configuration at application startup.
 * Fails fast if required configuration is missing or invalid.
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate PIN_ENCRYPTION_KEY format and presence
 */
function validatePINEncryptionKey(): { valid: boolean; errors: string[] } {
  // Import the strict validator
  const { validatePINEncryptionKey: strictValidate } = require('./pin-key-validator');
  const result = strictValidate();
  
  if (!result.valid) {
    return { valid: false, errors: [result.error] };
  }
  
  return { valid: true, errors: [] };
}

/**
 * Validate DATABASE_URL presence
 */
function validateDatabaseUrl(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const url = process.env.DATABASE_URL;

  if (!url) {
    errors.push(
      '❌ DATABASE_URL is not set.\n' +
      '   This environment variable is REQUIRED for database connectivity.'
    );
    return { valid: false, errors };
  }

  if (!url.includes('mysql') && !url.includes('postgresql')) {
    errors.push(
      '⚠️  DATABASE_URL does not appear to be a valid database connection string.\n' +
      '   Expected format: mysql://user:password@host:port/database'
    );
  }

  return { valid: true, errors: [] };
}

/**
 * Validate JWT_SECRET presence
 */
function validateJWTSecret(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    errors.push(
      '❌ JWT_SECRET is not set.\n' +
      '   This environment variable is REQUIRED for session management.'
    );
    return { valid: false, errors };
  }

  if (secret.length < 32) {
    errors.push(
      '⚠️  JWT_SECRET is too short.\n' +
      `   Current length: ${secret.length} characters.\n` +
      '   Recommended: at least 32 characters for security.'
    );
  }

  return { valid: true, errors: [] };
}

/**
 * Run all startup validations
 */
export function validateStartupConfiguration(): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  console.log('\n🔍 Running startup configuration validation...\n');

  // Validate PIN encryption key
  const pinKeyValidation = validatePINEncryptionKey();
  if (!pinKeyValidation.valid) {
    allErrors.push(...pinKeyValidation.errors);
  } else {
    console.log('✅ PIN_ENCRYPTION_KEY is properly configured');
  }

  // Validate database URL
  const dbValidation = validateDatabaseUrl();
  if (!dbValidation.valid) {
    allErrors.push(...dbValidation.errors);
  } else {
    console.log('✅ DATABASE_URL is properly configured');
  }

  // Validate JWT secret
  const jwtValidation = validateJWTSecret();
  if (!jwtValidation.valid) {
    allErrors.push(...jwtValidation.errors);
  } else {
    console.log('✅ JWT_SECRET is properly configured');
  }

  console.log('');

  const valid = allErrors.length === 0;

  if (!valid) {
    console.error('❌ STARTUP VALIDATION FAILED\n');
    console.error('Configuration errors:\n');
    allErrors.forEach((error) => console.error(error + '\n'));
    console.error('\n⛔ Application cannot start without fixing these errors.\n');
  } else {
    console.log('✅ All startup validations passed!\n');
  }

  return {
    valid,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Assert that startup validation passes
 * Throws an error if validation fails
 */
export function assertStartupConfigurationValid(): void {
  const result = validateStartupConfiguration();

  if (!result.valid) {
    throw new Error(
      'Startup validation failed. See errors above. ' +
      'Application cannot start without proper configuration.'
    );
  }
}
