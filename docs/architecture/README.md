# Arquitectura — índice de decisiones (ADRs)

Cada decisión técnica se registra como un ADR corto: contexto, opciones, decisión y consecuencias. Un ADR aceptado no se edita para cambiar la decisión: se crea uno nuevo que lo reemplaza y se marca el anterior como "Reemplazado por ADR-NNN".

| ADR | Decisión | Estado |
|---|---|---|
| [ADR-001](adr-001-plataforma-expo-typescript.md) | Expo (React Native) + TypeScript estricto | Aceptado |
| [ADR-002](adr-002-estrategia-de-testing-tdd.md) | TDD; Jest + RNTL durante la feature, E2E con Maestro al cierre | Aceptado |
| [ADR-003](adr-003-comentarios-docstring.md) | Comentarios solo como docstrings TSDoc | Aceptado |
| [ADR-004](adr-004-framework-ui-heroui-native.md) | UI con HeroUI Native (solo open source) + Uniwind | Aceptado |
| [ADR-005](adr-005-estructura-del-proyecto.md) | Estructura por feature con capas internas, rutas delgadas en `src/app/`, alias `@/` y límites aplicados por lint | Aceptado |
| [ADR-006](adr-006-persistencia-local.md) | expo-sqlite + Drizzle 0.45 con convenciones sync-ready (UUIDv7, timestamps, borrado lógico, repositorios); apertura y migración únicas para app y tests | Aceptado |
| [ADR-007](adr-007-modelo-de-datos.md) | Modelo relacional con precio copiado por ítem, archivado sin borrado, fechas locales y "no vendí" por semana | Aceptado (enmendado el 2026-11-13: categorías y contextos de consejos) |
| [ADR-008](adr-008-almacenamiento-de-imagenes.md) | Fotos JPEG de 1600 px en `Paths.document/photos/<id>.jpg` (nombre derivado del id), con hash, inmutables y limpieza de huérfanos segura | Aceptado |
| [ADR-009](adr-009-estado-y-acceso-a-datos-en-la-ui.md) | TanStack Query sobre repositorios con invalidación por tablas tras commit; React Hook Form; sin store global | Aceptado |
| [ADR-010](adr-010-validacion-de-datos.md) | Zod 4 en los bordes (formularios, rutas, notificaciones, respaldos); códigos de error traducidos en la UI | Aceptado |
| [ADR-011](adr-011-notificaciones-locales.md) | expo-notifications: aviso adaptado de una sola vez + `WEEKLY` neutro sin duplicados (estados A/B), reconciliación serializada por diferencias | Aceptado |
| [ADR-012](adr-012-respaldo-y-exportacion.md) | Respaldo ZIP STORED versionado con lector/escritor propio por directorio central; restauración validada sin depender de la caché; CSV con `;` y BOM | Aceptado |
| [ADR-013](adr-013-tooling-de-calidad.md) | ESLint con tipos + regla local de docstrings + límites de capas, Prettier, Jest en dos proyectos, Maestro, React Compiler activado | Aceptado |
| [ADR-014](adr-014-tipografia-e-iconos.md) | Solo Lexend (sin `tnum`; montos alineados a la derecha con un componente `Amount`) e íconos Phosphor importados por ícono | Aceptado |
| [ADR-015](adr-015-fechas-y-zonas-horarias.md) | Fechas locales con aritmética de calendario pura; única conversión en la zona del dispositivo (`LocalCalendar`), sin `Intl` ni librerías; tests con TZ fija | Aceptado |
| [ADR-016](adr-016-plataformas-y-builds-locales.md) | Sin web; builds locales de Android con `expo run:android` (`debug`, `release` y `e2e` con `EXPO_PUBLIC_E2E=1`), lista de dependencias de la plantilla, `android.package` local provisional, APK por punto de control y `minSdkVersion` 24 | Aceptado |

## Pendientes (futuro, fuera de la v1)
La v1 no se publica y no usa servicios externos: todo es local. Estos ADRs quedan como consideraciones para cuando haya un release:

| ADR | Tema | Estado |
|---|---|---|
| (nuevo, sin número) | EAS Build y Submit, perfiles de `eas.json`, identificadores definitivos, firma de release, política de EAS Update y rollback (con las migraciones solo en builds nativos, ADR-006) y E2E de iOS. Los puntos de partida están en la sección "Futuro" de [ADR-016](adr-016-plataformas-y-builds-locales.md), que en la v1 solo decide web, builds locales, dependencias y `minSdkVersion` | Pendiente |
| ADR-017 | Crash reporting externo y destino del `logger` en producción (en la v1 el logger solo escribe en consola en desarrollo, ADR-005), con revisión de privacidad | Pendiente |
