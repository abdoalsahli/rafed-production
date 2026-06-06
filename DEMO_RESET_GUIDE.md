# Demo Reset Utility Guide

## Overview

The demo reset utility (`scripts/reset-demo-data.mjs`) allows you to safely reset demo data between client presentations. It resets all demo transactions, card statuses, and account balances while preserving the demo provider/product structure.

---

## What Gets Reset

### ✅ Reset (Cleared/Restored)

- **Card Statuses**: All SOLD cards reset to AVAILABLE
- **Transactions**: All demo purchase transactions cleared
- **Ledger Entries**: All demo financial ledger entries cleared
- **Account Balances**: Restored to original seeded values (100,000 LYD per account)
- **Used Credit**: Reset to 0

### ✅ Preserved (Not Affected)

- **Demo Providers**: Libyana, Almadar, LTT, Connect, Giga
- **Demo Distributors**: Demo Distributor 1, 2, 3
- **Demo Products**: All 125 products (5 per provider)
- **Provider-Distributor Relationships**: All 15 active relationships
- **API Credentials**: All 3 API keys and credentials
- **Card Inventory**: Total count remains 1,250 (just status changes)

---

## Safety Features

### Demo Record Identification

The utility only affects records created during demo seeding, identified by the timestamp suffix `1777407398700`:

- Provider codes: `LIBYANA_1777407398700`, `ALMADAR_1777407398700`, etc.
- Distributor names: `Demo Distributor 1 - 1777407398700`, etc.

### Confirmation Required

The utility requires an explicit `--confirm-demo-reset` flag to execute. Running without the flag shows help text and exits safely.

### Verification Steps

Before and after reset, the utility verifies:
- Demo records are correctly identified
- All changes are applied successfully
- No unintended data remains

---

## How to Use

### Basic Usage

```bash
# Show help (no changes made)
node scripts/reset-demo-data.mjs

# Execute reset (requires confirmation flag)
DATABASE_URL="$DATABASE_URL" node scripts/reset-demo-data.mjs --confirm-demo-reset
```

### Step-by-Step

1. **Before Client Demo**
   - Run the purchase workflow validation: `node scripts/validate-purchase-workflow.mjs`
   - Verify all demo data is in place

2. **After Client Demo**
   - Run the reset utility: `node scripts/reset-demo-data.mjs --confirm-demo-reset`
   - Verify output shows all records reset
   - Confirm "Ready for next client demonstration"

3. **Before Next Demo**
   - Run validation again to verify reset worked
   - Proceed with next client presentation

---

## Output Example

```
🔄 Starting demo data reset...

STEP 1: Identifying demo records
✓ Found 5 demo providers
✓ Found 3 demo distributors

STEP 2: Counting records before reset
✓ Sold cards to reset: 1
✓ Transactions to clear: 1
✓ Ledger entries to clear: 0

STEP 3: Capturing original balance values
✓ Original balance: 100000
✓ Original used credit: 0

STEP 4: Resetting card statuses
✓ Reset 1 cards to AVAILABLE

STEP 5: Clearing transactions
✓ Deleted 1 transactions

STEP 6: Clearing ledger entries
✓ Deleted 0 ledger entries

STEP 7: Restoring account balances
✓ Reset 5 account balances

STEP 8: Verifying reset
✓ Sold cards remaining: 0
✓ Transactions remaining: 0
✓ Ledger entries remaining: 0
✓ Accounts with original balance: 5

=== RESET SUMMARY ===
✅ Demo data reset completed successfully!

Changes:
  • 1 cards reset to AVAILABLE
  • 1 transactions cleared
  • 0 ledger entries cleared
  • 5 account balances restored

Preserved:
  • 5 demo providers
  • 3 demo distributors
  • Demo products
  • Provider-distributor relationships
  • API credentials

✓ Ready for next client demonstration
```

---

## When to Run Reset

| Scenario | Action |
|----------|--------|
| After each client demo | Run reset |
| Before next demo | Verify with validation script |
| Between multiple demos same day | Run reset between each |
| Before publishing to production | Ensure no demo data remains |
| During development | Use for testing demo workflow |

---

