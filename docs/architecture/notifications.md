# Diseño técnico — Notificaciones (F7)

- **Tarea**: F7.0 de `docs/plan-v1.md`. Rige F7.1 a F7.10.
- **ADRs**: ADR-011 (estados A/B, reconciliación serializada por diferencias, permisos, respuesta al tocar), ADR-015 (`LocalCalendar.instantAt`, tres zonas), ADR-005 (adaptador en `adapters/`, composición en `src/app/`, `sales` no llama a `notifications`), ADR-009 (`DataChanges`, TanStack Query), ADR-010 (validación del payload), ADR-007 (`notification_preferences`, regla 14), ADR-016 (permisos de Android, build `e2e`). **Decisiones**: D-01, D-06, D-07, D-13, D-23, D-28, D-29 y D-36.
- **Versiones verificadas** (2026-11-13, tarball de npm, `build/*.d.ts`, manifiesto y código Android): `expo-notifications` **58.1.9**. No está instalado: lo agrega F7.4 con `npx expo install expo-notifications`.
- **Base de código revisada**: `core/db/{transaction,data-changes,table-names}.ts`, `core/providers/*`, `core/dependencies/create-app-dependencies.ts`, `features/sales/{data/sale-repository.ts,use-cases/save-sale-record.ts,index.ts}` (`activeWeekStartsBetween`, `NoSalesWeekRepository.listBetween`, `SaleSavedOutcome.isFirstSale`), `shared/domain/calendar/*` (`LocalCalendar`, `weekRangeOf`, `addDays`, `isoWeekday`, `yearMonthOf`, `addMonths`, `monthName`), `src/app/{_layout,sales/new,tracking/monthly}.tsx` y `shared/lib/testing/guilt-patterns.ts`.
- Este diseño **aplica** ADR-011 sin cambiar la decisión. La sección 6.1 lista tres precisiones de firma que conviene registrar como enmienda fechada de ADR-011 (el mismo mecanismo que se usó con ADR-007 y ADR-008).

---

## 1. Resumen del enfoque

- **Dominio puro** (`features/notifications/domain/`):
  - `planNotifications` decide el estado A o B del recordatorio semanal y los 12 resúmenes mensuales;
  - `diffNotifications` compara el plan con lo programado y devuelve qué cancelar y qué programar;
  - `toExpoWeekday` traduce el día ISO al de `WEEKLY`;
  - un catálogo de textos con las variantes `already_registered` y `neutral`, más el resumen mensual con el nombre del mes.
- **Estado A** (semana en curso sin registrar, o `T` ya pasó): solo `cv.weekly.repeat` (`WEEKLY`, texto `neutral`). **Estado B** (semana registrada y `T` futuro): sin `WEEKLY`, `cv.weekly.<lunes>` en `T` con `already_registered` y 47 avisos `neutral` de una sola vez en las semanas siguientes. Nunca hay dos avisos para la misma semana.
- **Reconciliación serializada** (`NotificationReconciler.request()`): una cola en la que gana la última. Cada ejecución lee el permiso, las preferencias y si la semana está registrada; planifica; lista lo programado; aplica solo las diferencias, **siempre cancelando antes de programar**. Así, si algo falla a la mitad, puede faltar un aviso, pero nunca sobran dos.
- **Huella en el payload**: el adaptador guarda en `content.data` el trigger planificado y el destino. Al listar, reconstruye `ScheduledNotification` desde ese payload validado con Zod, y no desde el trigger nativo, cuya forma cambia entre iOS y Android. Lo que no se puede reconstruir se cancela.
- **Disparadores**: el arranque, la vuelta a primer plano, `DataChanges` de `sale_records`, `sale_items`, `no_sales_weeks` y `notification_preferences`, el fin de una restauración (llega como `DataChanges` de las tablas de ventas, sección 4.5) y la concesión del permiso. `sales` y `backup` no importan `notifications`.
- **Al tocar**: un puerto `NotificationResponseSource` cubre las dos vías de ADR-011 (la última respuesta del arranque en frío y el listener con la app abierta). Se deduplica por `identifier` **y fecha de entrega**, se valida el payload con Zod, se espera al router y se llama a `clearLastNotificationResponse`.
- **Permiso**: después de la primera venta (D-06), con una pantalla explicativa que compone la ruta `sales/new.tsx` en `onFinished`. Canal `reminders` creado antes de pedirlo. iOS: alerta y sonido, sin badge ni autorización provisional (D-29). `enableRemoteNotifications: false`.
- **Permisos de Android**: las notificaciones locales **no necesitan `VIBRATE` ni `ACCESS_NETWORK_STATE`**, que siguen bloqueados (sección 3.9).
- **Acción de prueba** solo en desarrollo y en el build `e2e`: programa avisos cercanos con el prefijo `cvtest.`. La reconciliación no los toca.

---

## 2. Archivos a crear o modificar

