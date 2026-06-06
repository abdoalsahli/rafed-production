DROP INDEX `idx_cards_provider_status` ON `cards`;--> statement-breakpoint
ALTER TABLE `cards` ADD `product_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD CONSTRAINT `cards_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_cards_provider_product_status` ON `cards` (`provider_id`,`product_id`,`status`);