# ADR-015: Fechas y zonas horarias

- **Estado**: Aceptado
- **Fecha**: 2026-11-13
- **Origen**: hallazgo I5 del reviewer sobre ADR-005 a ADR-013.

## Contexto
- La app usa dos clases de tiempo:
  - **fechas de negocio**: el día de una venta, la semana de "no vendí", el mes de un resumen;
  - **instantes técnicos**: `created_at` y los disparos de notificaciones.
- Chile tiene horario de verano, y **el cambio de hora ocurre a medianoche**:
  - al adelantar el reloj, las 00:00 de ese día no existen;
  - al atrasarlo, las 23:00 a 23:59 ocurren dos veces.

  Cualquier código que calcule "el inicio del día" como un instante, o que sume `24 * 3600 * 1000` para pasar al día siguiente, falla esos días.
- Zonas relevantes: `America/Santiago` (continental, con cambio de hora), `Pacific/Easter` (Isla de Pascua, con cambio de hora y otro desfase) y `America/Punta_Arenas` (Magallanes, UTC-3 fijo, sin cambio de hora).
- El soporte de `Intl` con zonas IANA en Hermes depende de la plataforma, y no se encontró documentación oficial que lo garantice en iOS y Android. Tampoco se encontró confirmación de que un polyfill de Temporal funcione en Hermes. Jest corre en Node con otro `Intl`.

## Opciones consideradas
| Opción | Pros | Contras |
|---|---|---|
| **`@date-fns/tz` 1.5.0 (zonas IANA vía `Intl`)** | API conocida. | Depende de `Intl.DateTimeFormat` con `timeZone` en Hermes, sin verificar; podría necesitar el polyfill de FormatJS con datos de zonas. |
| **Polyfill de Temporal** | Es el modelo correcto (`PlainDate`, `ZonedDateTime`). | No está verificado en Hermes; pesa bastante. |
| **Aritmética de calendario pura + conversión solo en la zona del dispositivo con `Date` local** | Sin dependencias. La app **nunca necesita una zona distinta de la del dispositivo**. `Date` local usa la base de zonas del sistema operativo en ambas plataformas. Comportamiento igual en Node si se fija `TZ`. | Las conversiones dependen de la zona del proceso, así que los tests tienen que fijarla. |

## Decisión
**Aritmética de calendario pura para `LocalDate`, y una única frontera de conversión instante ↔ fecha local, en la zona del dispositivo, detrás del puerto `LocalCalendar`. Sin librerías de fechas ni `Intl`.**

Se aparta en parte de la sugerencia del reviewer (usar una librería IANA): como la app solo convierte en la zona del dispositivo, una librería IANA agregaría una dependencia sin verificar en Hermes y no aportaría nada. Si algún día hace falta otra zona (por ejemplo, un servidor), se reevalúa en un ADR nuevo.

### Reglas
1. **`LocalDate` (`YYYY-MM-DD`) solo se manipula con aritmética de calendario pura** en `shared/domain/calendar/`:
   - sumar días;
   - lunes de la semana ISO;
   - primer y último día del mes;
   - diferencia en días;
   - día ISO de la semana.

   Se implementa con un número de día civil (algoritmo *days from civil*), sin `Date`. **Nunca** se convierte una `LocalDate` a instante para hacer aritmética.
2. **Prohibido calcular "inicio del día" como instante** y prohibido sumar milisegundos para cambiar de día. Las consultas por período filtran por `sold_on` (`TEXT`), nunca por instantes (ADR-007).
3. **Única frontera de conversión**: el puerto `LocalCalendar`, implementado con `Date` local:
   - `localDateOf(instant)` lee año, mes y día locales del instante;
   - `instantAt(date, minuteOfDay)` construye la hora local de pared.

   Para un minuto inexistente (salto hacia adelante), se usa el primer minuto válido posterior. Para un minuto repetido (salto hacia atrás), se usa la primera ocurrencia. Ambas reglas se verifican con tests en lugar de confiar en la implementación del motor.
