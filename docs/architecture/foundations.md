# Diseño técnico — Fundaciones (F0)

- **Tarea**: F0.3 de `docs/plan-v1.md`. Rige F0.4 a F0.15.
- **ADRs**: ADR-003, ADR-005, ADR-006, ADR-009, ADR-010, ADR-013, ADR-014, ADR-015 y ADR-016. Este documento no cambia ninguna decisión: la aplica. Las piezas nuevas que define (el `TransactionRunner`, la máquina de arranque, los dobles de test, `parseRouteParams` y el *flag* `e2e`) son detalles de implementación de esos ADRs. La sección 6 marca la única que podría merecer un ADR propio.

---

## 1. Resumen del enfoque

- **Arranque como máquina de estados pura**. Un *reducer* sin efectos decide en qué fase está la app. `MigrationGate`, en `core/providers`, solo ejecuta los efectos (fuentes, migración y splash) y traduce cada resultado a un evento.
- **Una raíz de composición**. `createAppDependencies()`, en `core/dependencies`, construye todas las implementaciones reales sin tocar la base. La migración es una tarea de arranque aparte que recibe `MigrationGate`. Las rutas no tienen lógica.
- **Transacciones de varios repositorios** con un puerto `TransactionRunner`, que es la frontera asíncrona sobre la `runInTransaction` síncrona de ADR-006. Los repositorios que participan exponen además escritores síncronos. Las llamadas anidadas se unen a la transacción externa, y `DataChanges` se emite una sola vez, después del commit.
- **Dobles compartidos y deterministas** (`FakeClock`, `SequentialIdGenerator`, base en memoria con las migraciones reales). Viven en carpetas `testing/`, que solo pueden importar los tests.
- **Rutas delgadas**: validan sus parámetros con `parseRouteParams` (que devuelve `Result` y nunca lanza) y renderizan una screen de feature. Los tests que montan rutas viven en `src/__tests__/`.

---

## 2. Archivos a crear o modificar

### 2.1 Estructura inicial de `src/` (F0.4 la crea, F0.6 a F0.15 la llenan)

```
src/
  app/                                   Solo rutas (ADR-005); sin tests
    _layout.tsx                          preventAutoHideAsync + createAppDependencies() + <AppProviders> + <Stack>
    +not-found.tsx                       Renderiza NotFoundScreen de shared/ui
    +native-intent.tsx                   Sin EXPO_PUBLIC_E2E=1, reescribe cuantovendi://e2e/** a "/"
    (tabs)/_layout.tsx                   Pestañas (F0.14)
    (tabs)/index.tsx                     Inicio → features/tracking (HomeScreen provisoria)
    (tabs)/calendar.tsx                  Calendario → features/tracking (provisoria)
    (tabs)/products.tsx                  Productos → features/products (provisoria)
    (tabs)/tips.tsx                      Consejos → features/tips (provisoria)
    (tabs)/settings.tsx                  Ajustes → features/settings (provisoria)
    e2e/diagnostics.tsx                  Solo con el flag: diagnóstico de fechas (ADR-015)
  __tests__/                             Tests de integración que montan rutas (renderRouter)
    navigation.test.tsx                  Pestañas, +not-found y rutas e2e sin el flag (F0.14, F0.15)
  features/
    tracking/{screens/home-screen.tsx, screens/home-screen.test.tsx, index.ts}
    products/{screens/…, index.ts}       Provisorias de F0.14
    tips/{screens/…, index.ts}
    settings/{screens/…, index.ts}
    e2e/{screens/date-diagnostics-screen.tsx, domain/diagnostic-cases.ts, index.ts}
  shared/
    domain/
      money.ts  ids.ts  result.ts  text.ts  transaction-runner.ts  index.ts
      calendar/{local-date,arithmetic,clock,local-calendar,device-local-calendar,
                calendar-names,index}.ts
      calendar/__fixtures__/time-zones.ts
      testing/{fake-clock,sequential-id-generator,fake-random-source}.ts
    lib/
      logger.ts                          Única excepción de no-console (ADR-013)
      route-params.ts                    parseRouteParams (F0.14)
      e2e-flag.ts                        isE2EFlag + isE2EBuild (F0.15)
      time/{use-today,use-current-week,time-refresh}.ts
      testing/recording-logger.ts
    ui/                                  Tema y componentes base (F0.12, F0.13)
  core/
    db/
      open.ts                            configureConnection(raw)
      client.ts                          openAppDatabase(): abre expo-sqlite y crea AppDatabase
      configure-and-migrate.ts
      transaction.ts                     createRunInTransaction + createTransactionRunner
      data-changes.ts                    createDataChanges()
      table-names.ts                     TableName (ADR-009)
      schema/*.ts  migrations/*
      testing/{test-database,load-migration-bundle}.ts
    providers/
      app-dependencies.ts                Tipo AppDependencies (solo tipos)
      dependencies-context.tsx           DependenciesProvider + useDependencies
      app-providers.tsx                  Árbol de providers (sección 4.2)
      migration-gate.tsx                 Efectos del arranque + splash + pantalla de error
      boot/boot-machine.ts               Reducer puro del arranque
      query/query-client.ts              createQueryClient (ADR-009)
      query/root-keys-to-invalidate.ts   Función pura (ADR-009)
      query/data-changes-bridge.tsx      Puente DataChanges → invalidateQueries
      query/query-dependencies.ts        Registro de QueryDependency de todas las features
    dependencies/
      create-app-dependencies.ts         Única fábrica de implementaciones concretas
    testing/
      create-test-dependencies.ts        AppDependencies con dobles y base en memoria
      render-with-providers.tsx          RNTL + QueryClient nuevo + DependenciesProvider
e2e/maestro/
  _shared/                               Subflujos para crear datos por la UI
  foundations/{smoke,fresh-install,release-has-no-e2e,upgrade-verify}.yaml
tools/eslint/{docstring-only-comments,routes-only-in-app}.*
```

