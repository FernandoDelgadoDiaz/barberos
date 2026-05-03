CREATE TABLE IF NOT EXISTS daily_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id),
  amount numeric NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  expense_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_tenant_expenses" ON daily_expenses
  FOR ALL
  TO authenticated
  USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner')
  WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

CREATE POLICY "superadmin_all_expenses" ON daily_expenses
  FOR ALL
  USING (get_my_role() = 'superadmin');
