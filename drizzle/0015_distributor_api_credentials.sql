CREATE TABLE `distributor_api_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`distributor_id` int NOT NULL,
	`key_id` varchar(64) NOT NULL,
	`masked_key` varchar(64) NOT NULL,
	`secret_hash` varchar(255) NOT NULL,
	`status` enum('active','rotated','revoked') NOT NULL DEFAULT 'active',
	`webhook_url` varchar(2048),
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distributor_api_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_api_creds_key_id` UNIQUE(`key_id`)
);
--> statement-breakpoint
ALTER TABLE `distributor_api_credentials` ADD CONSTRAINT `distributor_api_credentials_distributor_id_distributors_id_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `idx_api_creds_distributor_id` ON `distributor_api_credentials` (`distributor_id`);
--> statement-breakpoint
CREATE INDEX `idx_api_creds_status` ON `distributor_api_credentials` (`status`);