### 2.1 Feature `src/features/notifications/`

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `domain/preferences.ts` | `NotificationPreferences` (ADR-007), `DEFAULT_NOTIFICATION_PREFERENCES` (domingo, 1200, mensual activado), `notificationPreferencesSchema` (weekday 1–7, minuteOfDay 0–1439, entero), `MINUTES_PER_DAY`. | F7.2 |
| `domain/plan.ts` | `PlannedNotification`, `NotificationPlanInput`, `planNotifications`, `weeklyReminderInstant` (calcula `T`), constantes `FALLBACK_WEEKS = 47`, `MONTHS_AHEAD = 12`, `MAX_PENDING_NOTIFICATIONS = 64`, `MONTHLY_MINUTE_OF_DAY = 600`. | F7.2 |
| `domain/identifiers.ts` | `APP_NOTIFICATION_PREFIX = 'cv.'`, `TEST_NOTIFICATION_PREFIX = 'cvtest.'`, `weeklyRepeatId`, `weeklyOnceId(weekStart)`, `monthlyId(fireMonth)`, `isAppNotificationId`. | F7.2 |
| `domain/diff.ts` | `ScheduledNotification`, `NotificationDiff`, `diffNotifications`, `samePlannedNotification`. | F7.2 |
| `domain/expo-weekday.ts` | `toExpoWeekday` (ISO 1 = lunes → 2; ISO 7 = domingo → 1). | F7.2 |
| `domain/texts.ts` | Catálogo en español: `weeklyReminderContent(variant)`, `monthlySummaryContent(summarizedMonth)`. Sin datos de la semana en `neutral`. | F7.2 |
| `domain/payload.ts` | `notificationDataSchema` (lo que va en `content.data`), `NotificationTarget`, `parseNotificationTarget(data)`, `toNotificationData(planned)`. | F7.2 (esquema) / F7.6 (uso) |
| `domain/permission.ts` | `NotificationPermission`, `shouldOfferPermission({ isFirstSale, permission })`. | F7.2 / F7.8 |
| `domain/reconcile-tables.ts` | `RECONCILE_TABLES` y `touchesReconcileTables(tables)`. | F7.5 |
| `domain/taps.ts` | `NotificationTap`, `createTapDeduplicator()` (puro, recuerda las últimas claves procesadas). | F7.6 |
| `domain/test-reminder.ts` | `planTestReminders(input)`: avisos `cvtest.*` cercanos, para la acción de prueba. | F7.5 |
| `domain/ports.ts` | `NotificationScheduler`, `NotificationResponseSource`, `RegisteredWeekReader`. | F7.2 |
| `domain/index.ts` | API pública del dominio. | F7.2 |
| `data/preferences-repository.ts` | Interfaz `PreferencesRepository` y `PreferencesDatabaseAccess`. | F7.3 |
| `data/drizzle-preferences-repository.ts` | Lee la fila `'device'` (o los valores por defecto) y hace *upsert* en `runInTransaction`, tocando `notification_preferences`. | F7.3 |
| `data/preferences-repository.contract.ts` | Contrato compartido por la implementación Drizzle y la de memoria. | F7.3 |
| `adapters/expo-notification-scheduler.ts` | `ExpoNotificationScheduler`: canal `reminders`, permisos, `listScheduled` por prefijo, `cancel` y `schedule` con triggers `DATE` y `WEEKLY`. | F7.4 |
| `adapters/expo-notification-responses.ts` | `NotificationResponseSource` sobre `getLastNotificationResponse`, `addNotificationResponseReceivedListener` y `clearLastNotificationResponse`. | F7.6 |
| `adapters/notification-presentation.ts` | `installNotificationPresentation()`: `setNotificationHandler` (banner y lista, sin sonido ni badge en primer plano). | F7.6 |
| `use-cases/reconcile-notifications.ts` | `reconcileNotifications(deps)`: una ejecución completa (pasos 1 a 5 de ADR-011). | F7.5 |
| `use-cases/notification-reconciler.ts` | `createNotificationReconciler(run, logger)`: la cola serializada en la que gana la última. | F7.5 |
| `use-cases/registered-week-reader.ts` | `createRegisteredWeekReader({ sales, noSalesWeeks })`: si la semana tiene una venta activa con ítems o una marca de "no vendí". | F7.5 |
| `use-cases/schedule-test-reminders.ts` | Acción de prueba: programa con `scheduler.schedule` lo que da `planTestReminders`. | F7.5 |
| `hooks/query-keys.ts` | `notificationKeys` y `NOTIFICATIONS_QUERY_DEPENDENCIES` (solo la raíz de preferencias depende de una tabla). | F7.3 / F7.7 |
| `hooks/use-notification-preferences.ts` | Lectura de preferencias. | F7.7 |
| `hooks/use-save-notification-preferences.ts` | Guarda; la reconciliación llega sola por `DataChanges`. | F7.7 |
| `hooks/use-notification-permission.ts` | Estado del permiso; se vuelve a leer al volver a primer plano. | F7.7 |
| `hooks/use-request-notification-permission.ts` | Pide el permiso (solo desde un toque) y, si se concede, `reconciler.request()`. | F7.7 / F7.8 |
| `hooks/use-notification-triggers.ts` | Arranque, `AppState` y `DataChanges` → `reconciler.request()`, con limpieza. | F7.5 |
| `hooks/use-notification-taps.ts` | Ambas vías de respuesta, deduplicación, espera del router, `clearLast`. | F7.6 |
| `hooks/use-schedule-test-reminders.ts` | Acción de prueba (desarrollo y `e2e`). | F7.5 |
| `components/notifications-host.tsx` | Componente sin UI visible que monta `useNotificationTriggers` y `useNotificationTaps`. Recibe `navigationReady` y `onOpen(target)` de la ruta raíz. | F7.5 / F7.6 |
| `components/weekly-reminder-fields.tsx`, `components/permission-status.tsx`, `components/test-reminder-panel.tsx` | Presentación según F7.1. | F7.7 |
| `screens/notification-settings-screen.tsx` | Preferencias (día y hora, activar o desactivar, resumen mensual), estado del permiso y acceso a los ajustes del sistema. | F7.7 |
| `screens/permission-intro-screen.tsx` | Pantalla explicativa de la primera venta, con "Activar" y "Ahora no". | F7.8 |
| `testing/fake-notification-scheduler.ts` | Doble con permiso configurable, registro de operaciones en orden y modo lento (promesas controladas) para probar la serialización. | F7.5 |
| `testing/in-memory-preferences-repository.ts` | Doble conectado a un `DataChanges`. | F7.3 |
| `testing/fake-notification-responses.ts` | Doble para emitir respuestas y fijar la última. | F7.6 |
| `index.ts` | API pública: screens, `NotificationsHost`, hooks que usan las rutas, tipos de puertos, adaptadores y fábricas para `core/dependencies`, `NOTIFICATIONS_QUERY_DEPENDENCIES`. | F7.3 a F7.8 |

### 2.2 Rutas (`src/app/`)

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `_layout.tsx` (modificar) | Dentro de `RootNavigator`, monta `<NotificationsHost navigationReady={Boolean(useRootNavigationState()?.key)} onOpen={openNotificationTarget} />`. `openNotificationTarget` traduce el destino a `router.push('/sales/new')`, `router.push({ pathname: '/tracking/monthly', params: { month } })` o `router.navigate('/')` si el payload no es válido. | F7.6 |
| `sales/new.tsx` (modificar) | En `onFinished(outcome)`: si `shouldOfferPermission({ isFirstSale: outcome.isFirstSale, permission })` (permiso leído con `useNotificationPermission` mientras se muestra la celebración), `router.replace('/notifications/intro')`; si no, `goBackOrHome`. | F7.8 |
| `notifications/intro.tsx` (nuevo) | Renderiza `PermissionIntroScreen`; al terminar ("Activar" o "Ahora no"), `goBackOrHome`. Presentación modal según F7.1. | F7.8 |
| `settings/notifications.tsx` (nuevo) | Renderiza `NotificationSettingsScreen`. F9 la integra en Ajustes. | F7.7 |

### 2.3 Núcleo, compartido y configuración

| Archivo | Cambio | Tarea |
|---|---|---|
| `core/providers/app-dependencies.ts` | Agrega `preferences: PreferencesRepository`, `notifications: NotificationScheduler`, `notificationReconciler: NotificationReconciler`, `notificationResponses: NotificationResponseSource` y `registeredWeeks: RegisteredWeekReader` (solo tipos; compuesto en `core/dependencies` y compartido por la reconciliación y el panel de prueba). | F7.3 a F7.6 |
| `core/dependencies/create-app-dependencies.ts` | Construye el repositorio Drizzle de preferencias, el scheduler, la fuente de respuestas y el reconciliador; llama a `installNotificationPresentation()` una vez. | F7.3 a F7.6 |
| `core/providers/query/query-dependencies.ts` | Suma `NOTIFICATIONS_QUERY_DEPENDENCIES`. | F7.7 |
| `core/testing/create-test-dependencies.ts` | Suma los dobles de `testing/`. | F7.3 a F7.6 |
| `app.json` | Plugin `["expo-notifications", { "enableRemoteNotifications": false, "icon": <ícono monocromo>, "color": <acento> }]` y `com.google.android.c2dm.permission.RECEIVE` en `android.blockedPermissions` (sección 3.9). `VIBRATE` y `ACCESS_NETWORK_STATE` siguen bloqueados. | F7.4 |
| `package.json` | `expo-notifications` ~58.1.9 con `npx expo install`. | F7.4 |
| `src/features/settings/screens/settings-screen.tsx` | Fila provisional "Recordatorios" que lleva a `/settings/notifications` (la pantalla definitiva es de F9). | F7.7 |

