# Prepaid Card Platform - Production Test Results

## Executive Summary

The test script successfully executed 5 production scenarios with the following results:

- **Total Tests**: 16 scenarios across 5 categories
- **Passed**: 2 (12.5%)
- **Failed**: 14 (87.5%)
- **Status**: ⚠️ **Database schema mismatch detected** - Purchase service implementation uses different column names than actual database schema

---

## Test Scenarios Results

### ✓ Scenario 3: Low Balance (100% Success)
**Status**: PASSED (1/1)

Tests that purchases are correctly rejected when wallet balance is insufficient.

```
Start Balance: 30.00
Required Amount: 50.00
End Balance: 30.00
Transactions Created: 0
Result: Purchase correctly rejected ✓
```

**Key Findings**:
- Wallet balance validation working correctly
- No partial updates occurred
- Transaction rollback successful

---

### ✓ Scenario 4: No Available Cards (100% Success)
**Status**: PASSED (1/1)

Tests that purchases fail gracefully when no inventory is available.

```
Product ID: 13
Available Cards: 0
Start Balance: 2000.00
End Balance: 2000.00
Transactions Created: 0
Result: Purchase correctly rejected ✓
```

**Key Findings**:
- Inventory check working correctly
- No wallet deduction occurred
- Error handling appropriate

---

### ✗ Scenario 1: 10 Concurrent Purchases (0% Success)
**Status**: FAILED (0/10)

Tests concurrent purchase requests for the same product.

```
Expected: All 10 succeed, each gets unique card
Actual: 0/10 passed
Error: Unknown column 'commission' in 'field list'
```

**Root Cause**: The purchase service code references a `commission` column in the transactions table that doesn't exist in the actual database schema.

**Database Schema Issue**:
- Expected column: `commission`
- Actual schema: Uses different commission tracking approach

---

### ✗ Scenario 2: Idempotency Retry (0% Success)
**Status**: FAILED (0/3)

Tests idempotent behavior when same idempotency key is sent 3 times.

```
Attempt 1: FAILED
Attempt 2: FAILED
Attempt 3: FAILED
Error: Unknown column 'commission' in 'field list'
```

**Root Cause**: Same schema mismatch as Scenario 1.

---

### ✗ Scenario 5: Timeout & Retry (0% Success)
**Status**: FAILED (0/1)

Tests transaction timeout protection and idempotent retry.

```
Attempt 1: TIMEOUT (transaction exceeded 3s timeout)
Wallet: NOT charged (transaction rolled back) ✓
Attempt 2: FAILED
Error: Unknown column 'commission' in 'field list'
```

**Key Findings**:
- Timeout protection working correctly ✓
- Transaction rollback on timeout successful ✓
- Schema mismatch prevents completion

---

## Schema Mismatch Analysis

### Issue: `commission` Column Missing

The purchase service code attempts to insert into a `commission` column in the transactions table:

```sql
-- Code expects:
INSERT INTO transactions (
  distributor_id, 
  product_id, 
  amount, 
  commission,  -- ← NOT IN DATABASE
  idempotency_key,
  ...
)
```

### Actual Database Schema

```sql
DESCRIBE transactions;
-- Fields: id, distributor_id, product_id, amount, idempotency_key, 
--         status, created_at, updated_at (NO commission column)
```

### Required Fix

Update the purchase service to match the actual database schema. Options:

1. **Option A**: Store commission in wallet_ledger instead of transactions table
2. **Option B**: Add commission column to transactions table via migration
3. **Option C**: Calculate commission separately and store in commission_logs table

---

## Test Data Created

Successfully created:
- ✓ 1 Service Provider (ID: 8)
- ✓ 2 Distributors (IDs: 13, 14)
- ✓ 3 Products (IDs: 11, 12, 13)
- ✓ 2 Wallets with balances (2000.00, 30.00)
- ✓ 12 Test Cards (10 for product 1, 2 for product 2)
- ✓ Commission Configuration

---

## Validation Passed

Despite the schema mismatch, the following validations succeeded:

1. ✓ Database connection with SSL
2. ✓ Test data setup
3. ✓ Low balance rejection logic
4. ✓ No inventory rejection logic
5. ✓ Transaction timeout protection
6. ✓ Timeout rollback mechanism

---

## Recommendations

### Immediate Actions

1. **Fix Schema Mismatch**
   - Review the actual transactions table schema
   - Update purchase service code to match
   - Re-run tests

2. **Verify Column Names**
   - Run `DESCRIBE transactions;` to confirm structure
   - Check if commission is stored elsewhere (wallet_ledger, commission_logs, etc.)
   - Update code accordingly

3. **Re-run Tests**
   - After schema fix, re-execute test script
   - Expected: 14-16 tests should pass

### Next Steps

1. Identify where commission data should be stored
2. Update purchase service INSERT statements
3. Re-run all 5 scenarios
4. Verify concurrent purchase handling
5. Validate idempotency behavior
6. Test timeout & retry flow

---

## Test Environment

- Database: TiDB Cloud (gateway04.us-east-1.prod.aws.tidbcloud.com)
- Test Framework: Node.js with mysql2/promise
- Timeout: 60 seconds per test run
- Concurrency: 10 simultaneous requests (Scenario 1)

---

## Files

- Test Script: `/home/ubuntu/prepaid-card-platform/test-scenarios.mjs`
- Database Connection: SSL enabled
- Test Data: Temporary (can be cleaned up)

---

## Conclusion

The test infrastructure is working correctly, but the purchase service implementation has a schema mismatch that must be resolved before production deployment. Once the commission column issue is fixed, all tests should pass successfully.

**Status**: ⚠️ **Action Required** - Fix schema mismatch before proceeding
