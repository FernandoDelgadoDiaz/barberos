-- 019_subscriptions.sql
-- Sistema de suscripciones con MercadoPago (ver docs/PLAN_PAGOS.md)
-- Ejecutar manualmente en el SQL Editor de Supabase.

-- ============================================================
-- 1. Columnas de suscripción en tenants
-- ============================================================
ALTER TABLE tenants
  ADD COLUMN subscription_status text NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'grace_period', 'suspended')),
  ADD COLUMN subscription_ends_at timestamptz,          -- fin del período pagado (NULL = nunca pagó)
  ADD COLUMN grace_days int NOT NULL DEFAULT 5,          -- días de gracia tras el vencimiento
  ADD COLUMN last_payment_at timestamptz,                -- fecha del último pago aprobado
  ADD COLUMN last_payment_id text,                       -- id de pago de MercadoPago (reconciliación)
  ADD COLUMN mp_preference_id text;                      -- última preference generada

-- ============================================================
-- 2. Tabla de pagos: auditoría + idempotencia del webhook
--    (mp_payment_id UNIQUE evita procesar dos veces la misma notificación)
-- ============================================================
CREATE TABLE subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mp_payment_id text UNIQUE NOT NULL,
  mp_preference_id text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  status text NOT NULL,                                  -- approved | pending | rejected | ...
  period_start timestamptz,
  period_end timestamptz,
  raw jsonb,                                             -- payload crudo de MP (debug/auditoría)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_payments_tenant ON subscription_payments(tenant_id);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Owner: solo lectura de los pagos de su propio tenant.
-- Sin policies de INSERT/UPDATE/DELETE: solo el service_role (Netlify Functions) escribe.
CREATE POLICY "owner_read_own_payments"
ON subscription_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.tenant_id = subscription_payments.tenant_id
  )
);

-- ============================================================
-- 3. Blindaje: la policy 015 (owner_update_own_tenant) permite al owner
--    actualizar CUALQUIER columna de su tenant desde el cliente. Este trigger
--    impide que usuarios autenticados modifiquen campos de suscripción/trial.
--    Las Netlify Functions usan la service_role key, donde auth.uid() es NULL,
--    por lo que sus escrituras pasan sin restricción.
-- ============================================================
CREATE OR REPLACE FUNCTION protect_subscription_columns()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.subscription_status   IS DISTINCT FROM OLD.subscription_status
    OR NEW.subscription_ends_at  IS DISTINCT FROM OLD.subscription_ends_at
    OR NEW.grace_days            IS DISTINCT FROM OLD.grace_days
    OR NEW.last_payment_at       IS DISTINCT FROM OLD.last_payment_at
    OR NEW.last_payment_id       IS DISTINCT FROM OLD.last_payment_id
    OR NEW.mp_preference_id      IS DISTINCT FROM OLD.mp_preference_id
    OR NEW.trial_ends_at         IS DISTINCT FROM OLD.trial_ends_at
    OR NEW.trial_days            IS DISTINCT FROM OLD.trial_days
    OR NEW.is_exempt_trial       IS DISTINCT FROM OLD.is_exempt_trial THEN
      RAISE EXCEPTION 'No autorizado a modificar campos de suscripción';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE TRIGGER trg_protect_subscription
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION protect_subscription_columns();

-- ============================================================
-- 4. Verificación post-migración (opcional, correr aparte):
--
-- a) Columnas nuevas presentes:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'tenants' AND column_name LIKE '%subscription%';
--
-- b) El trigger bloquea a un owner autenticado (debe fallar si se corre
--    logueado como owner desde el cliente):
--    UPDATE tenants SET subscription_ends_at = '2099-01-01' WHERE id = '<tenant_id>';
--
-- c) Idempotencia: insertar dos veces el mismo mp_payment_id debe fallar
--    con unique_violation la segunda vez.
-- ============================================================