---

## 3. Tipos e interfaces principales (firmas)

### 3.1 Preferencias (`domain/preferences.ts`)

```ts
/** Preferencias de notificación del dispositivo (ADR-007); no viajan en el respaldo (D-28). */
export interface NotificationPreferences {
  readonly weekly: {
    readonly enabled: boolean;
    readonly weekday: IsoWeekday;
    readonly minuteOfDay: number;
  };
  readonly monthly: { readonly enabled: boolean };
}

/** Domingo a las 20:00 y resumen mensual activado (ADR-007, regla 14). */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences;

/** Valida día ISO 1–7 y minuto 0–1439 enteros; es la única fuente de esas reglas. */
export const notificationPreferencesSchema: z.ZodType<NotificationPreferences>;
```

### 3.2 Plan (`domain/plan.ts`, ADR-011 con las precisiones de 6.1)

```ts
/** Tipo de notificación programada por la app. */
export type NotificationKind = 'weekly_reminder' | 'monthly_summary';

/** Variante del texto del recordatorio semanal. */
export type WeeklyReminderVariant = 'already_registered' | 'neutral';

/** Ruta interna a la que lleva tocar la notificación. */
export type NotificationDeepLink = '/sales/new' | '/tracking/monthly';

/** Contenido visible y destino. El resumen mensual lleva el mes que resume (`YYYY-MM`). */
export type NotificationContent =
  | { readonly title: string; readonly body: string; readonly deepLink: '/sales/new' }
  | {
      readonly title: string;
      readonly body: string;
      readonly deepLink: '/tracking/monthly';
      readonly month: YearMonth;
    };

/** Trigger planificado: de una sola vez o semanal repetitivo (hora local de pared). */
export type PlannedTrigger =
  | { readonly type: 'once'; readonly fireAt: EpochMs }
  | { readonly type: 'weekly'; readonly weekday: IsoWeekday; readonly minuteOfDay: number };

/** Notificación a programar. Solo el recordatorio semanal puede ser `weekly`. */
export type PlannedNotification =
  | {
      readonly identifier: string;
      readonly kind: NotificationKind;
      readonly trigger: Extract<PlannedTrigger, { type: 'once' }>;
      readonly content: NotificationContent;
    }
  | {
      readonly identifier: string;
      readonly kind: 'weekly_reminder';
      readonly trigger: Extract<PlannedTrigger, { type: 'weekly' }>;
      readonly content: NotificationContent;
    };

/** Datos para planificar, sin dependencias de plataforma (ADR-011). */
export interface NotificationPlanInput {
  readonly now: EpochMs;
  readonly calendar: LocalCalendar;
  readonly preferences: NotificationPreferences;
  readonly currentWeekRegistered: boolean;
  /** Instante del último recordatorio semanal planificado, o `null` (D-13, 6.1 punto 9). */
  readonly lastWeeklyFireAt: EpochMs | null;
  readonly fallbackWeeks: number;
  readonly monthsAhead: number;
}

/**
 * Instante `T` del recordatorio de la semana ISO que contiene `today`:
 * `calendar.instantAt(addDays(lunes, weekday - 1), minuteOfDay)`.
 */
export function weeklyReminderInstant(
  today: LocalDate,
  weekly: NotificationPreferences['weekly'],
  calendar: LocalCalendar,
): EpochMs;

/**
 * Instante del recordatorio de la semana en curso que la reconciliación debe recordar (D-13):
 * `T` si el semanal está activo, `T > now` y no llegó ya otro esta semana; si no, `null`.
 */
export function weeklyInstantToRemember(input: NotificationPlanInput): EpochMs | null;

/**
 * Plan completo, ordenado: primero `cv.weekly.repeat` si existe y después los avisos de una
 * sola vez por `fireAt` ascendente (empates por `identifier`). Sin instantes `<= now`, sin dos
 * avisos semanales para la misma semana y con a lo sumo 64 pendientes (60 en el estado B).
 */
export function planNotifications(input: NotificationPlanInput): readonly PlannedNotification[];
```

Reglas de `planNotifications` (lo que fijan los tests de F7.2):
- `today = calendar.localDateOf(now)`, `week = weekRangeOf(today)`, `T = weeklyReminderInstant(today, weekly, calendar)`.
- **Semanal desactivado**: ningún aviso con `kind = 'weekly_reminder'`.
- **Ya llegó esta semana (D-13)**: si `lastWeeklyFireAt <= now`, cae en la semana de `today` y `T > now`, solo los `fallbackWeeks` avisos neutrales desde la próxima semana (sin `cv.weekly.repeat` ni aviso de esta semana). Ver 6.1 punto 9.
- **Estado B** si `currentWeekRegistered && T > now`:
  - `cv.weekly.<week.start>` en `T`, variante `already_registered`;
  - para `k = 1..fallbackWeeks`: `cv.weekly.<addDays(week.start, 7k)>` en `instantAt(addDays(week.start, 7k + weekday - 1), minuteOfDay)`, variante `neutral`.
- **Estado A** en cualquier otro caso: solo `cv.weekly.repeat`, `{ type: 'weekly', weekday, minuteOfDay }`, variante `neutral`.
- **Mensual activado**: los primeros `monthsAhead` días 1 cuyo instante `instantAt(día 1, 600)` sea `> now`, empezando por el mes en curso. El id usa el **mes en que se dispara** (`cv.monthly.2026-12` se dispara el 2026-12-01, como en el ejemplo de ADR-011). El contenido y el payload llevan el **mes que se resume**, el anterior (`month = '2026-11'`, "Tu resumen de noviembre está listo").
- Ningún `fireAt` es `<= now`. Si un `instantAt` cae en un minuto inexistente, ADR-015 ya devuelve el primer minuto válido posterior.

### 3.3 Diferencias (`domain/diff.ts`)

```ts
/** Notificación `cv.*` que el adaptador no pudo reconstruir desde su payload; siempre se cancela. */
export interface UnrecognizedScheduledNotification {
  readonly identifier: string;
  readonly kind: 'unrecognized';
}

/** Lo programado en el sistema, normalizado por el adaptador desde `content` y `content.data`. */
export type ScheduledNotification = PlannedNotification | UnrecognizedScheduledNotification;

/** Cambios necesarios para que lo programado coincida con el plan (ADR-011). */
export interface NotificationDiff {
  /** Ids a cancelar: los que sobran, los que cambiaron y los no reconocidos. */
  readonly toCancel: readonly string[];
  /** Lo que falta o cambió, en el orden del plan. */
  readonly toSchedule: readonly PlannedNotification[];
}

/**
 * Compara por identificador. Ignora los ids sin el prefijo `cv.` (también los `cvtest.`).
 * Igualdad estructural de `kind`, `trigger` y `content`, incluido `month`.
 */
export function diffNotifications(
  plan: readonly PlannedNotification[],
  scheduled: readonly ScheduledNotification[],
): NotificationDiff;

/** Igualdad estructural usada por `diffNotifications`. */
export function samePlannedNotification(a: PlannedNotification, b: PlannedNotification): boolean;
```

