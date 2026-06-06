# External Distributor REST API

Production-grade REST API for third-party integrations, POS systems, and mobile applications to purchase prepaid cards on behalf of distributors.

## Base URL

```
https://your-domain.com/api/v1
```

## Authentication

All endpoints require API credentials passed via headers:

```
X-API-Key: sk_live_xxxxxxxxxxxxx
X-API-Secret: (raw secret - 32 characters)
```

**Security Notes:**
- Secrets are hashed with SHA256 before storage
- Timing-safe comparison prevents timing attacks
- Credentials must be generated in the dashboard
- Each credential tracks last_used_at for audit trails
- Inactive credentials are rejected immediately

## Endpoints

### 1. Get Product Catalog

Returns all products available to the authenticated distributor from connected providers.

```
GET /api/v1/products
```

**Headers:**
```
X-API-Key: sk_live_xxxxxxxxxxxxx
X-API-Secret: (raw secret)
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "success": true,
  "products": [
    {
      "providerId": 1214748,
      "providerName": "Connect",
      "providerCode": "CONNECT",
      "productId": 798020,
      "productName": "Premium Card",
      "price": "50.00"
    },
    {
      "providerId": 1214748,
      "providerName": "Connect",
      "providerCode": "CONNECT",
      "productId": 798021,
      "productName": "Standard Card",
      "price": "25.00"
    }
  ]
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_CREDENTIALS",
    "message": "Invalid API credentials"
  }
}
```

---

### 2. Create Purchase Request

Purchase a prepaid card. Supports both `providerId + productId` or `productId`-only flow.

```
POST /api/v1/purchases
```

**Headers:**
```
X-API-Key: sk_live_xxxxxxxxxxxxx
X-API-Secret: (raw secret)
Idempotency-Key: unique-identifier-v1
Content-Type: application/json
```

**Request Body:**
```json
{
  "productId": 798020,
  "providerId": 1214748,
  "quantity": 1
}
```

Or (productId-only, providerId resolved automatically):
```json
{
  "productId": 798020,
  "quantity": 1
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "requestId": 12345,
  "status": "PENDING",
  "productId": 798020,
  "quantity": 1,
  "amount": "50.00",
  "createdAt": "2026-05-11T15:30:00.000Z",
  "completedAt": null,
  "card": null
}
```

**Response (200 OK - Idempotent Retry):**
```json
{
  "success": true,
  "requestId": 12345,
  "status": "SUCCEEDED",
  "productId": 798020,
  "quantity": 1,
  "amount": "50.00",
  "createdAt": "2026-05-11T15:30:00.000Z",
  "completedAt": "2026-05-11T15:30:05.000Z",
  "card": {
    "id": 54321,
    "pin": "REDACTED",
    "serialNumber": "REDACTED"
  }
}
```

**Error Response (400 - Missing Idempotency Key):**
```json
{
  "success": false,
  "error": {
    "code": "MISSING_IDEMPOTENCY_KEY",
    "message": "Idempotency-Key header is required"
  }
}
```

**Error Response (400 - Invalid Request):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request body",
    "details": [
      {
        "field": "productId",
        "message": "Expected number"
      }
    ]
  }
}
```

**Error Response (403 - Not Connected to Provider):**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN_PRODUCT",
    "message": "Not connected to this provider or connection is inactive"
  }
}
```

**Error Response (404 - Product Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found or inactive"
  }
}
```

**Error Response (409 - Queue Full):**
```json
{
  "success": false,
  "error": {
    "code": "QUEUE_FULL",
    "message": "Queue at capacity. Please retry later."
  }
}
```

---

### 3. Get Purchase Status

Retrieve the status and details of a purchase request.

```
GET /api/v1/purchases/:requestId
```

**Path Parameters:**
- `requestId` (integer) - The purchase request ID returned from POST /api/v1/purchases

**Headers:**
```
X-API-Key: sk_live_xxxxxxxxxxxxx
X-API-Secret: (raw secret)
Content-Type: application/json
```

**Response (200 OK - Pending):**
```json
{
  "success": true,
  "requestId": 12345,
  "status": "PENDING",
  "productId": 798020,
  "quantity": 1,
  "amount": "50.00",
  "createdAt": "2026-05-11T15:30:00.000Z",
  "completedAt": null
}
```

**Response (200 OK - Succeeded):**
```json
{
  "success": true,
  "requestId": 12345,
  "status": "SUCCEEDED",
  "productId": 798020,
  "quantity": 1,
  "amount": "50.00",
  "createdAt": "2026-05-11T15:30:00.000Z",
  "completedAt": "2026-05-11T15:30:05.000Z",
  "card": {
    "id": 54321,
    "pin": "REDACTED",
    "serialNumber": "REDACTED"
  }
}
```

**Response (200 OK - Failed):**
```json
{
  "success": true,
  "requestId": 12345,
  "status": "FAILED",
  "productId": 798020,
  "quantity": 1,
  "amount": "50.00",
  "createdAt": "2026-05-11T15:30:00.000Z",
  "completedAt": "2026-05-11T15:30:10.000Z",
  "failureReason": "Insufficient balance"
}
```

**Error Response (404 - Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "REQUEST_NOT_FOUND",
    "message": "Purchase request not found or access denied"
  }
}
```

---

## Idempotency

