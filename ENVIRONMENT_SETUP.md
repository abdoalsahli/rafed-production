# Environment Configuration Guide

This document describes all required environment variables for the Prepaid Card Platform, with emphasis on production-safe PIN encryption configuration.

## Critical Security Variables

### PIN_ENCRYPTION_KEY (REQUIRED)

**Purpose:** Master encryption key for all card PINs stored in the database.

**Format:** 32-byte hexadecimal string (64 hex characters)

**Example:**
```
PIN_ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

**How to Generate:**

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Validation Rules:**
- ✅ Must be exactly 64 characters long
- ✅ Must contain only hexadecimal characters (0-9, a-f, A-F)
- ✅ Must be set before application startup
- ❌ Cannot be empty or missing
- ❌ Cannot contain special characters or spaces
- ❌ Cannot contain whitespace (tabs, newlines)

**Security Considerations:**
- Store in a secure secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate periodically (recommended: every 90 days)
- Never commit to version control
- Never share or expose in logs
- Use different keys for development, staging, and production
- Back up securely for disaster recovery

**Startup Validation (STRICT - FAIL FAST):**

The application implements strict validation and **will exit immediately** (exit code 1) at startup if PIN_ENCRYPTION_KEY is invalid. No partial startup or degraded mode is allowed.

The application fails if PIN_ENCRYPTION_KEY:
- ❌ Is not set (missing entirely)
- ❌ Contains whitespace (spaces, tabs, newlines)
- ❌ Is not exactly 64 characters long
- ❌ Contains non-hexadecimal characters
- ❌ Is not a valid hex string

**Startup Error Example:**
```
═══════════════════════════════════════════════════════════════
❌ STARTUP FAILED: PIN_ENCRYPTION_KEY VALIDATION ERROR
═══════════════════════════════════════════════════════════════

PIN_ENCRYPTION_KEY environment variable is not set.
This is a REQUIRED variable for production deployment.

To fix this:
1. Generate a new 32-byte hex key:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
2. Set the environment variable:
   export PIN_ENCRYPTION_KEY=<generated-key>
3. Restart the application
═══════════════════════════════════════════════════════════════
```

**Key Points:**
- Error messages never expose the actual key value
- Clear guidance provided for each validation failure
- Application exits with code 1 on validation failure
- See ENVIRONMENT_SETUP.md for detailed troubleshooting

---

## Database Configuration

### DATABASE_URL (REQUIRED)

**Purpose:** Connection string for the MySQL/TiDB database.

**Format:** `mysql://user:password@host:port/database`

**Example:**
```
DATABASE_URL=mysql://admin:password123@localhost:3306/prepaid_cards
```

**Validation Rules:**
- ✅ Must be a valid MySQL connection string
- ✅ Must point to an accessible database
- ❌ Cannot be empty or missing

---

## Authentication Configuration

### JWT_SECRET (REQUIRED)

**Purpose:** Secret key for signing session cookies and JWT tokens.

**Format:** Any string, minimum 32 characters recommended

**Example:**
```
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
```

**Validation Rules:**
- ✅ Must be at least 32 characters long
- ✅ Should be cryptographically random
- ❌ Cannot be empty or missing

**How to Generate:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## OAuth Configuration

### VITE_APP_ID (REQUIRED)

**Purpose:** OAuth application ID for Manus authentication.

**Format:** String (provided by Manus platform)

### OAUTH_SERVER_URL (REQUIRED)

**Purpose:** OAuth server base URL.

**Format:** URL (provided by Manus platform)

**Example:**
```
OAUTH_SERVER_URL=https://api.manus.im
```

---

## Development vs Production

### Development Environment

For development, you can use less strict values:

```bash
# .env.development
PIN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
DATABASE_URL=mysql://root:root@localhost:3306/prepaid_cards_dev
JWT_SECRET=dev-secret-key-change-in-production
NODE_ENV=development
```

### Production Environment

For production, use strong, unique values:

```bash
# Environment variables (never in .env file)
PIN_ENCRYPTION_KEY=<generate-with-crypto.randomBytes(32).toString('hex')>
DATABASE_URL=<secure-database-url>
JWT_SECRET=<generate-with-crypto.randomBytes(32).toString('base64')>
NODE_ENV=production
```

**Production Best Practices:**
1. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
2. Never store secrets in `.env` files
3. Use environment-specific configuration
4. Rotate secrets regularly
5. Audit secret access
6. Use different secrets for each environment

