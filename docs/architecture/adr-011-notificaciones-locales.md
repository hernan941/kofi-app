# ADR-011: Notificaciones locales

- **Estado**: Aceptado
- **Fecha**: 2026-11-12 (revisado 2026-11-13 tras la revisión del reviewer)
- **Versiones verificadas**: `expo-notifications` ~58.1.9 (SDK 58), revisada en su `build/*.d.ts` y en el código del plugin:
  - **Triggers**: `SchedulableTriggerInputTypes` incluye `DATE`, `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`, `CALENDAR` (solo iOS) y `TIME_INTERVAL`. En `WEEKLY`, el `weekday` va de 1 a 7, **con 1 = domingo** (distinto del ISO que usa el dominio).
  - **Funciones**: existen `getAllScheduledNotificationsAsync`, `useLastNotificationResponse` y `clearLastNotificationResponseAsync`.
  - **Plugin**: `enableRemoteNotifications` es **solo de iOS** (por defecto `true`; agrega el entitlement `aps-environment`).
  - **Comportamiento según la documentación oficial**: desde SDK 58 las notificaciones se muestran en primer plano salvo que `setNotificationHandler` indique otra cosa. En Android 13+ el aviso de permiso no aparece hasta que existe un canal. En Android 14+ `SCHEDULE_EXACT_ALARM` está denegado por defecto, y sin él la entrega es aproximada.

## Contexto
- **Recordatorio semanal**: domingo a las 20:00 por defecto, configurable o desactivable. **El texto se adapta** a si ya se registró la semana.
- **Resumen mensual**: el día 1, "tu resumen de <mes> está listo". Se puede desactivar.
- Nunca mensajes de culpa. Solo notificaciones locales.

El contenido de una notificación local se fija al programarla.

## Opciones consideradas
`docs/product.md` fija que, si la persona deja de abrir la app, el recordatorio semanal **sigue llegando** con un texto neutro y amable, sin datos de la semana.

| Opción | Pros | Contras |
|---|---|---|
| **`WEEKLY` repetitivo con texto fijo** | Simple; nunca se termina. | No adapta el texto. |
| **Repetitivo + tarea en segundo plano** (`expo-background-task`) | Teóricamente adaptable. | iOS no garantiza que la tarea corra. |
| **Solo notificaciones de una sola vez (`DATE`) en una ventana deslizante** | Adapta el texto. | Se terminan si no se abre la app. Contradice `docs/product.md`. |
| **Híbrido: aviso de una sola vez adaptado para la semana en curso + `WEEKLY` neutro de respaldo** (propuesto por el reviewer, decidido por producto) | Adapta el texto y nunca se termina. | Un trigger repetitivo no tiene fecha de inicio (el SDK no la admite y empieza en la próxima coincidencia), así que si conviven en la misma semana, **ambos disparan a la misma hora**. Se resuelve con los dos estados de abajo. |

## Decisión
**Híbrido sin duplicados, con dos estados que decide una función pura, aplicado por un reconciliador serializado que solo cambia lo necesario.**

### Estados del recordatorio semanal
Sea `T` el instante del recordatorio de la semana en curso.

- **Estado A (repetitivo)**: la semana en curso **no** está registrada, **o** `T` ya pasó.
  - Se programa **solo** el trigger `WEEKLY` con el texto neutro.
  - Es correcto también en las semanas futuras sin abrir la app: sin abrirla no se puede registrar (todo es local), así que el texto neutro, que invita a registrar o a marcar "no vendí" sin datos de la semana, siempre corresponde.
- **Estado B (adaptado)**: la semana en curso **ya está registrada** y `T` todavía no llegó. Es el único caso en que el texto tiene que ser distinto.
  - Se **cancela** el `WEEKLY`.
  - Se programa un aviso de una sola vez en `T`, con la variante `already_registered` ("¿te faltó anotar algo?").
  - **Como respaldo**, se programan avisos de una sola vez con el texto neutro para las 47 semanas siguientes.
  - En la primera reconciliación después de `T` (cualquier apertura de la app) se vuelve al estado A. Si la app no se vuelve a abrir, el recordatorio sigue llegando casi un año.
- **Garantía contra duplicados**: nunca hay un `WEEKLY` y un aviso de una sola vez para la misma semana. Se evaluó la variante de "arrancar el `WEEKLY` desde la semana siguiente a la última adaptada" y **no es posible**: el trigger no admite fecha de inicio. En iOS (`SchedulerModule.swift`, tipo `weekly`) se traduce a un trigger de calendario repetitivo que dispara en la próxima coincidencia. En Android (`NotificationTriggers.kt`) la próxima fecha se calcula desde el momento de programarlo. Por eso, en la semana adaptada el respaldo se cubre con avisos de una sola vez (estado B), y el `WEEKLY` se vuelve a programar recién cuando ya no puede coincidir con un aviso adaptado (estado A). La alternativa de usar solo avisos de una sola vez con una ventana larga equivale al estado B permanente. Se prefiere el `WEEKLY` en el estado A porque no caduca nunca.
- **`WEEKLY` verificado en SDK 58** (`expo-notifications` 58.1.9): implementado en iOS y en Android.
- **Presupuesto de iOS** (64 pendientes por app): en el estado B son 48 semanales y 12 mensuales, 60 en total.

