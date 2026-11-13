# Diseño técnico — Calendario y racha (F5)

- **Tarea**: F5.0 de `docs/plan-v1.md`. Rige F5.2 a F5.5.
- **ADRs**: ADR-005, ADR-007 (regla 11: racha; regla 15: tolerancia), ADR-009, ADR-010 y ADR-015. **Decisiones**: D-01, D-03, D-18, D-25 y D-37. Base: `docs/architecture/tracking-home.md` (`YearMonth`, `trackingKeys`, `useSalesBetween`, `SaleRecordView`) y `docs/architecture/sales.md` (`activeWeekStartsBetween`, `NoSalesWeekRepository`, `noSalesWeekStatus`, `useMarkNoSales`).
- No cambia ninguna decisión aceptada. La regla de la racha se ubica en `sales/domain` (sección 1) para que `tips` la use sin depender de `tracking`, que es la dirección de ADR-005. Lo demás es aditivo. La sección 6 marca lo que hay que resolver.

---

## 1. Resumen del enfoque

- **Cuadrícula del mes como función pura** (`monthGrid`) en `shared/domain/calendar/`: semanas de lunes a domingo (D-01), con los días del mes anterior y del siguiente que completan la primera y la última fila. Va en `shared` porque la reutiliza el `DatePickerSheet` del registro de ventas (`docs/design/sales.md`, 6.2), que necesita la misma grilla.
- **El mes del calendario se arma en el dominio de `tracking`** (`buildCalendarMonth`) a partir de una sola consulta acotada: los registros y las marcas de "no vendí" del rango de la cuadrícula. Devuelve días con total, cantidad de registros, nivel de intensidad y si son hoy o futuros, y semanas con su estado de "no vendí".
- **Intensidad relativa a los propios días del mes visible**: 0 sin ventas y 1 a 3 según la proporción respecto del día de más monto del mes. Quien vende poco igual ve días "llenos" (lo valida el designer en F5.1).
- **Racha (ADR-007, regla 11)** como función pura en `sales/domain/streak.ts`, con un cargador en `sales/use-cases/load-streak.ts` que consulta **por ventanas de 26 semanas** hacia atrás y se detiene en el primer hueco. Una semana "registrada" tiene un registro activo con al menos un ítem activo, o una marca activa de "no vendí". Es la misma definición de "tiene ventas" que F3 (`sales.md`, 6.3). La semana en curso sin registrar no corta la racha. La anterior sin registrar, sí.
  - **Por qué en `sales` y no en `tracking`**: la racha se calcula solo con datos de `sales` (las dos tablas y la definición de "tiene ventas") y la necesitan dos features. `tracking` la muestra y `tips` la usa como contexto (F6, `racha`). ADR-005 prevé que `tips` dependa solo de `sales/domain` y `products/domain`. Con la regla en `tracking`, `tips` pasaría a depender de `tracking`.
- **Calendario propio, sin librería**: filas de `View` y celdas `Pressable` de los componentes base. No hay `FlatList` ni listas virtualizadas, porque son como mucho 42 celdas.
- **Detalle del día** en `/tracking/day/[date]`: total, registros del día con nombres actuales (`SaleRecordView`) y "Registrar una venta este día" si el día no es futuro (D-03).
- **"No vendí" desde el calendario (D-18)**: las semanas que están en la ventana permitida (actual y anterior) ofrecen marcar o desmarcar con los hooks de `sales`. El caso de uso vuelve a verificar todo dentro de la transacción.

---

## 2. Archivos a crear o modificar

### 2.1 `src/shared/domain/calendar/`

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `month-grid.ts` | `monthGrid(month)`: semanas de lunes a domingo que cubren el mes (4 a 6 filas) y el rango cerrado de la cuadrícula. | F5.2 |
| `index.ts` | Reexporta `month-grid`. | F5.2 |

