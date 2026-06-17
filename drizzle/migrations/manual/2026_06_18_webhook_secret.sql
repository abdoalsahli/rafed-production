-- Add dedicated webhook signing secret to distributor_api_credentials.
-- This column holds a cryptographically random secret independent of the API key,
-- fixing C-2: previously secretHash (a SHA-256 of the API key) was used as the
-- HMAC secret, allowing anyone who knew the API secret to forge webhook signatures.
ALTER TABLE `distributor_api_credentials`
  ADD COLUMN `webhook_secret` VARCHAR(128) NULL AFTER `secret_hash`;