---

## Startup Validation

### Strict PIN_ENCRYPTION_KEY Validation

The application performs **strict, fail-fast validation** of PIN_ENCRYPTION_KEY at startup. The application will **exit immediately** (exit code 1) if validation fails.

**Validation checks:**
1. PIN_ENCRYPTION_KEY must be set (not empty or undefined)
2. PIN_ENCRYPTION_KEY must be exactly 64 characters
3. PIN_ENCRYPTION_KEY must contain only hexadecimal characters (0-9, a-f, A-F)
4. PIN_ENCRYPTION_KEY must not contain whitespace
5. PIN_ENCRYPTION_KEY must be a valid hex string

### Successful Startup

When PIN_ENCRYPTION_KEY is valid, you'll see:

```
✅ PIN_ENCRYPTION_KEY is properly configured
```

### If Validation Fails

The application will display a detailed error message and exit:

```
═══════════════════════════════════════════════════════════════
❌ STARTUP FAILED: PIN_ENCRYPTION_KEY VALIDATION ERROR
═══════════════════════════════════════════════════════════════

PIN_ENCRYPTION_KEY environment variable is not set.
This is a REQUIRED variable for production deployment.

To fix this:
1. Generate a new 32-byte hex key:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
2. Set the environment variable:
   export PIN_ENCRYPTION_KEY=<generated-key>
3. Restart the application
═══════════════════════════════════════════════════════════════
For more information, see ENVIRONMENT_SETUP.md
═══════════════════════════════════════════════════════════════
```

**Important:** Error messages never expose the actual key value. They only show validation details to help you fix the issue.

---

## Deployment Checklist

Before deploying to production:

- [ ] Generate a new PIN_ENCRYPTION_KEY using cryptographic random
- [ ] Store PIN_ENCRYPTION_KEY in your secrets manager
- [ ] Verify DATABASE_URL points to production database
- [ ] Verify JWT_SECRET is unique and strong
- [ ] Verify NODE_ENV=production
- [ ] Test startup validation passes
- [ ] Verify no secrets are in version control
- [ ] Set up secret rotation schedule
- [ ] Document secret management procedures
- [ ] Train team on secret handling
- [ ] Set up audit logging for secret access

---

## Troubleshooting

### Error: PIN_ENCRYPTION_KEY is not set

**Cause:** The environment variable is missing entirely.

**Solution:** Generate and set the environment variable:
```bash
export PIN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

Verify it's set:
```bash
echo "PIN_ENCRYPTION_KEY length: ${#PIN_ENCRYPTION_KEY}"
# Should output: PIN_ENCRYPTION_KEY length: 64
```

### Error: PIN_ENCRYPTION_KEY contains invalid characters

**Cause:** The key contains non-hexadecimal characters (letters other than a-f, special characters, spaces, etc.).

**Solution:** Generate a new valid hex key:
```bash
export PIN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

Verify the format:
```bash
echo "$PIN_ENCRYPTION_KEY" | grep -E '^[0-9a-fA-F]{64}$' && echo "Valid" || echo "Invalid"
```

### Error: PIN_ENCRYPTION_KEY has incorrect length

**Cause:** The key is not exactly 64 characters (32 bytes in hex format).

**Solution:** Generate a new key with correct length:
```bash
export PIN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

Verify the length:
```bash
echo "PIN_ENCRYPTION_KEY length: ${#PIN_ENCRYPTION_KEY}"
# Should output: PIN_ENCRYPTION_KEY length: 64
```

### Error: PIN_ENCRYPTION_KEY contains whitespace

**Cause:** The key contains spaces, tabs, or newlines.

**Solution:** Ensure no whitespace when setting the variable:
```bash
# Generate without whitespace
export PIN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Verify no whitespace
echo "$PIN_ENCRYPTION_KEY" | od -c | head
```

### Application exits immediately on startup

**Cause:** PIN_ENCRYPTION_KEY validation failed.

**Solution:**
1. Check the error message for the specific validation failure
2. Follow the guidance in the error message
3. Verify the key format:
   ```bash
   echo "$PIN_ENCRYPTION_KEY" | grep -E '^[0-9a-fA-F]{64}$' && echo "Valid" || echo "Invalid"
   ```
4. Restart the application

---

## Security References

- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [HashiCorp Vault](https://www.vaultproject.io/)

---

## Support

For questions about environment configuration, contact the platform team or refer to the main README.md.