All purchase requests require an `Idempotency-Key` header. This ensures:

1. **Same request always returns same result** - Retries are safe
2. **No duplicate charges** - Multiple requests with same key return cached result
3. **Network resilience** - Timeouts and connection failures can be safely retried

**Idempotency Key Format:**
- Unique per distributor
- Recommended: UUID v4 or timestamp-based identifier
- Max length: 255 characters
- Example: `550e8400-e29b-41d4-a716-446655440000`

**Behavior:**
```
First request with key "abc123":
  → Creates purchase request
  → Returns status PENDING
  → Stores idempotency_key = "abc123"

Retry with same key "abc123":
  → Finds existing request
  → Returns SAME result (PENDING, SUCCEEDED, or FAILED)
  → No new charge
  → No duplicate card allocation
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Retry? |
|------|---------|--------|
| 200 | Success | No |
| 400 | Bad Request (validation error) | No |
| 401 | Unauthorized (invalid credentials) | No |
| 403 | Forbidden (not connected to provider) | No |
| 404 | Not Found (product/request not found) | No |
| 409 | Conflict (queue full) | Yes (exponential backoff) |
| 500 | Internal Server Error | Yes (exponential backoff) |

### Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": []  // Optional: validation details
  }
}
```

### Retry Strategy

```
Recommended exponential backoff:
- 409 (Queue Full): Retry after 1s, 2s, 4s, 8s, 16s
- 500 (Server Error): Retry after 1s, 2s, 4s, 8s, 16s
- 400, 401, 403, 404: Do NOT retry (permanent errors)
```

---

## Code Examples

### Python

```python
import requests
import uuid

BASE_URL = "https://your-domain.com/api/v1"
API_KEY = "sk_live_xxxxxxxxxxxxx"
API_SECRET = "your-secret-here"

def purchase_card(product_id):
    headers = {
        "X-API-Key": API_KEY,
        "X-API-Secret": API_SECRET,
        "Idempotency-Key": str(uuid.uuid4()),
        "Content-Type": "application/json"
    }
    
    body = {
        "productId": product_id,
        "quantity": 1
    }
    
    response = requests.post(
        f"{BASE_URL}/purchases",
        headers=headers,
        json=body
    )
    
    return response.json()

# Get product catalog
headers = {
    "X-API-Key": API_KEY,
    "X-API-Secret": API_SECRET
}
catalog = requests.get(f"{BASE_URL}/products", headers=headers).json()
print(f"Available products: {catalog['products']}")

# Purchase a card
result = purchase_card(798020)
print(f"Purchase result: {result}")

# Check status
request_id = result['requestId']
status = requests.get(
    f"{BASE_URL}/purchases/{request_id}",
    headers=headers
).json()
print(f"Purchase status: {status['status']}")
```

### JavaScript/Node.js

```javascript
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'https://your-domain.com/api/v1';
const API_KEY = 'sk_live_xxxxxxxxxxxxx';
const API_SECRET = 'your-secret-here';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-API-Key': API_KEY,
    'X-API-Secret': API_SECRET,
    'Content-Type': 'application/json'
  }
});

async function purchaseCard(productId) {
  const response = await client.post('/purchases', {
    productId,
    quantity: 1
  }, {
    headers: {
      'Idempotency-Key': uuidv4()
    }
  });
  
  return response.data;
}

async function main() {
  // Get catalog
  const catalog = await client.get('/products');
  console.log('Available products:', catalog.data.products);
  
  // Purchase
  const purchase = await purchaseCard(798020);
  console.log('Purchase result:', purchase);
  
  // Check status
  const status = await client.get(`/purchases/${purchase.requestId}`);
  console.log('Purchase status:', status.data);
}

main().catch(console.error);
```

### cURL

```bash
# Get product catalog
curl -X GET https://your-domain.com/api/v1/products \
  -H "X-API-Key: sk_live_xxxxxxxxxxxxx" \
  -H "X-API-Secret: your-secret-here" \
  -H "Content-Type: application/json"

# Create purchase
curl -X POST https://your-domain.com/api/v1/purchases \
  -H "X-API-Key: sk_live_xxxxxxxxxxxxx" \
  -H "X-API-Secret: your-secret-here" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 798020,
    "quantity": 1
  }'

# Check purchase status
curl -X GET https://your-domain.com/api/v1/purchases/12345 \
  -H "X-API-Key: sk_live_xxxxxxxxxxxxx" \
  -H "X-API-Secret: your-secret-here" \
  -H "Content-Type: application/json"
```

---

## API Credentials Management

### Generate New Credentials

1. Log in to the dashboard
2. Navigate to **Settings → API Credentials**
3. Click **Generate New Credential**
4. Save the key and secret securely (secret is only shown once)
5. Use in API requests

### Rotate Credentials

1. Generate a new credential (old one remains active)
2. Update your integration to use the new credential
3. Deactivate the old credential when ready

### Monitor Usage

Each credential shows:
- Last used timestamp
- Number of requests
- Status (active/inactive)
- Created date

---

## Rate Limiting

Currently no rate limits. Future versions may implement:
- Per-credential rate limits
- Per-distributor rate limits
- Burst allowances

---

## Support

For API issues or questions:
- Email: api-support@example.com
- Documentation: https://docs.example.com
- Status: https://status.example.com
