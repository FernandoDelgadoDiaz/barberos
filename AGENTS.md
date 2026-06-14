# BarberOS — Architecture Lock

## Proyecto
App SaaS multi-tenant para gestión de barberías.

Stack real:
- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- React Router
- Supabase
- Zustand
- Netlify

Repositorio:
FernandoDelgadoDiaz/barberos

Rama de trabajo:
ui-redesign-owner-panel

## Objetivo actual
Rediseñar únicamente la capa visual del panel del dueño.

Pantallas owner:
- src/pages/owner/LivePanel.tsx
- src/pages/owner/Metrics.tsx
- src/pages/owner/History.tsx
- src/pages/owner/Services.tsx
- src/pages/owner/Barbers.tsx
- src/pages/owner/Settings.tsx

## Regla principal
La app ya está en producción y funciona correctamente.

No romper:
- lógica
- arquitectura
- Supabase
- base de datos
- autenticación
- rutas
- queries
- Netlify
- contratos de datos

## Archivos prohibidos para rediseño visual
No modificar salvo autorización explícita:

- src/config/supabase.ts
- src/hooks/useAuth.ts
- src/hooks/useRealtime.ts
- src/stores/tenantStore.ts
- src/router.tsx
- src/types/index.ts
- src/pages/barber/*
- src/pages/superadmin/*
- package.json
- vite.config.*
- netlify.toml

## Permitido
Solo cambios visuales:

- JSX de presentación
- clases Tailwind
- CSS visual
- cards
- layouts
- navegación visual
- tipografía
- espaciados
- colores
- iconografía
- estados vacíos
- microinteracciones
- componentes UI presentacionales

## Prohibido
- No agregar campos nuevos.
- No modificar tablas.
- No modificar Supabase Storage.
- No usar fotos reales de dueños o barberos.
- No inventar métricas.
- No crear datos falsos.
- No cambiar rutas existentes.
- No mover cálculos de negocio.
- No modificar handlers críticos.

## Datos
Toda métrica mostrada debe venir de datos reales existentes.

Si una comparación no existe, mostrar texto neutro:
- Datos actualizados en tiempo real.
- Información generada con datos reales del negocio.
- Seguimiento activo de la jornada.

## Diseño visual objetivo
SaaS premium 2026.

Eliminar:
- negro/violeta oscuro
- estética administrativa vieja
- exceso de bordó oscuro

Usar:
- fondo claro #F8FAFC
- cards blancas
- texto #0F172A
- azul #2563EB
- cyan #06B6D4
- verde #10B981
- ámbar #F59E0B
- bordes 24px-32px
- sombras suaves
- mobile-first
- avatares por iniciales

## Flujo obligatorio
Antes de modificar una pantalla:
1. Leer el archivo completo.
2. Identificar lógica y UI.
3. Preservar lógica.
4. Modificar solo presentación.
5. Ejecutar npm run build.
6. Corregir solo errores derivados del rediseño.
7. No hacer commit sin autorización.
