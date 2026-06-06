-- Phase 13: Product Model Refinement
-- Add stable external identifiers (productCode) to products table
-- This enables code-first API while maintaining backward compatibility with numeric IDs

-- Add productCode column to products table
ALTER TABLE products ADD COLUMN product_code VARCHAR(64) AFTER price;

-- Create unique index on (provider_id, product_code) to ensure uniqueness within provider
ALTER TABLE products ADD UNIQUE INDEX idx_products_provider_code (provider_id, product_code);

-- Note: productCode is optional during transition period to maintain backward compatibility
-- Once all products are assigned codes, this can be changed to NOT NULL