### 2.2 Responsabilidad de cada pieza nueva

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `shared/domain/transaction-runner.ts` | Tipo del puerto `TransactionRunner`. Lo usan los casos de uso de cualquier feature. | F0.9 |
| `shared/domain/calendar/*` | `LocalDate`, aritmética pura, `Clock`, `LocalCalendar` y sus implementaciones reales (`systemClock`, `deviceLocalCalendar`), que no importan nada de plataforma. Así `test:tz` (`**/calendar/**`) las cubre. | F0.7 |
| `shared/domain/ids.ts` | Esquemas de ids, `IdGenerator`, `createUuidV7Generator(clock, random)` y `deterministicId(key)` (UUIDv5). La fuente aleatoria se inyecta, y `expo-crypto` se conecta en `core/dependencies`. | F0.6, F0.8 |
| `shared/domain/testing/*` | `FakeClock`, `SequentialIdGenerator` y `FakeRandomSource`. | F0.7, F0.8 |
| `shared/lib/time/*` | `useToday` y `useCurrentWeek` (ADR-009 los ubica en `shared`). `time-refresh.ts` contiene la función pura que calcula cuándo despertar. Leen `clock` y `calendar` con `useDependencies()`. | F0.11 |
| `shared/lib/route-params.ts` | `parseRouteParams`: normaliza los parámetros de Expo Router (rechaza los arreglos) y valida con Zod. Devuelve `Result`. | F0.14 |
| `shared/lib/e2e-flag.ts` | Único lugar que lee `process.env.EXPO_PUBLIC_E2E`, con acceso estático para que Expo lo reemplace al compilar (ADR-013, ADR-016). | F0.15 |
| `core/db/client.ts` | Abre la base con `openDatabaseSync`, llama a `configureConnection` y crea el `AppDatabase` de Drizzle. No migra. | F0.9 |
| `core/db/transaction.ts` | `createRunInTransaction(db, dataChanges)` (síncrona, con anidamiento) y `createTransactionRunner(run)`. | F0.9 |
| `core/providers/boot/boot-machine.ts` | El *reducer* puro del arranque. | F0.10 |
| `core/providers/migration-gate.tsx` | Carga las fuentes con `useFonts`, ejecuta la tarea `migrateDatabase` recibida por props, oculta el splash y muestra la pantalla de error de `shared/ui` o los hijos. | F0.10 |
| `core/dependencies/create-app-dependencies.ts` | Construye `AppDependencies` y la tarea de arranque. Solo lo importa `src/app/_layout.tsx` (lint). | F0.11 |
| `core/testing/*` | Ayudas de test de la UI. Pueden importar dobles de las features y `core/db/testing`. | F0.11 |
| `features/e2e/` | Pantallas que solo existen con el *flag*: en F0, el diagnóstico de fechas; desde F8.11, la semilla. | F0.15 |

