# Financial Logic Bug Analysis: Double-Counting Purchase Impact

## Executive Summary

**BUG CONFIRMED**: The purchase flow is **double-counting** the purchase amount when calculating available balance. A 10.00 LYD purchase decreases available balance by 20.00 LYD instead of 10.00 LYD.

**Root Cause**: The account update logic both decreases `balance` AND increases `used_credit` by the same amount, causing the purchase to be deducted twice in the `available_to_spend` formula.

---

## Current Implementation Analysis

### File: `/server/queue-manager.ts` (Lines 388-403)

```typescript
// Update account balance
const newUsedCredit = parseFloat((account as any).usedCredit) + price;
const newBalance = parseFloat((account as any).balance) - price;
await db
  .update(providerDistributorAccounts)
  .set({
    balance: String(newBalance),
    usedCredit: String(newUsedCredit),
    version: (account as any).version + 1,
  })
  .where(
    and(
      eq(providerDistributorAccounts.providerId, providerId),
      eq(providerDistributorAccounts.distributorId, distributorId)
    )
  );
```

### Current Account Update Formula

```
newBalance = balance - price
newUsedCredit = usedCredit + price
```

### Current Available Balance Formula (Line 369-372)

```
availableBalance = balance + creditLine - usedCredit
```

---

## The Double-Counting Problem

### Before Purchase (Test Data)
```
balance: 5000.00
creditLine: 5000.00
usedCredit: 0.00
availableBalance = 5000 + 5000 - 0 = 10,000.00
```

### After 10.00 LYD Purchase (Current Buggy Behavior)
```
newBalance = 5000.00 - 10.00 = 4990.00
newUsedCredit = 0.00 + 10.00 = 10.00

availableBalance = 4990 + 5000 - 10 = 9,980.00
Decrease: 10,000 - 9,980 = 20.00 ✗ (WRONG - should be 10.00)
```

### Why This Happens

The purchase amount is deducted **twice**:

1. **First deduction**: `balance - price` (line 390)
   - Reduces balance by 10.00
   - Impact on available: -10.00

2. **Second deduction**: `usedCredit + price` (line 389)
   - Increases used_credit by 10.00
   - Impact on available: -10.00 (because formula subtracts used_credit)
   - **Total impact: -20.00** ✗

---

## Correct Financial Model

### Intended Behavior (Based on Code Comments & Architecture)

The system should support **two account funding models**:

1. **Direct Balance Model**: Distributor pays directly from balance
   - When `balance >= price`: Deduct from balance only
   - `usedCredit` remains unchanged
   - `availableBalance = balance + (creditLine - usedCredit)`

2. **Credit Line Model**: Distributor uses credit line
   - When `balance < price`: Use credit line
   - Increase `usedCredit` only
   - `balance` remains unchanged
   - `availableBalance = balance + (creditLine - usedCredit)`

### Correct Account Update Logic

```typescript
const price = 10.00;
const availableBalance = balance + creditLine - usedCredit;

if (availableBalance < price) {
  // Insufficient funds
  return error;
}

// Determine funding source
if (balance >= price) {
  // Use balance only
  newBalance = balance - price;
  newUsedCredit = usedCredit; // NO CHANGE
} else {
  // Use balance + credit line
  const balanceUsed = balance;
  const creditUsed = price - balanceUsed;
  
  newBalance = 0; // Balance depleted
  newUsedCredit = usedCredit + creditUsed; // Only credit portion
}
```

---

## Test Case Verification

### Scenario: 10.00 LYD Purchase with Correct Logic

**Before**:
```
balance: 5000.00
creditLine: 5000.00
usedCredit: 0.00
availableBalance = 5000 + 5000 - 0 = 10,000.00
```

**After** (CORRECT):
```
balance: 4990.00 (5000 - 10)
creditLine: 5000.00 (unchanged)
usedCredit: 0.00 (unchanged - still using balance)
availableBalance = 4990 + 5000 - 0 = 9,990.00
Decrease: 10,000 - 9,990 = 10.00 ✓ (CORRECT)
```

### Scenario: Purchase Exceeding Balance

**Before**:
```
balance: 5.00
creditLine: 5000.00
usedCredit: 0.00
availableBalance = 5 + 5000 - 0 = 5,005.00
```

