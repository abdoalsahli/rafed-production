# Webhook Integration Guide

## Overview

The Prepaid Card Platform provides webhook support for purchase completion events. Webhooks allow your system to receive real-time notifications when purchases succeed or fail, enabling seamless integration and fulfillment workflows.

## Architecture

### Async Design

The webhook system is designed with **async-first** architecture:

1. **Purchase Processing**: Purchase request is queued and processed asynchronously
2. **DB Commit**: Purchase result (success/failure) is committed to database
3. **Webhook Queue**: Webhook event is queued independently AFTER DB commit
4. **Webhook Delivery**: Webhook is delivered with automatic retries (non-blocking)

**Critical Guarantee**: Webhook failures NEVER affect purchase success. If a purchase succeeds, the webhook delivery is guaranteed to be attempted, but webhook delivery failures do not roll back the purchase.

### Retry Strategy

Webhooks use exponential backoff with the following schedule:

| Attempt | Delay | Cumulative |
|---------|-------|-----------|
| 1 | 30 seconds | 30s |
| 2 | 2 minutes | 2m 30s |
| 3 | 10 minutes | 12m 30s |
| 4 | 1 hour | 1h 12m 30s |
| 5 | 6 hours | 7h 12m 30s |

After 5 failed attempts, the webhook is marked as `FAILED_DELIVERY` and logged for manual review.

### Security

All webhooks are signed using **HMAC-SHA256** with a **dedicated webhook secret** (separate from API authentication credentials). Each webhook includes:

- `X-Webhook-Timestamp`: ISO 8601 timestamp of webhook creation
- `X-Webhook-Signature`: HMAC-SHA256 signature of timestamp + body
- `X-Webhook-Version`: API version (v1) for future compatibility
- `X-Webhook-Event-ID`: Unique event ID for replay attack prevention

**Replay Attack Prevention**:
- Each webhook has a unique `eventId` (format: `evt_{timestamp}_{random}`)
- Distributors MUST reject duplicate `eventId` values
- Distributors MUST reject timestamps older than 5 minutes
- Combine timestamp validation + eventId tracking for complete replay protection

## Webhook Events

### purchase.succeeded

Sent when a purchase completes successfully and a card is allocated.

**Payload:**
```json
{
  "eventId": "evt_1716033600000_a1b2c3d4e5f6",
  "event": "purchase.succeeded",
  "requestId": 12345,
  "providerId": 1,
  "providerCode": "LIBYANA_TELECOM",
  "providerName": "Libyana Telecom",
  "productId": 1,
  "productName": "$10 Prepaid Card",
  "amount": "10.00",
  "serial": "CARD123456789",
  "pin": "1234567890",
  "status": "SUCCEEDED",
  "timestamp": "2026-05-18T12:00:00.000Z"
}
```

### purchase.failed

Sent when a purchase fails (insufficient balance, no cards available, etc.).

**Payload:**
```json
{
  "eventId": "evt_1716033601000_f6e5d4c3b2a1",
  "event": "purchase.failed",
  "requestId": 12346,
  "providerId": 1,
  "providerCode": "LIBYANA_TELECOM",
  "providerName": "Libyana Telecom",
  "productId": 1,
  "productName": "$10 Prepaid Card",
  "amount": "10.00",
  "status": "FAILED",
  "reason": "Insufficient balance",
  "timestamp": "2026-05-18T12:00:01.000Z"
}
```

## Webhook Configuration

### Setting Webhook URL

Configure your webhook URL in the distributor API settings:

```bash
# Via API (if available)
POST /api/v1/distributor/webhook-config
Content-Type: application/json
Authorization: Bearer <api_key>

{
  "webhookUrl": "https://your-domain.com/webhooks/purchases",
  "webhookSecret": "your-secret-key"
}
```

### Webhook Secret

Store your webhook secret securely. Use it to verify webhook signatures on your server.

## Webhook Verification

