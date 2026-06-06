-- Phase 15: Rate Limiting & Abuse Protection
-- Creates tables for tracking API rate limits

-- Rate limit events table
-- Tracks each API request for rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  distributor_id INT NOT NULL,
  endpoint VARCHAR(32) NOT NULL COMMENT 'products, purchases, polling, webhook_replay',
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_distributor_endpoint (distributor_id, endpoint),
  INDEX idx_timestamp (timestamp),
  FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Idempotency key tracking table
-- Ensures idempotent purchase requests
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  distributor_id INT NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  purchase_id VARCHAR(64),
  response_json LONGTEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL COMMENT 'Retention: 24 hours',
  UNIQUE KEY idx_distributor_idempotency (distributor_id, idempotency_key),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhook replay tracking table
-- Prevents replay flooding
CREATE TABLE IF NOT EXISTS webhook_replay_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  distributor_id INT NOT NULL,
  webhook_delivery_id INT NOT NULL,
  replay_count INT DEFAULT 0,
  last_replay_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL COMMENT 'Retention: 7 days',
  UNIQUE KEY idx_distributor_delivery (distributor_id, webhook_delivery_id),
  INDEX idx_expires_at (expires_at),
  FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
