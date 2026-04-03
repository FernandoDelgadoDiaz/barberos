# BarberOS

## Proyecto
SaaS multitenant white-label para barberías.
Stack: React 18 + TypeScript + Vite + TailwindCSS + Supabase + Netlify Functions.
Supabase project: https://anwqupemaircnlszjgmd.supabase.co

## Pipeline
1. Claude (claude.ai) → arquitecto, define ARCHITECTURE LOCK
2. DeepSeek via Claude Code → implementa
3. ChatGPT → audita
4. Claude → valida

## Reglas críticas
- NUNCA romper funcionalidad existente
- TypeScript estricto, sin `any`
- Toda query Supabase incluye .eq('tenant_id', tenantId)
- RLS habilitado en todas las tablas
- Comisiones se calculan SOLO en Netlify Functions, nunca en el cliente
- Branding via CSS variables en TenantTheme.tsx (--primary, --secondary)
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