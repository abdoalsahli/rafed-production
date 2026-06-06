# Run-Mode Seed Data Guide

This guide explains the realistic business data seeded into the platform for testing, demonstrations, and onboarding purposes.

## Overview

The run-mode seed data creates a complete, realistic business environment with:
- **5 Service Providers** (card issuers)
- **3 Distributors** (card resellers)
- **2,500 Prepaid Cards** across all providers
- **20 Realistic Transactions** with full ledger reconciliation
- **11 Active Relationships** with commission structures

All seeded data is tagged with `SEED_RUN_MODE` naming patterns for easy identification and cleanup.

## Seeded Data Structure

### Service Providers

| ID | Name | Provider Code | Status | Products | Cards |
|---|---|---|---|---|---|
| 1154729 | Libyana | SEED_* | active | 5 | 500 |
| 1154730 | Almadar | SEED_* | active | 5 | 500 |
| 1154731 | LTT | SEED_* | active | 5 | 500 |
| 1154732 | Connect | SEED_* | active | 5 | 500 |
| 1154733 | Giga | SEED_* | active | 5 | 500 |

### Distributors

| ID | Name | Status | Connected Providers | API Credentials |
|---|---|---|---|---|
| 1149507 | Anis | active | All 5 | Yes |
| 1149508 | iCard | active | Libyana, Almadar, LTT | Yes |
| 1149509 | Qareep | active | Libyana, Almadar, LTT | Yes |

### Products (Denominations)

Each provider has 5 products with the following denominations:
- 5 LYD Card
- 10 LYD Card
- 20 LYD Card
- 50 LYD Card
- 75 LYD Card

**Total: 25 products** (5 providers × 5 denominations)

### Card Inventory

- **Total Cards: 2,500**
- **Per Provider: 500 cards**
- **Status Distribution:**
  - 480 cards: AVAILABLE
  - 20 cards: SOLD (from transactions)

Cards are organized into batches (1 batch per provider) with encrypted PINs.

### Provider-Distributor Relationships

**Anis (5 relationships):**
- Connected to: Libyana, Almadar, LTT, Connect, Giga
- Commission: 5% (percentage-based)
- Credit Line: 10,000 LYD

**iCard (3 relationships):**
- Connected to: Libyana, Almadar, LTT
- Commission: 5% (percentage-based)
- Credit Line: 5,000 LYD

**Qareep (3 relationships):**
- Connected to: Libyana, Almadar, LTT
- Commission: 5% (percentage-based)
- Credit Line: 3,000 LYD

**Total Relationships: 11**

### Financial Accounts

Each provider-distributor relationship has a corresponding financial account with:
- Initial Balance: 0.00 LYD
- Credit Line: As per relationship
- Used Credit: 0.00 LYD (updated by transactions)

### Transaction History

**20 Sample Transactions** created for Anis distributor:
- Purchases from various providers
- Realistic pricing based on product denominations
- Full ledger reconciliation with debit and commission credit entries
- Status: All completed

**Ledger Entries per Transaction:**
1. **Purchase Debit**: Card purchase amount deducted from distributor balance
2. **Commission Credit**: 5% commission added to distributor balance

Example transaction flow:
```
Purchase 50 LYD card:
- Debit: -50 LYD (purchase)
- Credit: +2.50 LYD (5% commission)
- Net: -47.50 LYD
```

### API Credentials

Each distributor has one active API credential set:
- **Key ID**: `key_*` (unique identifier)
- **Masked Key**: `sk_live_****` (display format)
- **Secret Hash**: SHA-256 hash of the secret
- **Status**: active

## Using the Seeded Data

### Accessing Provider Dashboard

1. Log in with Google OAuth (use your own account)
2. Navigate to `/provider/dashboard`
3. Select any seeded provider (Libyana, Almadar, LTT, Connect, Giga)
4. View:
   - Product inventory
   - Card batch status
   - Distributor relationships
   - Commission structures

### Accessing Distributor Dashboard