### 2.2 `src/features/sales/` (aditivo)

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `domain/streak.ts` | `Streak`, `STREAK_SCAN_WEEKS`, `registeredWeeks(saleWeekStarts, marks)` y `streakFrom(currentWeekStart, registered)`. | F5.2 |
| `domain/index.ts` | Exporta lo anterior. | F5.2 |
| `use-cases/load-streak.ts` | `loadStreak(ports, currentWeekStart)`: ventanas de 26 semanas hacia atrás hasta encontrar un hueco. | F5.2 |
| `index.ts` | Exporta `loadStreak`, `StreakReadPorts`, `useMarkNoSales` y `useUnmarkNoSales`. | F5.3 |
| `screens/new-sale-screen.tsx` y `src/app/sales/new.tsx` | Prop opcional `initialSoldOn?: LocalDate` y parámetro de ruta `date` validado con `localDateSchema`. Si falta, es inválido o es futuro, se usa hoy. | F5.3 |

### 2.3 Feature `src/features/tracking/`

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `domain/calendar.ts` | `dailyActivity`, `intensityLevels`, `weekFactsOf` y `buildCalendarMonth`. | F5.2 |
| `domain/day-detail.ts` | `buildDayDetail(date, today, records)`: total, cantidad de registros y `canRegister`. | F5.2 |
| `hooks/query-keys.ts` (de F4) | Suma `trackingKeys.calendar(from, to)` y `trackingKeys.streak(weekStart)`. La raíz `['tracking']` ya depende de `sale_records`, `sale_items` y `no_sales_weeks`. | F5.3 |
| `hooks/use-calendar-month.ts` | `monthGrid(month).range` → una consulta con `listBetween` de ventas y de marcas → `buildCalendarMonth`. | F5.3 |
| `hooks/use-streak.ts` | `useCurrentWeek()` → `loadStreak` con `trackingKeys.streak(week.start)`. | F5.3 |
| `hooks/use-day-detail.ts` | `useSalesBetween({ start: date, end: date })` + `useProductsByIds` → `DayDetail` + `SaleRecordView[]`. | F5.3 |
| `hooks/use-week-no-sales.ts` | `noSalesWeekStatus(weekFactsOf(...), today)` sobre los datos ya cargados del mes, más `useMarkNoSales` y `useUnmarkNoSales`. | F5.3 |
| `components/month-calendar.tsx` | Encabezado de días (L a D), filas por semana y celdas; marca de semana "no vendí". Sin listas virtualizadas. | F5.3 |
| `components/calendar-day-cell.tsx` | Celda de 48 × 48 o más; la intensidad se marca con algo más que color (F5.1); `accessibilityLabel` de `dayAccessibilityLabel`. Se memoiza por día. | F5.3 |
| `components/day-label.ts` | `dayAccessibilityLabel(day)`: "12 de noviembre, 45.000 pesos, 2 ventas", "12 de noviembre, sin ventas", con "Hoy," delante si corresponde. | F5.3 |
| `components/streak-badge.tsx` | Racha con `Fire` en `accent`; la racha en 0 con tono amable (texto de F5.1). | F5.3 |
| `components/week-no-sales-action.tsx` | Marcar o desmarcar "no vendí" de una semana, o el texto de D-25 si la semana tiene ventas. | F5.3 |
| `components/day-detail-view.tsx` | Total del día con `Amount`, lista de registros (`ListRow`) y botón "Registrar una venta este día" solo si `canRegister`. | F5.3 |
| `screens/calendar-screen.tsx` (existe, provisoria) | Mes visible en `useState<YearMonth>` (empieza en el actual), `MonthSwitcher` de F4 (adelante hasta el actual), calendario, racha y acción de semana. Props: `onOpenDay(date)`. | F5.3 |
| `screens/day-detail-screen.tsx` | Props: `date`, `onOpenSale(id)`, `onRegisterSale(date)`. | F5.3 |
| `index.ts` | Suma `DayDetailScreen` y `StreakBadge` (si F5.1 la pone también en Inicio). | F5.3 |

### 2.4 Rutas (`src/app/`)

| Archivo | Responsabilidad |
|---|---|
| `(tabs)/calendar.tsx` (existe) | `CalendarScreen` con `onOpenDay(date)` → `/tracking/day/[date]`. |
| `tracking/day/[date].tsx` | `parseRouteParams(z.object({ date: localDateSchema }), params)`; inválido → `NotFoundScreen`. Válido → `DayDetailScreen` con `onOpenSale` → `/sales/[id]` y `onRegisterSale(date)` → `/sales/new?date=…`. Una fecha futura válida se muestra sin la acción de registrar. |

