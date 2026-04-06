-- Migration 009: Create appointments table and link to service_logs
-- This migration is idempotent: it will not break if table already exists.

-- 1. Create appointments table if it doesn't exist
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  barber_id uuid NOT NULL,
  shift_id uuid,
  attention_number integer NOT NULL,
  total_price decimal(10,2) NOT NULL,
  total_barber_earning decimal(10,2) NOT NULL,
  total_owner_earning decimal(10,2) NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,

  CONSTRAINT fk_appointments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_appointments_barber FOREIGN KEY (barber_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_appointments_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
);

-- 2. Add appointment_id to service_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_logs' AND column_name='appointment_id') THEN
    ALTER TABLE service_logs ADD COLUMN appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create trigger for updated_at on appointments
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_updated_at_trigger ON appointments;
CREATE TRIGGER appointments_updated_at_trigger
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointments_updated_at();

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_shift ON appointments(tenant_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_created ON appointments(barber_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_attention_number ON appointments(shift_id, attention_number);
CREATE INDEX IF NOT EXISTS idx_service_logs_appointment ON service_logs(appointment_id);

-- 5. Enable Row Level Security
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies following existing patterns

-- Barbers can read their own appointments (select)
CREATE POLICY "barber_own_appointments_select" ON appointments FOR SELECT
  USING (barber_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Owners can read appointments of their tenant
CREATE POLICY "owner_tenant_appointments_select" ON appointments FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

-- Superadmins have full access
CREATE POLICY "superadmin_all_appointments" ON appointments FOR ALL
  USING (get_my_role() = 'superadmin');

-- Note: INSERT/UPDATE/DELETE policies are not needed because appointments are created via service role functions.
-- The service role key bypasses RLS, which is fine.