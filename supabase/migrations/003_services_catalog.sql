CREATE TABLE services_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_price decimal(10,2) NOT NULL,
  duration_min integer DEFAULT 30,
  is_active boolean DEFAULT true
);