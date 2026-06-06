# Demo Scripts Reference

This directory contains utilities for managing demo data and validating the purchase workflow for client presentations.

---

## Quick Start

```bash
# 1. Seed demo data (one-time setup)
DATABASE_URL="$DATABASE_URL" node scripts/seed-demo-data-simple.mjs

# 2. Validate purchase workflow works
DATABASE_URL="$DATABASE_URL" node scripts/validate-purchase-workflow.mjs

# 3. Run client demo
# ... (client uses the platform)

# 4. Reset demo data after demo
DATABASE_URL="$DATABASE_URL" node scripts/reset-demo-data.mjs --confirm-demo-reset

# 5. Verify reset worked
DATABASE_URL="$DATABASE_URL" node scripts/validate-purchase-workflow.mjs
```

---

## Available Scripts

### 1. `seed-demo-data-simple.mjs`

**Purpose**: Initialize demo data for client presentations

**What it creates**:
- 5 demo providers (Libyana, Almadar, LTT, Connect, Giga)
- 3 demo distributors
- 125 demo products (5 denominations × 5 providers)
- 1,250 demo cards (50 per denomination per provider)
- 3 demo API credentials

**Usage**:
```bash
DATABASE_URL="$DATABASE_URL" node scripts/seed-demo-data-simple.mjs
```

**Output**:
- Demo account IDs (needed for login)
- API credentials (for API testing)
- Summary of created data

**When to run**:
- Once at the beginning of demo setup
- When you need fresh demo data from scratch

---

### 2. `validate-purchase-workflow.mjs`

**Purpose**: Verify the complete purchase workflow works end-to-end

**What it validates**:
- ✓ Provider relationships exist
- ✓ Products are available
- ✓ Cards are in stock
- ✓ Purchase executes successfully
- ✓ Card status changes to SOLD
- ✓ Inventory decreases
- ✓ Balance updates correctly
- ✓ Commission is calculated
- ✓ Transaction is recorded
- ✓ Idempotency works (duplicate key rejected)

**Usage**:
```bash
DATABASE_URL="$DATABASE_URL" node scripts/validate-purchase-workflow.mjs
```

**Output**:
- Detailed validation results
- Financial summary (before/after balances)
- Inventory summary (card counts)
- Transaction details
- All validation checks status

**When to run**:
- After seeding demo data (to verify setup)
- After resetting demo data (to verify reset worked)
- Before each client demo (to ensure everything is ready)
- After client demo (to verify workflow still works)

---

### 3. `reset-demo-data.mjs`

**Purpose**: Reset demo data between client presentations

**What it resets**:
- Card statuses (SOLD → AVAILABLE)
- Transactions (cleared)
- Ledger entries (cleared)
- Account balances (restored to 100,000)
- Used credit (reset to 0)

**What it preserves**:
- Demo providers
- Demo distributors
- Demo products
- Provider-distributor relationships
- API credentials

**Usage**:
```bash
# Show help (no changes)
DATABASE_URL="$DATABASE_URL" node scripts/reset-demo-data.mjs

# Execute reset (requires confirmation)
DATABASE_URL="$DATABASE_URL" node scripts/reset-demo-data.mjs --confirm-demo-reset
```

**Output**:
- Records reset summary
- Cards reset count
- Transactions cleared count
- Ledger entries cleared count
- Balances restored count
- Verification results

**When to run**:
- After each client demo
- Between multiple demos on the same day
- When you want to reset to clean state

**Safety**:
- Requires `--confirm-demo-reset` flag
- Only affects demo records (identified by timestamp)
- Verifies reset completed successfully

---

### 4. `setup-demo-relationships.mjs`

**Purpose**: Create provider-distributor relationships and accounts

**What it creates**:
- 15 provider-distributor relationships (5 providers × 3 distributors)
- 15 provider-distributor accounts with initial balances

**Usage**:
```bash
DATABASE_URL="$DATABASE_URL" node scripts/setup-demo-relationships.mjs
```

**When to run**:
- Automatically called during seed process
- Manually if relationships are missing

---

## Demo Accounts

After seeding, use these distributor IDs to log in:

| Distributor | ID | Status |
|---|---|---|
| Demo Distributor 1 | 1029525 | Active |
| Demo Distributor 2 | 1029526 | Active |
| Demo Distributor 3 | 1029527 | Active |

---

## Demo Providers

| Provider | ID | Products |
|---|---|---|
| Libyana | 1034760 | 5 (5, 10, 20, 50, 75 LYD) |
| Almadar | 1034761 | 5 (5, 10, 20, 50, 75 LYD) |
| LTT | 1034762 | 5 (5, 10, 20, 50, 75 LYD) |
| Connect | 1034763 | 5 (5, 10, 20, 50, 75 LYD) |
| Giga | 1034764 | 5 (5, 10, 20, 50, 75 LYD) |

---

## Demo API Credentials

After seeding, API credentials are available for each distributor:

- **Distributor 1**: `sk_live_b5edad26462c`
- **Distributor 2**: `sk_live_118464a45db9`
- **Distributor 3**: `sk_live_8918ffc4f524`

View credentials in the app at `/distributor/api` page.

---

## Complete Demo Workflow

### Setup Phase (Once)

```bash
# 1. Seed demo data
DATABASE_URL="$DATABASE_URL" node scripts/seed-demo-data-simple.mjs

# 2. Validate everything works
DATABASE_URL="$DATABASE_URL" node scripts/validate-purchase-workflow.mjs

# 3. Review demo accounts and credentials
# Note down distributor IDs and API keys
```

### Demo Phase (Per Client)

```bash
# 1. Before demo - verify everything is ready
DATABASE_URL="$DATABASE_URL" node scripts/validate-purchase-workflow.mjs

# 2. Run client demo
# - Log in as Demo Distributor 1 (ID: 1029525)
# - Show provider relationships
# - Show available products
# - Execute a purchase
# - Show transaction history
# - Show API credentials

# 3. After demo - reset for next client
DATABASE_URL="$DATABASE_URL" node scripts/reset-demo-data.mjs --confirm-demo-reset

# 4. Verify reset worked
DATABASE_URL="$DATABASE_URL" node scripts/validate-purchase-workflow.mjs
```

---

## Troubleshooting

### No demo data found
- Run seed script: `node scripts/seed-demo-data-simple.mjs`
- Verify DATABASE_URL is set correctly

### Validation fails
- Check database connection
- Verify demo data was seeded
- Run reset and try again

### Reset doesn't work
- Ensure `--confirm-demo-reset` flag is used
- Check database permissions
- Verify demo records exist

### Purchase workflow fails
- Run validation to get detailed error
- Check database for demo data
- Verify provider relationships exist

---

## Documentation

- **DEMO_GUIDE.md** - Detailed demo walkthrough for client presentations
- **DEMO_DATA_VERIFICATION.md** - Verification report of seeded data
- **DEMO_RESET_GUIDE.md** - Detailed reset utility documentation

---

## Support

For issues:
1. Check script output for error messages
2. Review troubleshooting section above
3. Check documentation files
4. Verify database connection and permissions