### 2.3 Archivos que se modifican
- `package.json`, `app.json`, `.gitignore`, `assets/images/favicon.png` (se borra): según ADR-016 (F0.4).
- `src/app/index.tsx` → se reemplaza por `src/app/(tabs)/index.tsx` en F0.14. En F0.4, `src/app/index.tsx` ya renderiza `HomeScreen` de `@/features/tracking`.
- `src/__tests__/home-screen.test.tsx` → se mueve a `src/features/tracking/screens/home-screen.test.tsx` e importa la screen, no la ruta (F0.4). Ver 2.4.
- `src/app/_layout.tsx`: pasa a montar `AppProviders` (F0.10, F0.11).
- `eslint.config.js`, `jest.config.js`, `tsconfig.json`, `.prettierrc.json`, `metro.config.js` y `babel.config.js` (nuevo): F0.5 y F0.9.

### 2.4 Dónde va el test de humo actual
ADR-005 prohíbe tests **dentro** de `src/app/` (todo archivo ahí es una ruta), y reserva `src/__tests__/` para los tests de integración que **montan rutas**. No prohíbe probar rutas: prohíbe ponerles tests al lado. El test actual importa `@/app/index` para probar un texto, que es comportamiento de una screen y no de la navegación. Por eso:
- **F0.4**: se crea `features/tracking/screens/home-screen.tsx` (Inicio provisoria) y el test pasa a `features/tracking/screens/home-screen.test.tsx` (proyecto `ui`). La ruta solo la renderiza.
- **F0.14**: `src/__tests__/navigation.test.tsx` usa `renderRouter` de `expo-router/testing-library` para probar lo que sí es de las rutas: las cinco pestañas, `+not-found`, un parámetro inválido que no lanza y, en F0.15, que `/e2e/diagnostics` no muestra el diagnóstico sin el *flag*.

---

## 3. Tipos e interfaces principales (firmas)

### 3.1 Arranque
```ts
/** Motivo por el que el arranque no puede seguir; la UI lo traduce a un texto amable. */
export type BootFailure =
  | { readonly kind: 'migration_failed' }
  | { readonly kind: 'foreign_key_violation'; readonly violations: number }
  | { readonly kind: 'newer_database'; readonly appliedMigrations: number; readonly knownMigrations: number };

/** Estado de una condición del arranque. */
export type BootCondition = 'pending' | 'ready' | 'failed';

/** Fase del arranque; el splash se mantiene mientras no sea `ready` ni `failed`. */
export type BootState =
  | { readonly phase: 'booting' }
  | { readonly phase: 'loading'; readonly fonts: BootCondition; readonly database: BootCondition }
  | { readonly phase: 'ready'; readonly usingSystemFont: boolean }
  | { readonly phase: 'failed'; readonly failure: BootFailure };

/** Eventos que `MigrationGate` traduce desde los efectos. */
export type BootEvent =
  | { readonly type: 'started' }
  | { readonly type: 'fonts_loaded' }
  | { readonly type: 'fonts_failed' }
  | { readonly type: 'database_ready' }
  | { readonly type: 'database_failed'; readonly failure: BootFailure };

/**
 * Transición pura del arranque. Las fuentes y la base son independientes;
 * un fallo de fuentes no detiene el arranque (se usa la fuente del sistema),
 * un fallo de la base sí. Los eventos tardíos sobre un estado final se ignoran.
 */
export function bootReducer(state: BootState, event: BootEvent): BootState;

/** Indica si ya se puede ocultar el splash. */
export function isBootSettled(state: BootState): boolean;
```

