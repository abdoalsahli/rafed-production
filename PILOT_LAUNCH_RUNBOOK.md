# Prepaid Card Platform - Pilot Launch Runbook

**Version:** 1.0  
**Last Updated:** April 18, 2026  
**Status:** Ready for Pilot Launch  

---

## Table of Contents

1. [Pre-Launch Checklist](#pre-launch-checklist)
2. [Provider Onboarding](#provider-onboarding)
3. [Distributor Onboarding](#distributor-onboarding)
4. [Access Request Approval](#access-request-approval)
5. [Account Top-Up Procedure](#account-top-up-procedure)
6. [Purchase Verification](#purchase-verification)
7. [Refund Procedure](#refund-procedure)
8. [Suspend/Reactivate Procedure](#suspendractivate-procedure)
9. [Monitoring & Alert Response](#monitoring--alert-response)
10. [Daily Operational Checklist](#daily-operational-checklist)
11. [Rollback & Incident Response](#rollback--incident-response)

---

## Pre-Launch Checklist

### Infrastructure & Database
- [ ] Database connection verified (test query: `SELECT 1`)
- [ ] monitoring_alerts table exists: `SHOW TABLES LIKE 'monitoring_alerts'`
- [ ] All required tables present: `SHOW TABLES` (should show 16 tables)
- [ ] Database backups configured and tested
- [ ] SSL/TLS certificates valid and not expiring within 30 days
- [ ] Dev server running without errors: `pnpm run dev`
- [ ] TypeScript compilation clean: `pnpm tsc --noEmit`

### API & Backend
- [ ] All tRPC endpoints responding: `curl https://[domain]/api/trpc/auth.me`
- [ ] OAuth integration working: test login flow in browser
- [ ] Financial service tests passing: `pnpm test -- financial.service.test.ts`
- [ ] Refund service tests passing: `pnpm test -- refund.flow.test.ts`
- [ ] Provider endpoints responding: `curl https://[domain]/api/trpc/provider.dashboard`
- [ ] Distributor endpoints responding: `curl https://[domain]/api/trpc/financial.accountBalance`

### Frontend & UI
- [ ] Distributor Dashboard loads without errors
- [ ] Provider Dashboard loads without errors
- [ ] All navigation links working
- [ ] Forms submit and validate correctly
- [ ] Error messages display properly
- [ ] Loading states visible during API calls
- [ ] Mobile responsiveness verified (test on phone/tablet)

### Security & Compliance
- [ ] All sensitive data masked in UI (PINs, full API keys)
- [ ] Authorization checks working (test cross-provider access denial)
- [ ] HTTPS enforced (no HTTP fallback)
- [ ] CORS headers correct
- [ ] Rate limiting configured
- [ ] Audit logging enabled

### Monitoring & Alerts
- [ ] Alert system functional: test alert creation
- [ ] Dashboard metrics calculating correctly
- [ ] Monitoring dashboard accessible
- [ ] Alert thresholds configured (low balance, low inventory)
- [ ] Notification channels tested (email, Slack if configured)

### Documentation & Runbooks
- [ ] This runbook reviewed and updated
- [ ] Escalation contacts documented
- [ ] Incident response procedures tested
- [ ] Rollback procedures documented and tested

---

## Provider Onboarding

### Step 1: Create Provider Account (Admin)

**Location:** Admin panel or direct database  
**Time Required:** 5 minutes

**Via API (if admin endpoint exists):**
```bash
curl -X POST https://[domain]/api/trpc/admin.createProvider \
  -H "Authorization: Bearer [admin-token]" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Provider Name",
    "status": "active"
  }'
```

**Via Database (direct):**
```sql
INSERT INTO service_providers (name, status, createdAt, updatedAt)
VALUES ('Provider Name', 'active', NOW(), NOW());
```

**Verification:**
```sql
SELECT id, name, status FROM service_providers WHERE name = 'Provider Name';
```

**Expected Output:** Provider ID (e.g., 12345)

---

### Step 2: Send Provider Login Link

**Location:** Email or manual link sharing  
**Time Required:** 2 minutes

**Login URL Format:**
```
https://[domain]/login?returnPath=/provider/dashboard
```

**Provider Actions:**
1. Click login link
2. Authenticate via OAuth
3. Redirected to Provider Dashboard
4. Verify dashboard loads with "No distributors" message

**Verification Checklist:**
- [ ] Provider can log in
- [ ] Dashboard loads without errors
- [ ] No data visible (fresh account)
- [ ] Navigation menu visible

---

### Step 3: Configure Provider Settings (Optional)

**Location:** Provider Settings page (if implemented)  
**Time Required:** 5 minutes

**Settings to Configure:**
- Commission default rates
- Credit line limits
- Notification preferences
- API key generation (if applicable)

**Verification:**
- [ ] Settings saved successfully
- [ ] Settings persist after logout/login

---

### Step 4: Verify Provider Dashboard

**Location:** Provider Dashboard  
**Time Required:** 3 minutes

**Expected Metrics:**
- Total Revenue: $0.00 (new provider)
- Commission Paid: $0.00
- Active Distributors: 0
- Pending Requests: 0

**Verification Checklist:**
- [ ] All metrics display correctly
- [ ] No errors in console
- [ ] Charts/graphs render (if applicable)
- [ ] Refresh button works

---

## Distributor Onboarding

### Step 1: Create Distributor Account (Admin)

**Location:** Admin panel or direct database  
**Time Required:** 5 minutes

**Via Database:**
```sql
INSERT INTO distributors (name, status, createdAt, updatedAt)
VALUES ('Distributor Name', 'active', NOW(), NOW());
```

**Verification:**
```sql
SELECT id, name, status FROM distributors WHERE name = 'Distributor Name';
```

**Expected Output:** Distributor ID (e.g., 67890)

---

### Step 2: Send Distributor Login Link

**Location:** Email or manual link sharing  
**Time Required:** 2 minutes

**Login URL Format:**
```
https://[domain]/login?returnPath=/distributor/dashboard-v2
```

**Distributor Actions:**
1. Click login link
2. Authenticate via OAuth
3. Redirected to Distributor Dashboard
4. Verify dashboard loads with $0 balance

**Verification Checklist:**
- [ ] Distributor can log in
- [ ] Dashboard loads without errors
- [ ] Balance shows $0.00
- [ ] Navigation menu visible

---

### Step 3: Verify Distributor Dashboard

**Location:** Distributor Dashboard  
**Time Required:** 3 minutes

**Expected Metrics:**
- Total Balance: $0.00
- Available to Spend: $0.00
- Used Credit: $0.00
- Connected Providers: 0
- Pending Requests: 0

**Verification Checklist:**
- [ ] All metrics display correctly
- [ ] No errors in console
- [ ] Empty state message visible
- [ ] Refresh button works

---

## Access Request Approval

### Step 1: Distributor Requests Access (Distributor)

**Location:** Distributor Dashboard → Providers section  
**Time Required:** 5 minutes

**Procedure:**
1. Navigate to Providers page
2. Click "Request Access" button
3. Select provider from dropdown
4. Enter requested commission rate (e.g., 5%)
5. Enter requested credit line (e.g., $1,000)
6. Click "Submit Request"

**Expected Response:**
```json
{
  "message": "Access request submitted",
  "requestId": 12345,
  "status": "pending"
}
```

**Verification:**
```sql
SELECT id, distributor_id, provider_id, status, requested_commission, requested_credit_line
FROM access_requests
WHERE distributor_id = [distributor_id]
ORDER BY createdAt DESC LIMIT 1;
```

---

### Step 2: Provider Reviews Request (Provider)

**Location:** Provider Dashboard → Requests section  
**Time Required:** 5 minutes

**Procedure:**
1. Navigate to Provider Dashboard
2. Go to "Pending Requests" section
3. Review distributor name, requested commission, requested credit line
4. Click "View Details" for more information

**Expected Display:**
- Distributor Name
- Requested Commission: 5%
- Requested Credit Line: $1,000
- Request Date: [timestamp]

---

### Step 3: Provider Approves Request (Provider)

**Location:** Provider Dashboard → Requests section  
**Time Required:** 3 minutes

**Procedure:**
1. Click "Approve" button on request
2. Confirm commission rate (can modify if needed)
3. Confirm credit line (can modify if needed)
4. Click "Confirm Approval"

**Expected Response:**
```json
{
  "message": "Request approved",
  "relationshipId": 54321,
  "commissionRate": 5,
  "creditLine": 1000
}
```

**Verification:**
```sql
-- Verify relationship created
SELECT id, provider_id, distributor_id, status, commission_rate, credit_line
FROM provider_distributor_relationships
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id];

-- Verify account created
SELECT provider_id, distributor_id, balance, credit_line, used_credit
FROM provider_distributor_accounts
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id];

-- Verify request status updated
SELECT status FROM access_requests WHERE id = [request_id];
```

**Expected Results:**
- Relationship status: "active"
- Account balance: $0.00 (no topup yet)
- Credit line: $1,000
- Request status: "approved"

---

### Step 4: Distributor Verifies Access (Distributor)

**Location:** Distributor Dashboard → Providers section  
**Time Required:** 3 minutes

**Procedure:**
1. Refresh Distributor Dashboard
2. Navigate to Providers page
3. Verify provider appears in "Connected Providers" list
4. Click provider to view details

**Expected Display:**
- Provider Name
- Status: "Active"
- Commission Rate: 5%
- Credit Line: $1,000
- Available to Spend: $1,000 (balance $0 + credit line $1,000)

---

## Account Top-Up Procedure

### Step 1: Provider Initiates Top-Up (Provider)

**Location:** Provider Dashboard → Distributor Details  
**Time Required:** 5 minutes

**Procedure:**
1. Navigate to Provider Dashboard
2. Go to "Active Distributors" section
3. Find distributor to top-up
4. Click "Top-Up Account" button
5. Enter top-up amount (e.g., $5,000)
6. Click "Confirm Top-Up"

**Expected Response:**
```json
{
  "message": "Top-up successful",
  "topupId": 99999,
  "amount": 5000,
  "newBalance": 5000,
  "timestamp": "2026-04-18T12:00:00Z"
}
```

**Verification:**
```sql
-- Check ledger entry
SELECT id, provider_id, distributor_id, type, amount, balance_after_transaction, created_at
FROM provider_distributor_ledger
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id]
AND type = 'topup_credit'
ORDER BY created_at DESC LIMIT 1;

-- Check account balance
SELECT balance, credit_line, used_credit
FROM provider_distributor_accounts
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id];
```

**Expected Results:**
- Ledger entry created with type "topup_credit"
- Amount: $5,000
- Balance after transaction: $5,000
- Account balance updated to $5,000

---

### Step 2: Distributor Verifies Top-Up (Distributor)

**Location:** Distributor Dashboard  
**Time Required:** 2 minutes

**Procedure:**
1. Refresh Distributor Dashboard
2. Verify "Total Balance" updated to $5,000
3. Navigate to Wallet page
4. Verify balance reflects in wallet

**Expected Display:**
- Total Balance: $5,000.00
- Available to Spend: $5,000.00 (no used credit)
- Recent Transaction: Top-up $5,000

---

## Purchase Verification

### Step 1: Distributor Initiates Purchase (Distributor)

**Location:** Distributor Dashboard or Purchase Flow  
**Time Required:** 3 minutes

**Procedure:**
1. Navigate to purchase flow (if available)
2. Select provider
3. Select product/card type
4. Enter quantity (e.g., 1 card)
5. Verify price ($100 per card)
6. Click "Purchase"

**Expected Response:**
```json
{
  "message": "Purchase successful",
  "transactionId": 88888,
  "amount": 100,
  "commission": 5,
  "newBalance": 4895,
  "timestamp": "2026-04-18T12:05:00Z"
}
```

**Verification:**
```sql
-- Check transaction
SELECT id, distributor_id, provider_id, amount, commission_amount, status, created_at
FROM transactions
WHERE distributor_id = [distributor_id]
ORDER BY created_at DESC LIMIT 1;

-- Check ledger entries (should be 2: purchase debit + commission credit)
SELECT id, provider_id, distributor_id, type, amount, balance_after_transaction, created_at
FROM provider_distributor_ledger
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id]
ORDER BY created_at DESC LIMIT 2;

-- Check account balance
SELECT balance, used_credit FROM provider_distributor_accounts
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id];
```

**Expected Results:**
- Transaction status: "completed"
- Two ledger entries: purchase_debit ($100) + commission_credit ($5)
- Account balance: $4,895 (5000 - 100 + 5)
- Used credit: $0

---

### Step 2: Distributor Verifies Purchase (Distributor)

**Location:** Distributor Dashboard → Transactions  
**Time Required:** 2 minutes

**Procedure:**
1. Navigate to Transactions page
2. Verify latest transaction appears
3. Verify amount, commission, and new balance
4. Click transaction for details

**Expected Display:**
- Transaction ID
- Provider Name
- Amount: $100.00
- Commission: $5.00
- New Balance: $4,895.00
- Status: Completed
- Timestamp

---

### Step 3: Verify Provider Metrics Updated (Provider)

**Location:** Provider Dashboard  
**Time Required:** 2 minutes

**Procedure:**
1. Navigate to Provider Dashboard
2. Refresh page
3. Verify metrics updated

**Expected Metrics:**
- Total Revenue: $100.00 (purchase amount)
- Commission Paid: $5.00
- Recent Sales: 1 transaction visible

**Verification:**
```sql
-- Check provider dashboard metrics
SELECT 
  SUM(CASE WHEN type = 'purchase_debit' THEN amount ELSE 0 END) as total_revenue,
  SUM(CASE WHEN type = 'commission_credit' THEN amount ELSE 0 END) as commission_paid,
  COUNT(DISTINCT CASE WHEN type = 'purchase_debit' THEN reference_id END) as transaction_count
FROM provider_distributor_ledger
WHERE provider_id = [provider_id];
```

---

## Refund Procedure

### Step 1: Initiate Refund (Admin or Distributor)

**Location:** Transaction Details or Admin Panel  
**Time Required:** 5 minutes

**Procedure:**
1. Navigate to transaction to refund
2. Click "Request Refund" or "Initiate Refund"
3. Enter refund reason (e.g., "Customer request")
4. Click "Confirm Refund"

**Expected Response:**
```json
{
  "message": "Refund processed",
  "refundId": 77777,
  "transactionId": 88888,
  "refundAmount": 100,
  "commissionReversal": 5,
  "newBalance": 5000,
  "timestamp": "2026-04-18T12:10:00Z"
}
```

**Verification:**
```sql
-- Check refund entries in ledger
SELECT id, provider_id, distributor_id, type, amount, balance_after_transaction, reference_id, created_at
FROM provider_distributor_ledger
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id]
AND reference_id = [transaction_id]
ORDER BY created_at DESC;

-- Check transaction status
SELECT status FROM transactions WHERE id = [transaction_id];

-- Check account balance restored
SELECT balance FROM provider_distributor_accounts
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id];
```

**Expected Results:**
- Two refund entries: refund_debit ($100) + refund_credit ($5)
- Transaction status: "refunded"
- Account balance: $5,000 (restored to pre-purchase state)

---

### Step 2: Verify Refund Completed (Distributor)

**Location:** Distributor Dashboard → Transactions  
**Time Required:** 2 minutes

**Procedure:**
1. Navigate to Transactions page
2. Find original transaction
3. Verify status shows "Refunded"
4. Verify refund entries appear in ledger

**Expected Display:**
- Original Transaction: Status "Refunded"
- Refund Entry: -$100 (reversal)
- New Balance: $5,000

---

### Step 3: Verify Provider Metrics Reversed (Provider)

**Location:** Provider Dashboard  
**Time Required:** 2 minutes

**Procedure:**
1. Navigate to Provider Dashboard
2. Refresh page
3. Verify metrics reflect refund

**Expected Metrics:**
- Total Revenue: $0.00 (if only one transaction)
- Commission Paid: $0.00 (if only one transaction)
- Recent Sales: Shows refund transaction

---

## Suspend/Reactivate Procedure

### Step 1: Suspend Distributor (Provider)

**Location:** Provider Dashboard → Active Distributors  
**Time Required:** 3 minutes

**Procedure:**
1. Navigate to Provider Dashboard
2. Go to "Active Distributors" section
3. Find distributor to suspend
4. Click "Suspend" button
5. Enter reason (e.g., "Non-payment")
6. Click "Confirm Suspend"

**Expected Response:**
```json
{
  "message": "Distributor suspended",
  "relationshipId": 54321,
  "status": "suspended",
  "timestamp": "2026-04-18T12:15:00Z"
}
```

**Verification:**
```sql
SELECT status FROM provider_distributor_relationships
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id];
```

**Expected Result:** Status = "suspended"

---

### Step 2: Verify Purchase Blocked (Distributor)

**Location:** Distributor Dashboard  
**Time Required:** 3 minutes

**Procedure:**
1. Refresh Distributor Dashboard
2. Navigate to purchase flow
3. Attempt to purchase card
4. Verify error message appears

**Expected Error Message:**
```
"Cannot process purchase: relationship suspended. Contact provider for details."
```

**Verification:**
```sql
-- Attempt purchase (will fail with error)
-- Check relationship status is suspended
SELECT status FROM provider_distributor_relationships
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id];
```

---

### Step 3: Reactivate Distributor (Provider)

**Location:** Provider Dashboard → Suspended Distributors  
**Time Required:** 3 minutes

**Procedure:**
1. Navigate to Provider Dashboard
2. Go to "Suspended Distributors" section (or filter)
3. Find distributor to reactivate
4. Click "Reactivate" button
5. Click "Confirm Reactivate"

**Expected Response:**
```json
{
  "message": "Distributor reactivated",
  "relationshipId": 54321,
  "status": "active",
  "timestamp": "2026-04-18T12:20:00Z"
}
```

**Verification:**
```sql
SELECT status FROM provider_distributor_relationships
WHERE provider_id = [provider_id] AND distributor_id = [distributor_id];
```

**Expected Result:** Status = "active"

---

### Step 4: Verify Purchase Works Again (Distributor)

**Location:** Distributor Dashboard  
**Time Required:** 3 minutes

**Procedure:**
1. Refresh Distributor Dashboard
2. Navigate to purchase flow
3. Attempt to purchase card
4. Verify purchase succeeds

**Expected Response:**
```json
{
  "message": "Purchase successful",
  "transactionId": 66666,
  "amount": 100,
  "newBalance": 4795
}
```

---

## Monitoring & Alert Response

### Step 1: Monitor Dashboard Metrics

**Location:** Monitoring Dashboard (if available)  
**Frequency:** Every 4 hours or continuous

**Metrics to Monitor:**
- Active providers: Should be > 0
- Active distributors: Should be > 0
- Total transactions: Should increase
- Failed transactions: Should be 0 or very low
- Average response time: Should be < 500ms
- Database connection status: Should be "healthy"

**Verification Procedure:**
```bash
# Check API health
curl https://[domain]/api/health

# Check database
curl https://[domain]/api/trpc/admin.health

# Check recent transactions
curl https://[domain]/api/trpc/admin.getRecentTransactions
```

---

### Step 2: Alert Threshold Configuration

**Location:** Monitoring System Configuration  
**Time Required:** 10 minutes (one-time setup)

**Thresholds to Set:**
- Low Balance Alert: Trigger when distributor balance < $500
- Low Inventory Alert: Trigger when available cards < 100 per product
- High Failed Transaction Rate: Trigger when > 5% of transactions fail
- Response Time Alert: Trigger when API response time > 1000ms
- Database Connection Alert: Trigger on connection failure

**Configuration Example:**
```sql
-- Create alert threshold (if custom table exists)
INSERT INTO alert_thresholds (rule_name, threshold_value, alert_type)
VALUES ('low_balance', 500, 'warning');
```

---

### Step 3: Respond to Low Balance Alert

**Alert Trigger:** Distributor balance < $500  
**Response Time:** Within 1 hour

**Procedure:**
1. Identify affected distributor from alert
2. Log into Provider Dashboard
3. Navigate to distributor details
4. Review recent transactions
5. Determine if top-up needed
6. If needed, initiate top-up (see Account Top-Up Procedure)
7. Notify distributor via email/SMS if configured

**Verification:**
```sql
-- Check distributor balance
SELECT provider_id, distributor_id, balance, credit_line, used_credit
FROM provider_distributor_accounts
WHERE balance < 500;

-- Check if top-up was processed
SELECT * FROM provider_distributor_ledger
WHERE type = 'topup_credit'
ORDER BY created_at DESC LIMIT 1;
```

---

### Step 4: Respond to Failed Transaction Alert

**Alert Trigger:** Transaction status = "failed"  
**Response Time:** Immediate (within 15 minutes)

**Procedure:**
1. Identify failed transaction from alert
2. Check transaction details:
   ```sql
   SELECT * FROM transactions WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1;
   ```
3. Determine failure reason (insufficient balance, suspended relationship, etc.)
4. If balance issue: Initiate top-up
5. If relationship issue: Check if suspended
6. If system issue: Check logs and restart service if needed
7. Retry transaction if appropriate
8. Notify affected parties

**Common Failure Reasons:**
- Insufficient balance: Top-up required
- Suspended relationship: Reactivate required
- Invalid product: Check product status
- System error: Check logs and restart

---

### Step 5: Review Alert History

**Location:** Monitoring Dashboard → Alert History  
**Frequency:** Daily

**Procedure:**
1. Navigate to Alert History
2. Filter by date range (last 24 hours)
3. Review all alerts
4. Verify all alerts were responded to
5. Document any patterns or recurring issues

**Verification:**
```sql
SELECT severity, rule_name, COUNT(*) as count
FROM monitoring_alerts
WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY severity, rule_name;
```

---

## Daily Operational Checklist

**Time:** 9:00 AM (or start of business day)  
**Duration:** 15 minutes

### Morning Checks

- [ ] **System Status**
  ```bash
  curl https://[domain]/api/health
  ```
  Expected: HTTP 200, all services "healthy"

- [ ] **Database Connection**
  ```sql
  SELECT 1;
  ```
  Expected: Returns 1

- [ ] **Recent Transactions**
  ```sql
  SELECT COUNT(*) as transaction_count
  FROM transactions
  WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR);
  ```
  Expected: Count > 0 (normal activity)

- [ ] **Failed Transactions**
  ```sql
  SELECT COUNT(*) as failed_count
  FROM transactions
  WHERE status = 'failed'
  AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR);
  ```
  Expected: Count = 0 or very low (< 5)

- [ ] **Alert Review**
  ```sql
  SELECT severity, COUNT(*) as count
  FROM monitoring_alerts
  WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
  GROUP BY severity;
  ```
  Expected: No "critical" alerts, low "warning" count

- [ ] **Low Balance Distributors**
  ```sql
  SELECT provider_id, distributor_id, balance
  FROM provider_distributor_accounts
  WHERE balance < 500
  ORDER BY balance ASC;
  ```
  Expected: Empty or review for necessary top-ups

- [ ] **Suspended Relationships**
  ```sql
  SELECT COUNT(*) as suspended_count
  FROM provider_distributor_relationships
  WHERE status = 'suspended';
  ```
  Expected: Count = 0 (or review if any)

### Afternoon Checks (2:00 PM)

- [ ] **Transaction Volume**
  ```sql
  SELECT COUNT(*) as transaction_count
  FROM transactions
  WHERE created_at > DATE_SUB(NOW(), INTERVAL 4 HOUR);
  ```
  Expected: Reasonable volume for time of day

- [ ] **API Response Times**
  - Test dashboard load time: Should be < 2 seconds
  - Test transaction API: Should be < 500ms

- [ ] **Backup Status**
  - Verify last backup completed successfully
  - Check backup size is reasonable

### End of Day Checks (5:00 PM)

- [ ] **Daily Summary Report**
  ```sql
  SELECT 
    COUNT(DISTINCT provider_id) as active_providers,
    COUNT(DISTINCT distributor_id) as active_distributors,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN type = 'purchase_debit' THEN amount ELSE 0 END) as total_revenue,
    SUM(CASE WHEN type = 'commission_credit' THEN amount ELSE 0 END) as total_commission
  FROM provider_distributor_ledger
  WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR);
  ```

- [ ] **Error Log Review**
  - Check application logs for errors
  - Check database error log
  - Check API error log

- [ ] **Prepare Tomorrow's Briefing**
  - Document any issues encountered
  - List any pending actions
  - Note any unusual patterns

---

## Rollback & Incident Response

### Incident Severity Levels

| Level | Description | Response Time | Action |
|-------|-------------|----------------|--------|
| **Critical** | System down, data loss risk, all users affected | 5 minutes | Immediate rollback or restart |
| **High** | Major feature broken, significant user impact | 15 minutes | Investigate, fix, or rollback |
| **Medium** | Feature partially broken, some users affected | 1 hour | Investigate and fix |
| **Low** | Minor issue, workaround available | 4 hours | Investigate and fix |

---

### Critical Incident: System Down

**Symptoms:**
- API returning 500 errors
- Database connection failing
- All users unable to access platform

**Immediate Actions (0-5 minutes):**

1. **Verify Incident**
   ```bash
   curl https://[domain]/api/health
   # Should return error if system is down
   ```

2. **Check Database**
   ```bash
   # From database server
   mysql -u [user] -p -h [host] [database] -e "SELECT 1;"
   ```

3. **Check Dev Server Status**
   ```bash
   ps aux | grep "pnpm run dev"
   # Should show running process
   ```

4. **Check Error Logs**
   ```bash
   tail -100 /var/log/app.log
   tail -100 /var/log/mysql.log
   ```

**Recovery Actions (5-15 minutes):**

1. **Restart Dev Server**
   ```bash
   # Kill existing process
   pkill -f "pnpm run dev"
   
   # Restart
   cd /home/ubuntu/prepaid-card-platform
   pnpm run dev
   ```

2. **Verify System Recovered**
   ```bash
   curl https://[domain]/api/health
   # Should return HTTP 200
   ```

3. **Run Smoke Tests**
   ```bash
   # Test auth
   curl https://[domain]/api/trpc/auth.me
   
   # Test financial
   curl https://[domain]/api/trpc/financial.accountBalance
   ```

4. **If Still Failing: Rollback**
   ```bash
   # Rollback to last known good version
   git checkout [last-stable-commit]
   pnpm install
   pnpm run dev
   ```

---

### High Incident: Purchase Failures

**Symptoms:**
- Purchase transactions failing
- Error: "Account not found" or "Insufficient balance"
- Users reporting unable to buy cards

**Investigation (0-15 minutes):**

1. **Check Recent Failures**
   ```sql
   SELECT id, distributor_id, provider_id, status, created_at, error_message
   FROM transactions
   WHERE status = 'failed'
   AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
   ORDER BY created_at DESC;
   ```

2. **Check Affected Accounts**
   ```sql
   SELECT pda.provider_id, pda.distributor_id, pda.balance, pda.credit_line, pda.used_credit
   FROM provider_distributor_accounts pda
   WHERE (pda.provider_id, pda.distributor_id) IN (
     SELECT provider_id, distributor_id FROM transactions
     WHERE status = 'failed'
     AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
   );
   ```

3. **Check Relationship Status**
   ```sql
   SELECT pdr.provider_id, pdr.distributor_id, pdr.status
   FROM provider_distributor_relationships pdr
   WHERE (pdr.provider_id, pdr.distributor_id) IN (
     SELECT provider_id, distributor_id FROM transactions
     WHERE status = 'failed'
     AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
   );
   ```

**Common Causes & Fixes:**

| Cause | Fix | SQL |
|-------|-----|-----|
| Insufficient balance | Top-up account | `UPDATE provider_distributor_accounts SET balance = balance + [amount] WHERE ...` |
| Suspended relationship | Reactivate | `UPDATE provider_distributor_relationships SET status = 'active' WHERE ...` |
| Account missing | Recreate account | `INSERT INTO provider_distributor_accounts ...` |
| Commission config missing | Create config | `INSERT INTO provider_distributor_commission ...` |

**Notification:**
- Notify affected providers and distributors
- Provide ETA for resolution
- Document incident for post-mortem

---

### High Incident: Refund Failures

**Symptoms:**
- Refund requests failing
- Error: "Account not found" or "Transaction not found"
- Users unable to get refunds

**Investigation (0-15 minutes):**

1. **Check Failed Refunds**
   ```sql
   SELECT * FROM refunds
   WHERE status = 'failed'
   AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
   ```

2. **Check Original Transactions**
   ```sql
   SELECT * FROM transactions
   WHERE id IN (SELECT transaction_id FROM refunds WHERE status = 'failed')
   AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR);
   ```

3. **Check Ledger Entries**
   ```sql
   SELECT * FROM provider_distributor_ledger
   WHERE reference_id IN (SELECT transaction_id FROM refunds WHERE status = 'failed')
   ORDER BY created_at DESC;
   ```

**Recovery:**
- Manually create refund ledger entries if needed
- Verify account balance is correct
- Retry refund process
- Notify affected users

---

### Medium Incident: High Failed Transaction Rate

**Symptoms:**
- > 5% of transactions failing
- Pattern of failures (specific provider, time, etc.)
- Users reporting intermittent issues

**Investigation (0-30 minutes):**

1. **Calculate Failure Rate**
   ```sql
   SELECT 
     COUNT(*) as total_transactions,
     SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_transactions,
     ROUND(100.0 * SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate_percent
   FROM transactions
   WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
   ```

2. **Identify Pattern**
   ```sql
   -- By provider
   SELECT provider_id, COUNT(*) as total, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
   FROM transactions
   WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
   GROUP BY provider_id;
   
   -- By time
   SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00') as hour, COUNT(*) as total, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
   FROM transactions
   WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
   GROUP BY hour;
   ```

3. **Check System Resources**
   ```bash
   # CPU usage
   top -b -n 1 | head -20
   
   # Memory usage
   free -h
   
   # Disk usage
   df -h
   
   # Database connections
   mysql -u [user] -p -h [host] -e "SHOW PROCESSLIST;"
   ```

**Common Causes & Fixes:**
- High database load: Optimize queries, increase connections
- Memory pressure: Restart service, increase memory
- Network issues: Check connectivity, restart network service
- Code bug: Check logs, deploy fix or rollback

---

### Low Incident: UI Display Issues

**Symptoms:**
- Dashboard metrics showing incorrect values
- Charts not rendering
- Formatting issues

**Investigation (0-30 minutes):**

1. **Check Browser Console**
   - Open browser DevTools (F12)
   - Check Console tab for JavaScript errors
   - Check Network tab for failed API calls

2. **Check API Responses**
   ```bash
   curl https://[domain]/api/trpc/financial.accountBalance | jq .
   curl https://[domain]/api/trpc/provider.dashboard | jq .
   ```

3. **Check Database Data**
   ```sql
   -- Verify data exists and is correct
   SELECT * FROM provider_distributor_accounts LIMIT 1;
   SELECT * FROM provider_distributor_ledger LIMIT 1;
   ```

**Recovery:**
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh page (Ctrl+F5)
- Restart browser
- Check if issue is browser-specific
- Deploy UI fix if needed

---

### Rollback Procedure

**When to Rollback:**
- Critical bug introduced in latest deployment
- Data integrity issue
- Unrecoverable system state
- After 30 minutes of troubleshooting without fix

**Rollback Steps:**

1. **Identify Last Stable Version**
   ```bash
   git log --oneline | head -10
   # Find last known good commit
   ```

2. **Notify Users**
   - Send notification: "Performing maintenance, service will be briefly unavailable"
   - Estimated duration: 5-10 minutes

3. **Stop Current Service**
   ```bash
   pkill -f "pnpm run dev"
   ```

4. **Rollback Code**
   ```bash
   cd /home/ubuntu/prepaid-card-platform
   git checkout [stable-commit]
   git clean -fd
   ```

5. **Reinstall Dependencies**
   ```bash
   pnpm install
   ```

6. **Restart Service**
   ```bash
   pnpm run dev
   ```

7. **Verify System**
   ```bash
   curl https://[domain]/api/health
   # Should return HTTP 200
   ```

8. **Run Smoke Tests**
   ```bash
   # Test critical paths
   curl https://[domain]/api/trpc/auth.me
   curl https://[domain]/api/trpc/financial.accountBalance
   curl https://[domain]/api/trpc/provider.dashboard
   ```

9. **Notify Users**
   - Send notification: "Service restored"
   - Provide incident summary

10. **Post-Mortem**
    - Document what went wrong
    - Identify root cause
    - Plan fix for next deployment
    - Schedule review meeting

---

### Escalation Contacts

**On-Call Engineer:** [Name] - [Phone] - [Email]  
**Engineering Manager:** [Name] - [Phone] - [Email]  
**Product Manager:** [Name] - [Phone] - [Email]  
**Database Admin:** [Name] - [Phone] - [Email]  

**Escalation Path:**
1. Try to resolve within 15 minutes
2. If unresolved, contact On-Call Engineer
3. If critical and unresolved after 30 minutes, contact Engineering Manager
4. If data integrity issue, immediately contact Database Admin

---

## Post-Launch Review

**Schedule:** 1 week after pilot launch  
**Duration:** 1 hour

**Review Items:**
- [ ] Total transactions processed
- [ ] Total revenue generated
- [ ] Number of active providers
- [ ] Number of active distributors
- [ ] Incident count and severity
- [ ] User feedback and issues
- [ ] Performance metrics
- [ ] Database performance
- [ ] API response times
- [ ] System uptime percentage

**Success Criteria:**
- [ ] System uptime > 99%
- [ ] API response time < 500ms (p95)
- [ ] Zero critical incidents
- [ ] All core workflows functional
- [ ] User satisfaction > 4/5

**Next Steps:**
- [ ] Identify improvements for next phase
- [ ] Plan additional features
- [ ] Schedule next review

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-18 | Platform Team | Initial runbook for pilot launch |

---

**Last Updated:** April 18, 2026  
**Next Review:** May 18, 2026  
**Status:** APPROVED FOR PILOT LAUNCH ✅
