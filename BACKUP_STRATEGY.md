# Database Backup Strategy

## Overview

This document outlines the backup and disaster recovery strategy for the prepaid card platform database.

## Backup Strategy

### Backup Frequency
- **Daily full backups**: 2:00 AM UTC (off-peak hours)
- **Backup window**: 30 minutes (estimated)
- **Performance impact**: Minimal (read-only operation)

### Backup Location
- **Primary storage**: `/home/ubuntu/backups/database/`
- **Retention period**: 14 days
- **Backup size**: ~50-100 MB per backup (estimated)

### Retention Policy
- Keep last 14 daily backups
- Automatic cleanup of backups older than 14 days
- Manual backups retained indefinitely (marked with `-manual-` prefix)

### Backup Naming Convention
```
database_YYYY-MM-DD_HH-MM-SS.sql.gz
database_YYYY-MM-DD_HH-MM-SS-manual-[reason].sql.gz
```

### Backup Contents
- Full database schema
- All table data
- Indexes and constraints
- Triggers and stored procedures (if any)

### Backup Verification
- Backup file size checked
- Gzip integrity verified
- Backup timestamp logged
- Restore test performed weekly

## Scripts

### 1. Manual Backup Script
**File**: `scripts/backup-manual.sh`
**Usage**: `./scripts/backup-manual.sh [reason]`
**Example**: `./scripts/backup-manual.sh "before-major-update"`

### 2. Automated Daily Backup Script
**File**: `scripts/backup-daily.sh`
**Trigger**: Cron job at 2:00 AM UTC
**Crontab entry**: `0 2 * * * /home/ubuntu/prepaid-card-platform/scripts/backup-daily.sh`

### 3. Restore Script
**File**: `scripts/restore-backup.sh`
**Usage**: `./scripts/restore-backup.sh [backup-file] [target-database]`
**Example**: `./scripts/restore-backup.sh database_2026-04-18_02-00-00.sql.gz test_db`

### 4. Cleanup Script
**File**: `scripts/cleanup-old-backups.sh`
**Trigger**: Runs after daily backup
**Retention**: Keeps last 14 backups

## Restore Procedure

### Quick Restore
```bash
# 1. List available backups
ls -lh /home/ubuntu/backups/database/

# 2. Restore to test database
./scripts/restore-backup.sh database_2026-04-18_02-00-00.sql.gz test_db

# 3. Verify data integrity
mysql -u [user] -p test_db -e "SELECT COUNT(*) FROM service_providers;"

# 4. If verified, restore to production
./scripts/restore-backup.sh database_2026-04-18_02-00-00.sql.gz production_db
```

### Full Restore Procedure
See RESTORE_PROCEDURE.md for detailed steps.

## Monitoring

### Backup Verification
- Check backup file exists and is not empty
- Verify gzip integrity: `gzip -t [backup-file]`
- Test restore weekly to production-like environment

### Backup Logs
- Location: `/home/ubuntu/backups/logs/backup.log`
- Retention: 30 days
- Monitored for errors

### Alerts
- Alert if backup fails
- Alert if backup takes > 45 minutes
- Alert if backup file size is < 10 MB (unusually small)

## Disaster Recovery

### Recovery Time Objective (RTO)
- **Target**: 1 hour
- **Actual**: 15-30 minutes (depending on backup size)

### Recovery Point Objective (RPO)
- **Target**: 24 hours
- **Actual**: 24 hours (daily backups)

### Failure Scenarios

#### Scenario 1: Data Corruption
1. Detect corruption via integrity checks
2. Restore from latest backup to test database
3. Verify data integrity
4. Restore to production database
5. Notify users of recovery

#### Scenario 2: Accidental Data Deletion
1. Identify deletion time
2. Find backup created before deletion
3. Restore to test database
4. Extract affected records
5. Apply changes to production
6. Notify affected users

#### Scenario 3: Database Server Failure
1. Provision new database server
2. Restore latest backup
3. Update connection strings
4. Verify application connectivity
5. Notify users of recovery

## Testing Schedule

| Test | Frequency | Owner | Success Criteria |
|------|-----------|-------|------------------|
| Backup creation | Daily | Automated | Backup file exists, size > 10 MB |
| Restore to test DB | Weekly | Manual | Data restored successfully |
| Data integrity check | Weekly | Manual | Row counts match, no corruption |
| Full disaster recovery | Monthly | Manual | Recovery completed in < 1 hour |

## Backup Checklist

- [ ] Backup script created and tested
- [ ] Restore script created and tested
- [ ] Cron job configured for daily backups
- [ ] Backup directory created with proper permissions
- [ ] Cleanup script configured
- [ ] Backup logs configured
- [ ] Monitoring alerts configured
- [ ] Weekly restore test scheduled
- [ ] Monthly disaster recovery test scheduled
- [ ] Documentation completed

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-18 | Initial backup strategy |