### 3.2 Base, migración y transacciones
```ts
/** Resultado de migrar al arrancar (ADR-006). */
export type MigrationResult = Result<void, BootFailure>;

/**
 * Desactiva las FK fuera de transacción, detecta una base más nueva que el código,
 * migra con el migrador de Expo, verifica `foreign_key_check` y reactiva las FK.
 * Nunca deja las FK desactivadas al volver.
 */
export function configureAndMigrate(
  raw: RawSqliteConnection,
  db: AppDatabase,
  bundle: MigrationBundle,
): Promise<MigrationResult>;

/** Conexión cruda mínima que necesitan los PRAGMA; la satisfacen expo-sqlite y better-sqlite3. */
export interface RawSqliteConnection {
  exec(sql: string): void;
  pragmaValue(sql: string): unknown;
}

/** Journal y SQL empaquetados con la forma de `migrations.js` de drizzle-kit. */
export interface MigrationBundle {
  readonly journal: { readonly entries: readonly { readonly idx: number; readonly when: number; readonly tag: string; readonly breakpoints: boolean }[] };
  readonly migrations: Readonly<Record<string, string>>;
}

/**
 * Frontera asíncrona de una transacción que abarca varios repositorios.
 * `work` es síncrono (ADR-006): el tipo rechaza un bloque que devuelva una promesa.
 * Un error dentro de `work` hace rollback y llega como promesa rechazada.
 * Emite `DataChanges` una sola vez, después del commit.
 */
export interface TransactionRunner {
  run<T>(work: () => T extends PromiseLike<unknown> ? never : T): Promise<T>;
}
```
`RunInTransaction`, `TouchedTables`, `AppDatabase`, `DataChanges` y `TableName` se usan tal cual los definen ADR-006 y ADR-009.

**Cómo se compone una transacción de varios repositorios** (la necesita F3.4):
- Cada repositorio implementa su interfaz asíncrona de ADR-007 (`SaleRepository`, `NoSalesWeekRepository`) para las lecturas y las escrituras simples desde los hooks.
- Si una escritura tiene que formar parte de una transacción mayor, el repositorio expone además un **escritor síncrono** (`SaleRecordWriter` o `NoSalesWeekWriter`, entre otros). Sus métodos llaman internamente a `runInTransaction`, que se une a la transacción externa si existe (ADR-006). La misma clase Drizzle implementa las dos interfaces.
- El caso de uso recibe `TransactionRunner` y los escritores como puertos (`import type`), y escribe todo dentro de `transactions.run(() => { … })`. Las lecturas que deciden algo (por ejemplo, si la semana está marcada o si es la primera venta) también se hacen dentro del bloque, con métodos síncronos del escritor, para que decisión y escritura vean el mismo estado.

Ejemplo de forma, que el architect de F3.0 concreta:
```ts
/** Escrituras síncronas de ventas para usar dentro de `TransactionRunner.run`. */
export interface SaleRecordWriter {
  saveSync(record: SaleRecord, now: EpochMs): void;
  hasAnyActiveRecordSync(): boolean;
}
```
Así no hay `await` dentro de una transacción síncrona, y un `throw` de cualquier escritor revierte todo.

### 3.3 Tiempo, ids y logger
`Clock`, `LocalCalendar`, `IdGenerator`, `Logger` y `AppDependencies` se usan tal cual los definen ADR-005 y ADR-015. En F0, `AppDependencies` contiene solo `clock`, `calendar`, `ids`, `logger`, `dataChanges` y `transactions: TransactionRunner`. Cada feature agrega sus campos cuando existen, y el tipo de ADR-005 es el destino.

