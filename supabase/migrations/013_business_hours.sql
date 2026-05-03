ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS opening_time time DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS closing_time time DEFAULT '21:00';
