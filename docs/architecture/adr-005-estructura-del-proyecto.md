# ADR-005: Estructura del proyecto y límites entre capas

- **Estado**: Aceptado
- **Fecha**: 2026-11-12 (revisado 2026-11-13 tras la revisión del reviewer)
- **Versiones verificadas (boilerplate instalado)**: `expo` 58.0.25, `expo-router` ~58.0.31, React Native 0.88.1, React 19.3.0, TypeScript 6.0.3. La plantilla trae Expo Router en `src/app/`, el alias `@/*` → `./src/*` y `@/assets/*` → `./assets/*`.

## Contexto
Hay que fijar dónde vive cada cosa, para que el `code-writer` y el `reviewer` compartan un criterio y para que la regla "la UI depende del dominio, nunca al revés" se pueda verificar con el linter (ADR-013).

- Expo Router trata **todo** archivo dentro de `src/app/` como ruta. Por eso el boilerplate pone sus tests en `src/__tests__/`.
- Las features de producto (`docs/product.md`) son: productos, registro de ventas, seguimiento, notificaciones, consejos, y respaldo y exportación.

## Opciones consideradas

### Ubicación de las rutas
- **`app/` en la raíz**: es la convención histórica. Deja el código repartido en dos raíces y obliga a mantener dos alias.
- **`src/app/`**: es lo que trae la plantilla actual y el boilerplate. Todo el código queda bajo `src/` con un único alias `@/`.

### Organización del código
- **Por tipo** (`components/`, `hooks/`, `services/`). Cada cambio toca muchas carpetas y los límites entre features quedan implícitos.
- **Por feature con capas internas**. El cambio queda localizado y los límites se pueden verificar con el linter.
- **Clean architecture completa** (entities, use cases, ports, adapters y presenters en cada feature). Son demasiadas capas para una app local de este tamaño (YAGNI).

## Decisión
**Organización por feature con capas internas, rutas delgadas en `src/app/` y un único alias `@/` → `src/`.**

```
src/
  app/                      Solo rutas de Expo Router (delgadas, sin lógica ni tests)
    _layout.tsx             Raíz: llama a createAppDependencies() y monta AppProviders
    (tabs)/...              Navegación principal
    sales/new.tsx           Valida params, renderiza la screen y compone la navegación posventa
  __tests__/                Tests de integración que montan rutas (fuera de src/app/)
  features/
    products/
      domain/               Tipos, reglas y fábricas puras; esquemas de validación
      data/                 Interfaz del repositorio + implementación Drizzle (sin módulos expo-*)
      adapters/             Adaptadores sobre módulos expo-* (cuando la feature los necesita)
      hooks/                Hooks de lectura/escritura (TanStack Query, ADR-009)
      components/           Componentes presentacionales
      screens/              Pantallas que componen hooks + componentes
      use-cases/            Orquestación con varios puertos (opcional)
      index.ts              API pública para UI y composición
      domain/index.ts       API pública del dominio
    sales/  tracking/  notifications/  tips/  backup/  settings/
  shared/
    domain/                 Tipos y funciones puras transversales: Clp, LocalDate, ids, Result, calendario
    ui/                     Componentes base del sistema de diseño (designer, ADR-004)
    lib/                    Utilidades sin estado de negocio: logger, formateadores puros
  core/
    db/                     Apertura y configuración de SQLite, esquema Drizzle, migraciones, runInTransaction
    files/                  Acceso al sistema de archivos (fotos, respaldos)
    providers/              Tipo AppDependencies, DependenciesContext, useDependencies, AppProviders, MigrationGate
    dependencies/           createAppDependencies(): única fábrica que conoce las implementaciones concretas
e2e/maestro/<feature>/      Flujos E2E (ADR-013)
tools/eslint/               Regla local de comentarios (ADR-013)
```

### Reglas de dependencia
| Capa | Puede importar | No puede importar |
|---|---|---|
| `shared/domain` | nada del proyecto; `zod`, `uuid` | React, React Native, `expo-*`, Drizzle, `core`, `features` |
| `features/*/domain` | `shared/domain`, `@/features/<otra>/domain`, `zod` | React, RN, `expo-*`, Drizzle, `core`, `data`, `hooks`, UI |
| `features/*/data` | su `domain`, otros `domain`, `core/db`, Drizzle | `expo-*`, `hooks`, `components`, `screens`, `app` |
| `features/*/adapters` | su `domain`, `core/files`, módulos `expo-*` | `hooks`, UI, `data` |
| `features/*/use-cases` | su `domain`, otros `domain`, interfaces de puertos (`import type`) | implementaciones concretas, UI |
| `features/*/hooks` | `domain`, `use-cases`, `import type` de puertos, `core/providers` | `core/dependencies`, implementaciones concretas, Drizzle, `expo-sqlite` |
| `features/*/components` | `domain`, `shared/ui`, `shared/lib` | `data`, `adapters`, `core` |
| `features/*/screens` | `hooks`, `components`, `domain`, `shared/ui`, `shared/lib` | `data`, `adapters`, `core/db`, `core/dependencies` |
| `shared/ui` | `shared/domain`, `shared/lib`, HeroUI Native | `features`, `core` |
| `core/providers` | `import type` de puertos de las features, TanStack Query | implementaciones concretas, `core/dependencies` |
| `core/dependencies` | implementaciones de `data` y `adapters`, `core/db`, `core/files` | UI, `hooks` |
| `src/app/` | `@/features/<f>` (index), `core/providers`; **solo `_layout.tsx` raíz** importa `core/dependencies` | capas internas de las features |