```ts
/** Fuente de bytes aleatorios; la real es `getRandomBytes` de expo-crypto (ADR-006). */
export type RandomSource = (length: 16) => Uint8Array;

/** Generador UUIDv7 puro: `v7({ msecs: clock.now(), random: random(16) })` de `uuid` 14. */
export function createUuidV7Generator(clock: Clock, random: RandomSource): IdGenerator;

/** UUIDv5 de una clave estable con `NAMESPACE_CUANTOVENDI`; para ids deterministas (ADR-007). */
export function deterministicId(key: string): Uuid;

/**
 * Próximo instante en el que "hoy" debe recalcularse: la próxima medianoche local
 * o, como máximo, una hora después de `now` (ADR-009, ADR-015).
 */
export function nextTodayRefreshAt(now: EpochMs, calendar: LocalCalendar): EpochMs;

/** Fecha local actual; cambia al pasar la medianoche y al volver a primer plano. */
export function useToday(): LocalDate;

/** Semana ISO en curso, derivada de `useToday()`. */
export function useCurrentWeek(): WeekRange;
```

### 3.4 Composición y arranque
```ts
/** Lo que la raíz recibe de la composición: dependencias y tareas de arranque. */
export interface AppComposition {
  readonly dependencies: AppDependencies;
  /** Migra la base; lo ejecuta `MigrationGate` una sola vez. */
  readonly migrateDatabase: () => Promise<MigrationResult>;
}

/** Única fábrica de implementaciones concretas; no toca la base hasta `migrateDatabase`. */
export function createAppDependencies(): AppComposition;

/** Props de la puerta de arranque. */
export interface MigrationGateProps {
  readonly migrateDatabase: () => Promise<MigrationResult>;
  readonly children: React.ReactNode;
}
```

### 3.5 Parámetros de ruta y flag de E2E
```ts
/** Error al validar los parámetros de una ruta. */
export type RouteParamsError =
  | { readonly code: 'missing'; readonly param: string }
  | { readonly code: 'repeated'; readonly param: string }
  | { readonly code: 'invalid'; readonly param: string };

/**
 * Valida los parámetros de Expo Router con un esquema Zod (ADR-010).
 * Rechaza los parámetros repetidos (arreglos). Nunca lanza.
 */
export function parseRouteParams<S extends z.ZodType>(
  schema: S,
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): Result<z.output<S>, RouteParamsError>;

/** Interpreta el valor de `EXPO_PUBLIC_E2E`: solo `'1'` habilita lo de E2E. */
export function isE2EFlag(value: string | undefined): boolean;

/** Constante reemplazada al compilar; el código detrás de `if (isE2EBuild)` desaparece del build normal. */
export const isE2EBuild: boolean;
```

**Uso en una ruta.** Si los parámetros fallan, la ruta renderiza `NotFoundScreen` de `shared/ui`, o un `<Redirect>` al destino que fije la tarea de la feature (por ejemplo, F6.6 lleva un id desconocido a la lista de consejos). Si el id es válido pero la entidad no existe, el caso lo resuelve el estado "no encontrado" de la screen, no el helper.

### 3.6 Dobles de test compartidos
```ts
/** Reloj controlable; `advance` no mueve los timers de Jest (para eso, `advanceClockAndTimers`). */
export class FakeClock implements Clock {
  constructor(start: EpochMs);
  now(): EpochMs;
  set(instant: EpochMs): void;
  advance(ms: number): void;
}

/** Avanza a la vez el `FakeClock` y los timers falsos de Jest. */
export function advanceClockAndTimers(clock: FakeClock, ms: number): void;

/**
 * Ids deterministas con forma UUIDv7 válida y creciente
 * (`00000000-0000-7000-8000-000000000001`, …), aceptados por `uuidSchema`
 * y por la validación de nombres de `PhotoStorage`.
 */
export class SequentialIdGenerator implements IdGenerator {
  next(): Uuid;
}

/** Fuente aleatoria fija para probar el generador UUIDv7. */
export function fakeRandomSource(bytes: Uint8Array): RandomSource;

/** Base `better-sqlite3` en memoria, abierta con `configureConnection` y migrada con `configureAndMigrate`. */
export function createTestDatabase(options?: {
  readonly bundle?: MigrationBundle;
  readonly dataChanges?: DataChanges;
}): Promise<TestDatabase>;

/** Base de test con todo lo que reciben los repositorios. */
export interface TestDatabase {
  readonly db: AppDatabase;
  readonly raw: RawSqliteConnection;
  readonly runInTransaction: RunInTransaction;
  readonly transactions: TransactionRunner;
  readonly dataChanges: DataChanges;
  close(): void;
}

/** Arma `{ journal, migrations }` desde la carpeta, recortado opcionalmente hasta una migración (N-1 → N). */
export function loadMigrationBundle(folder: string, options?: { readonly upToIndex?: number }): MigrationBundle;

/** `AppDependencies` de test: `FakeClock`, `SequentialIdGenerator`, `deviceLocalCalendar` y `RecordingLogger`. */
export function createTestDependencies(overrides?: Partial<AppDependencies>): AppDependencies;
```
- La UI usa el `deviceLocalCalendar` real con la `TZ` fija de Jest (ADR-013). No hay calendario falso, para que la única frontera de conversión sea la que se prueba.
- **Regla de lint (para F0.5)**: lo que está en `**/testing/**` solo lo pueden importar los archivos `*.test.*` y otros `testing/`. Las carpetas `testing/` no cuentan para los límites de capa, porque `core/testing` necesita dobles de las features.