## Warnings & Precautions

### ⚠️ Important

- **Confirmation Required**: Always use `--confirm-demo-reset` flag
- **Backup First**: Consider backing up database before first use
- **Test First**: Run validation script after reset to confirm it worked
- **Demo Only**: This utility ONLY affects demo records (timestamp-identified)

### ❌ What NOT to Do

- Do NOT run without the `--confirm-demo-reset` flag in production scripts
- Do NOT modify the utility to remove the confirmation requirement
- Do NOT run against production databases without careful verification
- Do NOT assume it's safe without understanding the demo identifier

---

## Troubleshooting

### Issue: "No demo data found"

**Cause**: Demo data doesn't exist or has different timestamp

**Solution**: 
1. Verify demo data was seeded: `node scripts/seed-demo-data-simple.mjs`
2. Check timestamp in database matches `1777407398700`
3. Update script if using different timestamp

### Issue: Reset didn't work

**Cause**: Database connection or permissions issue

**Solution**:
1. Verify `DATABASE_URL` is set correctly
2. Check database credentials and permissions
3. Run validation script to verify: `node scripts/validate-purchase-workflow.mjs`

### Issue: Some data wasn't reset

**Cause**: Data may not be identified as demo data

**Solution**:
1. Check data has correct timestamp identifier
2. Verify in database: `SELECT * FROM transactions WHERE distributor_id IN (SELECT id FROM distributors WHERE name LIKE '%1777407398700%')`
3. Manually delete if necessary

---

## Workflow Example

### Demo Workflow

```bash
# 1. Seed demo data (once)
DATABASE_URL="$DATABASE_URL" node scripts/seed-demo-data-simple.mjs

# 2. Validate purchase workflow
DATABASE_URL="$DATABASE_URL" node scripts/validate-purchase-workflow.mjs

# 3. Run client demo
# ... (client uses the platform)

# 4. Reset after demo
DATABASE_URL="$DATABASE_URL" node scripts/reset-demo-data.mjs --confirm-demo-reset

# 5. Verify reset worked
DATABASE_URL="$DATABASE_URL" node scripts/validate-purchase-workflow.mjs

# 6. Ready for next demo
```

---

## Technical Details

### Demo Record Identification

The utility identifies demo records by the timestamp suffix `1777407398700` which was added during seeding:

```sql
-- Demo providers
SELECT * FROM service_providers 
WHERE provider_code LIKE '%1777407398700%'

-- Demo distributors
SELECT * FROM distributors 
WHERE name LIKE '%1777407398700%'

-- Demo accounts
SELECT * FROM provider_distributor_accounts
WHERE provider_id IN (SELECT id FROM service_providers WHERE provider_code LIKE '%1777407398700%')
```

### Reset Operations

1. **Card Status Reset**: `UPDATE cards SET status = 'AVAILABLE' WHERE provider_id IN (...)`
2. **Transaction Delete**: `DELETE FROM transactions WHERE provider_id IN (...) AND distributor_id IN (...)`
3. **Ledger Delete**: `DELETE FROM provider_distributor_ledger WHERE provider_id IN (...) AND distributor_id IN (...)`
4. **Balance Restore**: `UPDATE provider_distributor_accounts SET balance = 100000, used_credit = 0 WHERE ...`

### Verification

After reset, the utility verifies:
- No SOLD cards remain for demo providers
- No transactions remain for demo provider-distributor pairs
- No ledger entries remain
- All accounts have original balance (100,000) and used_credit (0)

---

## Support

For issues or questions:

1. Check this guide's Troubleshooting section
2. Review script output for specific error messages
3. Verify database connection and permissions
4. Run validation script to diagnose issues
5. Check database directly for data state

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-28 | Initial release with safety checks and verification |

---

## Related Scripts

- `scripts/seed-demo-data-simple.mjs` - Initial demo data seeding
- `scripts/validate-purchase-workflow.mjs` - Validate purchase workflow
- `scripts/setup-demo-relationships.mjs` - Setup provider-distributor relationships
- `DEMO_GUIDE.md` - Demo walkthrough guide
- `DEMO_DATA_VERIFICATION.md` - Demo data verification report
