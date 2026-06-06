CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`type` enum('REQUEST_RECEIVED','REQUEST_APPROVED','REQUEST_REJECTED') NOT NULL,
	`message` text NOT NULL,
	`is_read` int NOT NULL DEFAULT 0,
	`related_entity_id` int,
	`related_entity_type` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_notifications_user_id` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notifications_is_read` ON `notifications` (`is_read`);--> statement-breakpoint
CREATE INDEX `idx_notifications_created_at` ON `notifications` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_is_read` ON `notifications` (`user_id`,`is_read`);