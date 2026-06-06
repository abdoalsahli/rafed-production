# External Purchase API Documentation

## Overview

The External Purchase API allows third-party systems, POS systems, mobile apps, and client integrations to purchase prepaid cards on behalf of distributors using API credentials.

This API is separate from the web dashboard (which uses tRPC with browser sessions) and is designed for server-to-server integrations.

## Endpoint

```
POST /api/v1/purchases
```

**Base URL:** `https://your-domain.com`

**Example:** `https://your-domain.com/api/v1/purchases`

## Authentication

The API uses header-based authentication with API key and secret.

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-API-Key` | Yes | API Key ID (format: `sk_live_...`) |
| `X-API-Secret` | Yes | API Secret (raw secret, returned only once during generation) |
| `Idempotency-Key` | Yes | Unique identifier for this purchase (UUID or similar) |
| `Content-Type` | Yes | Must be `application/json` |

### Authentication Flow

1. Client sends request with `X-API-Key` and `X-API-Secret` headers
2. Server finds credential by key ID
3. Server verifies credential is active
4. Server hashes the provided secret using SHA256
5. Server compares hashed secret with stored hash using timing-safe comparison
6. If valid, server updates `last_used_at` and processes the purchase
7. If invalid, server returns 401 Unauthorized

### Security Notes

- **Never log raw secrets** - The API redacts secrets in logs
- **Never expose secrets in error messages** - Errors do not reveal whether key or secret is invalid
- **Timing-safe comparison** - Secret comparison uses constant-time comparison to prevent timing attacks
- **HTTPS only** - Always use HTTPS in production
- **Secret rotation** - Generate new credentials periodically and revoke old ones

## Request Body

```json
{
  "providerId": 1214740,
  "productId": 150005,
  "quantity": 1
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `providerId` | number | Yes | ID of the service provider |
| `productId` | number | Yes | ID of the product to purchase |
| `quantity` | number | No | Number of cards (default: 1, currently only 1 supported) |

### Validation

- `providerId` must be a positive integer
- `productId` must be a positive integer
- `quantity` must be a positive integer
- Distributor must have an active relationship with the provider
- Product must belong to the provider and be active
- Distributor must have sufficient balance/credit

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "requestId": 60220,
  "status": "PENDING",
  "providerId": 1214740,
  "productId": 150005,
  "quantity": 1,
  "amount": "10.00",
  "commissionAmount": "0.50",
  "card": {
    "id": 152510,
    "pin": "REDACTED",
    "serialNumber": "REDACTED"
  },
  "createdAt": "2026-05-11T12:00:00.000Z",
  "completedAt": null
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": []
  }
}
```

## Error Codes

| HTTP Status | Error Code | Description |
|-------------|-----------|-------------|
| 400 | `MISSING_IDEMPOTENCY_KEY` | Idempotency-Key header is missing |
| 400 | `INVALID_REQUEST` | Request body validation failed |
| 400 | `PRODUCT_NOT_FOUND` | Product not found or inactive |
| 401 | `MISSING_CREDENTIALS` | Missing X-API-Key or X-API-Secret header |
| 401 | `INVALID_API_KEY_FORMAT` | API key format is invalid |
| 401 | `INVALID_API_CREDENTIALS` | API key or secret is invalid |
| 403 | `INACTIVE_CREDENTIAL` | API credential is inactive |
| 403 | `FORBIDDEN` | Distributor not connected to provider or connection is inactive |
| 409 | `QUEUE_FULL` | Queue at capacity, retry later |
| 500 | `DATABASE_ERROR` | Database connection error |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

## Idempotency

The API uses the `Idempotency-Key` header to ensure idempotent purchases.

### Behavior

- **First request:** Creates a new purchase request
- **Duplicate request:** Returns the same result as the first request
- **No duplicate purchase:** Same idempotency key will never result in multiple purchases

### Implementation

- Idempotency key must be unique per purchase attempt
- If you retry a request, use the same idempotency key
- The API will return the existing result instead of creating a duplicate

### Example

```bash
# First request
curl -X POST https://your-domain.com/api/v1/purchases \
  -H "X-API-Key: sk_live_xxx" \
  -H "X-API-Secret: yyy" \
  -H "Idempotency-Key: purchase-2026-05-11-001" \
  -H "Content-Type: application/json" \
  -d '{"providerId": 1214740, "productId": 150005}'

