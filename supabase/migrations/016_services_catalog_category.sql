-- Add category to services_catalog: distinguishes between 'servicio' (commission-based)
-- and 'producto' (100% to owner, sold via wizard "Productos" step).
-- Existing rows default to 'servicio' so commission logic stays intact.
ALTER TABLE services_catalog
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'servicio'
CHECK (category IN ('servicio', 'producto'));