**Purchase 10.00 LYD** (CORRECT):
```
balance: 0.00 (5 - 5 = 0)
creditLine: 5000.00 (unchanged)
usedCredit: 5.00 (0 + 5 = 5, only credit portion)
availableBalance = 0 + 5000 - 5 = 4,995.00
Decrease: 5,005 - 4,995 = 10.00 ✓ (CORRECT)
```

---

## Ledger Entry Analysis

### Current Ledger Calculations (Lines 406-445)

```typescript
const balanceAfterDebit = availableBalance - price;
const newUsedCreditAfterTxn = newUsedCredit;

// DEBIT entry
await insertLedgerEntry(
  ...,
  String(balanceAfterDebit),  // availableBalance - price
  String(newUsedCreditAfterTxn),
  ...
);

// COMMISSION CREDIT entry
const commissionAmount = price * 0.05;
const balanceAfterCommission = balanceAfterDebit + commissionAmount;

await insertLedgerEntry(
  ...,
  String(balanceAfterCommission),  // (availableBalance - price) + commission
  String(newUsedCreditAfterTxn),
  ...
);
```

### Ledger Issue

The ledger stores `balance_after_transaction` which represents the **available balance** at that moment, NOT the account `balance` field. This is confusing because:

- Ledger shows: `balance_after_transaction: 9920.00`
- Account shows: `balance: 4955.00`

These are **different concepts** and should be clearly named:
- Ledger: `available_balance_after` (calculated field)
- Account: `balance` (actual balance field)

---

## Answers to Your Questions

### 1. Is the purchase supposed to deduct from balance, increase used_credit, or both?

**ANSWER**: Should deduct from balance ONLY (if balance sufficient). Only increase used_credit if balance is insufficient and credit line is needed.

**Current behavior**: Both (WRONG - causes double-counting)

### 2. If balance > purchase amount, should used_credit remain unchanged?

**ANSWER**: YES. Used_credit should only increase when drawing from credit line.

**Current behavior**: NO - used_credit always increases (WRONG)

### 3. If balance = 0, should used_credit increase?

**ANSWER**: YES. When balance is depleted, credit line is drawn, so used_credit increases.

**Current behavior**: YES - but also decreases balance unnecessarily (WRONG)

### 4. Is the current behavior double-counting the purchase?

**ANSWER**: YES, CONFIRMED. The purchase is deducted from both `balance` AND `used_credit`, causing it to be subtracted twice in the available balance formula.

### 5. Should available_to_spend decrease by 10.00 or 20.00 for a 10.00 purchase?

**ANSWER**: Should decrease by 10.00 only.

**Current behavior**: Decreases by 20.00 (WRONG)

### 6. Why do ledger balance_after values show around 9,920 while account available_to_spend shows 9,910?

**ANSWER**: 
- Ledger `balance_after_transaction` = 9920.00 (calculated from availableBalance - price + commission)
- Account `available_to_spend` = 9910.00 (calculated from balance + creditLine - usedCredit)

The difference is:
- Ledger: (5000 + 5000 - 0) - 10 + 0.50 = 9990.50 (but shows 9920 due to prior transactions)
- Account: 4955 + 5000 - 45 = 9910.00

They're tracking different things. The account calculation is CORRECT, but the account fields are WRONG.

### 7. Which field is the source of truth for displayed available balance?

**ANSWER**: The account `available_to_spend` calculation is correct in formula, but the account fields (`balance`, `used_credit`) are being updated incorrectly.

**Source of truth should be**: 
```
available_to_spend = balance + (creditLine - usedCredit)
```

But this is only correct if `balance` and `usedCredit` are updated correctly per the financial model.

---

## Patch Plan

### Phase 1: Fix Account Update Logic (queue-manager.ts)

Replace lines 388-403 with corrected logic:

```typescript
// Update account balance - CORRECTED
let newBalance = parseFloat((account as any).balance);
let newUsedCredit = parseFloat((account as any).usedCredit);

if (newBalance >= price) {
  // Use balance only
  newBalance = newBalance - price;
  // usedCredit unchanged
} else {
  // Use balance + credit line
  const creditUsed = price - newBalance;
  newBalance = 0;
  newUsedCredit = newUsedCredit + creditUsed;
}

await db
  .update(providerDistributorAccounts)
  .set({
    balance: String(newBalance),
    usedCredit: String(newUsedCredit),
    version: (account as any).version + 1,
  })
  .where(
    and(
      eq(providerDistributorAccounts.providerId, providerId),
      eq(providerDistributorAccounts.distributorId, distributorId)
    )
  );
```

