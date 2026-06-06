# Database Restore Procedure

## Quick Reference

```bash
# List available backups
ls -lh /home/ubuntu/backups/database/

# Restore to test database
./scripts/restore-backup.sh database_2026-04-18_02-00-00.sql.gz test_db

# Verify restore
mysql -u [user] -p test_db -e "SELECT COUNT(*) FROM service_providers;"

# If verified, restore to production
./scripts/restore-backup.sh database_2026-04-18_02-00-00.sql.gz production_db
```

## Detailed Restore Procedure

### Prerequisites

- SSH access to backup server
- MySQL client installed
- `DATABASE_URL` environment variable set
- Backup file exists and is readable
- Sufficient disk space for restored database

### Step 1: Identify the Backup to Restore

```bash
# List all available backups
ls -lh /home/ubuntu/backups/database/

# List backups by date
ls -lh /home/ubuntu/backups/database/ | sort -k6,7

# Find backup from specific date
ls -lh /home/ubuntu/backups/database/ | grep "2026-04-18"

# Find manual backups
ls -lh /home/ubuntu/backups/database/ | grep "manual"
```

### Step 2: Verify Backup Integrity

```bash
# Test gzip integrity
gzip -t /home/ubuntu/backups/database/database_2026-04-18_02-00-00.sql.gz

# Check file size
ls -lh /home/ubuntu/backups/database/database_2026-04-18_02-00-00.sql.gz

# Expected size: 10 MB - 100 MB (depending on data volume)
# If < 1 MB, backup may be incomplete
```

### Step 3: Restore to Test Database

```bash
# Run restore script
cd /home/ubuntu/prepaid-card-platform
./scripts/restore-backup.sh database_2026-04-18_02-00-00.sql.gz test_db

# Script will:
# 1. Verify backup integrity
# 2. Drop existing test_db (if exists)
# 3. Create new test_db
# 4. Restore data from backup
# 5. Verify table count
```

### Step 4: Verify Restored Data

```bash
# Connect to test database
mysql -u [user] -p test_db

# Check table count
SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='test_db';

# Check key tables
SELECT COUNT(*) FROM service_providers;
SELECT COUNT(*) FROM distributors;
SELECT COUNT(*) FROM provider_distributor_relationships;
SELECT COUNT(*) FROM provider_distributor_accounts;
SELECT COUNT(*) FROM provider_distributor_ledger;

# Compare with production
SELECT COUNT(*) FROM provider_distributor_ledger WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY);
```

### Step 5: Validate Data Integrity

```bash
# Check for data consistency
SELECT COUNT(*) FROM provider_distributor_relationships WHERE status = 'ACTIVE';

# Verify account balances are reasonable
SELECT 
  provider_id,
  distributor_id,
  balance,
  used_credit,
  credit_line
FROM provider_distributor_accounts
LIMIT 10;

# Check ledger entries
SELECT 
  provider_id,
  distributor_id,
  type,
  amount,
  balance_after_transaction
FROM provider_distributor_ledger
ORDER BY created_at DESC
LIMIT 10;
```

### Step 6: Restore to Production (If Verified)

```bash
# IMPORTANT: Only proceed if test database verification is successful

# Run restore script
./scripts/restore-backup.sh database_2026-04-18_02-00-00.sql.gz production_db

# Script will prompt for confirmation:
# WARNING: This will DROP and recreate the database: production_db
# Are you sure? Type 'yes' to confirm:

# Type 'yes' to proceed

# Verify production restore
mysql -u [user] -p production_db -e "SELECT COUNT(*) FROM service_providers;"
```

## Restore Scenarios

### Scenario 1: Accidental Data Deletion

**Situation**: User accidentally deleted important data

**Steps**:
1. Identify when deletion occurred (e.g., 2026-04-18 14:30)
2. Find backup created before deletion (e.g., 2026-04-18 02:00)
3. Restore to test database
4. Extract affected records from test database
5. Apply changes to production database
6. Notify affected users

**Example**:
```bash
# Restore backup from before deletion
./scripts/restore-backup.sh database_2026-04-18_02-00-00.sql.gz test_db

# Extract deleted records
mysql -u [user] -p test_db -e "
  SELECT * FROM provider_distributor_ledger 
  WHERE distributor_id = 123 
  AND created_at > '2026-04-18 14:00'
" > deleted_records.sql

# Apply to production
mysql -u [user] -p production_db < deleted_records.sql
```

### Scenario 2: Data Corruption

**Situation**: Database shows signs of corruption

