-- Phase 16: Observability & Monitoring
-- Creates tables for structured logging and metrics tracking

-- Structured logs table
CREATE TABLE IF NOT EXISTS structured_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  level VARCHAR(10) NOT NULL COMMENT 'INFO, WARN, ERROR',
  request_id VARCHAR(64) NOT NULL,
  correlation_id VARCHAR(64) NOT NULL,
  distributor_id INT,
  provider_id INT,
  webhook_event_id INT,
  retry_attempt INT,
  message TEXT NOT NULL,
  metadata LONGTEXT COMMENT 'JSON metadata',
  INDEX idx_correlation_id (correlation_id),\n  INDEX idx_request_id (request_id),\n  INDEX idx_timestamp (timestamp),\n  INDEX idx_distributor_id (distributor_id),\n  FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE SET NULL\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n-- Purchase latency metrics\nCREATE TABLE IF NOT EXISTS metrics_purchase_latency (\n  id BIGINT AUTO_INCREMENT PRIMARY KEY,\n  distributor_id INT NOT NULL,\n  latency_ms INT NOT NULL,\n  status VARCHAR(20) NOT NULL COMMENT 'success, failure',\n  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  INDEX idx_distributor_timestamp (distributor_id, timestamp),\n  INDEX idx_timestamp (timestamp),\n  FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n-- Webhook latency metrics\nCREATE TABLE IF NOT EXISTS metrics_webhook_latency (\n  id BIGINT AUTO_INCREMENT PRIMARY KEY,\n  distributor_id INT NOT NULL,\n  latency_ms INT NOT NULL,\n  status VARCHAR(20) NOT NULL COMMENT 'delivered, failed',\n  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  INDEX idx_distributor_timestamp (distributor_id, timestamp),\n  INDEX idx_timestamp (timestamp),\n  FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n-- Alerts table\nCREATE TABLE IF NOT EXISTS alerts (\n  id BIGINT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(64) NOT NULL,\n  severity VARCHAR(20) NOT NULL COMMENT 'LOW, MEDIUM, HIGH, CRITICAL',\n  message TEXT NOT NULL,\n  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  acknowledged BOOLEAN DEFAULT FALSE,\n  acknowledged_at DATETIME,\n  INDEX idx_severity (severity),\n  INDEX idx_timestamp (timestamp),\n  INDEX idx_acknowledged (acknowledged)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
