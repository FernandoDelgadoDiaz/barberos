# Arquitectura BarberOS

## Capas
1. Cliente React (SPA) → Vite, TailwindCSS, Zustand
2. Supabase → Auth, PostgreSQL, Realtime, Storage
3. Netlify Functions → lógica de negocio sensible

## Flujo registro de servicio
Cliente → POST /api/log-service → Netlify Function
  → lee commission_rules del tenant
  → calcula service_number_today
  → aplica regla de comisión
  → inserta en service_logs
  → Supabase Realtime notifica al owner panel

## Tablas
- tenants: config del tenant (branding + reglas)
- profiles: users con rol y tenant
- services_catalog: servicios por tenant
- service_logs: cada servicio con comisión calculada
- daily_summaries: agregado diario por barbero

## RLS
- Functions usan service_role key (sin RLS)
- Cliente usa anon key (con RLS)