### Resumen mensual
- Avisos de una sola vez el día 1 de cada uno de los **12 meses siguientes**, **a las 10:00** (decisión), con el nombre del mes.
- Se recalculan en cada reconciliación, así que con uso normal no se terminan nunca.
- Sin abrir la app durante un año, se detienen. **Decisión**: se acepta. `docs/product.md` solo exige continuidad para el recordatorio semanal, y un resumen sin datos nuevos no aporta.

### Planificación (dominio puro)
```ts
/** Tipo de notificación programada por la app. */
export type NotificationKind = 'weekly_reminder' | 'monthly_summary';

/** Variante del texto del recordatorio semanal. */
export type WeeklyReminderVariant = 'already_registered' | 'neutral';

/** Ruta interna a la que lleva tocar la notificación. */
export type NotificationDeepLink = '/sales/new' | '/tracking/monthly';

/** Contenido visible y destino de una notificación. */
export interface NotificationContent {
  readonly title: string;
  readonly body: string;
  readonly deepLink: NotificationDeepLink;
}

/** Notificación a programar: de una sola vez o semanal repetitiva. */
export type PlannedNotification =
  | {
      readonly identifier: string;
      readonly kind: NotificationKind;
      readonly trigger: { readonly type: 'once'; readonly fireAt: EpochMs };
      readonly content: NotificationContent;
    }
  | {
      readonly identifier: string;
      readonly kind: 'weekly_reminder';
      readonly trigger: {
        readonly type: 'weekly';
        readonly weekday: IsoWeekday;
        readonly minuteOfDay: number;
      };
      readonly content: NotificationContent;
    };

/** Datos necesarios para planificar, sin dependencias de plataforma. */
export interface NotificationPlanInput {
  readonly now: EpochMs;
  readonly calendar: LocalCalendar;
  readonly preferences: NotificationPreferences;
  readonly currentWeekRegistered: boolean;
  readonly fallbackWeeks: number;
  readonly monthsAhead: number;
}

/**
 * Calcula las notificaciones que deberían estar programadas a partir de ahora
 * (estado A o B del recordatorio semanal, más los resúmenes mensuales).
 *
 * @returns Plan sin instantes pasados y sin dos avisos para la misma semana.
 */
export function planNotifications(input: NotificationPlanInput): readonly PlannedNotification[];

/** Notificación ya programada en el sistema, normalizada por el adaptador. */
export type ScheduledNotification = PlannedNotification;

/** Cambios necesarios para que lo programado coincida con el plan. */
export interface NotificationDiff {
  readonly toCancel: readonly string[];
  readonly toSchedule: readonly PlannedNotification[];
}

/**
 * Compara el plan con lo programado por identificador. Reprograma solo
 * lo que falta o lo que cambió de trigger o de contenido.
 */
export function diffNotifications(
  plan: readonly PlannedNotification[],
  scheduled: readonly ScheduledNotification[],
): NotificationDiff;

/**
 * Convierte el día ISO del dominio (1 = lunes) al `weekday` del trigger
 * `WEEKLY` de expo-notifications (1 = domingo).
 */
export function toExpoWeekday(day: IsoWeekday): number;
```

- **Identificadores deterministas**: `cv.weekly.repeat`, `cv.weekly.2026-11-16` y `cv.monthly.2026-12`. El prefijo `cv.` permite ignorar notificaciones ajenas.
- **Instantes**: `calendar.instantAt(localDate, minuteOfDay)` (ADR-015) para los avisos de una sola vez. El `WEEKLY` usa la hora local de pared del sistema, que sigue los cambios de horario sola.
- **Textos**: un catálogo en español con las variantes `already_registered` y `neutral` y el resumen mensual con nombre de mes (catálogo propio, ADR-010). Un test verifica que ningún texto coincide con los patrones de culpa acordados con producto y que el texto neutro no menciona datos de la semana.

### Reconciliación
```ts
/** Puerto hacia el sistema de notificaciones del dispositivo. */
export interface NotificationScheduler {
  getPermission(): Promise<NotificationPermission>;
  /** Pide el permiso al sistema; solo se llama desde una acción del usuario. */
  requestPermission(): Promise<NotificationPermission>;
  /** Lista las notificaciones de la app (prefijo `cv.`) ya programadas, normalizadas. */
  listScheduled(): Promise<readonly ScheduledNotification[]>;
  cancel(identifiers: readonly string[]): Promise<void>;
  schedule(notifications: readonly PlannedNotification[]): Promise<void>;
}

/** Permiso de notificaciones simplificado para la UI. */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';
```

- **Cola serializada en la que gana la última**: `NotificationReconciler.request()` encola una reconciliación.
  - Si hay una en curso, marca "pendiente". Al terminar la actual se ejecuta **una sola** más, con los datos del momento; las solicitudes intermedias se descartan.
  - Así nunca corren dos a la vez ni se intercalan `cancel` y `schedule`.
