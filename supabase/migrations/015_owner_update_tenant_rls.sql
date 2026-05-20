-- Policy: owner can update only their own tenant's data
CREATE POLICY "owner_update_own_tenant"
ON tenants
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.tenant_id = tenants.id
      AND profiles.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.tenant_id = tenants.id
      AND profiles.role = 'owner'
  )
);
