CREATE TABLE `card_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`upload_status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`total_cards` int NOT NULL,
	`processed_cards` int NOT NULL DEFAULT 0,
	`failed_cards` int NOT NULL DEFAULT 0,
	`uploaded_by` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `card_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`batch_id` int,
	`pin_encrypted` text NOT NULL,
	`status` enum('AVAILABLE','SOLD') NOT NULL DEFAULT 'AVAILABLE',
	`allocated_to_distributor_id` int,
	`allocated_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `distributors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distributors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_distributor_commission` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider_id` int NOT NULL,
	`distributor_id` int NOT NULL,
	`commission_rate` decimal(5,4) NOT NULL,
	`commission_type` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_distributor_commission_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_provider_distributor_unique` UNIQUE(`provider_id`,`distributor_id`)
);
--> statement-breakpoint
CREATE TABLE `service_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_providers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`distributor_id` int NOT NULL,
	`provider_id` int NOT NULL,
	`product_id` int NOT NULL,
	`card_id` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`commission_amount` decimal(10,2) NOT NULL,
	`transaction_type` enum('purchase','refund') NOT NULL DEFAULT 'purchase',
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `transactions_idempotency_key_unique` UNIQUE(`idempotency_key`),
	CONSTRAINT `idx_transactions_idempotency_key` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `wallet_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`distributor_id` int NOT NULL,
	`type` enum('DEBIT','CREDIT') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`current_balance_after_transaction` decimal(12,2) NOT NULL,
	`reference_id` varchar(255),
	`reference_type` enum('transaction','topup','adjustment') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wallet_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`distributor_id` int NOT NULL,
	`balance` decimal(12,2) NOT NULL DEFAULT '0.00',
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_distributor_id` PRIMARY KEY(`distributor_id`)
);
--> statement-breakpoint
ALTER TABLE `card_batches` ADD CONSTRAINT `card_batches_provider_id_service_providers_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cards` ADD CONSTRAINT `cards_provider_id_service_providers_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cards` ADD CONSTRAINT `cards_batch_id_card_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `card_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cards` ADD CONSTRAINT `cards_allocated_to_distributor_id_distributors_id_fk` FOREIGN KEY (`allocated_to_distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_provider_id_service_providers_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_distributor_commission` ADD CONSTRAINT `pdc_provider_id_service_providers_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_distributor_commission` ADD CONSTRAINT `pdc_distributor_id_distributors_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_distributor_id_distributors_id_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_provider_id_service_providers_id_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_card_id_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wallet_ledger` ADD CONSTRAINT `wallet_ledger_distributor_id_distributors_id_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_distributor_id_distributors_id_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_card_batches_provider_id` ON `card_batches` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_provider_status` ON `cards` (`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_cards_batch_id` ON `cards` (`batch_id`);--> statement-breakpoint
CREATE INDEX `idx_products_provider_id` ON `products` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_distributor_id` ON `transactions` (`distributor_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_provider_id` ON `transactions` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_card_id` ON `transactions` (`card_id`);--> statement-breakpoint
CREATE INDEX `idx_wallet_ledger_distributor_id` ON `wallet_ledger` (`distributor_id`);--> statement-breakpoint
CREATE INDEX `idx_wallet_ledger_reference_id` ON `wallet_ledger` (`reference_id`);