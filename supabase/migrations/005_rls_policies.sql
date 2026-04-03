ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "superadmin_all_tenants" ON tenants FOR ALL
  USING (get_my_role() = 'superadmin');
CREATE POLICY "owner_read_own_tenant" ON tenants FOR SELECT
  USING (id = get_my_tenant_id());

CREATE POLICY "user_read_own_profile" ON profiles FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "owner_read_tenant_profiles" ON profiles FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');
CREATE POLICY "owner_manage_tenant_profiles" ON profiles FOR ALL
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');
CREATE POLICY "superadmin_all_profiles" ON profiles FOR ALL
  USING (get_my_role() = 'superadmin');

CREATE POLICY "tenant_read_services" ON services_catalog FOR SELECT
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY "owner_manage_services" ON services_catalog FOR ALL
  USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('owner','superadmin'));

CREATE POLICY "barber_own_logs" ON service_logs FOR SELECT
  USING (barber_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "owner_tenant_logs" ON service_logs FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');
CREATE POLICY "superadmin_all_logs" ON service_logs FOR ALL
  USING (get_my_role() = 'superadmin');

CREATE POLICY "barber_own_summaries" ON daily_summaries FOR SELECT
  USING (barber_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "owner_tenant_summaries" ON daily_summaries FOR SELECT
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');
CREATE POLICY "superadmin_all_summaries" ON daily_summaries FOR ALL
  USING (get_my_role() = 'superadmin');