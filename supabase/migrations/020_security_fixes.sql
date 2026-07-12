-- 020_security_fixes.sql
-- Fixes de la auditoría de seguridad (2026-07-12). Ver reporte en la sesión.
-- Ejecutar manualmente en el SQL Editor de Supabase. NO ejecutado aún.

-- ============================================================
-- 1. CRÍTICO C1 — service_logs: la política logs_all (USING true, roles
--    public) anulaba el RLS por completo: cualquiera con la anon key podía
--    leer/escribir/borrar los logs de todos los tenants. La política buena
--    (tenant_own_logs, scoped por profiles.tenant_id) ya existe y queda
--    como única vía de acceso para usuarios autenticados.
-- ============================================================
DROP POLICY IF EXISTS "logs_all" ON service_logs;

-- ============================================================
-- 2. CRÍTICO C2 — daily_summaries: misma situación (summaries_all con
--    USING true). Queda vigente tenant_own_summaries (scoped).
-- ============================================================
DROP POLICY IF EXISTS "summaries_all" ON daily_summaries;

-- ============================================================
-- 3. CRÍTICO C3 — tenants: el SELECT era USING (true) para public →
--    anónimos podían leer teléfono, comisiones, estado de suscripción y
--    mp_preference_id de todos los tenants.
--    Nueva política: solo usuarios autenticados ven SU tenant (por
--    membresía en profiles) o todo si son superadmin. Las Netlify
--    Functions no se ven afectadas (service_role bypassa RLS).
-- ============================================================
DROP POLICY IF EXISTS "tenants_own" ON tenants;

CREATE POLICY "tenants_select_member"
ON tenants
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT profiles.tenant_id FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
  OR get_my_role() = 'superadmin'
);

-- Caso de uso que dependía del acceso anónimo: Login.tsx muestra el nombre
-- de la barbería cuando la URL trae ?tenant=<slug>, ANTES de autenticarse.
-- Se repone con una función que expone SOLO el nombre de tenants activos
-- (nunca teléfono, comisiones ni datos de suscripción).
-- ⚠️ Requiere un cambio de 1 línea en Login.tsx (ver nota al final).
CREATE OR REPLACE FUNCTION public.get_tenant_login_name(p_slug text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT name FROM tenants WHERE slug = p_slug AND is_active = true;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_login_name(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_tenant_login_name(text) TO anon, authenticated;

-- ============================================================
-- 4. ALTO — Índices faltantes en tablas calientes (hoy solo tenían PK;
--    toda query de dashboard/history/metrics filtra por estas columnas).
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_service_logs_tenant_started
  ON service_logs (tenant_id, started_at);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant
  ON appointments (tenant_id);

CREATE INDEX IF NOT EXISTS idx_shifts_tenant_barber
  ON shifts (tenant_id, barber_id);

-- ============================================================
-- 5. MEDIO — Funciones SECURITY DEFINER ejecutables por anon via
--    /rest/v1/rpc/ (linter de Supabase). Sin sesión devuelven NULL,
--    pero no hay razón para exponerlas sin login.
--    (protect_subscription_columns devuelve trigger y no es invocable
--     por RPC, pero el REVOKE silencia el warning del linter.)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_tenant_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_subscription_columns() FROM anon;

-- ============================================================
-- Verificación post-migración (correr aparte):
--
-- a) Las políticas permisivas ya no existen:
--    SELECT tablename, policyname FROM pg_policies
--    WHERE policyname IN ('logs_all','summaries_all','tenants_own');
--    -- debe devolver 0 filas
--
-- b) La nueva política de tenants existe:
--    SELECT policyname, roles FROM pg_policies WHERE tablename='tenants';
--    -- debe listar tenants_select_member (authenticated) y
--    -- owner_update_own_tenant
--
-- c) Índices creados:
--    SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_%tenant%';
--
-- d) Prueba de aislamiento SIN login (con la anon key, desde consola):
--    fetch('https://anwqupemaircnlszjgmd.supabase.co/rest/v1/service_logs?select=id',
--      { headers: { apikey: '<ANON_KEY>' } })
--    -- debe devolver [] (antes devolvía los 694 logs de La Barbería)
--    Ídem para /rest/v1/tenants → []
--
-- e) La función de login funciona:
--    SELECT get_tenant_login_name('la-barberia');  -- → 'La Barbería'
-- ============================================================
