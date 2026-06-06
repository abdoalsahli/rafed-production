CREATE TABLE `purchase_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`distributor_id` int NOT NULL,
	`product_id` int NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`status` enum('PENDING','PROCESSING','SUCCEEDED','FAILED') NOT NULL DEFAULT 'PENDING',
	`card_id` int,
	`failure_reason` text,
	`processing_started_at` timestamp,
	`completed_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_purchase_requests_idempotency` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD CONSTRAINT `pr_provider_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD CONSTRAINT `pr_distributor_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD CONSTRAINT `pr_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_requests` ADD CONSTRAINT `pr_card_fk` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_purchase_requests_queue` ON `purchase_requests` (`provider_id`,`distributor_id`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_purchase_requests_processing` ON `purchase_requests` (`status`,`processing_started_at`);