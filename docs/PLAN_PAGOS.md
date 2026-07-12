# PLAN TÉCNICO — Suscripciones con MercadoPago (BarberOS)

> Aprobado el 2026-07-12. Modo de cobro: **link de pago mensual manual** (Checkout Pro / Preference).
> Precio configurable vía variable de entorno `MP_PRICE_ARS` en Netlify (hoy 30000). Sin hardcodear en código.

## Estado previo verificado

| Elemento | Estado |
|---|---|
| `tenants.trial_ends_at`, `trial_days` (def. 14), `is_exempt_trial` (def. false) | En DB (sin migración versionada) |
| `tenants.is_active` | Suspensión administrativa (superadmin) |
| `TrialExpiredGuard` | Bloquea con pantalla WhatsApp cuando `trial_ends_at <= hoy` |
| `SuspendedGuard` | Bloquea si `is_active === false` (envuelve por fuera del trial) |
| Guards cableados | En `BarberLayout` y `OwnerLayout` (`SuspendedGuard > TrialExpiredGuard`) |
| `useAuth` carga tenant con `select('*')` | Columnas nuevas aparecen automáticamente en `tenant` |
| Variables MP en Netlify | `MP_ACCESS_TOKEN`, `MP_PRICE_ARS=30000` |
| SDK de MercadoPago | No instalado → se usa API REST directa con `fetch` (sin dependencia nueva) |

### Hallazgo de seguridad crítico (bloqueante)

La policy `015_owner_update_tenant_rls.sql` permite al owner hacer `UPDATE` de **cualquier columna** de su tenant desde el cliente. Con columnas de suscripción en `tenants`, un owner podría auto-extenderse el período pagado. RLS no restringe por columna → se blinda con un **trigger** `protect_subscription_columns` en la migración 019 (permite escrituras del service_role — `auth.uid() IS NULL` — y bloquea las de usuarios autenticados).

## Modelo de estados

`subscription_status`: `trial` → `active` (pagó) → `grace_period` (venció, `grace_days` de gracia, def. 5) → `suspended` (bloqueo por falta de pago).

Independiente de `is_active` (suspensión manual superadmin) y de `is_exempt_trial` (cuentas gratis, nunca se bloquean).

## 1) Migración `019_subscriptions.sql`

- Columnas nuevas en `tenants`: `subscription_status`, `subscription_ends_at`, `grace_days` (def. 5), `last_payment_at`, `last_payment_id`, `mp_preference_id`.
- Tabla `subscription_payments`: auditoría de pagos + **idempotencia del webhook** (`mp_payment_id UNIQUE`). RLS: owner solo SELECT de sus pagos; escritura solo service_role (sin policies de escritura).
- Trigger `trg_protect_subscription` sobre `tenants`: bloquea que usuarios autenticados modifiquen campos de suscripción/trial.
- **Verificar en staging** que `auth.uid()` es `NULL` bajo service_role key (es la condición que permite escribir a las Netlify Functions).

## 2) Netlify Functions

| Función | Rol | Propósito |
|---|---|---|
| `create-payment.ts` | owner | Crea Preference en MP (`POST /checkout/preferences`), guarda `mp_preference_id`, devuelve `init_point` y el precio |
| `mp-webhook.ts` | público (MP) | Recibe notificación, **re-consulta** `GET /v1/payments/{id}` (fuente de verdad), si `approved`: inserta en `subscription_payments` (idempotente), extiende `subscription_ends_at = max(actual, now()) + 1 mes`, `status='active'`. Responde 200 |
| `cron-subscriptions.ts` | scheduled (diaria) | Transiciona estados: vencido → `grace_period`; vencido + gracia → `suspended`. Avisos "vence en 5 días" |
| `admin-extend-subscription.ts` | superadmin | Registro manual de pago: +1 mes y `active` (fallback si el webhook falla o se cobra por fuera) |

Detalles de la Preference:
- `external_reference` y `metadata.tenant_id` = tenant_id (para reconciliar en el webhook).
- `notification_url` = `https://barberos-app.netlify.app/api/mp-webhook`.
- `back_urls`: `/pago/exito`, `/pago/pendiente`, `/pago/error` + `auto_return: approved`.
- El desbloqueo real lo hace el **webhook**; los back_urls son solo UX.
- Seguridad webhook: validar `x-signature` de MP además del re-fetch del pago.

## 3) Frontend

Se **extiende `TrialExpiredGuard`** (no se crea guard nuevo; no se re-cablean layouts). Lógica de acceso (derivada de fechas, no depende del cron):

```
1. is_active === false        → SuspendedGuard (por fuera, sin cambios)
2. is_exempt_trial === true   → acceso libre
3. Pagó alguna vez (subscription_ends_at != null):
     hoy <= subscription_ends_at + grace_days → acceso ; si no → PAYWALL
4. Nunca pagó (solo trial):
     trial_ends_at > hoy → acceso ; si no → PAYWALL
```

Paywall (evoluciona la pantalla actual):
- Título según caso: "Tu prueba finalizó" / "Tu suscripción venció".
- Botón primario: "Pagar suscripción $X/mes" → `POST /api/create-payment` → redirect a `init_point`. El precio viene de la function (lee `MP_PRICE_ARS`).
- WhatsApp queda como secundario (soporte).
- Banner no bloqueante durante `grace_period`: "Tu suscripción venció, tenés X días para pagar".

Rutas nuevas: `/pago/exito`, `/pago/pendiente`, `/pago/error`.
Tipos nuevos en `src/types/index.ts` (Tenant): `subscription_status`, `subscription_ends_at`, `grace_days`, `last_payment_at`, `last_payment_id`.
No se toca `useAuth` ni `tenantStore` (usan `select('*')`).

## 4) Superadmin

- `get-tenants.ts`: agregar campos nuevos a la interface TS (el `select('*')` ya los trae).
- `Tenants.tsx`: columna/badge "Suscripción" (Activo / En gracia / Suspendido / Trial / Exento), fechas en modal de detalles, acción "Extender 1 mes" → `admin-extend-subscription`.
- `toggle-tenant` existente cubre activar/desactivar de emergencia.

## Orden de implementación

1. **PASO 1** — Migración 019 + trigger de seguridad (SQL se ejecuta manualmente en Supabase).
2. **PASO 2** — `create-payment.ts` + `mp-webhook.ts`.
3. **PASO 3** — Frontend (TrialExpiredGuard/paywall + rutas `/pago/*` + tipos).
4. **PASO 4** — Superadmin (columna suscripción + acción extender).
5. **PASO 5** — `cron-subscriptions.ts` + `admin-extend-subscription.ts`.

## Decisiones pendientes de confirmar

1. Canal de avisos "vence en 5 días": WhatsApp, email, o solo banner in-app (MVP).
2. Gracia en trial: hoy el trial bloquea al vencer sin gracia; los 5 días de gracia aplican solo a renovaciones pagas. ¿Se mantiene?
