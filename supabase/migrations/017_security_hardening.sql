-- 017_security_hardening.sql
-- Aplicado en producción (proyecto Barberos / anwqupemaircnlszjgmd) el 2026-06-14.
--
-- Objetivo: habilitar RLS en profiles sin la recursión infinita que rompió el
-- login la primera vez. Las helper functions get_my_role()/get_my_tenant_id()
-- se crean como SECURITY DEFINER con search_path fijo: su SELECT interno bypassa
-- RLS, eliminando la recursión cuando se las llama desde las policies de profiles.
--
-- Contexto: en la DB live estas funciones NO existían (la migración 005 no se
-- aplicó o fue revertida), por eso este paso las CREA. Las policies previas de
-- profiles eran profiles_own (ALL) y profiles_simple (SELECT), ambas rol public.
-- Ver SECURITY_ANALYSIS.md para el plan completo y el rollback.

BEGIN;

-- ============================================================================
-- PASO 5 — Helper functions (SECURITY DEFINER + search_path fijo)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Defensa en profundidad: solo authenticated puede ejecutar las helpers.
REVOKE ALL ON FUNCTION public.get_my_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_role()      FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role()      TO authenticated;

-- ============================================================================
-- PASO 6 — Policies definitivas de profiles + ENABLE RLS
-- ============================================================================
DROP POLICY IF EXISTS "profiles_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_simple" ON public.profiles;

-- A) Cada usuario lee su propio perfil (camino del login; NO usa helpers).
CREATE POLICY "profiles_self_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- B) Cada usuario actualiza su propio perfil.
CREATE POLICY "profiles_self_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- C) Owner lee todos los perfiles de su tenant (Barbers.tsx, LivePanel.tsx).
CREATE POLICY "profiles_owner_read_tenant"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_my_tenant_id()
  AND public.get_my_role() = 'owner'
);

-- D) Owner actualiza perfiles de su tenant (toggle is_active, edit display_name).
CREATE POLICY "profiles_owner_update_tenant"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_my_tenant_id()
  AND public.get_my_role() = 'owner'
)
WITH CHECK (
  tenant_id = public.get_my_tenant_id()
  AND public.get_my_role() = 'owner'
);

-- E) Superadmin: acceso total.
CREATE POLICY "profiles_superadmin_all"
ON public.profiles
FOR ALL
TO authenticated
USING (public.get_my_role() = 'superadmin')
WITH CHECK (public.get_my_role() = 'superadmin');

-- Nota: NO se crean policies de INSERT/DELETE para authenticated.
-- Esas operaciones van solo por Netlify Functions (service_role, bypassa RLS):
-- create-barber.ts (INSERT), create-tenant.ts (INSERT + DELETE rollback).

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- ROLLBACK (referencia — ejecutar manualmente si hace falta revertir)
-- ============================================================================
-- BEGIN;
--   ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS "profiles_self_select"         ON public.profiles;
--   DROP POLICY IF EXISTS "profiles_self_update"         ON public.profiles;
--   DROP POLICY IF EXISTS "profiles_owner_read_tenant"   ON public.profiles;
--   DROP POLICY IF EXISTS "profiles_owner_update_tenant" ON public.profiles;
--   DROP POLICY IF EXISTS "profiles_superadmin_all"      ON public.profiles;
--   CREATE POLICY "profiles_own"
--     ON public.profiles FOR ALL
--     USING (user_id = auth.uid());
--   CREATE POLICY "profiles_simple"
--     ON public.profiles FOR SELECT
--     USING (
--       (user_id = auth.uid())
--       OR (tenant_id = ( SELECT p.tenant_id FROM profiles p
--                          WHERE (p.user_id = auth.uid()) LIMIT 1))
--     );
--   DROP FUNCTION IF EXISTS public.get_my_tenant_id();
--   DROP FUNCTION IF EXISTS public.get_my_role();
-- COMMIT;
