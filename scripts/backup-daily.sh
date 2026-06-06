#!/bin/bash

# Automated Daily Database Backup Script
# Scheduled to run via cron at 2:00 AM UTC
# Crontab entry: 0 2 * * * /home/ubuntu/prepaid-card-platform/scripts/backup-daily.sh

set -e

# Configuration
BACKUP_DIR="/home/ubuntu/backups/database"
LOG_DIR="/home/ubuntu/backups/logs"
LOG_FILE="$LOG_DIR/backup.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/database_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

# Ensure directories exist
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR: $1"
    # Send alert (if configured)
    # echo "Backup failed: $1" | mail -s "Database Backup Failed" admin@example.com
    exit 1
}

# Check environment variables
if [ -z "$DATABASE_URL" ]; then
    error_exit "DATABASE_URL environment variable not set"
fi

# Parse DATABASE_URL
DB_URL="$DATABASE_URL"
DB_USER=$(echo "$DB_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')

# Validate parsed values
if [ -z "$DB_USER" ] || [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ]; then
    error_exit "Failed to parse DATABASE_URL"
fi

log "Starting daily backup"
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
    
    log "✓ Daily backup successful"
    
    # Run cleanup
    log "Running cleanup of old backups (retention: $RETENTION_DAYS days)"
    find "$BACKUP_DIR" -name "database_*.sql.gz" -not -name "*manual*" -mtime +$RETENTION_DAYS -delete
    log "✓ Cleanup completed"
    
    exit 0
else
    error_exit "Backup failed"
fi