---

## 3. Tipos e interfaces principales (firmas)

### 3.1 Cuadrícula (`shared/domain/calendar/month-grid.ts`)
```ts
export interface MonthGrid {
  readonly month: YearMonth;
  /** Lunes de la primera fila → domingo de la última. */
  readonly range: LocalDateRange;
  /** De 4 a 6 filas de 7 fechas, de lunes a domingo. */
  readonly weeks: readonly (readonly LocalDate[])[];
}
export function monthGrid(month: YearMonth): MonthGrid;
```

### 3.2 Racha (`sales/domain/streak.ts`, `sales/use-cases/load-streak.ts`)
```ts
/** Tamaño de cada ventana de consulta hacia atrás. */
export const STREAK_SCAN_WEEKS = 26;

export interface Streak {
  /** Semanas seguidas registradas (ADR-007, regla 11). */
  readonly weeks: number;
  /** `true` si la semana en curso ya está registrada y cuenta. */
  readonly includesCurrentWeek: boolean;
  /** Lunes de la semana más antigua de la racha; `null` con racha 0. El cargador lo usa para decidir si pide otra ventana. */
  readonly oldestWeekStart: LocalDate | null;
}

/** Lunes registrados: semanas con ventas (ya filtradas por `activeWeekStartsBetween`) ∪ marcas activas. */
export function registeredWeeks(saleWeekStarts: readonly LocalDate[], marks: readonly NoSalesWeek[]): ReadonlySet<LocalDate>;

/**
 * Cuenta desde la semana en curso si está registrada; si no, desde la anterior. La anterior
 * sin registrar da 0. Retrocede de a 7 días con `addDays` (cruza el año sin casos especiales).
 */
export function streakFrom(currentWeekStart: LocalDate, registered: ReadonlySet<LocalDate>): Streak;

/** Lecturas que necesita el cargador. */
export interface StreakReadPorts {
  readonly sales: Pick<SaleRepository, 'activeWeekStartsBetween'>;
  readonly noSalesWeeks: Pick<NoSalesWeekRepository, 'listBetween'>;
}
/**
 * 1. Ventana `[currentWeekStart − 25 semanas, domingo de la semana en curso]`: lee las dos fuentes.
 * 2. `streakFrom` sobre la unión acumulada.
 * 3. Si `oldestWeekStart` es el primer lunes de la ventana, pide la ventana anterior (solo ese tramo) y repite.
 * 4. Si no, devuelve. Termina siempre: los datos son finitos y una ventana sin registros es un hueco.
 */
export function loadStreak(ports: StreakReadPorts, currentWeekStart: LocalDate): Promise<Streak>;
```

### 3.3 Mes del calendario (`tracking/domain/calendar.ts`)
```ts
/** Lo vendido en un día; solo cuentan los registros con al menos un ítem activo. */
export interface DayActivity {
  readonly date: LocalDate;
  readonly total: Clp;
  readonly recordCount: number;
}
export function dailyActivity(records: readonly SaleRecord[]): ReadonlyMap<LocalDate, DayActivity>;

/** 0 = sin ventas; 1 a 3 = poco, medio y mucho, relativo al día de más monto del mes. */
export type IntensityLevel = 0 | 1 | 2 | 3;
/**
 * Solo días del mes con actividad: nivel = max(1, ceil(3 × total / máximo)). Con máximo $0
 * (solo ventas a $0), nivel 1. Los días fuera del mes no reciben nivel.
 */
export function intensityLevels(activity: ReadonlyMap<LocalDate, DayActivity>, month: YearMonth): ReadonlyMap<LocalDate, IntensityLevel>;

export interface CalendarDay {
  readonly date: LocalDate;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  readonly isFuture: boolean;
  readonly activity: DayActivity | null;
  readonly level: IntensityLevel;
}
export interface CalendarWeek {
  readonly week: WeekRange;
  readonly days: readonly CalendarDay[];
  /** Marca activa de "no vendí" en esta semana. */
  readonly noSalesMarked: boolean;
}
export interface CalendarMonth {
  readonly month: YearMonth;
  readonly weeks: readonly CalendarWeek[];
  /** Total de los días del mes (no de los días de relleno). */
  readonly monthTotal: Clp;
}
export function buildCalendarMonth(
  month: YearMonth,
  today: LocalDate,
  records: readonly SaleRecord[],
  marks: readonly NoSalesWeek[],
): CalendarMonth;

/** `WeekFacts` de F3 a partir de los datos ya cargados ("tiene ventas" = `hasItems`). */
export function weekFactsOf(week: WeekRange, records: readonly SaleRecord[], marks: readonly NoSalesWeek[]): WeekFacts;
```

