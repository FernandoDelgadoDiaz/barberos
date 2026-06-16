-- 018_product_sales.sql
-- Detalle de productos vendidos por atención (para que el dueño planifique compras).
-- Una fila por línea de producto. Snapshot de nombre/precio al momento de la venta
-- para no corromper el histórico si el catálogo cambia.
-- La escritura ocurre SOLO desde la Netlify Function log-service (service_role).

CREATE TABLE IF NOT EXISTS product_sales (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  barber_id      uuid REFERENCES profiles(id),
  product_id     uuid REFERENCES services_catalog(id) ON DELETE SET NULL,
  product_name   text NOT NULL,                         -- snapshot al momento de venta
  unit_price     numeric NOT NULL CHECK (unit_price >= 0),
  quantity       integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  line_total     numeric NOT NULL CHECK (line_total >= 0),
  payment_method text NOT NULL DEFAULT 'efectivo'
    CHECK (payment_method IN ('efectivo', 'transferencia')),
  sold_at        timestamptz NOT NULL,                  -- = started_at del servicio (UTC)
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_sales_tenant_sold_at
  ON product_sales (tenant_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_product_sales_product
  ON product_sales (tenant_id, product_id);

ALTER TABLE product_sales ENABLE ROW LEVEL SECURITY;

-- Lectura: solo el dueño de su tenant. La escritura va por service_role (bypassa RLS).
CREATE POLICY "owner_read_tenant_product_sales" ON product_sales
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

CREATE POLICY "superadmin_all_product_sales" ON product_sales
  FOR ALL
  USING (get_my_role() = 'superadmin');
