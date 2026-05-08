# Decisiones BarberOS

## 2025-04-02: Comisiones en Netlify Functions
Razón: no manipulable desde el cliente. Usa service_role key.

## 2025-04-02: Multitenant vía RLS + tenant_id explícito
Razón: doble garantía. Nunca confiar solo en RLS.

## 2025-04-02: Zustand para estado del tenant
Razón: branding y config se cargan una vez al login, disponibles en toda la app.

## 2025-04-02: daily_summaries como tabla separada
Razón: métricas históricas no se calculan en tiempo real.

## Mayo 2026 — Sprint UI + Fixes

### Nomenclatura global
- Atención → Cliente en toda la UI (variables y tipos no cambian, solo textos visibles)
- Owner → Dueño en toda la UI
- Un Cliente = una visita; puede tener múltiples Servicios dentro

### Modelo de datos UI
- Historial del barbero agrupa service_logs por `appointment_id` (fallback: `started_at` truncado al minuto)
- Propinas NO afectan la ganancia del dueño en la liquidación del LivePanel

### LivePanel — día extendido
- Entre 00:00 y 06:00hs Argentina el panel muestra datos del día anterior automáticamente
- Botón "Iniciar nuevo día" visible solo en ese rango horario

### Bugs resueltos
- Split mostraba 122%/111% → corregido excluyendo `tip_amount` del cálculo de porcentaje
- `ownerEarning` duplicaba `others_amount` → corregido (ya está incluido en `owner_earning`)
- Liquidación descontaba propinas del dueño → corregido con `barber_earning - tip_amount`
- Summary cargaba con filtro `started_at` → migrado a `created_at` con rango UTC-3
- Dashboard se colgaba al cambiar solapas → cleanup del efecto agrega `setLoading(false)`