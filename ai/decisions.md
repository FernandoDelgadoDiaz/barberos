# Decisiones BarberOS

## 2025-04-02: Comisiones en Netlify Functions
Razón: no manipulable desde el cliente. Usa service_role key.

## 2025-04-02: Multitenant vía RLS + tenant_id explícito
Razón: doble garantía. Nunca confiar solo en RLS.

## 2025-04-02: Zustand para estado del tenant
Razón: branding y config se cargan una vez al login, disponibles en toda la app.

## 2025-04-02: daily_summaries como tabla separada
Razón: métricas históricas no se calculan en tiempo real.