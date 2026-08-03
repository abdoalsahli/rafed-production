-- Allocation Orders: provider-side offline order management
CREATE TABLE IF NOT EXISTS `allocation_orders` (
  `id` int AUTO_INCREMENT NOT NULL,
  `provider_id` int NOT NULL,
  `client_name` varchar(255) NOT NULL,
  `client_phone` varchar(64),
  `client_notes` text,
  `status` enum('draft','confirmed','delivered','cancelled') NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` timestamp NULL,
  `delivered_at` timestamp NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ao_provider_id` (`provider_id`),
  INDEX `idx_ao_status` (`status`),
  CONSTRAINT `fk_ao_provider` FOREIGN KEY (`provider_id`) REFERENCES `service_providers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `allocation_order_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity_requested` int NOT NULL,
  `quantity_fulfilled` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_aoi_order_id` (`order_id`),
  CONSTRAINT `fk_aoi_order` FOREIGN KEY (`order_id`) REFERENCES `allocation_orders` (`id`),
  CONSTRAINT `fk_aoi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `allocation_order_cards` (
  `id` int AUTO_INCREMENT NOT NULL,
  `order_item_id` int NOT NULL,
  `card_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_aoc_card_id` (`card_id`),
  INDEX `idx_aoc_order_item_id` (`order_item_id`),
  CONSTRAINT `fk_aoc_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `allocation_order_items` (`id`),
  CONSTRAINT `fk_aoc_card` FOREIGN KEY (`card_id`) REFERENCES `cards` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