---

## 4. Flujo de datos y manejo de estado

### 4.1 Arranque
```
módulo _layout.tsx: SplashScreen.preventAutoHideAsync()
  → createAppDependencies()            sin queries; abre la conexión y crea los repositorios
  → <AppProviders composition>
      MigrationGate: dispatch(started) → phase loading
        ├─ useFonts(Lexend 400/500/600/700) → fonts_loaded | fonts_failed (se registra en el logger)
        └─ migrateDatabase()                → database_ready | database_failed(failure)
      isBootSettled(state) → SplashScreen.hideAsync()
      ready  → hijos (QueryClientProvider, puente, Stack)
      failed → pantalla de error de shared/ui, sin acciones de escritura;
               "actualiza la app" si es newer_database; exportación de emergencia desde F8.8
```
- `migrateDatabase` se ejecuta **una sola vez** por proceso. Si el componente se vuelve a montar, no se repite.
- En `failed` no se monta `QueryClientProvider` ni ninguna screen de feature, así que nada puede escribir.
- La recolección de huérfanos de F2.6 se agenda después del primer render en `ready`.

### 4.2 Árbol de providers (de afuera hacia adentro)
`GestureHandlerRootView` → `HeroUINativeProvider` → `IconContext.Provider` (Phosphor: peso `bold` y tamaño 24, ADR-014) → `DependenciesProvider` → `MigrationGate` → `QueryClientProvider` (`createQueryClient()`, ADR-009) → `DataChangesBridge` → `StatusBar` (`expo-status-bar`, `style="auto"`) + `Stack`.

`DependenciesProvider` va por fuera de `MigrationGate` para que la pantalla de error pueda usar el `logger` y, desde F8.8, la exportación de emergencia.

### 4.3 Lectura, escritura e invalidación
```
screen → hook (useQuery con key que incluye el rango de useToday/useCurrentWeek)
       → repositorio (useDependencies) → AppDatabase
mutation → caso de uso o repositorio → TransactionRunner.run / runInTransaction
        → commit → DataChanges.emit(tablas)
        → DataChangesBridge (agrupa por tick) → rootKeysToInvalidate(registro, tablas)
        → queryClient.invalidateQueries({ queryKey: raíz }) → las screens montadas se actualizan
```
- `core/providers/query/query-dependencies.ts` reúne los `QueryDependency` que exporta cada feature por su `index.ts`. Es un registro de datos, no de implementaciones, así que no rompe ADR-005.
- Sin store global: el estado de UI va en `useState` local, y lo persistido en TanStack Query (ADR-009).

### 4.4 "Hoy" reactivo
`useToday` guarda `calendar.localDateOf(clock.now())` en estado. Programa un `setTimeout` hasta `nextTodayRefreshAt(now, calendar)` y escucha `AppState` (`active`). En cada disparo recalcula y, si la fecha cambió, actualiza el estado; así cambian las keys que dependen del rango. Al desmontar limpia el timer y el listener. `useCurrentWeek` deriva `{ start: isoWeekStart(today), end: addDays(start, 6) }`.

