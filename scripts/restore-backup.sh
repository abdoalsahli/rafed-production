#!/bin/bash

# Database Restore Script
# Usage: ./restore-backup.sh [backup-file] [target-database]
# Example: ./restore-backup.sh database_2026-04-18_02-00-00.sql.gz test_db
# Example: ./restore-backup.sh database_2026-04-18_02-00-00.sql.gz production_db

set -e

# Configuration
BACKUP_DIR="/home/ubuntu/backups/database"
LOG_DIR="/home/ubuntu/backups/logs"
LOG_FILE="$LOG_DIR/restore.log"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Validate arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 [backup-file] [target-database]"
    echo "Example: $0 database_2026-04-18_02-00-00.sql.gz test_db"
    exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="$2"

# Ensure directories exist
mkdir -p "$LOG_DIR"

# Check if backup file exists
if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    error_exit "Backup file not found: $BACKUP_DIR/$BACKUP_FILE"
fi

# Check if backup file is readable
if [ ! -r "$BACKUP_DIR/$BACKUP_FILE" ]; then
    error_exit "Backup file not readable: $BACKUP_DIR/$BACKUP_FILE"
fi

# Verify backup integrity
log "Verifying backup integrity: $BACKUP_FILE"
if ! gzip -t "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null; then
    error_exit "Backup file is corrupted"
fi
log "✓ Backup integrity verified"

# Check environment variables
if [ -z "$DATABASE_URL" ]; then
    error_exit "DATABASE_URL environment variable not set"
fi

# Parse DATABASE_URL
DB_URL="$DATABASE_URL"
DB_USER=$(echo "$DB_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')

# Validate parsed values
if [ -z "$DB_USER" ] || [ -z "$DB_HOST" ]; then
    error_exit "Failed to parse DATABASE_URL"
fi

log "Starting restore from backup: $BACKUP_FILE"
log "Target database: $TARGET_DB"
log "Database host: $DB_HOST"

# Confirm before proceeding
echo ""
echo "WARNING: This will DROP and recreate the database: $TARGET_DB"
echo "Backup file: $BACKUP_DIR/$BACKUP_FILE"
echo ""
read -p "Are you sure? Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log "Restore cancelled by user"
    exit 0
fi

# Drop existing database if it exists
log "Dropping existing database: $TARGET_DB"
mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -e "DROP DATABASE IF EXISTS $TARGET_DB;" 2>/dev/null || true

# Create new database
log "Creating new database: $TARGET_DB"
mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -e "CREATE DATABASE $TARGET_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null

# Restore from backup
log "Restoring data from backup..."
START_TIME=$(date +%s)
if gunzip < "$BACKUP_DIR/$BACKUP_FILE" | mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$TARGET_DB" 2>/dev/null; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    log "✓ Restore completed successfully"
    log "  Duration: ${DURATION}s"
    
    # Verify restore
    log "Verifying restore..."
    TABLE_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$TARGET_DB" -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='$TARGET_DB';" 2>/dev/null | tail -1)
    log "✓ Restore verified: $TABLE_COUNT tables"
    
    exit 0
else
    error_exit "Restore failed"
fi
