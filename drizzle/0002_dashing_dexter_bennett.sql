ALTER TABLE `provider_distributor_commission` DROP FOREIGN KEY `pdc_provider_id_service_providers_fk`;
--> statement-breakpoint
ALTER TABLE `provider_distributor_commission` DROP FOREIGN KEY `pdc_distributor_id_distributors_fk`;
--> statement-breakpoint
ALTER TABLE `provider_distributor_commission` ADD CONSTRAINT `pdc_provider_fk` FOREIGN KEY (`provider_id`) REFERENCES `service_providers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_distributor_commission` ADD CONSTRAINT `pdc_distributor_fk` FOREIGN KEY (`distributor_id`) REFERENCES `distributors`(`id`) ON DELETE no action ON UPDATE no action;