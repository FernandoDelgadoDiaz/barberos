-- Identity belongs to a tenant. Historical appointments remain anonymous.
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  phone_normalized text NOT NULL CHECK (phone_normalized ~ '^[0-9]{8,15}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_normalized),
  UNIQUE (tenant_id, id)
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_tenant_read ON public.customers FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id()
    AND public.get_my_role() IN ('owner', 'barber'));

REVOKE ALL ON public.customers FROM anon, authenticated;
GRANT SELECT ON public.customers TO authenticated;

ALTER TABLE public.appointments ADD COLUMN customer_id uuid;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_customer_same_tenant
  FOREIGN KEY (tenant_id, customer_id)
  REFERENCES public.customers(tenant_id, id) ON DELETE RESTRICT;
CREATE INDEX appointments_customer_visit_idx
  ON public.appointments (tenant_id, customer_id, started_at DESC)
  WHERE customer_id IS NOT NULL AND total_price > 0;