- **Sin ciclos.** El contexto y el tipo `AppDependencies` viven en `core/providers` y solo contienen tipos. `createAppDependencies()` vive en `core/dependencies` y solo lo importa `src/app/_layout.tsx`. Así los hooks dependen del contexto y no de las implementaciones.
- **Entre features** solo se importa por `@/features/<f>` y `@/features/<f>/domain`. Dentro de una feature se usan imports relativos.
- **Dirección prevista** (sin ciclos):
  - `products` ← `sales` ← `tracking`.
  - `tips` depende solo de `sales/domain` y `products/domain`.
  - `notifications` depende de `sales/domain`.
  - `backup` depende de `core/db` y `core/files`.
  - `settings` compone `notifications` y `backup`.
- **Composición entre features en `src/app/`, no entre features**:
  - Después de guardar una venta, la ruta `src/app/sales/new.tsx` recibe `onSaved(saleRecordId)` de la screen y navega a la ruta del consejo posventa (`/tips/after-sale`), que pertenece a `tips`.
  - La reprogramación de recordatorios no la invoca `sales`: la dispara `DataChanges` (ADR-009, ADR-011).
- **`use-cases/` es opcional** y solo se crea cuando una acción coordina varios puertos *de la misma feature* (por ejemplo, la restauración en `backup`).
- **`src/app/` contiene solo rutas** (`_layout.tsx`, `+not-found.tsx` y pantallas). Lo verifica una regla de lint (ADR-013).
- **Puerta de migraciones**: `MigrationGate` en `core/providers` muestra el splash mientras migra y la pantalla de error con exportación de emergencia si la migración falla (ADR-006).

```ts
/**
 * Dependencias que la raíz de composición entrega a la UI mediante contexto.
 * Vive en `core/providers` y solo referencia tipos; las implementaciones
 * las construye `createAppDependencies()` en `core/dependencies`.
 */
export interface AppDependencies {
  readonly clock: Clock;
  readonly calendar: LocalCalendar;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  readonly dataChanges: DataChanges;
  readonly products: ProductRepository;
  readonly sales: SaleRepository;
  readonly noSalesWeeks: NoSalesWeekRepository;
  readonly tipViews: TipViewRepository;
  readonly tipCatalog: TipCatalog;
  readonly preferences: PreferencesRepository;
  readonly photos: PhotoStorage;
  readonly photoPicker: PhotoPicker;
  readonly notifications: NotificationScheduler;
  readonly archiveIo: ArchiveIo;
  readonly fileSharer: FileSharer;
  readonly documentPicker: DocumentPicker;
}

/** Fuente del instante actual, reemplazable en tests. */
export interface Clock {
  now(): EpochMs;
}

/** Generador de identificadores, reemplazable en tests (ADR-006). */
export interface IdGenerator {
  next(): Uuid;
}

/**
 * Registro de eventos técnicos. En la v1 escribe en consola solo en desarrollo
 * y no hace nada en builds de release. El destino externo (crash reporting) es
 * futuro, fuera de la v1 (ADR-017, pendiente).
 */
export interface Logger {
  info(event: string, context?: Readonly<Record<string, unknown>>): void;
  warn(event: string, context?: Readonly<Record<string, unknown>>): void;
  error(event: string, error: unknown, context?: Readonly<Record<string, unknown>>): void;
}

/** Abre el menú de compartir del sistema para un archivo local. */
export interface FileSharer {
  share(fileUri: string, options: { readonly mimeType: string; readonly uti?: string }): Promise<void>;
}

/** Permite al usuario elegir un archivo; devuelve `null` si cancela. */
export interface DocumentPicker {
  pickSingle(options: { readonly mimeTypes: readonly string[] }): Promise<PickedDocument | null>;
}
```

`LocalCalendar` se define en ADR-015, `DataChanges` en ADR-009, `PhotoStorage` y `PhotoPicker` en ADR-008, `NotificationScheduler` en ADR-011, `ArchiveIo` en ADR-012 y `TipCatalog` en ADR-007.

### Convenciones
- Archivos y carpetas en **kebab-case** en inglés; los componentes se exportan en PascalCase.
- Rutas en inglés; los textos visibles en español.
- Los tests van **junto al archivo** en `features/`, `shared/` y `core/` (`money.ts` → `money.test.ts`). Los que montan rutas van en `src/__tests__/`, nunca dentro de `src/app/`.
- No hay barrels dentro de las capas internas; solo los dos `index.ts` públicos por feature.

## Consecuencias
- Las reglas de dependencia se verifican con ESLint (ADR-013).
- Cuando llegue la sincronización, cambian `data/`, `adapters/` y `core/`; el dominio, los hooks y la UI no.
- `core/dependencies` es el único lugar que conoce las implementaciones, y solo lo usa la raíz.
- Componer el flujo posventa en `src/app/` mantiene las features desacopladas, a cambio de que cada ruta conozca la navegación de su flujo. Ese conocimiento corresponde a la capa de rutas.

## Enmienda 2026-11-13
El consejo posventa se compone en `src/app/sales/new.tsx` pasando `renderAfterSave(outcome)` con el componente `AfterSaleTip` de `tips`, en vez de navegar a una ruta `/tips/after-sale`. La composición sigue ocurriendo en `src/app/` y `sales` no depende de `tips` (ver `docs/architecture/tips.md`).