**Steps**:
1. Stop application (optional, depending on severity)
2. Restore latest backup to test database
3. Run integrity checks
4. If test database is healthy, restore to production
5. Restart application
6. Monitor for errors

**Example**:
```bash
# Restore latest backup
LATEST_BACKUP=$(ls -t /home/ubuntu/backups/database/database_*.sql.gz | head -1 | xargs basename)
./scripts/restore-backup.sh "$LATEST_BACKUP" test_db

# Run integrity checks
mysql -u [user] -p test_db -e "CHECK TABLE service_providers;"
mysql -u [user] -p test_db -e "CHECK TABLE provider_distributor_ledger;"

# If OK, restore to production
./scripts/restore-backup.sh "$LATEST_BACKUP" production_db
```

### Scenario 3: Database Server Failure

**Situation**: Database server hardware failure

**Steps**:
1. Provision new database server
2. Restore latest backup
3. Update application connection strings
4. Verify application connectivity
5. Notify users of recovery

**Example**:
```bash
# On new server, restore latest backup
LATEST_BACKUP=$(ls -t /home/ubuntu/backups/database/database_*.sql.gz | head -1 | xargs basename)
./scripts/restore-backup.sh "$LATEST_BACKUP" production_db

# Update DATABASE_URL in application
export DATABASE_URL="mysql://user:pass@new-host/production_db"

# Restart application
systemctl restart prepaid-card-platform
```

## Troubleshooting

### Issue: "Backup file not found"

**Cause**: Backup file path is incorrect or file doesn't exist

**Solution**:
```bash
# List available backups
ls -lh /home/ubuntu/backups/database/

# Use correct filename
./scripts/restore-backup.sh database_2026-04-18_02-00-00.sql.gz test_db
```

### Issue: "Backup file is corrupted"

**Cause**: Backup file is incomplete or damaged

**Solution**:
```bash
# Check file size
ls -lh /home/ubuntu/backups/database/database_2026-04-18_02-00-00.sql.gz

# Try previous backup
./scripts/restore-backup.sh database_2026-04-17_02-00-00.sql.gz test_db

# If all backups are corrupted, contact support
```

### Issue: "Row count mismatch"

**Cause**: Restored data doesn't match production

**Solution**:
```bash
# Compare row counts
mysql -u [user] -p production_db -e "SELECT COUNT(*) FROM service_providers;"
mysql -u [user] -p test_db -e "SELECT COUNT(*) FROM service_providers;"

# If mismatch, try different backup
./scripts/restore-backup.sh database_2026-04-17_02-00-00.sql.gz test_db
```

### Issue: "Restore takes too long"

**Cause**: Large backup file or slow network

**Solution**:
- Wait for restore to complete (may take 30+ minutes for large backups)
- Check database server load: `top`, `iostat`
- Check network connectivity: `ping`, `traceroute`
- Consider restoring during maintenance window

## Recovery Time Estimates

| Backup Size | Restore Time | Network Speed |
|-------------|--------------|---------------|
| 10 MB | 1-2 minutes | 100 Mbps |
| 50 MB | 5-10 minutes | 100 Mbps |
| 100 MB | 10-20 minutes | 100 Mbps |
| 500 MB | 50-100 minutes | 100 Mbps |

## Rollback Procedure

If restore causes issues:

```bash
# Restore previous backup
./scripts/restore-backup.sh database_2026-04-17_02-00-00.sql.gz production_db

# Verify
mysql -u [user] -p production_db -e "SELECT COUNT(*) FROM service_providers;"

# Restart application
systemctl restart prepaid-card-platform
```

## Testing Restore

### Weekly Restore Test

```bash
# Run weekly restore test
cd /home/ubuntu/prepaid-card-platform
LATEST_BACKUP=$(ls -t /home/ubuntu/backups/database/database_*.sql.gz | grep -v manual | head -1 | xargs basename)
./scripts/test-restore.sh "$LATEST_BACKUP"

# Check test results
tail -20 /home/ubuntu/backups/logs/test-restore.log
```

### Monthly Full Restore Drill

```bash
# 1. Restore to test database
./scripts/restore-backup.sh [backup-file] test_db

# 2. Run full data validation
mysql -u [user] -p test_db < validation-queries.sql

# 3. Document results
echo "Restore drill completed successfully" >> /home/ubuntu/backups/logs/restore-drills.log

# 4. Clean up
mysql -u [user] -p -e "DROP DATABASE test_db;"
```

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-18 | Initial restore procedure |
