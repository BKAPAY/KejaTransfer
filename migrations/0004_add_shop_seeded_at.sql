-- Add seededAt column to shops table to track if default products have been seeded
-- This prevents re-seeding after user deletes products
ALTER TABLE shops ADD COLUMN IF NOT EXISTS seeded_at TIMESTAMP;

-- Update existing shops that have products to have seeded_at set
UPDATE shops SET seeded_at = NOW() WHERE id IN (SELECT DISTINCT shop_id FROM shop_products) AND seeded_at IS NULL;