### 3.4 Detalle del día (`tracking/domain/day-detail.ts`)
```ts
export interface DayDetail {
  readonly date: LocalDate;
  readonly total: Clp;
  readonly recordCount: number;
  /** D-03: `false` si `date > today`. */
  readonly canRegister: boolean;
}
export function buildDayDetail(date: LocalDate, today: LocalDate, records: readonly SaleRecord[]): DayDetail;
```

### 3.5 Hooks y screens
```ts
/** Clave con el rango de la cuadrícula; la consulta trae ventas y marcas juntas. */
// trackingKeys.calendar(from, to) = ['tracking', 'calendar', from, to]
// trackingKeys.streak(weekStart)  = ['tracking', 'streak', weekStart]

export function useCalendarMonth(month: YearMonth): { readonly status: 'pending' | 'error' | 'ready'; readonly calendar: CalendarMonth | null };
export function useStreak(): UseQueryResult<Streak>;
export function useDayDetail(date: LocalDate): { readonly status: 'pending' | 'error' | 'ready'; readonly detail: DayDetail | null; readonly records: readonly SaleRecordView[] };
export function useWeekNoSales(week: WeekRange, calendar: CalendarMonth | null): {
  readonly status: NoSalesWeekStatus | null;
  readonly mark: () => void;
  readonly unmark: () => void;
  readonly isPending: boolean;
};

export interface CalendarScreenProps { readonly onOpenDay: (date: LocalDate) => void }
export interface DayDetailScreenProps {
  readonly date: LocalDate;
  readonly onOpenSale: (id: SaleRecordId) => void;
  readonly onRegisterSale: (date: LocalDate) => void;
}
```
- `useCalendarMonth` usa `useToday()` solo para `isToday`/`isFuture` dentro de `select`. La key depende del rango y no de hoy. Así, al pasar la medianoche no se vuelve a consultar: solo se recalcula el `select`.
- `useWeekNoSales` usa `noSalesWeekStatus` de `sales/domain` (D-18 y D-25). No reimplementa la ventana.

---

## 4. Flujo de datos y manejo de estado

### 4.1 Calendario
```
CalendarScreen  month = useState(yearMonthOf(today))
  useCalendarMonth(month)
    range = monthGrid(month).range
    key ['tracking','calendar',range.start,range.end]
    queryFn: Promise.all([sales.listBetween(range), noSalesWeeks.listBetween(range)])
    select:  buildCalendarMonth(month, today, records, marks)
  MonthCalendar ─► CalendarDayCell ─► onOpenDay(date) ─► /tracking/day/[date]
  useStreak() ─► StreakBadge (dónde se muestra: F5.1)
  Semana actual y anterior visibles ─► useWeekNoSales ─► WeekNoSalesAction
       mark ─► useMarkNoSales({ weekStart }) ─► markNoSales (verifica en la transacción)
       ─► DataChanges {no_sales_weeks} ─► invalida ['tracking'] y ['no-sales-weeks']
       ─► el calendario muestra la marca y la racha se recalcula
```

### 4.2 Racha
```
useStreak()  week = useCurrentWeek()
  key ['tracking','streak',week.start]
  queryFn: loadStreak({ sales, noSalesWeeks }, week.start)
     ventana 1: [week.start − 175 días, week.end] → activeWeekStartsBetween + listBetween
     streakFrom → si llega al borde de la ventana, ventana 2: [− 182 días, borde − 1], …
```
- **Al guardar** una venta, borrarla, marcar o desmarcar: se invalida `['tracking']` y se recarga.
- **Al empezar una semana**: `useCurrentWeek()` cambia el lunes y la key → se consulta de nuevo. La semana nueva todavía no está registrada, así que la racha se mantiene (cuenta desde la anterior) con `includesCurrentWeek: false`.
- Costo: con uso normal, una ventana (dos consultas indexadas). Una racha de 2 años son 5 ventanas.

