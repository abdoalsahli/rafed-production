CREATE TABLE `monitoring_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL,
	`rule_name` varchar(255) NOT NULL,
	`provider_id` int,
	`distributor_id` int,
	`reference_id` varchar(255),
	`message` text NOT NULL,
	`metadata` text,
	`status` enum('active','resolved','acknowledged') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `monitoring_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `monitoring_alerts` ADD CONSTRAINT `ma_provider_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitoring_alerts` ADD CONSTRAINT `ma_distributor_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_ma_severity` ON `monitoring_alerts` (`severity`);--> statement-breakpoint
CREATE INDEX `idx_ma_rule_name` ON `monitoring_alerts` (`rule_name`);--> statement-breakpoint
CREATE INDEX `idx_ma_status` ON `monitoring_alerts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ma_provider_distributor` ON `monitoring_alerts` (`provider_id`,`distributor_id`);--> statement-breakpoint
CREATE INDEX `idx_ma_created_at` ON `monitoring_alerts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_ma_reference_id` ON `monitoring_alerts` (`reference_id`);