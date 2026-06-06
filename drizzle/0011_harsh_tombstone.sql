ALTER TABLE `products` ADD `display_name` varchar(255);--> statement-breakpoint
ALTER TABLE `products` ADD `face_value` decimal(10,2);--> statement-breakpoint
ALTER TABLE `products` ADD `currency` varchar(3) DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE `products` ADD `is_active` int DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_products_status` ON `products` (`status`);