### 4.3 Detalle del día
```
/tracking/day/2026-11-12 ─► parseRouteParams(localDateSchema) ─► DayDetailScreen
  useDayDetail(date): useSalesBetween({date, date}) + useProductsByIds → DayDetail + SaleRecordView[]
  tocar un registro ─► onOpenSale(id) ─► /sales/[id]
  canRegister ─► "Registrar una venta este día" ─► onRegisterSale(date) ─► /sales/new?date=2026-11-12
```

### 4.4 Estado
- Persistido: TanStack Query bajo `['tracking']` (ventas, marcas y racha) y `['products']` (nombres).
- UI: el mes visible del calendario es `useState` de la screen. El calendario es una pestaña y no recibe enlaces externos. El día del detalle va en la URL.
- Render: a lo sumo 42 celdas memoizadas (`React.memo` por `CalendarDay`; el React Compiler de ADR-013 también ayuda). Cambiar de mes reemplaza las filas sin listas anidadas.

---

## 5. Tests que el code-writer escribe primero

### 5.1 Dominio (`node`, F5.2)
1. `monthGrid`:
   - febrero de 2027, que empieza en lunes y tiene 28 días: 4 filas exactas, del 1 al 28;
   - noviembre de 2026, que empieza en domingo: 6 filas, del 26 de octubre al 6 de diciembre;
   - febrero bisiesto (2028);
   - diciembre que cruza a enero;
   - toda fila empieza en lunes y tiene 7 días.
2. `dailyActivity`: suma por día; un registro sin ítems no cuenta; dos registros del mismo día dan `recordCount` 2.
3. `intensityLevels` (los del plan):
   - días sin ventas → sin nivel (0 en `CalendarDay`);
   - el máximo → 3;
   - empates en el máximo → 3 los dos;
   - un único día con ventas → 3;
   - proporciones de 1/3 y 2/3 en los bordes;
   - solo ventas a $0 → 1;
   - los días de relleno de otro mes no afectan el máximo.
4. `buildCalendarMonth`: `isToday` e `isFuture` según `today`; una semana marcada da `noSalesMarked`; `monthTotal` excluye los días de relleno.
5. `weekFactsOf` + `noSalesWeekStatus`: una semana con un registro sin ítems sigue siendo `markable`.
6. `streakFrom` y `loadStreak` (los del plan, con dobles en memoria de los dos repositorios):
   - una semana actual sin registrar no corta, pero una anterior sin registrar sí (racha 0);
   - "no vendí" cuenta;
   - los registros borrados y los registros sin ítems no cuentan;
   - la racha cruza el cambio de año (lunes 2026-12-28 → 2027-01-04);
   - una racha de 30 semanas pide exactamente 2 ventanas y una de 3, una sola (espía en el doble);
   - una racha que termina justo en el borde de la ventana pide la siguiente y se detiene en el hueco;
   - `includesCurrentWeek` en los dos casos.
7. Con `FakeClock` el domingo a las 23:59 y el lunes a las 00:00 (`test:tz`, tres zonas): el domingo, una venta de ese día cuenta en la semana en curso; el lunes, esa misma semana pasa a ser la anterior y la racha no cambia.
8. `buildDayDetail`: `canRegister` es `true` hoy y en el pasado y `false` mañana.

### 5.2 Datos (`node`, F5.2, si hace falta)
9. Ya cubiertos por F3.3 (`activeWeekStartsBetween` y `listBetween`). Se agrega un caso de contrato: las dos fuentes con la misma semana no la duplican en `registeredWeeks`.

### 5.3 Hooks, componentes y screens (`ui`, F5.3)
10. Los del plan:
    - la etiqueta accesible de cada día dice la fecha y lo vendido ("12 de noviembre, 45.000 pesos, 2 ventas"); un día sin ventas dice "sin ventas" y hoy empieza con "Hoy,";
    - se puede cambiar de mes y no se puede pasar del mes actual;
    - tocar un día llama a `onOpenDay` con su fecha;
    - un día futuro no ofrece registrar;
    - la racha se actualiza al guardar (`dataChanges`) y al empezar una semana nueva (`advanceClockAndTimers` cruzando el domingo a las 23:59).
