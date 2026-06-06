#!/bin/bash

# Manual Database Backup Script
# Usage: ./backup-manual.sh [reason]
# Example: ./backup-manual.sh "before-major-update"

set -e

# Configuration
BACKUP_DIR="/home/ubuntu/backups/database"
LOG_DIR="/home/ubuntu/backups/logs"
LOG_FILE="$LOG_DIR/backup.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
REASON="${1:-manual}"
BACKUP_FILE="$BACKUP_DIR/database_${TIMESTAMP}-manual-${REASON}.sql.gz"

# Ensure directories exist
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check environment variables
if [ -z "$DATABASE_URL" ]; then
    error_exit "DATABASE_URL environment variable not set"
fi

# Parse DATABASE_URL
# Format: mysql://user:password@host:port/database?ssl=...
DB_URL="$DATABASE_URL"
DB_USER=$(echo "$DB_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')

# Validate parsed values
if [ -z "$DB_USER" ] || [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ]; then
    error_exit "Failed to parse DATABASE_URL. Format should be: mysql://user:password@host/database"
fi

log "Starting manual backup: $REASON"
log "Database: $DB_NAME on $DB_HOST"
log "Backup file: $BACKUP_FILE"

# Create backup
START_TIME=$(date +%s)
if mysqldump -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    
    log "✓ Backup completed successfully"
    log "  Size: $SIZE"
    log "  Duration: ${DURATION}s"
    log "  File: $BACKUP_FILE"
    
    # Verify backup integrity
    if gzip -t "$BACKUP_FILE" 2>/dev/null; then
        log "✓ Backup integrity verified"
    else
        error_exit "Backup integrity check failed"
    fi
    
    # Check file size
    FILE_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
    if [ "$FILE_SIZE" -lt 1000 ]; then
        error_exit "Backup file suspiciously small ($FILE_SIZE bytes)"
    fi
    
    log "✓ Manual backup successful"
    exit 0
else
    error_exit "Backup failed"
fi
