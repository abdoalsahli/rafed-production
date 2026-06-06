# Implementation Guide: Prepaid Card Platform Backend

## Project Structure

```
server/
  ├── services/
  │   ├── purchase.service.ts          # Core purchase orchestration
  │   ├── encryption.service.ts        # PIN encryption/decryption
  │   └── commission.service.ts        # (Future) Commission calculations
  ├── db.ts                            # Database query helpers
  ├── purchase.service.test.ts         # Unit tests
  └── routers.ts                       # tRPC procedure definitions

drizzle/
  ├── schema.ts                        # Database schema
  ├── 0001_*.sql                       # Initial migration
  └── 0002_*.sql                       # Foreign key fixes

client/
  └── src/pages/                       # (Future) Admin UI

BACKEND_DOCUMENTATION.md               # Detailed architecture docs
IMPLEMENTATION_GUIDE.md                # This file
todo.md                                # Feature tracking
```

## Getting Started

### 1. Environment Setup

```bash
# Install dependencies
pnpm install

# Set environment variables
export DATABASE_URL="mysql://user:password@localhost:3306/prepaid_cards"
export KMS_MASTER_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# Run development server
pnpm dev

# Run tests
pnpm test
```

### 2. Database Setup

The database schema is already created and includes:

- 10 tables with proper relationships
- NUMERIC types for financial data
- Indexes for performance
- Foreign key constraints
- Unique constraints for idempotency

**Verify the schema:**

```bash
# Connect to MySQL
mysql -u user -p database_name

# Check tables
SHOW TABLES;

# Verify wallets table has version column
DESCRIBE wallets;
```

### 3. Seed Initial Data

```sql
-- Create a service provider
INSERT INTO service_providers (name, status)
VALUES ('Telecom Provider A', 'active');

-- Create a distributor
INSERT INTO distributors (name, status)
VALUES ('Distributor X', 'active');

-- Create a product
INSERT INTO products (provider_id, name, description, price, status)
VALUES (1, 'Airtime $10', '10 USD airtime', 10.00, 'active');

-- Set commission rate (15%)
INSERT INTO provider_distributor_commission
(provider_id, distributor_id, commission_rate, commission_type)
VALUES (1, 1, 0.15, 'percentage');

-- Create wallet for distributor
INSERT INTO wallets (distributor_id, balance, version)
VALUES (1, 1000.00, 1);

-- Add some cards (in production, use batch upload)
INSERT INTO cards (provider_id, pin_encrypted, status)
VALUES
  (1, 'encrypted_pin_1', 'AVAILABLE'),
  (1, 'encrypted_pin_2', 'AVAILABLE'),
  (1, 'encrypted_pin_3', 'AVAILABLE');
```

## Core Components

### 1. Purchase Service (`server/services/purchase.service.ts`)

**Main Entry Point:**

```typescript
const response = await purchaseService.purchaseCard({
  distributorId: 1,
  productId: 1,
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440000"
});

console.log(`PIN: ${response.pin}`);
console.log(`Amount: ${response.amount}`);
console.log(`Commission: ${response.commission}`);
```

**Key Methods:**

- `purchaseCard()` - Main purchase flow
- `retryPurchase()` - Retry with same idempotency key

**Error Scenarios:**

```typescript
try {
  await purchaseService.purchaseCard(request);
} catch (error) {
  if (error.message.includes("Insufficient wallet balance")) {
    // Handle insufficient funds
  } else if (error.message.includes("No available cards")) {
    // Handle inventory issue
  } else if (error.message.includes("Wallet was updated")) {
    // Retry with new idempotency key
  } else if (error.message.includes("already processed")) {
    // Check transaction history
  }
}
```

### 2. Encryption Service (`server/services/encryption.service.ts`)

**PIN Encryption:**

```typescript
import { pinEncryptionService } from "./services/encryption.service";

// Encrypt a PIN
const encrypted = await pinEncryptionService.encryptPIN("1234567890");

// Decrypt a PIN
const decrypted = await pinEncryptionService.decryptPIN(encrypted);

// Secure cleanup
PINEncryptionService.zeroOutPIN(decrypted);
```

**Custom KMS Integration:**

```typescript
import { PINEncryptionService, KMSProvider } from "./services/encryption.service";

class AWSKMSProvider implements KMSProvider {
  async encrypt(plaintext: string): Promise<string> {
    // Implement AWS KMS encryption
  }

  async decrypt(ciphertext: string): Promise<string> {
    // Implement AWS KMS decryption
  }
}

const kms = new AWSKMSProvider();
const encryptionService = new PINEncryptionService(kms);
```

### 3. Database Helpers (`server/db.ts`)

**Key Functions:**

```typescript
// Allocate a card (SELECT FOR UPDATE SKIP LOCKED)
const card = await allocateAvailableCard(db, providerId);

// Get wallet with version
const wallet = await getWalletForUpdate(db, distributorId);

// Deduct balance (optimistic locking)
const success = await deductWalletBalance(
  db,
  distributorId,
  amount,
  wallet.version
);

// Record transaction
const transactionId = await recordTransaction(db, {
  idempotencyKey: "...",
  distributorId: 1,
  providerId: 1,
  productId: 1,
  cardId: 1,
  amount: "100.00",
  commissionAmount: "15.00"
});

// Record ledger entry
await recordWalletLedgerEntry(db, {
  distributorId: 1,
  type: "DEBIT",
  amount: "100.00",
  currentBalanceAfterTransaction: "900.00",
  referenceId: transactionId.toString(),
  referenceType: "transaction"
});
```

