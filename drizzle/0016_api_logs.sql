-- Create api_logs table for API request tracking and audit trail
CREATE TABLE `api_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `distributor_id` int NOT NULL,
  `api_key_id` int,
  `endpoint` varchar(255) NOT NULL,
  `method` varchar(10) NOT NULL,
  `status_code` int NOT NULL,
  `response_time_ms` int,
  `request_id` varchar(255),
  `ip_address` varchar(45),
  `user_agent` text,
  `error_message` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `al_distributor_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors` (`id`),
  CONSTRAINT `al_api_key_fk` FOREIGN KEY (`api_key_id`) REFERENCES `distributor_api_credentials` (`id`),
  INDEX `idx_al_distributor_id` (`distributor_id`),
  INDEX `idx_al_endpoint` (`endpoint`),
  INDEX `idx_al_status_code` (`status_code`),
  INDEX `idx_al_created_at` (`created_at`),
  INDEX `idx_al_distributor_created_at` (`distributor_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