# Response: requestId 60220

# Retry with same idempotency key
curl -X POST https://your-domain.com/api/v1/purchases \
  -H "X-API-Key: sk_live_xxx" \
  -H "X-API-Secret: yyy" \
  -H "Idempotency-Key: purchase-2026-05-11-001" \
  -H "Content-Type: application/json" \
  -d '{"providerId": 1214740, "productId": 150005}'

# Response: Same requestId 60220 (no duplicate purchase)
```

## API Credential Management

### Generate API Credentials

1. Log in to the web dashboard as a distributor user
2. Navigate to **API Settings** or **Integrations**
3. Click **Generate New API Key**
4. Copy the **API Key ID** and **API Secret** (secret is shown only once)
5. Store the secret securely (you cannot retrieve it later)

### Credential Format

- **Key ID:** `sk_live_` followed by 32 random hex characters (e.g., `sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- **Secret:** 64 random hex characters (e.g., `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`)
- **Masked Key:** `sk_live_` followed by last 12 characters of secret (for display only)

### Revoke API Credentials

1. Log in to the web dashboard
2. Navigate to **API Settings**
3. Find the credential to revoke
4. Click **Revoke** or **Deactivate**
5. Confirm the action

Once revoked, the credential cannot be used for API calls.

### Best Practices

- **Rotate credentials regularly** - Generate new credentials every 90 days
- **Use different credentials per integration** - Don't share credentials across systems
- **Monitor last_used_at** - Check when credentials were last used
- **Revoke unused credentials** - Remove credentials that are no longer needed
- **Store securely** - Use environment variables or secure vaults, never hardcode

## Purchase Flow

### Synchronous vs Asynchronous

The API returns immediately with a `requestId` and status of `PENDING`.

The actual purchase processing happens asynchronously in the background:

1. **PENDING** - Request queued for processing
2. **PROCESSING** - Purchase is being processed
3. **SUCCEEDED** - Purchase completed, card allocated and sold
4. **FAILED** - Purchase failed (insufficient funds, no inventory, etc.)

### Polling for Status

To check the status of a purchase, use the dashboard or query the `requestId`:

```bash
# Check purchase status (via dashboard or internal API)
GET /api/trpc/distributor.getPurchaseStatus?input={"requestId":60220}
```

### Account Updates

After a successful purchase:

1. Card is marked as SOLD
2. Distributor account balance is debited
3. Commission is credited to distributor account
4. Ledger entries are created for audit trail
5. Transaction record is created

## Examples

### cURL

```bash
curl -X POST https://your-domain.com/api/v1/purchases \
  -H "X-API-Key: sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "X-API-Secret: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2" \
  -H "Idempotency-Key: purchase-2026-05-11-001" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": 1214740,
    "productId": 150005,
    "quantity": 1
  }'
```

### Python

```python
import requests
import uuid

api_key = "sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
api_secret = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
idempotency_key = str(uuid.uuid4())

headers = {
    "X-API-Key": api_key,
    "X-API-Secret": api_secret,
    "Idempotency-Key": idempotency_key,
    "Content-Type": "application/json",
}

payload = {
    "providerId": 1214740,
    "productId": 150005,
    "quantity": 1,
}

response = requests.post(
    "https://your-domain.com/api/v1/purchases",
    headers=headers,
    json=payload,
)

print(response.json())
```

### Node.js

```javascript
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const apiKey = 'sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
const apiSecret = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2';
const idempotencyKey = uuidv4();

const headers = {
  'X-API-Key': apiKey,
  'X-API-Secret': apiSecret,
  'Idempotency-Key': idempotencyKey,
  'Content-Type': 'application/json',
};

const payload = {
  providerId: 1214740,
  productId: 150005,
  quantity: 1,
};

fetch('https://your-domain.com/api/v1/purchases', {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## Rate Limiting

Currently, there is no rate limiting on the API. However, rate limiting may be added in the future.

## Support

For API support, contact the platform administrator or check the dashboard for API documentation and logs.

## Changelog

### v1.0 (2026-05-11)

- Initial release
- Support for single card purchases
- Idempotency key support
- API credential authentication