## Integration with tRPC

### Adding Purchase Procedure

Add to `server/routers.ts`:

```typescript
import { purchaseService } from "./services/purchase.service";
import { z } from "zod";

export const appRouter = router({
  // ... existing routers

  purchase: router({
    purchaseCard: protectedProcedure
      .input(z.object({
        distributorId: z.number().int().positive(),
        productId: z.number().int().positive(),
        idempotencyKey: z.string().uuid(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const response = await purchaseService.purchaseCard({
            distributorId: input.distributorId,
            productId: input.productId,
            idempotencyKey: input.idempotencyKey,
          });

          return {
            success: true,
            transactionId: response.transactionId,
            pin: response.pin,
            amount: response.amount,
            commission: response.commission,
            timestamp: response.timestamp,
          };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Purchase failed",
          });
        }
      }),
  }),
});
```

### Frontend Usage

```typescript
import { trpc } from "@/lib/trpc";
import { v4 as uuidv4 } from "uuid";

export function PurchaseCard() {
  const purchaseMutation = trpc.purchase.purchaseCard.useMutation();

  const handlePurchase = async () => {
    try {
      const result = await purchaseMutation.mutateAsync({
        distributorId: 1,
        productId: 1,
        idempotencyKey: uuidv4(),
      });

      console.log("PIN:", result.pin);
      console.log("Amount:", result.amount);
      console.log("Commission:", result.commission);
    } catch (error) {
      console.error("Purchase failed:", error);
    }
  };

  return (
    <button onClick={handlePurchase} disabled={purchaseMutation.isPending}>
      {purchaseMutation.isPending ? "Processing..." : "Purchase Card"}
    </button>
  );
}
```

## Testing

### Run Unit Tests

```bash
pnpm test
```

### Test Coverage

- PIN encryption/decryption
- Commission calculation
- Wallet balance validation
- Decimal precision
- Idempotency handling

### Manual Testing

```bash
# 1. Start development server
pnpm dev

# 2. Create test data
mysql -u user -p database_name < seed.sql

# 3. Test purchase via API
curl -X POST http://localhost:3000/api/trpc/purchase.purchaseCard \
  -H "Content-Type: application/json" \
  -d '{
    "distributorId": 1,
    "productId": 1,
    "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

## Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL/TLS certificates installed
- [ ] Audit logging configured
- [ ] Monitoring and alerting set up
- [ ] Load testing completed
- [ ] Security audit passed

### Build for Production

```bash
pnpm build
```

### Start Production Server

```bash
NODE_ENV=production node dist/index.js
```

## Monitoring & Debugging

### Check Database Indexes

```sql
-- Verify indexes are created
SHOW INDEX FROM cards;
SHOW INDEX FROM transactions;
SHOW INDEX FROM wallet_ledger;
```

### Monitor Wallet Updates

```sql
-- Check for version conflicts
SELECT COUNT(*) as conflicts
FROM wallet_ledger
WHERE reference_type = 'transaction'
AND DATE(createdAt) = CURDATE();
```

### Audit PIN Access

```sql
-- Review transaction history
SELECT t.id, t.idempotency_key, t.status, t.amount, t.commission_amount
FROM transactions t
WHERE t.distributor_id = 1
ORDER BY t.createdAt DESC
LIMIT 10;
```

### Performance Monitoring

```sql
-- Check average purchase time
SELECT 
  COUNT(*) as total_purchases,
  AVG(TIMESTAMPDIFF(MILLISECOND, createdAt, updatedAt)) as avg_duration_ms
FROM transactions
WHERE DATE(createdAt) = CURDATE();
```

## Troubleshooting

### Issue: "Wallet was updated by another transaction"

**Cause:** Concurrent purchases updating the same wallet

**Solution:** Implement exponential backoff retry logic

```typescript
async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
    }
  }
}
```

### Issue: "No available cards in inventory"

**Cause:** Inventory depleted

**Solution:** Implement card batch upload and low inventory alerts

```typescript
// Upload new card batch
const batch = await cardBatchService.uploadBatch({
  providerId: 1,
  filename: "cards_batch_001.csv",
  cards: [
    { pin: "1234567890" },
    { pin: "0987654321" },
    // ... more cards
  ]
});
```

### Issue: Encryption failures

**Cause:** KMS unavailable or incorrect master key

**Solution:** Verify KMS connection and key configuration

```bash
# Test KMS connectivity
curl -X GET https://kms.amazonaws.com/health

# Verify master key
echo $KMS_MASTER_KEY | wc -c  # Should be 65 (64 hex chars + newline)
```

## Next Steps

1. **Implement Card Batch Upload** - Asynchronous bulk import
2. **Add Wallet Top-Up** - Credit distributor wallets
3. **Implement Reporting** - Sales, commission, and inventory reports
4. **Add Admin Dashboard** - Manage providers, distributors, and commissions
5. **Implement Webhooks** - Real-time notifications for sales and low inventory
6. **Scale to Microservices** - Extract inventory and commission services

## References

- [BACKEND_DOCUMENTATION.md](./BACKEND_DOCUMENTATION.md) - Detailed architecture
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [tRPC Documentation](https://trpc.io/)
- [Decimal.js](https://mikemcl.github.io/decimal.js/)
