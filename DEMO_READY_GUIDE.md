# Demo-Ready Implementation Guide

## Status: DEMO READY ✅

The prepaid card platform is now configured for a live client demo with a complete, working purchase flow.

---

## Complete Working Flow

### Distributor → Purchase → Card Delivered → Balance Updated

**Endpoint:** `demoPurchase.purchaseCard`

**Flow:**
1. Distributor authenticates (via Manus OAuth)
2. Calls `demoPurchase.purchaseCard` with:
   - `providerId`: Service provider ID
   - `productId`: Product to purchase
   - `idempotencyKey`: Unique request ID (for idempotency)
3. System:
   - Validates product exists
   - Checks distributor balance + available credit
   - Allocates card from inventory
   - Deducts balance/credit
   - Creates 2 ledger entries (debit + commission)
   - Decrypts and returns PIN
4. Response includes:
   - `cardId`: Allocated card ID
   - `pin`: Decrypted PIN
   - `newBalance`: Updated balance
   - `newUsedCredit`: Updated credit usage
   - `status`: "COMPLETED"

---

## API Endpoints for Demo

### 1. Purchase Card (Main Demo Flow)
```
POST /api/trpc/demoPurchase.purchaseCard
```
**Requires:** Authentication (Manus OAuth)

**Input:**
```json
{
  "providerId": 1,
  "productId": 1,
  "idempotencyKey": "demo-purchase-001"
}
```

**Response:**
```json
{
  "result": {
    "data": {
      "json": {
        "success": true,
        "transactionId": 123,
        "status": "COMPLETED",
        "cardId": 123,
        "pin": "1234-5678-9012",
        "amount": 50.00,
        "commission": 5.00,
        "newBalance": 950.00,
        "newUsedCredit": 0.00,
        "timestamp": "2026-04-21T12:15:00.000Z"
      }
    }
  }
}
```

### 2. Get Balance
```
GET /api/trpc/demoPurchase.getBalance?input={"providerId":1}
```
**Requires:** Authentication

**Response:**
```json
{
  "result": {
    "data": {
      "json": {
        "balance": 950.00,
        "creditLine": 1000.00,
        "usedCredit": 0.00,
        "availableToSpend": 1950.00
      }
    }
  }
}
```

### 3. Get Products
```
GET /api/trpc/demoPurchase.getProducts?input={"providerId":1}
```
**Requires:** Authentication

**Response:**
```json
{
  "result": {
    "data": {
      "json": [
        {
          "id": 1,
          "name": "Prepaid Card $50",
          "price": 50.00,
          "description": "Standard prepaid card"
        }
      ]
    }
  }
}
```

---

## Demo Scenario

### Prerequisites
1. User is authenticated (Manus OAuth session active)
2. Test distributor account exists with balance
3. Test products exist
4. Test cards are available in inventory

### Demo Steps

**Step 1: Show Current Balance**
```bash
curl -s 'http://localhost:3000/api/trpc/demoPurchase.getBalance?input={"providerId":1}' \
  -H "Cookie: <session-cookie>"
```
Expected: Shows balance of $1000, available to spend $1000

**Step 2: Show Available Products**
```bash
curl -s 'http://localhost:3000/api/trpc/demoPurchase.getProducts?input={"providerId":1}' \
  -H "Cookie: <session-cookie>"
```
Expected: Lists $50 prepaid card product

**Step 3: Execute Purchase**
```bash
curl -s -X POST 'http://localhost:3000/api/trpc/demoPurchase.purchaseCard' \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "input": {
      "providerId": 1,
      "productId": 1,
      "idempotencyKey": "demo-purchase-'$(date +%s)'"
    }
  }'
```
Expected: Returns card ID and PIN

**Step 4: Verify Balance Updated**
```bash
curl -s 'http://localhost:3000/api/trpc/demoPurchase.getBalance?input={"providerId":1}' \
  -H "Cookie: <session-cookie>"
```
Expected: Shows balance of $950 (down from $1000)

