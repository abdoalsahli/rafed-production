CREATE TABLE `provider_distributor_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`distributor_id` int NOT NULL,
	`balance` decimal(12,2) NOT NULL DEFAULT '0.00',
	`credit_line` decimal(12,2) NOT NULL DEFAULT '0.00',
	`used_credit` decimal(12,2) NOT NULL DEFAULT '0.00',
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_distributor_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_pda_unique` UNIQUE(`provider_id`,`distributor_id`)
);
--> statement-breakpoint
CREATE TABLE `provider_distributor_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`distributor_id` int NOT NULL,
	`type` enum('DEBIT','CREDIT','ADJUSTMENT') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`balance_after_transaction` decimal(12,2) NOT NULL,
	`used_credit_after_transaction` decimal(12,2) NOT NULL,
	`reference_id` varchar(255),
	`reference_type` enum('purchase_debit','commission_credit','topup','refund','adjustment') NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provider_distributor_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `provider_distributor_accounts` ADD CONSTRAINT `pda_provider_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_distributor_accounts` ADD CONSTRAINT `pda_distributor_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_distributor_ledger` ADD CONSTRAINT `pdl_provider_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_distributor_ledger` ADD CONSTRAINT `pdl_distributor_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_pda_provider_id` ON `provider_distributor_accounts` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_pda_distributor_id` ON `provider_distributor_accounts` (`distributor_id`);--> statement-breakpoint
CREATE INDEX `idx_pda_updated_at` ON `provider_distributor_accounts` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `idx_pdl_provider_distributor` ON `provider_distributor_ledger` (`provider_id`,`distributor_id`);--> statement-breakpoint
CREATE INDEX `idx_pdl_reference_id` ON `provider_distributor_ledger` (`reference_id`);--> statement-breakpoint
CREATE INDEX `idx_pdl_reference_type` ON `provider_distributor_ledger` (`reference_type`);--> statement-breakpoint
CREATE INDEX `idx_pdl_created_at` ON `provider_distributor_ledger` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_pdl_type` ON `provider_distributor_ledger` (`type`);