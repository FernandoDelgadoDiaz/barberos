-- Migration 008: Create shifts table with paused state and RLS policies
-- This migration is idempotent: it will not break if table already exists.

-- 1. Create shifts table if it doesn't exist
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  barber_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  closed_at timestamptz,
  paused_at timestamptz,
  status text NOT NULL CHECK (status IN ('open', 'paused', 'closed')),
  total_services integer NOT NULL DEFAULT 0,
  total_revenue decimal(10,2) NOT NULL DEFAULT 0,
  barber_earnings decimal(10,2) NOT NULL DEFAULT 0,
  owner_earnings decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,

  CONSTRAINT fk_shifts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_shifts_barber FOREIGN KEY (barber_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- 2. Add columns that may be missing in existing installations
DO $$
BEGIN
  -- Add paused_at if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shifts' AND column_name='paused_at') THEN
    ALTER TABLE shifts ADD COLUMN paused_at timestamptz;
  END IF;

  -- Add created_at if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shifts' AND column_name='created_at') THEN
    ALTER TABLE shifts ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  -- Add updated_at if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shifts' AND column_name='updated_at') THEN
    ALTER TABLE shifts ADD COLUMN updated_at timestamptz;
  END IF;
END $$;

-- 3. Update status constraint to include 'paused'
-- First drop existing constraint if it exists (we don't know its name)
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the check constraint on status column
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'shifts'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE shifts DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Now add the new constraint
ALTER TABLE shifts ADD CONSTRAINT shifts_status_check CHECK (status IN ('open', 'paused', 'closed'));

-- 4. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shifts_updated_at_trigger ON shifts;
CREATE TRIGGER shifts_updated_at_trigger
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_shifts_updated_at();

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_barber_status ON shifts (tenant_id, barber_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_barber_started ON shifts (tenant_id, barber_id, started_at);
CREATE INDEX IF NOT EXISTS idx_shifts_started_date ON shifts (tenant_id, barber_id, (started_at::date));

-- 6. Enable Row Level Security
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies following existing patterns

-- Barbers can read and update their own shifts (select, update)
CREATE POLICY "barber_own_shifts_select" ON shifts FOR SELECT
  USING (barber_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "barber_own_shifts_update" ON shifts FOR UPDATE
  USING (barber_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Owners can read shifts of their tenant
CREATE POLICY "owner_tenant_shifts_select" ON shifts FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

-- Superadmins have full access
CREATE POLICY "superadmin_all_shifts" ON shifts FOR ALL
  USING (get_my_role() = 'superadmin');

-- Note: INSERT policy is not needed because shifts are created via service role functions.
-- The service role key bypasses RLS, which is fine.