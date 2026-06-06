-- Webhook Deliveries Table
CREATE TABLE IF NOT EXISTS `webhook_deliveries` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `distributor_id` int NOT NULL,
  `purchase_request_id` int NOT NULL,
  `event_type` enum('purchase.succeeded', 'purchase.failed') NOT NULL,
  `target_url` varchar(2048) NOT NULL,
  `payload_json` longtext NOT NULL,
  `response_status` int,
  `response_body` text,
  `retry_count` int NOT NULL DEFAULT 0,
  `delivery_status` enum('PENDING', 'DELIVERED', 'FAILED_DELIVERY') NOT NULL DEFAULT 'PENDING',
  `delivered_at` timestamp NULL,
  `failed_at` timestamp NULL,
  `next_retry_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT `wd_distributor_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors` (`id`),
  CONSTRAINT `wd_purchase_request_fk` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`),
  
  INDEX `idx_wd_distributor_id` (`distributor_id`),
  INDEX `idx_wd_purchase_request_id` (`purchase_request_id`),
  INDEX `idx_wd_delivery_status` (`delivery_status`),
  INDEX `idx_wd_next_retry_at` (`next_retry_at`),
  INDEX `idx_wd_created_at` (`created_at`),
  INDEX `idx_wd_distributor_delivery` (`distributor_id`, `delivery_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhook Events Table (optional audit table)
CREATE TABLE IF NOT EXISTS `webhook_events` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `distributor_id` int NOT NULL,
  `purchase_request_id` int NOT NULL,
  `event_type` enum('purchase.succeeded', 'purchase.failed') NOT NULL,
  `payload_json` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT `we_distributor_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors` (`id`),
  CONSTRAINT `we_purchase_request_fk` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`),
  
  INDEX `idx_we_distributor_id` (`distributor_id`),
  INDEX `idx_we_purchase_request_id` (`purchase_request_id`),
  INDEX `idx_we_event_type` (`event_type`),
  INDEX `idx_we_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
