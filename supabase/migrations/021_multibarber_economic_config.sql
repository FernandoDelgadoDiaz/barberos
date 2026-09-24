-- 021_multibarber_economic_config.sql
-- Adds per-profile economic behavior without changing authorization roles.
-- An owner remains role='owner' (owner dashboard/metrics) and may also operate
-- as a barber through works_as_barber=true.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS works_as_barber boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS earning_mode text NOT NULL DEFAULT 'tenant_rules';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_earning_mode_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_earning_mode_check
  CHECK (earning_mode IN ('tenant_rules', 'owner_100'));

COMMENT ON COLUMN public.profiles.works_as_barber IS
  'Capability flag. Owners keep role=owner and may additionally use the barber workflow when true.';

COMMENT ON COLUMN public.profiles.earning_mode IS
  'Economic allocation for services performed by this profile: tenant_rules uses tenant commission rules; owner_100 allocates 100% of service revenue to owner earnings. Tips remain 100% to the worker and products/others 100% to the owner.';

-- Existing production behavior is preserved: all current profiles continue to
-- use tenant commission rules and no owner is automatically turned into a barber.