### 4.5 Navegación
- Raíz: un `Stack` de Expo Router con el grupo `(tabs)` y las rutas que se apilan encima. Las rutas de feature (`sales/new`, `sales/[id]`, `products/[id]`, `tracking/monthly`, `tips/[id]`, `tips/after-sale`, `settings/licenses`, etc.) las agrega cada feature según su diseño, y su presentación (*push* o modal) la decide el designer.
- Pestañas (propuesta de F0.14, la confirma el designer): Inicio (`House`), Calendario (`CalendarBlank`), Productos (`Package`), Consejos (`Lightbulb`) y Ajustes (`Gear`). La pestaña activa usa `fill` y `accessibilityState.selected` (`docs/design-system.md`, 6.9). Dónde va "Registrar venta" lo decide el designer en F0.14.
- `+not-found.tsx` para las URLs desconocidas. `+native-intent.tsx` descarta las URLs `cuantovendi://e2e/**` cuando `isE2EBuild` es `false`. Además, `src/app/e2e/*.tsx` hacen `<Redirect href="/" />` sin el *flag*, y solo con el *flag* cargan `@/features/e2e`. La condición es literalmente `if (process.env.EXPO_PUBLIC_E2E === '1')` y el `require('@/features/e2e')` va dentro de esa rama: Expo reemplaza la variable al empaquetar y Metro elimina la rama muerta, de modo que el bundle release no incluye el código E2E. Una constante intermedia como `isE2EBuild` no sirve para esto (`isE2EBuild` queda solo para decisiones que no cargan código E2E, como `+native-intent`). Se verifica con `npx expo export --platform android` y un `grep` de "Diagnóstico de fechas" sobre el bundle (`e2e/maestro/README.md`).

---

## 5. Tests que el code-writer escribe primero

Los de cada tarea del plan se mantienen. Esta lista agrega o precisa los que salen de este diseño.

**Unitarios (proyecto `node`)**
1. `bootReducer`: `booting → loading`; fuentes y base en cualquier orden llegan a `ready`; `fonts_failed` + `database_ready` da `ready` con `usingSystemFont: true`; `database_failed` lleva a `failed` en cualquier orden y gana sobre las fuentes; los eventos posteriores a un estado final se ignoran; `isBootSettled` solo en `ready` y `failed`.
2. `createUuidV7Generator`: versión 7, variante RFC 9562, timestamp igual a `clock.now()`, bytes aleatorios de `fakeRandomSource`, en minúsculas y aceptado por `uuidSchema`; dos ids en el mismo milisegundo son distintos con fuentes distintas.
3. `deterministicId`: estable para la misma clave y distinto entre claves.
4. `SequentialIdGenerator`: ids válidos según `uuidSchema` y según el patrón de `PhotoStorage`, crecientes, y otra instancia repite la secuencia.
5. `FakeClock`: `set` y `advance`.
6. `nextTodayRefreshAt`: a las 23:30 da la medianoche; a las 10:00 da las 11:00; en el día de salto hacia adelante de `America/Santiago` (00:00 inexistente) da el primer minuto válido (con `test:tz`).
7. `parseRouteParams`: válido; parámetro faltante (`missing`); arreglo (`repeated`); mal formado (`invalid`); nunca lanza.
8. `isE2EFlag`: `'1'` → `true`; `undefined`, `''`, `'0'`, `'true'` → `false`.
9. `rootKeysToInvalidate`: los casos de F0.11.

**Integración (proyecto `node`, `createTestDatabase`)**
10. `createTransactionRunner`: dos escritores en un `run` hacen commit juntos y emiten **un** `DataChanges` con la unión de las tablas; un `throw` del segundo revierte también el primero, no emite y llega como promesa rechazada; un `run` dentro de otro se une al externo; `work` que devuelve una promesa no compila (test de tipos con `@ts-expect-error`).
11. `createTestDatabase` deja `PRAGMA foreign_keys = 1` y pasa por `configureAndMigrate` (los casos de F0.9).
12. `loadMigrationBundle` con `upToIndex` produce un bundle recortado que el migrador acepta.

