CREATE TABLE `organization_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`role` enum('admin','operator','viewer') NOT NULL DEFAULT 'operator',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_unique_user_org` UNIQUE(`user_id`,`organization_id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('provider','distributor','internal') NOT NULL,
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`contact_person` varchar(255),
	`email` varchar(320),
	`phone` varchar(20),
	`address` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users_extended` (
	`user_id` int NOT NULL,
	`status` enum('pending','active','suspended') NOT NULL DEFAULT 'pending',
	`activated_at` timestamp,
	`suspended_at` timestamp,
	`suspension_reason` text,
	CONSTRAINT `users_extended_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `organization_users` ADD CONSTRAINT `organization_users_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_users` ADD CONSTRAINT `organization_users_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users_extended` ADD CONSTRAINT `users_extended_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_organization_users_user_id` ON `organization_users` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_organization_users_organization_id` ON `organization_users` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_organizations_name` ON `organizations` (`name`);--> statement-breakpoint
CREATE INDEX `idx_organizations_type` ON `organizations` (`type`);--> statement-breakpoint
CREATE INDEX `idx_organizations_status` ON `organizations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_users_extended_status` ON `users_extended` (`status`);