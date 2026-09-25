-- 022_tenant_commercial_policies.sql
-- Tenant-level policies for optional tips and product sales.
-- Defaults preserve La Barbería and all existing production behavior.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS tip_policy jsonb NOT NULL DEFAULT '{"enabled":true,"mode":"barber"}'::jsonb,
  ADD COLUMN IF NOT EXISTS product_policy jsonb NOT NULL DEFAULT '{"enabled":true,"mode":"owner"}'::jsonb;

COMMENT ON COLUMN public.tenants.tip_policy IS
  'Tenant tip policy. enabled=false disables tips. mode supports barber or pool; pool distribution is reserved until its settlement engine is implemented.';

COMMENT ON COLUMN public.tenants.product_policy IS
  'Tenant product-sales policy. enabled=false disables product sales. mode owner preserves current behavior; seller/margin sharing require explicit future configuration.';