**UI (proyecto `ui`)**
13. `MigrationGate`, con `migrateDatabase` falso: muestra hijos en `ready`; la pantalla de error en `failed` (con el texto de `newer_database` en ese caso); llama a `hideAsync` una sola vez (con `jest.mock('expo-splash-screen')`); no vuelve a migrar al montarse de nuevo.
14. `useToday` y `useCurrentWeek`: los casos de F0.11 con `advanceClockAndTimers`.
15. `DataChangesBridge`: los casos de F0.11.
16. `home-screen.test.tsx` reubicado (F0.4).
17. `src/__tests__/navigation.test.tsx` con `renderRouter`: las cinco pestañas con `selected`; una URL desconocida muestra not-found; `/e2e/diagnostics` sin el *flag* redirige a Inicio.

**E2E al cierre (F0.17, pendientes de entorno)**
- `e2e/maestro/foundations/smoke.yaml`, con el build `e2e`: abre la app, recorre las cinco pestañas y abre la pantalla de diagnóstico de fechas.
- `fresh-install.yaml`: instalación limpia, arranque sin error y migración `0000` aplicada (Inicio vacío visible).
- `release-has-no-e2e.yaml`, con el build `release`: `cuantovendi://e2e/diagnostics` abre Inicio y no el diagnóstico (ADR-013, ADR-016).
- `upgrade-verify.yaml` queda escrito para V-E2E-UPG desde la primera feature con datos (procedimiento de ADR-016).

---

## 6. Riesgos y decisiones abiertas para el orquestador

1. **`@types/better-sqlite3` no figura en ningún ADR.** El driver de Drizzle para `better-sqlite3` importa los tipos de ese paquete, y `better-sqlite3` no trae tipos propios. F0.9 casi seguro lo necesita como dependencia de desarrollo. Por la sección 7.2 del plan, una dependencia fuera de un ADR es una condición de parada. Propuesta: tratarlo como parte de la decisión de `better-sqlite3` en ADR-006 (son solo tipos, de desarrollo), o registrarlo en un ADR corto. Hay que decidirlo antes de F0.9.
2. **Composición de transacciones (`TransactionRunner` + escritores síncronos).** Aplica ADR-006 (transacción síncrona que se une a la externa) sin cambiar las firmas asíncronas de ADR-007, pero es un patrón transversal que usarán F3, F8 y el sync futuro. CLAUDE.md pide registrar como ADR toda decisión técnica nueva. Si el orquestador lo considera nueva y no detalle de ADR-006, conviene un ADR corto antes de F0.9. El número 017 está reservado para el reporte de errores, así que sería el siguiente libre.
3. **`android.package` provisional `com.cuantovendi.local`** (ADR-016). No bloquea ahora, pero conviene confirmarlo con el usuario antes de CP1: después, cambiarlo convierte la app en otra instalación.
4. **`useToday` en `shared/lib/time/` importa `@/core/providers`** (`useDependencies`). ADR-005 no prohíbe esa dirección para `shared/lib` (sí para `shared/ui` y `shared/domain`), y ADR-009 ubica los hooks en `shared`. F0.5 debe permitir solo `@/core/providers` desde `shared/lib`.
5. **`+native-intent.tsx` y la eliminación de código por el *flag*** se verifican en el dispositivo (F0.17). En Jest solo se prueba la lógica. Si Metro no elimina el `require` del build normal, el código de E2E quedaría inerte, pero empaquetado. Se detecta revisando el bundle o con `release-has-no-e2e.yaml`.
6. **Fondo de la navegación en tema oscuro**: el `Stack` y las pestañas de React Navigation tienen colores propios. El designer define en F0.12 o F0.14 cómo usan los tokens "Bruma" para que no aparezcan fondos blancos al navegar (D-12).
7. **`features/e2e/` es una carpeta de feature que no está en la lista de ADR-005.** Agrupa las pantallas que solo existen con `EXPO_PUBLIC_E2E=1` (ADR-013, ADR-015) con las mismas capas y límites que las demás features. Se elige así para no poner UI en `core`. Si el orquestador prefiere otra ubicación, se decide antes de F0.15.
8. **Categorías de consejos vs. `Tip.topic` de ADR-007**: no afecta a F0, pero queda anotado en F6.0 como posible condición de parada.
