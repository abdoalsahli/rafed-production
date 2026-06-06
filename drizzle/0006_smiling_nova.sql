CREATE TABLE `access_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`distributor_id` int NOT NULL,
	`requested_credit_line` decimal(12,2) NOT NULL,
	`requested_commission` decimal(5,2) NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`rejection_reason` text,
	`approved_by` int,
	`approved_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `access_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_access_requests_unique` UNIQUE(`provider_id`,`distributor_id`)
);
--> statement-breakpoint
CREATE TABLE `provider_distributor_relationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`distributor_id` int NOT NULL,
	`commission_rate` decimal(5,2) NOT NULL,
	`credit_line` decimal(12,2) NOT NULL,
	`used_credit` decimal(12,2) NOT NULL DEFAULT '0.00',
	`allow_credit` int NOT NULL DEFAULT 1,
	`status` enum('active','suspended','inactive') NOT NULL DEFAULT 'active',
	`access_request_id` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_distributor_relationships_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_pdr_unique` UNIQUE(`provider_id`,`distributor_id`)
);
--> statement-breakpoint
ALTER TABLE `access_requests` ADD CONSTRAINT `access_requests_provider_id_service_providers_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_requests` ADD CONSTRAINT `access_requests_distributor_id_distributors_id_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_distributor_relationships` ADD CONSTRAINT `pdr_provider_id_service_providers_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_distributor_relationships` ADD CONSTRAINT `pdr_distributor_id_distributors_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_distributor_relationships` ADD CONSTRAINT `pdr_access_req_id_access_requests_fk` FOREIGN KEY (`access_request_id`) REFERENCES `access_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_access_requests_provider_id` ON `access_requests` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_access_requests_distributor_id` ON `access_requests` (`distributor_id`);--> statement-breakpoint
CREATE INDEX `idx_access_requests_status` ON `access_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pdr_provider_id` ON `provider_distributor_relationships` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_pdr_distributor_id` ON `provider_distributor_relationships` (`distributor_id`);--> statement-breakpoint
CREATE INDEX `idx_pdr_status` ON `provider_distributor_relationships` (`status`);