### 3.4 Payload (`domain/payload.ts`)

```ts
/**
 * Lo que el adaptador guarda en `content.data`. Versionado con `v`. Permite reconstruir la
 * notificación al listar (`trigger`, `kind`) y navegar al tocar (`deepLink`, `month`).
 */
export const notificationDataSchema: z.ZodType<NotificationData>;

export type NotificationData =
  | {
      readonly v: 1;
      readonly kind: NotificationKind;
      readonly deepLink: '/sales/new';
      readonly trigger: PlannedTrigger;
    }
  | {
      readonly v: 1;
      readonly kind: 'monthly_summary';
      readonly deepLink: '/tracking/monthly';
      readonly month: YearMonth;
      readonly trigger: PlannedTrigger;
    };

/** Destino de navegación al tocar. */
export type NotificationTarget =
  | { readonly deepLink: '/sales/new' }
  | { readonly deepLink: '/tracking/monthly'; readonly month: YearMonth };

/** Serializa el payload de una notificación planificada. */
export function toNotificationData(planned: PlannedNotification): NotificationData;

/**
 * Valida `data` con Zod (ADR-010). Al tocar solo importa el destino, así que acepta un
 * `trigger` ausente o desconocido. Devuelve `null` si el destino no es válido; la ruta abre Inicio.
 */
export function parseNotificationTarget(data: unknown): NotificationTarget | null;
```

Los avisos `cvtest.*` usan el mismo payload, así que tocarlos lleva al mismo destino que el aviso real que imitan.

### 3.5 Puertos (`domain/ports.ts`)

```ts
/** Permiso de notificaciones simplificado para la UI (ADR-011). */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/** Puerto hacia el sistema de notificaciones (ADR-011). */
export interface NotificationScheduler {
  getPermission(): Promise<NotificationPermission>;
  /** Crea el canal `reminders` (Android) y después pide el permiso. Solo desde una acción del usuario. */
  requestPermission(): Promise<NotificationPermission>;
  /** Notificaciones de la app (prefijo `cv.`), reconstruidas desde su payload. */
  listScheduled(): Promise<readonly ScheduledNotification[]>;
  cancel(identifiers: readonly string[]): Promise<void>;
  /** Programa en orden, en el canal `reminders`; asegura el canal antes. */
  schedule(notifications: readonly PlannedNotification[]): Promise<void>;
}

/** Un toque sobre una notificación, normalizado por el adaptador. */
export interface NotificationTap {
  /** `request.identifier` + fecha de entrega: un `WEEKLY` repite el identifier cada semana. */
  readonly key: string;
  /** `true` si es la acción por defecto (tocar la notificación). */
  readonly isDefaultAction: boolean;
  readonly data: unknown;
}

/** Las dos vías de ADR-011: arranque en frío y app abierta. */
export interface NotificationResponseSource {
  /** Última respuesta conocida (`getLastNotificationResponse`), o `null`. */
  getLast(): NotificationTap | null;
  /** Respuestas nuevas mientras la app está abierta; devuelve la función de limpieza. */
  subscribe(listener: (tap: NotificationTap) => void): () => void;
  /**
   * `clearLastNotificationResponse` (síncrono en el módulo), para que no se repita en el próximo
   * arranque. Devuelve una promesa ya resuelta para que el puerto admita implementaciones asíncronas.
   */
  clearLast(): Promise<void>;
}

/** Si una semana tiene registro: una venta activa con ítems o una marca de "no vendí". */
export interface RegisteredWeekReader {
  isRegistered(week: WeekRange): Promise<boolean>;
}
```

### 3.6 Reconciliación (`use-cases/`)

```ts
/** Puertos de una ejecución. */
export interface ReconcileDeps {
  readonly scheduler: NotificationScheduler;
  readonly preferences: Pick<
    PreferencesRepository,
    'get' | 'getLastWeeklyFireAt' | 'setLastWeeklyFireAt'
  >;
  readonly weeks: RegisteredWeekReader;
  readonly clock: Clock;
  readonly calendar: LocalCalendar;
  readonly logger: Logger;
}

/** Resumen sin datos del negocio, para el logger. */
export interface ReconcileSummary {
  readonly state: 'A' | 'B' | 'weekly_off' | 'no_permission';
  readonly cancelled: number;
  readonly scheduled: number;
}

/**
 * Una ejecución: permiso → si no está concedido, plan vacío (cancela todo lo `cv.`); si está
 * concedido, preferencias y semana → `planNotifications` → `listScheduled` → `diffNotifications`
 * → `cancel(toCancel)` y **después** `schedule(toSchedule)`. Sin diferencias, no llama a ninguno.
 */
export function reconcileNotifications(deps: ReconcileDeps): Promise<ReconcileSummary>;

/** Cola serializada en la que gana la última (ADR-011). */
export interface NotificationReconciler {
  /**
   * Pide una reconciliación. Si no hay ninguna en curso, empieza ya. Si hay una en curso, marca
   * "pendiente": al terminar la actual corre **una sola** más, con el estado de ese momento.
   * La promesa se resuelve cuando termina una ejecución que empezó después del pedido. Nunca se
   * rechaza: un fallo se registra en el logger y la cola sigue.
   */
  request(): Promise<void>;
}

export function createNotificationReconciler(
  run: () => Promise<ReconcileSummary>,
  logger: Logger,
): NotificationReconciler;
```

### 3.7 Repositorio de preferencias (`data/preferences-repository.ts`)

```ts
/** Acceso a la fila única `'device'` de `notification_preferences` (ADR-007). */
export interface PreferencesRepository {
  /** Sin fila, o con una fila fuera de rango (que se registra), devuelve los valores por defecto. */
  get(): Promise<NotificationPreferences>;
  /**
   * Valida con `notificationPreferencesSchema` y hace *upsert* con `updated_at = now` en
   * `runInTransaction`, tocando `notification_preferences`.
   * @throws {RangeError} Si las preferencias no son válidas; no escribe nada.
   */
  save(preferences: NotificationPreferences, now: EpochMs): Promise<void>;
  /** Instante del último recordatorio semanal planificado (D-13), o `null`. No viaja en el respaldo. */
  getLastWeeklyFireAt(): Promise<EpochMs | null>;
  /** Guarda o borra ese instante sin tocar las preferencias ni emitir `DataChanges`. */
  setLastWeeklyFireAt(instant: EpochMs | null, now: EpochMs): Promise<void>;
}
```

### 3.8 Hooks y componentes (contratos para F7.5 a F7.8)

