-- Fix timestamp column names in access_requests table
ALTER TABLE `access_requests` 
CHANGE COLUMN `createdAt` `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
CHANGE COLUMN `updatedAt` `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Fix timestamp column names in distributor_api_credentials table
ALTER TABLE `distributor_api_credentials` 
CHANGE COLUMN `createdAt` `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
CHANGE COLUMN `updatedAt` `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