4. **Instantes técnicos** (`EpochMs`) solo para auditoría, orden y disparos. Nunca se usan para decidir a qué día pertenece una venta.
5. **Nombres de meses y días** con un catálogo propio (ADR-010), no con `toLocaleDateString`.
6. **Cambio de zona del dispositivo** (viaje o cambio de configuración): las ventas conservan su `LocalDate`. La siguiente reconciliación de notificaciones (al volver a primer plano) reprograma en la zona nueva.

```ts
/**
 * Frontera entre instantes y fechas locales en la zona horaria del dispositivo.
 * Es la única pieza que interpreta zonas; el resto del dominio usa `LocalDate`.
 */
export interface LocalCalendar {
  /** Fecha local del dispositivo en la que cae el instante. */
  localDateOf(instant: EpochMs): LocalDate;
  /**
   * Instante correspondiente a una hora local de pared.
   * Si el minuto no existe por un cambio de hora, devuelve el primer minuto válido posterior;
   * si existe dos veces, devuelve la primera ocurrencia.
   */
  instantAt(date: LocalDate, minuteOfDay: number): EpochMs;
  /** Instante de la próxima medianoche local después de `instant`, para refrescar "hoy". */
  nextLocalMidnight(instant: EpochMs): EpochMs;
}

/** Suma días a una fecha local con aritmética de calendario pura. */
export function addDays(date: LocalDate, days: number): LocalDate;

/** Lunes de la semana ISO que contiene la fecha. */
export function isoWeekStart(date: LocalDate): LocalDate;

/** Día ISO de la semana (1 = lunes, 7 = domingo). */
export function isoWeekday(date: LocalDate): IsoWeekday;

/** Primer y último día del mes de la fecha. */
export function monthRange(date: LocalDate): { readonly start: LocalDate; readonly end: LocalDate };
```

`nextLocalMidnight` se calcula como `instantAt(addDays(localDateOf(instant), 1), 0)`, aplicando la regla del minuto inexistente. `useToday()` (ADR-009) despierta en ese instante o como máximo cada hora, lo que ocurra primero, y vuelve a calcular `localDateOf(now)`. Así un temporizador desfasado no lo afecta.

### Tests
- **Aritmética pura**: bisiestos (2028-02-29), cambios de año y semanas ISO que cruzan el año. Propiedades: `addDays(addDays(d, n), -n) = d` e `isoWeekStart` siempre devuelve un lunes.
- **`LocalCalendar` con fixtures por zona**: Jest fija `TZ` (ADR-013), y el script `test:tz` repite la suite en `America/Santiago`, `Pacific/Easter` y `America/Punta_Arenas`. Para cada zona:
  - la fecha local de instantes cercanos a la medianoche;
  - `instantAt` en el día de salto hacia adelante, con 00:00 inexistente, y en el de salto hacia atrás;
  - `nextLocalMidnight` en ambos días;
  - un recordatorio del domingo a las 20:00 en la semana de cada cambio de hora.

  Las fechas de transición se toman de la base IANA vigente cuando se escriben los fixtures, y el test verifica que la zona del proceso sea la esperada antes de afirmar nada.
- **En dispositivo** (E2E o manual): con el teléfono en `America/Santiago`, verificar `localDateOf` e `instantAt` en Hermes contra los mismos casos, desde una pantalla de diagnóstico disponible solo en el build E2E.

## Consecuencias
- No se agregan dependencias de fechas. Todo el dominio trabaja con `LocalDate`, y las conversiones están en un solo lugar.
- Las notificaciones (ADR-011), "hoy" y "esta semana" (ADR-009), la racha y los resúmenes (ADR-007) usan las mismas reglas.
- Si en el futuro hace falta una zona distinta de la del dispositivo, solo cambia la implementación de `LocalCalendar`.
