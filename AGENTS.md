# BarberOS

## Proyecto
SaaS multitenant white-label para barberías.
Stack: React 18 + TypeScript + Vite + TailwindCSS + Supabase + Netlify Functions.
Supabase project: https://anwqupemaircnlszjgmd.supabase.co

## Pipeline
1. Codex (Codex.ai) → arquitecto, define ARCHITECTURE LOCK
2. DeepSeek via Codex → implementa
3. ChatGPT → audita
4. Codex → valida

## Reglas críticas
- NUNCA romper funcionalidad existente
- TypeScript estricto, sin `any`
- Toda query Supabase incluye .eq('tenant_id', tenantId)
- RLS habilitado en todas las tablas
- Comisiones se calculan SOLO en Netlify Functions, nunca en el cliente
- Tema visual unificado y fijo para todos los tenants via CSS variables en TenantTheme.tsx (--primary, --secondary). NO hay personalización de color por tenant; las columnas primary_color/secondary_color de la DB quedan sin uso para el tema.
- service_role key NUNCA en el cliente, solo en Netlify Functions

## Estructura de carpetas
src/
  config/supabase.ts
  types/index.ts
  stores/tenantStore.ts
  hooks/useAuth.ts
  components/TenantTheme.tsx
  components/PrivateRoute.tsx
  components/layouts/BarberLayout.tsx
  components/layouts/OwnerLayout.tsx
  pages/Login.tsx
  pages/barber/Dashboard.tsx
  pages/barber/Summary.tsx
  pages/owner/LivePanel.tsx
  pages/owner/Metrics.tsx
  pages/owner/Settings.tsx
  pages/owner/Barbers.tsx
  pages/owner/Services.tsx
  pages/superadmin/Tenants.tsx
netlify/functions/
supabase/migrations/

## Fase actual: 1 — Fundación
Auth + routing + branding. Sin lógica de negocio aún.

## Comandos
npm run dev
npm run build
netlify dev