---

## Key Implementation Details

### Database Changes
- Cards are marked as "SOLD" (status changed from "AVAILABLE")
- Balance is decremented in `providerDistributorAccounts`
- Two ledger entries created per purchase:
  1. DEBIT entry: Purchase amount
  2. CREDIT entry: 10% commission

### Error Handling
- Insufficient balance → PRECONDITION_FAILED
- Product not found → NOT_FOUND
- No cards available → CONFLICT
- Database errors → INTERNAL_SERVER_ERROR

### Security
- PIN is encrypted/decrypted with `PIN_ENCRYPTION_KEY`
- All operations require authentication
- Balance updates are atomic (single transaction)

---

## Known Limitations (Demo Only)

1. **No Queue System**: Purchases are synchronous (instant)
   - Production will use async queue with workers
   - Demo prioritizes reliability over production architecture

2. **No Complex Recovery**: No retry logic or recovery mechanism
   - Production will have comprehensive recovery system
   - Demo handles happy path only

3. **No Advanced Metrics**: Simplified metrics collection
   - Production will have detailed performance metrics
   - Demo has basic health checks

4. **No Distributed Locking**: Single-server deployment
   - Production will use distributed locks
   - Demo assumes single instance

---

## Testing the Demo

### Manual Test Scenario
1. Open browser to login page
2. Authenticate as distributor
3. Call `demoPurchase.getBalance` → See $1000
4. Call `demoPurchase.purchaseCard` → Get card + PIN
5. Call `demoPurchase.getBalance` → See $950
6. Show ledger entries in database

### Idempotency Test
```bash
# Call 1
curl -X POST 'http://localhost:3000/api/trpc/demoPurchase.purchaseCard' \
  -d '{"input":{"providerId":1,"productId":1,"idempotencyKey":"test-123"}}'

# Call 2 (same idempotencyKey)
curl -X POST 'http://localhost:3000/api/trpc/demoPurchase.purchaseCard' \
  -d '{"input":{"providerId":1,"productId":1,"idempotencyKey":"test-123"}}'
```
Expected: Both calls return same card ID (idempotent)

---

## Next Steps After Demo

1. **Implement Queue System**: Move to async processing with workers
2. **Add Recovery Logic**: Handle failed purchases and retries
3. **Implement Distributed Locking**: Support multi-instance deployment
4. **Add Comprehensive Metrics**: Performance tracking and analytics
5. **Build Frontend UI**: Dashboard, purchase form, transaction history

---

## Troubleshooting

### Issue: "No cards available"
**Solution:** Check if cards exist in database with status "AVAILABLE"
```sql
SELECT * FROM cards WHERE provider_id=1 AND product_id=1 AND status='AVAILABLE' LIMIT 5;
```

### Issue: "Insufficient balance"
**Solution:** Check account balance
```sql
SELECT * FROM provider_distributor_accounts WHERE provider_id=1 AND distributor_id=<user_id>;
```

### Issue: "PIN_DECRYPTION_FAILED"
**Solution:** Verify PIN_ENCRYPTION_KEY is set correctly
```bash
echo $PIN_ENCRYPTION_KEY
```

### Issue: "Database connection not available"
**Solution:** Verify database connection
```bash
curl -s 'http://localhost:3000/api/trpc/health.queueManager'
```

---

## Files Modified

- `server/routers/demo-purchase.router.ts` - New demo purchase endpoints
- `server/routers.ts` - Registered demo purchase router
- `server/queue-manager.ts` - Fixed insertId extraction
- `server/_core/index.ts` - Added error logging to tRPC middleware

---

## Ready for Demo ✅

The system is now ready for a live client demonstration with a complete, working purchase flow that shows:
- Authentication
- Product selection
- Purchase execution
- Card delivery with PIN
- Balance update
- Ledger tracking

All operations are synchronous and reliable for demo purposes.
