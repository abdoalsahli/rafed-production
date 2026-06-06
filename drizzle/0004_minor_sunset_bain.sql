ALTER TABLE `transactions` DROP INDEX `transactions_idempotency_key_unique`;--> statement-breakpoint
ALTER TABLE `cards` ADD `pin_viewed` int DEFAULT 0 NOT NULL;