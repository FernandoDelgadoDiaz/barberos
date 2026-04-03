# Reglas BarberOS

## Multitenant
- Toda query Supabase DEBE incluir .eq('tenant_id', tenantId)
- RLS es segunda línea de defensa, no la única
- tenant_id viene siempre del store, nunca hardcodeado

## Comisiones
- Lógica de comisiones SOLO en netlify/functions/log-service.ts
- service_number_today se calcula en la Function
- Reglas se leen de tenants.commission_rules (JSONB)

## Auth y roles
- Roles: 'superadmin' | 'owner' | 'barber'
- Rol en profiles.role, NO en user_metadata
- Redirección post-login según rol

## Realtime
- Solo owner panel suscribe a Supabase Realtime
- Canal: service_logs:tenant_id=eq.{tenantId}

## Branding
- CSS vars: --primary, --secondary
- Inyectadas en TenantTheme.tsx
- Logo en Supabase Storage bucket: tenant-logos (público)

## Prohibido
- No usar `any` en TypeScript
- No hardcodear tenant_id
- No exponer service_role key en el cliente