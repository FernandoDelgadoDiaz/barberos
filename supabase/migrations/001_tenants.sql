CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#1a1a1a',
  secondary_color text DEFAULT '#f59e0b',
  commission_rules jsonb NOT NULL DEFAULT '{"rules":[{"from_service":1,"to_service":1,"barber_pct":100,"owner_pct":0},{"from_service":2,"to_service":null,"barber_pct":50,"owner_pct":50}],"resets_daily":true}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);