### Phase 2: Reconcile Test Data

For each affected purchase request with status SUCCEEDED:

```sql
-- For each purchase, recalculate correct account state
-- Example: Purchase ID 60001 (10.00 LYD)

-- Current (WRONG):
-- balance: 4955.00, usedCredit: 45.00

-- Should be (CORRECT):
-- If original balance was 5000.00:
-- balance: 4990.00, usedCredit: 0.00

-- If original balance was 0.00:
-- balance: 0.00, usedCredit: 10.00
```

---

## Migration & Reconciliation Plan

### Step 1: Identify All Affected Purchases

```sql
SELECT 
  pr.id,
  t.amount,
  pda.id as account_id,
  pda.balance,
  pda.used_credit,
  pda.credit_line,
  pda.version
FROM purchase_requests pr
JOIN transactions t ON t.idempotency_key = pr.idempotency_key
JOIN provider_distributor_accounts pda 
  ON pda.provider_id = t.provider_id 
  AND pda.distributor_id = t.distributor_id
WHERE pr.status = 'SUCCEEDED'
ORDER BY pr.updated_at DESC;
```

### Step 2: Calculate Correct State

For each affected account, we need to:
1. Get all SUCCEEDED purchases in chronological order
2. Replay each purchase with correct logic
3. Calculate final correct state

### Step 3: Update Accounts

```sql
-- Example: Account 90046 (Libyana + SEED_Anis)
-- Current: balance=4955, usedCredit=45
-- Correct: balance=4990, usedCredit=0 (if only one 10 LYD purchase)

UPDATE provider_distributor_accounts
SET 
  balance = '4990.00',
  used_credit = '0.00',
  version = version + 1
WHERE id = 90046;
```

### Step 4: Verify Ledger Consistency

```sql
-- Verify ledger entries still make sense
-- (They should, as they track the available balance at each point)
SELECT * FROM provider_distributor_ledger
WHERE provider_id = 1214740
  AND distributor_id = 1179498
ORDER BY created_at DESC;
```

---

## Implementation Priority

1. **CRITICAL**: Fix queue-manager.ts account update logic
2. **HIGH**: Reconcile test data (2 affected purchases)
3. **MEDIUM**: Add unit tests for both funding models
4. **LOW**: Rename ledger fields for clarity (balance_after_transaction → available_balance_after)

---

## Testing Strategy

### Unit Test Cases

1. **Test: Purchase with sufficient balance**
   - Input: balance=1000, creditLine=1000, usedCredit=0, purchase=100
   - Expected: balance=900, usedCredit=0, available=1900

2. **Test: Purchase with insufficient balance, sufficient credit**
   - Input: balance=50, creditLine=1000, usedCredit=0, purchase=100
   - Expected: balance=0, usedCredit=50, available=950

3. **Test: Purchase with insufficient total funds**
   - Input: balance=100, creditLine=100, usedCredit=0, purchase=300
   - Expected: ERROR - Insufficient balance

4. **Test: Multiple purchases (replay scenario)**
   - Input: balance=1000, creditLine=1000, usedCredit=0
   - Purchase 1: 600 → balance=400, usedCredit=0
   - Purchase 2: 500 → balance=0, usedCredit=100
   - Purchase 3: 100 → balance=0, usedCredit=200
   - Expected: Final available=800

---

## Affected Data

### Test Purchases (Confirmed)

| Request ID | Amount | Card ID | Before Balance | Before UsedCredit | Current Balance | Current UsedCredit | Correct Balance | Correct UsedCredit |
|-----------|--------|---------|-----------------|-------------------|-----------------|-------------------|-----------------|-------------------|
| 1 | 10.00 | 152506 | 5000.00 | 0.00 | 4990.00 | 10.00 | 4990.00 | 0.00 |
| 60001 | 10.00 | 152507 | 4990.00 | 10.00 | 4955.00 | 45.00 | 4980.00 | 0.00 |

**Note**: The second purchase shows incorrect state because it was calculated from already-incorrect first purchase state.

---

## Conclusion

The bug is a **fundamental flaw in the account update logic** that violates the intended financial model. The fix is straightforward: implement proper balance vs. credit line logic instead of always deducting from both.

**Impact**: All distributors' available balances are overstated by the sum of all their purchases. This is a **critical financial bug** that must be fixed before production use.