```ts
/** Claves de la feature; solo `preferences` depende de una tabla. */
export const notificationKeys: {
  readonly preferences: () => readonly ['notification-preferences'];
  readonly permission: () => readonly ['notification-permission'];
};

/** `notification-preferences` ← `notification_preferences`. El permiso no depende de tablas. */
export const NOTIFICATIONS_QUERY_DEPENDENCIES: readonly QueryDependency[];

/** Props de {@link NotificationsHost}. */
export interface NotificationsHostProps {
  /** `true` cuando el navegador raíz está montado (`useRootNavigationState()?.key`). */
  readonly navigationReady: boolean;
  /** Navega; `null` = payload inválido → Inicio. */
  readonly onOpen: (target: NotificationTarget | null) => void;
}

/** Decide si la ruta posventa muestra la pantalla explicativa (D-06, D-36). */
export function shouldOfferPermission(input: {
  readonly isFirstSale: boolean;
  readonly permission: NotificationPermission | undefined;
}): boolean;
```

`shouldOfferPermission` es `true` solo si `isFirstSale` y `permission === 'undetermined'`. Si el permiso todavía no se leyó (`undefined`), devuelve `false`: es mejor no mostrar la pantalla que mostrarla por error. "Ahora no" no necesita guardarse: la primera venta ocurre una sola vez en la historia del dispositivo (D-36). Después de "Ahora no", la opción queda en Ajustes.

### 3.9 Adaptador (`adapters/expo-notification-scheduler.ts`) y configuración nativa

- **Canal**: `setNotificationChannelAsync('reminders', { name: 'Recordatorios', description: 'Recordatorio semanal y resumen del mes', importance: AndroidImportance.DEFAULT })`. Se crea una vez por proceso (memoizado), **antes** de `requestPermissionsAsync` y antes de cada `schedule`. En Android 13+ el diálogo de permiso no aparece sin un canal.
- **Permiso**: `requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })`, sin `allowProvisional` (D-29). Mapeo: `granted` → `'granted'`; `denied` → `'denied'`; `undetermined` → `'undetermined'`; `ios.status` `PROVISIONAL`/`EPHEMERAL` → `'granted'` (no se piden, pero se toleran).
- **Programar**: `scheduleNotificationAsync({ identifier, content: { title, body, data: toNotificationData(p), sound: 'default' }, trigger })`:
  - `once` → `{ type: SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: 'reminders' }`;
  - `weekly` → `{ type: SchedulableTriggerInputTypes.WEEKLY, weekday: toExpoWeekday(weekday), hour: ⌊minuteOfDay / 60⌋, minute: minuteOfDay % 60, channelId: 'reminders' }`;
  - sin `delivery: 'alarmClock'` (requeriría `SCHEDULE_EXACT_ALARM`, que DT-19 excluye).
- **Listar**: `getAllScheduledNotificationsAsync()`, filtrado por `isAppNotificationId`. Para cada uno: `notificationDataSchema.safeParse(content.data)` + `title` y `body` → `PlannedNotification`; si falla → `{ identifier, kind: 'unrecognized' }`. El trigger nativo no se interpreta: `NotificationTrigger` es una unión que cambia de forma entre plataformas (por ejemplo, `calendar` en iOS para lo que en Android es `weekly`).
- **Cancelar**: `cancelScheduledNotificationAsync(id)` por cada id.
- **Presentación en primer plano** (`notification-presentation.ts`): `setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) })`.
- **Respuestas** (`expo-notification-responses.ts`): `getLast()` usa `getLastNotificationResponse()` (lo mismo que hace por dentro `useLastNotificationResponse`), `subscribe` usa `addNotificationResponseReceivedListener` y `clearLast` llama a `clearLastNotificationResponse()` (síncrono) y devuelve una promesa ya resuelta. `key = \`${request.identifier}@${notification.date}\``. `isDefaultAction = actionIdentifier === DEFAULT_ACTION_IDENTIFIER`.

**Permisos de Android** (respuesta a la nota del orquestador), verificados en el manifiesto y el código de 58.1.9:
- El módulo declara `POST_NOTIFICATIONS` (el permiso que se pide) y `RECEIVE_BOOT_COMPLETED`. Este último hace falta para reprogramar las alarmas al reiniciar el teléfono (`NotificationsService` escucha `BOOT_COMPLETED` y `MY_PACKAGE_REPLACED`). No pide permiso al usuario.
- **`VIBRATE` no hace falta**. En Android 8+ vibra el canal, es decir, el sistema. En Android 7 (minSdk 24), `setDefaults(DEFAULT_ALL)` lo ejecuta `NotificationManagerService` con sus propios permisos. El módulo no declara `VIBRATE` ni llama al `Vibrator`. Se mantiene bloqueado.
- **`ACCESS_NETWORK_STATE` no hace falta**: lo aporta `firebase-messaging` (dependencia del módulo, para push), que no se usa (D-23). Se mantiene bloqueado.
- **Se agrega a `blockedPermissions`** `com.google.android.c2dm.permission.RECEIVE` (recepción de push de FCM, también de `firebase-messaging`), para cumplir DT-19 "sin push remoto".
- **`WAKE_LOCK`**: `firebase-messaging` lo declara y otra biblioteca transitiva (por ejemplo, WorkManager) podría necesitarlo. Bloquearlo sin verificar puede provocar `SecurityException`. F7.4 inspecciona el manifiesto fusionado (como F2.3) y lo informa. Por defecto **no se bloquea** (sección 6.1).
- `SCHEDULE_EXACT_ALARM` y `USE_EXACT_ALARM` no aparecen en el manifiesto del módulo; F7.4 lo confirma en el fusionado.

---

## 4. Flujo de datos y manejo de estado

### 4.1 Reconciliación

```
disparador ──► reconciler.request()
                 │ (cola: a lo sumo 1 en curso + 1 pendiente)
                 ▼
  reconcileNotifications
    1. scheduler.getPermission()  ── ≠ granted ──► plan = []
    2. preferences.get() y preferences.getLastWeeklyFireAt()
    3. weeks.isRegistered(weekRangeOf(calendar.localDateOf(now)))   (solo si el semanal está activo)
    4. planNotifications(...)                      ── puro
    5. scheduler.listScheduled()
    6. diffNotifications(plan, scheduled)          ── puro
    7. scheduler.cancel(toCancel)  ──►  8. scheduler.schedule(toSchedule)
    8b. preferences.setLastWeeklyFireAt(...)       (recuerda o borra el instante, ver 6.1 punto 9)
    9. logger.info('notifications_reconciled', { state, cancelled, scheduled })
```

