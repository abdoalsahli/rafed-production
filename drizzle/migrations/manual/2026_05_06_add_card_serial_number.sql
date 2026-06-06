-- Manual migration: Add serial_number support to cards table
-- Date: 2026-05-06
-- Purpose: Store card serial numbers for tracking and search without affecting purchase logic

-- Check if column exists before adding (idempotent)
-- For MySQL/TiDB, we use information_schema to check
SELECT @column_exists := COUNT(*) 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'cards' 
  AND COLUMN_NAME = 'serial_number';

-- Add column if it doesn't exist
SET @sql_add_column = IF(
  @column_exists = 0,
  'ALTER TABLE cards ADD COLUMN serial_number VARCHAR(128) NULL AFTER status',
  'SELECT "Column serial_number already exists"'
);

PREPARE stmt_add_column FROM @sql_add_column;
EXECUTE stmt_add_column;
DEALLOCATE PREPARE stmt_add_column;

-- Check if index exists before adding (idempotent)
SELECT @index_exists := COUNT(*) 
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'cards' 
  AND INDEX_NAME = 'idx_cards_serial_number';

-- Add index if it doesn't exist
SET @sql_add_index = IF(
  @index_exists = 0,
  'CREATE INDEX idx_cards_serial_number ON cards(serial_number)',
  'SELECT "Index idx_cards_serial_number already exists"'
);

PREPARE stmt_add_index FROM @sql_add_index;
EXECUTE stmt_add_index;
DEALLOCATE PREPARE stmt_add_index;

-- Verify the changes
SELECT 'Migration completed successfully' AS status;
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'cards' 
  AND COLUMN_NAME = 'serial_number';