### Node.js Example

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  signature: string,
  timestamp: string,
  body: string,
  secret: string
): boolean {
  // Verify timestamp is recent (within 5 minutes)
  const webhookTime = new Date(timestamp).getTime();
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  if (now - webhookTime > maxAge) {
    console.error('Webhook timestamp too old');
    return false;
  }
  
  // Verify signature
  const message = `${timestamp}.${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in Express handler
app.post('/webhooks/purchases', (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;
  const body = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(signature, timestamp, body, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  handleWebhook(req.body);
  res.status(200).json({ success: true });
});
```

### Python Example

```python
import hmac
import hashlib
import json
from datetime import datetime, timedelta

def verify_webhook_signature(signature, timestamp, body, secret):
    # Verify timestamp is recent (within 5 minutes)
    webhook_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    now = datetime.utcnow().replace(tzinfo=webhook_time.tzinfo)
    max_age = timedelta(minutes=5)
    
    if now - webhook_time > max_age:
        print('Webhook timestamp too old')
        return False
    
    # Verify signature
    message = f"{timestamp}.{body}"
    expected_signature = hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

# Usage in Flask handler
@app.route('/webhooks/purchases', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Webhook-Signature')
    timestamp = request.headers.get('X-Webhook-Timestamp')
    body = request.get_data(as_text=True)
    
    if not verify_webhook_signature(signature, timestamp, body, WEBHOOK_SECRET):
        return {'error': 'Invalid signature'}, 401
    
    # Process webhook
    payload = json.loads(body)
    handle_purchase_event(payload)
    
    return {'success': True}, 200
```

### cURL Example

```bash
# Verify signature manually
TIMESTAMP="2026-05-18T12:00:00.000Z"
BODY='{"event":"purchase.succeeded","requestId":12345}'
SECRET="your-secret-key"

# Generate expected signature
SIGNATURE=$(echo -n "${TIMESTAMP}.${BODY}" | \
  openssl dgst -sha256 -hmac "$SECRET" | \
  awk '{print $2}')

echo "Expected signature: $SIGNATURE"

# Send webhook request with signature
curl -X POST https://your-domain.com/webhooks/purchases \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -d "$BODY"
```

## Fast-Path Completion (wait=true)

For synchronous workflows, use the optional `wait=true` parameter:

```bash
POST /api/v1/purchases?wait=true
Content-Type: application/json
Idempotency-Key: unique-request-id-123

{
  "providerId": 1,
  "productId": 1,
  "quantity": 1
}
```

**Behavior:**
- Waits up to 5 seconds for purchase to complete
- Returns immediately if completed (SUCCEEDED or FAILED)
- Falls back to PENDING status if timeout reached

**Response (completed):**
```json
{
  "success": true,
  "requestId": 12345,
  "status": "SUCCEEDED",
  "providerId": 1,
  "productId": 1,
  "quantity": 1,
  "amount": "10.00",
  "commissionAmount": "1.00",
  "card": {
    "id": 999,
    "pin": "REDACTED",
    "serialNumber": "REDACTED"
  },
  "createdAt": "2026-05-18T12:00:00.000Z",
  "completedAt": "2026-05-18T12:00:01.000Z"
}
```

**Response (timeout):**
```json
{
  "success": true,
  "requestId": 12346,
  "status": "PENDING",
  "providerId": 1,
  "productId": 1,
  "quantity": 1,
  "amount": "10.00",
  "commissionAmount": "1.00",
  "card": null,
  "createdAt": "2026-05-18T12:00:00.000Z",
  "completedAt": null
}
```

## Polling Fallback

If you don't use `wait=true`, poll the status endpoint:

```bash
GET /api/v1/purchases/{requestId}/status
Authorization: Bearer <api_key>
```

**Response:**
```json
{
  "success": true,
  "requestId": 12345,
  "status": "SUCCEEDED",
  "card": {
    "id": 999,
    "pin": "REDACTED",
    "serialNumber": "REDACTED"
  },
  "completedAt": "2026-05-18T12:00:01.000Z"
}
```

## Idempotency

All purchase requests require an `Idempotency-Key` header:

```bash
POST /api/v1/purchases
Content-Type: application/json
Idempotency-Key: unique-request-id-123

{
  "providerId": 1,
  "productId": 1,
  "quantity": 1
}
```

**Guarantee**: The same `Idempotency-Key` always returns the same result. If a request is retried with the same key, the previous result is returned without re-processing.

## Error Handling

### Webhook Delivery Errors

Webhook delivery errors are categorized:

| Status Code | Retryable | Action |
|------------|-----------|--------|
| 5xx | Yes | Retry with exponential backoff |
| Timeout | Yes | Retry with exponential backoff |
| 4xx | No | Log and mark as FAILED_DELIVERY |
| Connection refused | Yes | Retry with exponential backoff |

### Purchase API Errors

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance for this purchase",
    "details": []
  }
}
```

Common error codes:
- `UNAUTHORIZED`: Invalid API credentials
- `MISSING_IDEMPOTENCY_KEY`: Idempotency-Key header required
- `INVALID_REQUEST`: Invalid request body
- `PRODUCT_NOT_FOUND`: Product not found or inactive
- `FORBIDDEN_PRODUCT`: Not connected to this provider
- `QUEUE_FULL`: Queue at capacity, retry later
- `INSUFFICIENT_BALANCE`: Account balance insufficient
- `NO_CARDS_AVAILABLE`: No cards available for this product
- `INTERNAL_ERROR`: Server error

## Best Practices

### 1. Idempotency

Always include `Idempotency-Key` header with a unique, stable identifier:

```typescript
const idempotencyKey = `${distributorId}-${productId}-${timestamp}-${randomId}`;
```

### 2. Webhook Verification

Always verify webhook signatures before processing:

```typescript
if (!verifyWebhookSignature(signature, timestamp, body, secret)) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### 3. Webhook Idempotency

