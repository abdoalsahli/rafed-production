/**
 * Validate PIN encryption key format
 * Must be a 32-byte hex string (64 hex characters)
 */
function validatePINEncryptionKey(key: string | undefined): string {
  if (!key) {
    throw new Error(
      'PIN_ENCRYPTION_KEY environment variable is required. ' +
      'Generate a 32-byte hex key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Check if it's a valid hex string
  if (!/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error(
      'PIN_ENCRYPTION_KEY must be a valid hex string (0-9, a-f, A-F only)'
    );
  }

  // Check if it's exactly 64 characters (32 bytes in hex)
  if (key.length !== 64) {
    throw new Error(
      `PIN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got ${key.length} characters.`
    );
  }

  return key;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  pinEncryptionKey: validatePINEncryptionKey(process.env.PIN_ENCRYPTION_KEY),
  enableDemoLogin: process.env.ENABLE_DEMO_LOGIN === "true",
};