- `RegisteredWeekReader` se compone con `sales.activeWeekStartsBetween(start, end)` y `noSalesWeeks.listBetween(start, end)`. Los tipos se importan de `@/features/sales` con `import type`, siguiendo la dirección `notifications → sales` de ADR-005.
- **Cancelar antes de programar** es lo que mantiene D-13 aunque falle la mitad: en A → B se cancela el `WEEKLY` antes de programar los de una sola vez, y en B → A se cancelan los de una sola vez antes de programar el `WEEKLY`. En el peor caso se pierde un recordatorio hasta la próxima apertura, pero nunca hay dos.
- **Cola**: `request()` con la cola libre arranca enseguida. Con una ejecución en curso, todas las solicitudes se juntan en una sola ejecución posterior, que lee el estado de ese momento. Si ya hay una pendiente, todo pedido devuelve esa misma pendiente, aunque llegue desde la continuación de la ejecución que acaba de terminar: nunca hay dos ejecuciones activas. Si una ejecución falla, se registra (`notifications_reconcile_failed`, sin datos del negocio) y la cola sigue.

### 4.2 Disparadores (`useNotificationTriggers`, montado por `NotificationsHost`)

- **Arranque**: `NotificationsHost` se monta dentro de `MigrationGate` (solo con la base lista) y pide una reconciliación en su primer efecto.
- **Primer plano**: `AppState.addEventListener('change')`; al pasar a `active`, `request()`. El listener se quita al desmontar. También cubre el cambio de zona horaria (ADR-015, regla 6) y el permiso cambiado en los ajustes del sistema.
- **Datos**: `dataChanges.subscribe(tables => touchesReconcileTables(tables) && request())`, con limpieza. `RECONCILE_TABLES = {'sale_records', 'sale_items', 'no_sales_weeks', 'notification_preferences'}`.
- **Permiso concedido**: `useRequestNotificationPermission` llama a `reconciler.request()` cuando el resultado es `granted`.
- **Fin de una restauración**: la restauración reemplaza `sale_records`, `sale_items` y `no_sales_weeks` en una `runInTransaction`, que emite esas tablas después del commit (`docs/architecture/backup.md`, 4.3). Eso dispara la reconciliación sin que `backup` dependa de `notifications`.

### 4.3 Al tocar una notificación (`useNotificationTaps`)

1. Al montar: `tap = responses.getLast()` (arranque en frío) y `responses.subscribe(onTap)` (app abierta), con limpieza.
2. `onTap(tap)`: si `!tap.isDefaultAction` o el deduplicador ya vio `tap.key`, no hace nada. Si no, guarda `target = parseNotificationTarget(tap.data)` como pendiente.
3. Cuando hay un pendiente y `navigationReady` es `true`, llama a `onOpen(target)` una sola vez y después a `responses.clearLast()`.
4. La ruta raíz navega: `/sales/new`, `/tracking/monthly?month=…` o Inicio si `target === null`. `tracking/monthly.tsx` ya valida `month` y redirige si no es válido.

El deduplicador recuerda las últimas 20 claves en memoria. La clave incluye la fecha de entrega, así que el `cv.weekly.repeat` de la semana siguiente se procesa aunque el proceso siga vivo (sección 6.1).

### 4.4 Permiso después de la primera venta (D-06)

```
NewSaleScreen ─ celebración + consejo (F6) ─ "Listo" ─► onFinished(outcome)
  sales/new.tsx: shouldOfferPermission({ isFirstSale, permission }) ?
     sí ─► router.replace('/notifications/intro') ─ PermissionIntroScreen
             "Activar"  ─► requestPermission() ─► granted ? reconciler.request() ─► goBackOrHome
             "Ahora no" ─► goBackOrHome  (no se insiste; queda en Ajustes)
     no ─► goBackOrHome
```

El orden con el consejo es el de F6.2 (UX-T3): primero la celebración con el consejo y, solo después de "Listo", la pantalla explicativa. Nunca aparecen a la vez. El permiso se lee con `useNotificationPermission` mientras la celebración está a la vista, para decidir sin esperar.

### 4.5 Preferencias (F7.7)

`useNotificationPreferences` lee la clave `notification-preferences`. `useSaveNotificationPreferences` llama a `preferences.save(prefs, clock.now())`, que emite `notification_preferences`: se invalida la clave **y** se dispara la reconciliación. Con el permiso `denied`, la pantalla muestra el estado y "Abrir ajustes" (`Linking.openSettings()`), sin pedirlo de nuevo. Con `undetermined`, ofrece "Activar recordatorios", que llama a `requestPermission` desde el toque. `useNotificationPermission` se invalida al volver a primer plano.

### 4.6 Acción de prueba (desarrollo y `e2e`)

- `TestReminderPanel` se renderiza en `NotificationSettingsScreen` solo si `__DEV__ || process.env.EXPO_PUBLIC_E2E === '1'`, con la condición escrita en línea para que el bundle `release` la elimine (como `src/app/e2e/diagnostics.tsx`).
- Ofrece dos acciones:
  - "Aviso en 1 minuto": un `cvtest.single` con el texto que corresponde hoy (`already_registered` o `neutral`, según `RegisteredWeekReader`).
  - Los ids son fijos y la acción cancela antes cualquier tanda `cvtest.*` anterior: nunca hay más de una tanda pendiente.
  - "Secuencia del estado B": `cvtest.seq.<n>`, un aviso `already_registered` en 1 minuto y dos `neutral` a los 3 y 5 minutos.
- `planTestReminders({ now, variant, offsetsSeconds })` es pura. Los ids `cvtest.` no empiezan con `cv.`, así que `listScheduled` y `diffNotifications` los ignoran y una reconciliación no los cancela.
- La repetición real del `WEEKLY` no se puede acortar (el trigger no admite otro intervalo). F7.10 la verifica adelantando la fecha del sistema (5.6).

### 4.7 Estado

- No hay store global. El estado de la cola vive en el reconciliador, creado una vez en `core/dependencies`.
- La deduplicación de toques vive en memoria del hook. Las preferencias y el permiso viven en TanStack Query.
- `NotificationsHost` no renderiza nada visible.

---

## 5. Tests que el code-writer escribe primero

### 5.1 Dominio (`node`, F7.2)

- **Valores por defecto**: domingo (7), 1200, mensual activado. El esquema rechaza weekday 0 y 8, minuteOfDay -1, 1440 y 12.5.
- **`toExpoWeekday`**: 1 → 2, 2 → 3, …, 6 → 7, 7 → 1.
- **`weeklyReminderInstant`**: el día configurado es hoy, antes y después de la hora; el día configurado ya pasó en la semana; el día configurado todavía no llega.
- **Estados A/B**:
  - semana no registrada → solo `cv.weekly.repeat` (`weekly`, `neutral`);
  - registrada y `T` futuro → sin `cv.weekly.repeat`, `cv.weekly.<lunes>` en `T` con `already_registered`, y exactamente 47 `neutral` en los lunes `+7k`, cada uno a la hora configurada de su semana;
  - registrada y `T` pasado → estado A;
  - transiciones A → B → A con el mismo `now` y cambiando `currentWeekRegistered`, y avanzando `now` más allá de `T`.
