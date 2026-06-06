ALTER TABLE `service_providers` ADD `provider_code` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `service_providers` ADD CONSTRAINT `service_providers_provider_code_unique` UNIQUE(`provider_code`);--> statement-breakpoint
ALTER TABLE `service_providers` ADD CONSTRAINT `idx_provider_code` UNIQUE(`provider_code`);