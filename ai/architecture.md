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

## Cálculos financieros (validados Mayo 2026)

### Campos en service_logs
- `price_charged` — precio del servicio, SIN propina ni otros
- `barber_earning` — comisión del barbero + `tip_amount` (propina incluida)
- `owner_earning` — comisión del dueño + `others_amount` (otros incluidos)
- `tip_amount` — propina, va 100% al barbero
- `others_amount` — extras (ceras, bebidas), van 100% al dueño

### Fórmulas de display
- Ganancia dueño = `Σ owner_earning` — NO sumar `others_amount` por separado, ya está incluido
- Liquidación dueño = `totalDay - Σ(barber_earning - tip_amount) - gastos`
- Split % barbero = `(barber_earning - tip_amount) / price_charged * 100`
- Split % dueño = `owner_earning / price_charged * 100`

### Invariante clave
`price_charged = (barber_earning - tip_amount) + (owner_earning - others_amount)`