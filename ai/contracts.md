# Contratos API BarberOS

## POST /api/log-service
Request: { barber_id, service_id, price_charged, started_at, ended_at? }
Response: { service_log_id, barber_earning, owner_earning, service_number_today, commission_rule_applied }

## POST /api/close-day
Request: { barber_id, date }
Response: { summary: DailySummary }

## GET /api/get-metrics
Query: tenant_id, from, to, metric_type
Response: { data: MetricResult[] }

## Reglas críticas de entrega
- Todos los archivos completos, listos para copiar y pegar
- Sin `any` en TypeScript
- Sin placeholders de lógica (TODO comentados está bien, código incompleto no)
- Al ejecutar `npm run dev` debe levantar sin errores de TypeScript
- Login con owner@demo.com → OwnerLayout
- Login con carlos@demo.com → BarberLayout
- Rutas protegidas redirigen a /login si no hay sesión