#!/bin/bash

# Restore Validation Test Script
# Tests backup and restore functionality
# Usage: ./test-restore.sh [backup-file]

set -e

# Configuration
BACKUP_DIR="/home/ubuntu/backups/database"
LOG_DIR="/home/ubuntu/backups/logs"
LOG_FILE="$LOG_DIR/test-restore.log"
TEST_DB="test_restore_$$"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR: $1"
    # Cleanup test database
    if [ ! -z "$TEST_DB" ]; then
        mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -e "DROP DATABASE IF EXISTS $TEST_DB;" 2>/dev/null || true
    fi
    exit 1
}

# Validate arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 [backup-file]"
    echo "Example: $0 database_2026-04-18_02-00-00.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

# Ensure directories exist
mkdir -p "$LOG_DIR"

# Check if backup file exists
if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    error_exit "Backup file not found: $BACKUP_DIR/$BACKUP_FILE"
fi

# Check environment variables
if [ -z "$DATABASE_URL" ]; then
    error_exit "DATABASE_URL environment variable not set"
fi

# Parse DATABASE_URL
DB_URL="$DATABASE_URL"
DB_USER=$(echo "$DB_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
PROD_DB=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')

log "Starting restore validation test"
log "Backup file: $BACKUP_FILE"
log "Test database: $TEST_DB"
log "Production database: $PROD_DB"

# Step 1: Verify backup integrity
log "Step 1: Verifying backup integrity..."
if ! gzip -t "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null; then
    error_exit "Backup file is corrupted"
fi
log "✓ Backup integrity verified"

# Step 2: Get production database stats
log "Step 2: Getting production database statistics..."
PROD_TABLE_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$PROD_DB" -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='$PROD_DB';" 2>/dev/null | tail -1)
log "  Production tables: $PROD_TABLE_COUNT"

# Step 3: Create test database
log "Step 3: Creating test database: $TEST_DB"
mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -e "CREATE DATABASE $TEST_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null

# Step 4: Restore backup to test database
log "Step 4: Restoring backup to test database..."
START_TIME=$(date +%s)
if gunzip < "$BACKUP_DIR/$BACKUP_FILE" | mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$TEST_DB" 2>/dev/null; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    log "✓ Restore completed in ${DURATION}s"
else
    error_exit "Restore failed"
fi

# Step 5: Verify restored database structure
log "Step 5: Verifying restored database structure..."
TEST_TABLE_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$TEST_DB" -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='$TEST_DB';" 2>/dev/null | tail -1)
log "  Test database tables: $TEST_TABLE_COUNT"

if [ "$PROD_TABLE_COUNT" -ne "$TEST_TABLE_COUNT" ]; then
    error_exit "Table count mismatch: production=$PROD_TABLE_COUNT, test=$TEST_TABLE_COUNT"
fi
log "✓ Table count matches"

# Step 6: Verify data integrity
log "Step 6: Verifying data integrity..."

# Check key tables
TABLES=("service_providers" "distributors" "provider_distributor_relationships" "provider_distributor_accounts" "provider_distributor_ledger")

for TABLE in "${TABLES[@]}"; do
    PROD_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$PROD_DB" -e "SELECT COUNT(*) FROM $TABLE;" 2>/dev/null | tail -1)
    TEST_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$TEST_DB" -e "SELECT COUNT(*) FROM $TABLE;" 2>/dev/null | tail -1)
    
    if [ "$PROD_COUNT" -ne "$TEST_COUNT" ]; then
        error_exit "Row count mismatch in $TABLE: production=$PROD_COUNT, test=$TEST_COUNT"
    fi
    log "  ✓ $TABLE: $TEST_COUNT rows"
done

# Step 7: Verify indexes
log "Step 7: Verifying indexes..."
PROD_INDEX_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$PROD_DB" -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA='$PROD_DB';" 2>/dev/null | tail -1)
TEST_INDEX_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$TEST_DB" -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA='$TEST_DB';" 2>/dev/null | tail -1)

if [ "$PROD_INDEX_COUNT" -ne "$TEST_INDEX_COUNT" ]; then
    error_exit "Index count mismatch: production=$PROD_INDEX_COUNT, test=$TEST_INDEX_COUNT"
fi
log "✓ Index count matches: $TEST_INDEX_COUNT indexes"

# Step 8: Cleanup
log "Step 8: Cleaning up test database..."
mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -e "DROP DATABASE $TEST_DB;" 2>/dev/null
log "✓ Test database dropped"

log "✓ Restore validation test completed successfully"
log ""
log "Summary:"
log "  Backup file: $BACKUP_FILE"
log "  Restore time: ${DURATION}s"
log "  Tables verified: ${#TABLES[@]}"
log "  Data integrity: ✓ PASS"
log "  Indexes verified: ✓ PASS"
log ""

exit 0