- **D-13**:
  - para cada plan generado (propiedad sobre una grilla de `now`, días, horas y registro): si el plan tiene `cv.weekly.repeat`, no tiene ningún `cv.weekly.<fecha>`; los `cv.weekly.<fecha>` caen en semanas ISO distintas; y ninguno cae en una semana anterior a la de `now`. Con eso, ninguna semana del plan (incluida la en curso) puede recibir dos recordatorios;
  - con el semanal activado siempre hay un recordatorio neutro de respaldo;
  - el texto `neutral` no contiene dígitos ni "$" ni palabras de la semana (montos, cantidades, racha);
  - desactivado, no hay ninguno.
- **Mensual**:
  - 12 avisos el día 1 a las 10:00;
  - hoy es día 1 antes de las 10:00 → incluye el de hoy; después → no;
  - el id usa el mes del disparo y `month` el mes anterior;
  - el aviso del 2027-01-01 resume `2026-12` y dice "diciembre";
  - desactivado → ninguno.
- **Invariantes**: ningún `fireAt <= now`; el plan va ordenado; ids deterministas (`cv.weekly.repeat`, `cv.weekly.AAAA-MM-DD`, `cv.monthly.AAAA-MM`); a lo sumo 64 pendientes (60 en B, 13 en A con mensual).
- **Cambio de horario**: con los *fixtures* de `shared/domain/calendar/__fixtures__/time-zones.ts`, en `America/Santiago`, `Pacific/Easter` y `America/Punta_Arenas` (`npm run test:tz`): un recordatorio del domingo a las 20:00 en la semana de cada cambio cae a las 20:00 locales; uno configurado a las 00:00 del día del salto hacia adelante usa el primer minuto válido.
- **`diffNotifications`**:
  - sin cambios → sin operaciones;
  - cambia solo lo que difiere en trigger, texto, `deepLink` o `month`;
  - un id del plan ausente → se programa;
  - un id programado ausente del plan → se cancela;
  - `unrecognized` → se cancela y, si está en el plan, se vuelve a programar;
  - ignora ids sin `cv.`, también los `cvtest.`.
- **Payload**: `toNotificationData` → `parseNotificationTarget` en ida y vuelta para los dos destinos; rechaza un `deepLink` desconocido, un `month` inválido (`2026-13`), `v: 2`, `null`, texto y números.
- **Deduplicador**: la misma clave dos veces → una sola; claves con el mismo identifier y otra fecha → dos; olvida las más viejas pasado el límite.
- **`shouldOfferPermission`**: solo `true` con primera venta y `undetermined`.
- **Tono**: ningún texto del catálogo (las dos variantes y los 12 nombres de mes) coincide con `GUILT_PATTERNS` (`shared/lib/testing/guilt-patterns.ts`).

### 5.2 Datos (`node`, `createTestDatabase`, F7.3)

- Sin fila → valores por defecto.
- Guardar y leer; guardar dos veces actualiza la misma fila (`id = 'device'`).
- `weekday` fuera de 1–7 o `minuteOfDay` fuera de 0–1439 → rechaza y no escribe.
- Emite `DataChanges` con `notification_preferences` y solo esa tabla.
- Una fila con valores fuera de rango (insertada a mano sin `CHECK`, por ejemplo en una base sin migrar) → valores por defecto y una advertencia en el logger.
- `getLastWeeklyFireAt` / `setLastWeeklyFireAt`: `null` al inicio; guardar y borrar; `save` no lo modifica; no emite `DataChanges`.
- El mismo contrato corre contra el repositorio en memoria.
- Migración `0001` con datos previos (ADR-006): una fila de `notification_preferences` anterior se conserva y la columna nueva queda en `NULL`.

### 5.3 Adaptador (`ui`, `jest.mock('expo-notifications')`, F7.4)

- En Android, `setNotificationChannelAsync('reminders', …)` ocurre antes de `requestPermissionsAsync`, y una sola vez por proceso.
- iOS: `requestPermissionsAsync` recibe `allowAlert: true`, `allowSound: true`, `allowBadge: false` y no recibe `allowProvisional`.
- Mapeo de permisos (`granted`, `denied`, `undetermined`, `PROVISIONAL`).
- `schedule`: `once` → `DATE` con `date: fireAt` y `channelId: 'reminders'`; `weekly` → `WEEKLY` con `toExpoWeekday` y la hora y el minuto; `data` = `toNotificationData`.
- `listScheduled`: solo prefijo `cv.`; reconstruye desde el payload; `data` inválido → `unrecognized`.
- `cancel` por identificador.

### 5.4 Reconciliación (`node`, dobles, F7.5)

- Sin permiso → plan vacío: cancela todos los `cv.` y no programa nada.
- Idempotente: dos ejecuciones seguidas → la segunda no hace operaciones.
- **Serialización** con `FakeNotificationScheduler` lento:
  - tres `request()` simultáneos → una ejecución en curso y una posterior (dos en total);
  - nunca se intercalan `cancel` y `schedule` de dos ejecuciones;
  - la segunda usa el estado más reciente (preferencias cambiadas durante la primera);
  - una ejecución que falla no traba la cola y se registra.
- Orden: en cada ejecución, `cancel` antes de `schedule`.
- `RegisteredWeekReader`: venta activa con ítems → registrada; venta sin ítems activos → no; marca activa → sí; marca borrada → no.

### 5.5 Hooks, componentes, screens y rutas (`ui`, F7.5 a F7.8)

- **Disparadores**: el montaje pide una vez; `AppState` → `active` pide; `DataChanges` de `sale_items` pide y de `products` no; el listener de `AppState` y la suscripción se limpian al desmontar.
- **Toques**:
  - payload válido → `onOpen` con `/sales/new` o con `/tracking/monthly` y el mes;
  - inválido → `onOpen(null)`;
  - la misma respuesta por `getLast` y por el listener → una sola llamada, seguida de `clearLast`;
  - con `navigationReady = false` no navega y lo hace al pasar a `true`;
  - la acción no por defecto se ignora;
  - el listener se limpia.
- **Presentación**: `installNotificationPresentation` configura banner y lista sin sonido ni badge.
- **Preferencias**:
  - cambiar el día y la hora guarda y dispara una reconciliación (verificada en el scheduler falso);
  - desactivar el semanal o el mensual;
  - con `denied` se muestra el estado y "Abrir ajustes" (`Linking.openSettings`), sin llamar a `requestPermission`.
- **Primera venta** (`src/__tests__/`, `renderRouter`):
  - la pantalla explicativa aparece solo en la primera venta con `undetermined`, y después de "Listo";
  - con `granted` o `denied`, o en la segunda venta, no aparece;
  - "Ahora no" vuelve sin pedir el permiso;
  - "Activar" con resultado `granted` reconcilia.
- **Acción de prueba**: programa ids `cvtest.` con los desfases pedidos; una reconciliación posterior no los cancela.
- **Ruta raíz**: `openNotificationTarget` navega a cada destino.

### 5.6 E2E y verificación manual (F7.10)

- **Maestro** (`e2e/maestro/notifications/`, pendiente de entorno):
  - `first-sale-intro.yaml`: primera venta → "Listo" → pantalla explicativa → "Ahora no" → Inicio; una segunda venta no la muestra;
  - `preferences.yaml`: cambiar el día y la hora, desactivar y volver a activar.

  El diálogo del sistema se trata con `clearState` y sin tocar "Permitir", porque Maestro no controla bien las notificaciones del sistema (ADR-011).