1. Log in with Google OAuth
2. Navigate to `/distributor/dashboard`
3. Select any seeded distributor (Anis, iCard, Qareep)
4. View:
   - Connected providers
   - Available products
   - Purchase history (20 transactions for Anis)
   - Account balance and credit line
   - Transaction ledger

### Viewing Financial Ledger

1. Navigate to `/distributor/transactions`
2. View transaction history with:
   - Purchase amounts
   - Commission calculations
   - Ledger entries (debit/credit)
   - Balance reconciliation

### Testing API Integration

Use the seeded API credentials to test distributor API endpoints:
- Purchase cards
- Check account balance
- View transaction history
- Manage API keys

## Cleaning Up Seed Data

When you're ready to remove all seeded data and return to a clean state:

```bash
node scripts/cleanup-run-mode.mjs
```

**What Gets Deleted:**
- All 2,500 cards
- All 20 transactions
- All ledger entries
- All financial accounts
- All provider-distributor relationships
- All API credentials
- All 25 products
- All 5 card batches
- All 3 distributors
- All 5 providers

**What's Preserved:**
- Admin accounts (abdogiydan2000@gmail.com)
- Production data (if any)
- User authentication records
- System configuration

## Important Notes

### Admin Account Protection

The admin account `abdogiydan2000@gmail.com` is **never** modified or deleted by the seed or cleanup scripts. This account is essential for platform administration.

### Data Reconciliation

All transactions and ledger entries follow strict financial rules:
- Each purchase creates a debit entry
- Each purchase triggers a commission credit entry
- Account balances are updated atomically
- All amounts are in LYD currency

### Idempotency

Transactions use UUID-based idempotency keys to prevent duplicate processing. This ensures safe retry behavior in production.

### Tagging Strategy

All seeded records are tagged with `SEED_RUN_MODE` in:
- Provider codes: `SEED_*`
- Batch filenames: `SEED_RUN_MODE_*`
- Distributor names: Anis, iCard, Qareep (recognizable names for testing)

This makes it easy to identify and clean up seed data later.

## Troubleshooting

### Seed Script Fails

If the seed script encounters errors:

1. Check database connection: `echo $DATABASE_URL`
2. Verify MySQL is running and accessible
3. Check for existing seed data: `SELECT COUNT(*) FROM service_providers WHERE provider_code LIKE 'SEED_%'`
4. If data exists, run cleanup first: `node scripts/cleanup-run-mode.mjs`
5. Re-run seed: `node scripts/seed-run-mode.mjs`

### Cards Not Appearing

If cards don't show in the UI:

1. Verify cards were created: `SELECT COUNT(*) FROM cards`
2. Check card status: `SELECT status, COUNT(*) FROM cards GROUP BY status`
3. Verify provider-distributor relationships exist
4. Check financial accounts are created

### Transactions Not Visible

If transactions don't appear in the ledger:

1. Verify transactions exist: `SELECT COUNT(*) FROM transactions`
2. Check ledger entries: `SELECT COUNT(*) FROM provider_distributor_ledger`
3. Verify account balances updated: `SELECT balance FROM provider_distributor_accounts`

## Performance Considerations

- **2,500 cards** may take 30-60 seconds to insert
- **20 transactions** with ledger entries take 10-20 seconds
- **Total seed time**: ~2-3 minutes

For faster seeding, reduce the card count in `scripts/seed-run-mode.mjs`:
```javascript
// Change from 500 to 100 cards per provider
for (let i = 0; i < 100; i++) {
  // Create card...
}
```

## Next Steps

After seeding:

1. **Test Provider Features**: Upload new card batches, manage distributors, view analytics
2. **Test Distributor Features**: Purchase cards, check balance, view transaction history
3. **Test API Integration**: Use API credentials to test programmatic access
4. **Test Financial Reconciliation**: Verify ledger entries match account balances
5. **Test Cleanup**: Run cleanup script and verify all data is removed

## Support

For issues or questions about the run-mode seed data:

1. Check the troubleshooting section above
2. Review database schema in `drizzle/schema.ts`
3. Check seed script logic in `scripts/seed-run-mode.mjs`
4. Review cleanup script in `scripts/cleanup-run-mode.mjs`