Webhooks may be delivered multiple times. Implement idempotent processing:

```typescript
// Check if webhook was already processed
const existing = await db.webhookEvents.findOne({
  requestId: payload.requestId,
  event: payload.event
});

if (existing) {
  return res.status(200).json({ success: true }); // Already processed
}

// Process webhook
await processWebhook(payload);

// Store webhook event
await db.webhookEvents.create({
  requestId: payload.requestId,
  event: payload.event,
  payload: payload,
  processedAt: new Date()
});
```

### 4. Timeout Handling

Set appropriate timeouts for webhook endpoints:

```typescript
// Express timeout middleware
app.use(express.json({ timeout: 30000 })); // 30 seconds

// Webhook handler
app.post('/webhooks/purchases', async (req, res) => {
  try {
    await processWebhookWithTimeout(req.body, 25000); // 25 second timeout
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Processing failed' });
  }
});
```

### 5. Monitoring

Monitor webhook delivery:

```typescript
// Log webhook events
console.log({
  timestamp: new Date().toISOString(),
  event: payload.event,
  requestId: payload.requestId,
  status: payload.status,
  deliveryTime: Date.now() - startTime
});

// Alert on failures
if (payload.status === 'FAILED') {
  alertOps({
    severity: 'high',
    message: `Purchase failed: ${payload.reason}`,
    requestId: payload.requestId
  });
}
```

## Integration Checklist

- [ ] Configure webhook URL in distributor settings
- [ ] Store webhook secret securely
- [ ] Implement webhook signature verification
- [ ] Implement idempotent webhook processing
- [ ] Set up webhook event logging
- [ ] Test webhook delivery with test purchases
- [ ] Implement monitoring and alerting
- [ ] Document webhook processing in your system
- [ ] Set up error handling and retry logic
- [ ] Test failure scenarios (timeout, invalid signature, etc.)

## Support

For webhook issues or questions:
- Check webhook delivery logs in the dashboard
- Verify webhook URL is accessible and responding with 200 status
- Ensure webhook secret is correct
- Verify timestamp is recent (within 5 minutes)
- Check signature verification logic

## Changelog

### v1.0 (2026-05-18)
- Initial webhook support
- HMAC-SHA256 signature verification
- Exponential backoff retry strategy
- wait=true fast-path parameter
- Full webhook documentation