- **Manual** (Android, build `e2e`):
  1. Semana sin registro: "Aviso en 1 minuto" → llega el texto neutro; tocarlo abre el registro de venta.
  2. Registrar una venta y repetir → llega `already_registered`.
  3. "Secuencia del estado B" con la app cerrada (deslizada fuera de recientes) → llegan los tres, en orden.
  4. **D-13 con el `WEEKLY` real**:
     - fijar el recordatorio para dentro de 2 minutos, cerrar la app y verificar que llega;
     - con la app cerrada, adelantar la fecha del sistema 7 días (dos veces) y comprobar que llega una vez por semana;
     - registrar en una semana, volver a adelantar y comprobar que no llegan dos.
  5. Tocar el resumen mensual de prueba abre el mes correcto.
  6. Con el permiso denegado, la app no insiste y Ajustes ofrece abrir los ajustes del sistema.
  7. Reiniciar el teléfono y comprobar que lo programado sigue (`RECEIVE_BOOT_COMPLETED`).

---

## 6. Riesgos y decisiones abiertas para el orquestador

### 6.1 Técnicas (no contradicen ADR-011, pero conviene registrarlas como enmienda)

1. **Deduplicación por `request.identifier` + fecha de entrega.** ADR-011 dice "por `request.identifier`". Como `cv.weekly.repeat` reusa el identifier cada semana, deduplicar solo por id descartaría el toque de la semana siguiente si el proceso sigue vivo. La clave incluye `notification.date`. Se mantiene el objetivo de ADR-011 (procesar cada respuesta una vez). El test de F7.6 se escribe con esta clave.
2. **`ScheduledNotification` incluye `unrecognized`** y el adaptador reconstruye desde `content.data`. ADR-011 fija `ScheduledNotification = PlannedNotification`. Sin la variante, un `cv.*` con payload ilegible (por ejemplo, de una versión anterior) no tendría representación y no se podría cancelar. Es un agregado al tipo.
3. **`NotificationContent` lleva `month`** en el resumen mensual (nota del orquestador en F6.0). Es un agregado.
4. **Fuente de respuestas como puerto**: en vez de llamar a `useLastNotificationResponse` en el hook, el puerto usa `getLastNotificationResponse()`, que es lo que ese hook hace por dentro, más el listener. Así el hook se prueba sin `jest.mock` del módulo. Las dos vías de ADR-011 se mantienen.
5. **`WAKE_LOCK`**: por defecto no se bloquea hasta ver el manifiesto fusionado en F7.4. Si solo lo aporta `firebase-messaging` y nada lo usa en tiempo de ejecución, el orquestador decide si se bloquea, con una prueba manual de entrega después del cambio.
6. **Entrega aproximada en Android**: sin `SCHEDULE_EXACT_ALARM`, el módulo usa `setAndAllowWhileIdle`, y en Doze puede atrasarse varios minutos (aceptado en ADR-011). Algunos fabricantes cortan alarmas de apps "dormidas"; no hay mitigación local y queda como observación en F7.10.
7. **Ícono de notificación de Android**: el plugin necesita un PNG monocromo (blanco sobre transparente). `assets/images/android-icon-monochrome.png` (432 × 432) podría servir si es blanco sobre transparente; si no, el designer entrega uno en F7.1. Sin ícono propio, Android muestra un cuadrado.
8. **Hora inexistente en el `WEEKLY`**: si la persona elige un minuto que no existe el día del cambio de hora (en Chile el cambio ocurre a las 00:00), el `WEEKLY` sigue la regla de cada plataforma, que puede atrasarlo o saltarlo esa semana. Los avisos de una sola vez siguen ADR-015. Se acepta como caso borde.
9. **D-13 con cambio de día a mitad de semana (F7.9, enmienda de ADR-011 y ADR-007).** Sin memoria, si la persona cambiaba el día después de que el aviso de la semana ya había llegado, el plan programaba otro para esa misma semana. Ahora `planNotifications` recibe `lastWeeklyFireAt` y la reconciliación lo persiste en `notification_preferences.last_weekly_fire_at` (migración `0001`, nullable, fuera del respaldo por D-28):
   - Se guarda (después de `cancel` y `schedule`) el instante del recordatorio de la semana en curso cuando el semanal está activo, todavía no llegó y no hay otro ya llegado esta semana. Un instante ya pasado no se guarda, para no dar por entregado un aviso que nunca se programó. Con el semanal apagado se borra, y sin permiso no se toca.
   - Si `lastWeeklyFireAt <= now`, cae en la semana ISO en curso y el instante calculado con las preferencias actuales todavía no llegó, el plan no programa aviso para esta semana: queda solo el respaldo de una sola vez desde la próxima semana (47 avisos neutrales, sin `cv.weekly.repeat`), tanto en el estado A como en el B. Si el nuevo instante ya pasó, rige el plan normal, porque el `WEEKLY` solo vuelve a disparar la semana siguiente.
   - Con la configuración sin cambios, el instante guardado coincide con el calculado y el plan no cambia (sin oscilar entre A y B).

### 6.2 De producto (cada una con su valor por defecto, que permite seguir)

1. **Textos de las notificaciones.** Propuesta para F7.1 (designer) y CP8:
   - `neutral`: "¿Cómo te fue esta semana?" / "Anota tus ventas o marca que no vendiste. Es un minuto.";
   - `already_registered`: "¿Te faltó anotar algo?" / "Esta semana ya está registrada. Si vendiste algo más, agrégalo.";
   - mensual: "Tu resumen de {mes} está listo" / "Mira cómo te fue en el mes.".

   **Por defecto**: estos textos, sujetos al test de tono.
2. **Importancia del canal en Android.** **Por defecto**: `DEFAULT` (suena y aparece en la barra, sin ventana emergente). La alternativa `HIGH` muestra una ventana emergente, más insistente.
3. **Resumen mensual de un mes sin ventas.** El plan se fija por adelantado, así que no puede saber si el mes tendrá ventas. **Por defecto**: llega igual (ADR-011). La alternativa (no programar el mes siguiente si el actual no tiene ventas) agrega una regla y deja meses sin aviso.
4. **"Ahora no" en la pantalla explicativa.** **Por defecto**: no se guarda nada y no vuelve a aparecer sola, porque la primera venta es una sola vez (D-36); queda "Activar recordatorios" en Ajustes. Si producto quiere ofrecerlo otra vez más adelante (por ejemplo, en la décima venta), sería una regla nueva.
5. **Cambiar la hora con el permiso denegado.** **Por defecto**: se puede cambiar y se guarda, con el aviso de que los recordatorios están apagados en el sistema. Se aplican cuando el permiso se conceda.

### 6.3 Dependencias

- **Nueva**: `expo-notifications` ~58.1.9 (ADR-011), con `npx expo install expo-notifications` y su plugin en `app.json`. No se agrega ninguna otra.
