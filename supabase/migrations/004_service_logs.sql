CREATE TABLE service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  barber_id uuid REFERENCES profiles(id),
  service_id uuid REFERENCES services_catalog(id),
  price_charged decimal(10,2) NOT NULL,
  barber_earning decimal(10,2) NOT NULL,
  owner_earning decimal(10,2) NOT NULL,
  service_number_today integer NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  status text DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  barber_id uuid REFERENCES profiles(id),
  summary_date date NOT NULL,
  total_services integer DEFAULT 0,
  total_revenue decimal(10,2) DEFAULT 0,
  barber_earnings decimal(10,2) DEFAULT 0,
  owner_earnings decimal(10,2) DEFAULT 0,
  UNIQUE(tenant_id, barber_id, summary_date)
);