- **Cada reconciliación**:
  1. Lee las preferencias y las semanas registradas.
  2. Planifica (estado A o B).
  3. Lee lo programado con `listScheduled` (`getAllScheduledNotificationsAsync` filtrado por prefijo).
  4. Aplica `diffNotifications`.
  5. Si el permiso no está concedido, el plan es vacío: cancela todo lo de la app.
- **Disparadores**:
  - el arranque;
  - la vuelta a primer plano (`AppState`, con limpieza);
  - `DataChanges` que toque `sale_records`, `sale_items`, `no_sales_weeks` o `notification_preferences` (ADR-009);
  - el fin de una restauración;
  - **la concesión del permiso**.

  La feature `sales` no llama a las notificaciones: el disparo llega por `DataChanges` (ADR-005).
- **Adaptador** `ExpoNotificationScheduler` en `features/notifications/adapters/`: usa triggers `DATE` y `WEEKLY` (con `toExpoWeekday`) en el canal de Android `reminders` y convierte los triggers leídos a `ScheduledNotification`. Tiene tests propios con `jest.mock('expo-notifications')`.

### Permisos
- **No se piden al primer arranque**, sino **después de guardar la primera venta** (decisión), con una pantalla previa en tono cálido. También se pueden activar desde Ajustes.
- **Android**: el canal `reminders` se crea **antes** de pedir el permiso. No se pide `SCHEDULE_EXACT_ALARM`.
- **iOS**: se piden alerta y sonido, sin badge. **Decisión**: no se usa la autorización provisional, porque los avisos silenciosos no cumplirían la función de recordatorio.
- Si se deniega, Ajustes muestra el estado y ofrece `Linking.openSettings()`. Nunca se insiste.
- **Plugin**: `enableRemoteNotifications: false` (iOS), para no declarar el entitlement de push. En Android la app no declara push porque no usa FCM ni `google-services.json`.

### Al tocar la notificación
- Se escuchan **ambas vías**: `useLastNotificationResponse` para el arranque en frío y `addNotificationResponseReceivedListener` (con limpieza) para la app abierta. Se **deduplican por `request.identifier`**, guardando en memoria el último identificador procesado.
- Después de procesar, se llama a `clearLastNotificationResponseAsync()` para que no se repita en el próximo arranque.
- **Se espera a que el router esté listo** (el navegador raíz montado, con `useRootNavigationState()` y su `key` definida) antes de `router.push`.
- `data` se valida con Zod (ADR-010). Si no es válida, se abre Inicio.
- `setNotificationHandler` se define explícitamente: en primer plano se muestra un banner sin sonido.

## Consecuencias
- "Qué y cuándo notificar" y "qué cambiar" son funciones puras con tests exhaustivos:
  - transiciones A → B → A;
  - **ausencia de duplicados por semana** en todo plan;
  - presupuesto de 64 pendientes;
  - cambio de horario en las tres zonas de ADR-015;
  - día configurado igual a hoy, antes y después de la hora;
  - fin de mes;
  - desactivaciones;
  - diferencias sin cambios.
- La cola en la que gana la última evita carreras con disparos simultáneos (por ejemplo, guardar y volver a primer plano a la vez). Tiene un test con un scheduler falso lento.
- El recordatorio semanal sigue llegando aunque no se abra la app: indefinidamente en el estado A y casi un año en el estado B, plazo que se renueva con cualquier apertura.
- Si se desactiva en Ajustes, el plan queda vacío y se cancela todo.
- En Android la hora puede variar unos minutos.
- La entrega real se verifica a mano en dispositivo; Maestro no controla bien las notificaciones del sistema.

## Enmienda 2026-11-13 (F7.0)
Agregados aceptados por el orquestador (no cambian la decisión), detallados en `docs/architecture/notifications.md`:
1. La deduplicación de respuestas usa `request.identifier` + fecha de entrega (`cv.weekly.repeat` repite el identifier cada semana).
2. `ScheduledNotification` suma la variante `unrecognized`, para cancelar avisos `cv.*` con payload ilegible.
3. El contenido del resumen mensual lleva `month` y abre `/tracking/monthly?month=…`.
4. Las respuestas llegan por un puerto sobre `getLastNotificationResponse` + listener.
5. Permisos de Android: no hacen falta `VIBRATE` ni `ACCESS_NETWORK_STATE` (bloqueados); se bloquea también `com.google.android.c2dm.permission.RECEIVE`. `WAKE_LOCK` se decide tras ver el manifiesto fusionado (F7.4).

## Enmienda 2026-11-14 (F7.9)
D-13 se cumple siempre: la reconciliación persiste en `notification_preferences.last_weekly_fire_at` el instante del recordatorio semanal de la semana en curso que planifica. Si ese instante ya pasó y cae en la semana en curso, y el nuevo instante todavía no llega (la persona cambió el día a mitad de semana), el plan no programa otro aviso para esa semana y deja solo el respaldo desde la próxima. Detalle en `docs/architecture/notifications.md`, 6.1 punto 9.