11. `useCalendarMonth` hace **una** consulta por mes (dos lecturas en paralelo) y no consulta de nuevo al cruzar la medianoche dentro del mismo mes.
12. La intensidad se distingue sin color (F5.1: tamaño, forma o texto), verificable por la etiqueta o por el `testID` de la variante.
13. `WeekNoSalesAction`: en la semana actual sin ventas se ofrece marcar; en la anterior también (D-18); con ventas se ve el texto de D-25; dos semanas atrás no se ofrece nada; marcar actualiza el calendario y la racha sin invalidar a mano.
14. Racha en 0: texto amable sin culpa (patrones compartidos con F6.4 y F7.2).
15. Rutas (`src/__tests__/tracking-routes.test.tsx`): `/tracking/day/2026-02-30` → `NotFoundScreen`; una fecha válida abre el detalle; "Registrar una venta este día" navega a `/sales/new?date=…` y el registro arranca con esa fecha. `/sales/new?date=<mañana>` arranca en hoy.
16. Render: `MonthCalendar` no usa `FlatList`/`SectionList`/`VirtualizedList` (test que recorre el árbol; foco del reviewer en F5.4).

### 5.4 E2E al cierre (F5.5, `e2e/maestro/tracking/calendar-*.yaml`, pendiente de entorno)
- `calendar-marked-days.yaml`: con ventas creadas por los subflujos de F0.15, los días aparecen marcados con su etiqueta.
- `calendar-day-detail.yaml`: abrir el detalle de un día y desde ahí una venta.
- `calendar-no-sales-streak.yaml`: marcar "no vendí" en la semana actual y ver la racha en 1 (o en N + 1 si había racha).
- F5 no agrega migraciones.

---

## 6. Riesgos y decisiones abiertas para el orquestador

### Técnicas
1. **La racha vive en `sales/domain` y `sales/use-cases`**, no en `tracking/domain` como sugiere el título de F5.2. Es la única forma de que `tips` la use sin una dependencia `tips → tracking`, que ADR-005 no prevé. F5.2 escribe esos tests en `sales`. No cambia ningún ADR.
2. **`loadStreak` lee las dos fuentes fuera de una transacción.** Una escritura entre las dos lecturas puede dar un valor viejo por un instante, pero la invalidación posterior lo corrige. No se justifica una lectura transaccional.
3. **`monthGrid` en `shared`.** Si F3.6 ya implementó la grilla del `DatePickerSheet` por su cuenta, F5.2 la reemplaza por `monthGrid` para no tener dos.
4. **Cambio aditivo en `sales`**: `initialSoldOn` en `NewSaleScreen` y el parámetro `date` en `/sales/new`. Si F3.7 está en curso, conviene sumarlo en F5.3 y no antes.
5. **Filas variables (4 a 6).** El alto del calendario cambia entre meses. Si el designer prefiere un alto fijo, se agrega a `monthGrid` la opción de completar siempre 6 filas, sin cambiar a los consumidores.

### De producto (cada una con valor por defecto)
6. **Intensidad.** Por defecto, relativa al **día de más monto del mes visible** y por monto (coherente con D-20), en 3 niveles. La alternativa es por cantidad de registros, o por cuantiles de los días con venta, que reparte mejor si hay un día excepcional. La valida el designer en F5.1.
7. **Qué cuenta como "2 ventas" en la etiqueta del día.** Por defecto, la cantidad de **registros** del día (no de unidades).
8. **Dónde se marca "no vendí" en el calendario.** Por defecto, una acción por semana, solo en la semana actual y en la anterior (D-18), visible en el calendario. El designer decide si va en la fila de la semana o en el detalle del día.
9. **Dónde se muestra la racha.** Por defecto, en Calendario y en Inicio (F5.1 decide). El hook y el componente sirven para los dos.
10. **Cambio de mes al pasar la medianoche del último día.** Por defecto, el calendario abierto se queda en el mes que se estaba viendo (la pestaña conserva su estado). Al reiniciar la app empieza en el mes actual.

Ninguna pregunta bloquea F5.2 con los valores por defecto. La 6 cambia los tests de `intensityLevels`, así que conviene confirmarla en F5.1, antes de F5.2.
