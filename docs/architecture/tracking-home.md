# Diseño técnico — Inicio y resumen mensual (F4)

- **Tarea**: F4.0 de `docs/plan-v1.md`. Rige F4.2 a F4.6.
- **ADRs**: ADR-005, ADR-007 (reglas 7, 9 y 15; `approximateProfit`), ADR-009 (puntos 5 y 6), ADR-010 (rutas) y ADR-015. **Decisiones**: D-11, D-15, D-19, D-20, D-26 y D-30. Base: `docs/architecture/sales.md` (tipos, `effectiveUnitCost`, `SaleRepository`, `SaleRecordView`) y `docs/architecture/products.md` (`currentCostsFor`).
- Este documento no cambia ninguna decisión aceptada. Suma de forma aditiva un método a `SaleRepository` (`earliestSoldOn`), un módulo de meses en `shared/domain/calendar/` y algunas exportaciones al `index.ts` de `sales`. La sección 6 marca lo que el orquestador tiene que resolver.

---

## 1. Resumen del enfoque

- **`features/tracking/` es una feature de solo lectura** sobre los datos de `sales` y `products` (`products` ← `sales` ← `tracking`, ADR-005). No escribe nada y no define tablas.
- **Todo cálculo es una función pura de `tracking/domain/`** sobre `SaleRecord[]` de un rango acotado: totales, comparación suave (D-19), resumen mensual (D-20), últimas ventas y ganancia aproximada (`approximateProfit` de ADR-007, con el mapa `currentCostByVersion` explícito, D-26). Los hooks solo eligen rangos, consultan y llaman al dominio. Los componentes no calculan nada.
- **Una sola consulta para Inicio**: el rango `[primer día del mes anterior, hoy]` cubre la semana actual, el tramo equivalente de la semana anterior, el mes actual y el tramo equivalente del mes anterior (sección 4.1). El rango sale de `useToday()` y forma parte de la key, así que se renueva al cambiar el día (ADR-009, punto 6).
- **Costos actuales solo cuando hacen falta**: el hook de ganancia pide `ProductRepository.currentCostsFor` únicamente con las versiones de ítems **sin** `unitCost` copiado, y su key depende de `product_versions`.
- **Resumen mensual en `/tracking/monthly?month=YYYY-MM`**, con el mes validado por un esquema Zod nuevo (`yearMonthSchema`) en `shared/domain/calendar/`. Es el destino del aviso mensual de F7 y permite navegar hacia atrás hasta el primer mes con ventas (D-30).
- **Nombres actuales**: las ventas pasadas muestran el nombre **actual** del producto y un indicador si está archivado, con el mismo armado que el detalle de venta de F3 (`SaleRecordView`).
- **Sin consejos en Inicio** (D-11). Inicio no importa nada de `tips`.

---

## 2. Archivos a crear o modificar

### 2.1 `src/shared/domain/calendar/` (transversal)

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `year-month.ts` | `yearMonthSchema` y `YearMonth` (`YYYY-MM` con marca), `yearMonthOf(date)`, `addMonths(month, n)`, `monthRangeOf(month)`, `compareYearMonth(a, b)`. Aritmética pura (ADR-015). Lo usan `tracking` (ruta y navegación), F5 (calendario) y F7 (destino del aviso mensual). | F4.2 |
| `index.ts` (existe) | Reexporta `year-month`. | F4.2 |

### 2.2 Feature `src/features/tracking/`

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `domain/periods.ts` | `homeRanges(today)`: semana actual hasta hoy, tramo equivalente de la semana anterior, mes hasta hoy, tramo equivalente del mes anterior y rango de consulta (D-19). | F4.2 |
| `domain/totals.ts` | `recordsBetween`, `totalBetween` y `compareTotals` (`PeriodComparison`). Reutiliza `recordTotal` de `sales/domain`. | F4.2 |
| `domain/home-summary.ts` | `homeSummary(records, ranges)`: totales y comparaciones de semana y mes. | F4.2 |
| `domain/monthly-summary.ts` | `monthlySummary(records, month)`: total, cantidad de registros, productos con más monto y canales con más monto, con empates (D-20). `monthNavigation(month, currentMonth, earliestMonth)` y `resolveMonth(requested, today)`. | F4.2 |
| `domain/profit.ts` | `approximateProfit(records, currentCostByVersion)` y `ProfitSummary` (firmas de ADR-007); `profitCoverage(summary)`; `versionIdsNeedingCurrentCost(records)`. Usa `effectiveUnitCost` de `sales/domain`. | F4.2 |
| `domain/latest-sales.ts` | `LATEST_SALES_LIMIT` (pregunta 6.4). | F4.2 |
| `domain/index.ts` | API pública del dominio de seguimiento. | F4.2 |
| `domain/testing/tracking-fixtures.ts` | Arma registros de varias fechas con las fábricas de `sales/domain/testing`. Solo para tests. | F4.2 |
| `hooks/query-keys.ts` | `trackingKeys`, `trackingCostKeys` y `TRACKING_QUERY_DEPENDENCIES`. | F4.3 |
| `hooks/use-sales-between.ts` | `useQuery` sobre `SaleRepository.listBetween(from, to)` con `trackingKeys.salesBetween(from, to)`. | F4.3 |
| `hooks/use-current-costs.ts` | `useQuery` sobre `currentCostsFor(ids)`; sin ids no consulta y devuelve un mapa vacío. | F4.3 |
| `hooks/use-profit.ts` | `useProfit(records)`: ids que necesitan costo → `useCurrentCosts` → `approximateProfit`. | F4.3 |
| `hooks/use-home-summary.ts` | `useToday()` → `homeRanges` → `useSalesBetween(fetch)` → `homeSummary` + `useProfit(registros del mes)`. | F4.3 |
| `hooks/use-latest-sales.ts` | `listRecent(LATEST_SALES_LIMIT)` con `trackingKeys.latest(limit)` + `useProductsByIds` → `SaleRecordView[]`. | F4.3 |
| `hooks/use-monthly-summary.ts` | `useSalesBetween(monthRangeOf(month))` → `monthlySummary` + `useProfit` + nombres de los productos destacados. | F4.3 |
| `hooks/use-earliest-sale-month.ts` | `SaleRepository.earliestSoldOn()` → `YearMonth | null`, con `trackingKeys.earliest()`. | F4.3 |
| `components/home-summary-card.tsx` | Monto de la semana (`Amount` en display y `accent`), monto del mes y comparación. | F4.4 |
| `components/comparison-text.ts` | `comparisonText(comparison, period)`: textos positivos al subir, al bajar, sin cambios y sin datos anteriores. Función pura con su test. | F4.4 |
| `components/profit-line.tsx` | Línea de ganancia con el texto de D-15 según `profitCoverage`; no se renderiza si recibe `null`. | F4.4 |
| `components/latest-sales-list.tsx` | Filas de `ListRow` con fecha, productos (nombre actual + "archivado") y total; tocar una llama a `onOpenSale(id)`. | F4.4 |
| `components/monthly-summary-view.tsx` | Total, producto o productos destacados, dónde vendiste más, ganancia y el estado de mes sin ventas. | F4.4 |
| `components/month-switcher.tsx` | Mes anterior y siguiente, deshabilitados según `monthNavigation`, con etiquetas accesibles. | F4.4 |
| `components/month-label.ts` | `formatMonthLabel(month, today)`: "noviembre", o "noviembre de 2025" si el año no es el de hoy (catálogo de ADR-010). | F4.4 |
| `screens/home-screen.tsx` (existe, provisoria) | Inicio real: primer uso (sistema de diseño 6.7), resumen, ganancia, últimas ventas, "Registrar venta" y "Ver resumen del mes". Props en 3.6. | F4.4 |
| `screens/monthly-summary-screen.tsx` | Resumen de un mes con navegación. Props en 3.6. | F4.4 |
| `index.ts` (existe) | Suma `MonthlySummaryScreen`, `TRACKING_QUERY_DEPENDENCIES` y los tipos de las props. | F4.4 |

### 2.3 Rutas (`src/app/`)

| Archivo | Responsabilidad |
|---|---|
| `(tabs)/index.tsx` (existe) | `HomeScreen` con `onRegisterSale` → `/sales/new`, `onOpenSale(id)` → `/sales/[id]`, `onOpenMonthlySummary()` → `/tracking/monthly`. |
| `tracking/monthly.tsx` | `parseRouteParams(z.object({ month: yearMonthSchema.optional() }), params)`. Válido → `MonthlySummaryScreen` con `requestedMonth = month ?? null` y `onChangeMonth(m)` → `router.setParams({ month: m })`. Inválido o repetido → `<Redirect href="/tracking/monthly" />` (se ve el mes actual). |

### 2.4 Código existente que se modifica

| Archivo | Cambio | Tarea |
|---|---|---|
| `src/features/sales/data/sale-repository.ts`, implementación Drizzle, doble en memoria y contrato | `earliestSoldOn(): Promise<LocalDate | null>`: el `sold_on` más antiguo de un registro activo con al menos un ítem activo. | F4.3 (si F3.3 ya cerró) |
| `src/features/sales/index.ts` | Exporta `useProductsByIds`, el tipo `SaleRecordView` y su armado puro (ver la fila siguiente). | F4.3 |
| `src/features/sales/hooks/use-sale-record-view.ts` | Si F3.5 armó `SaleRecordView` dentro del hook, la parte pura pasa a `sales/domain/sale-record-view.ts` (`buildSaleRecordView(record, productsById)`) para que Inicio y el detalle del día de F5 la reutilicen. | F4.3 |
| `src/core/providers/query/query-dependencies.ts` | Suma `...TRACKING_QUERY_DEPENDENCIES`. | F4.3 |
| `src/features/tracking/screens/home-screen.test.tsx` (existe) | Se reescribe para la pantalla real. | F4.4 |

---

## 3. Tipos e interfaces principales (firmas)

### 3.1 Mes (`shared/domain/calendar/year-month.ts`)
```ts
/** Mes calendario `YYYY-MM` (01 a 12); fuente única de `YearMonth`. */
export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).brand<'YearMonth'>();
export type YearMonth = z.infer<typeof yearMonthSchema>;

/** Mes que contiene la fecha. */
export function yearMonthOf(date: LocalDate): YearMonth;
/** Suma meses (positivos o negativos) con aritmética pura; cruza años. */
export function addMonths(month: YearMonth, months: number): YearMonth;
/** Primer y último día del mes. */
export function monthRangeOf(month: YearMonth): LocalDateRange;
/** Negativo, cero o positivo, como `Array.prototype.sort`. */
export function compareYearMonth(a: YearMonth, b: YearMonth): number;
```

### 3.2 Períodos y comparación (`domain/periods.ts`, `domain/totals.ts`)
```ts
/** Rangos de Inicio; todos cerrados y calculados con aritmética pura. */
export interface HomeRanges {
  /** Lunes de esta semana → hoy. */
  readonly weekToDate: LocalDateRange;
  /** Lunes anterior → mismo día ISO de la semana anterior (D-19). */
  readonly previousWeekSegment: LocalDateRange;
  /** Día 1 → hoy. */
  readonly monthToDate: LocalDateRange;
  /** Día 1 del mes anterior → mismo día del mes, o su último día si el mes anterior es más corto (D-19). */
  readonly previousMonthSegment: LocalDateRange;
  /** Unión de todo lo anterior: día 1 del mes anterior → hoy. */
  readonly fetch: LocalDateRange;
}
export function homeRanges(today: LocalDate): HomeRanges;

/** Registros con `soldOn` dentro del rango cerrado (defensa: la consulta ya viene acotada). */
export function recordsBetween(records: readonly SaleRecord[], range: LocalDateRange): readonly SaleRecord[];
/** Σ `recordTotal`; satura en `MAX_SALE_TOTAL`; los registros sin ítems suman 0 (ADR-007, regla 15). */
export function totalBetween(records: readonly SaleRecord[], range: LocalDateRange): Clp;

/** Comparación suave; nunca divide por cero. */
export type PeriodComparison =
  /** Ni este tramo ni el anterior tienen ventas. */
  | { readonly kind: 'no_data' }
  /** El tramo anterior está en $0 y este no: no hay porcentaje. */
  | { readonly kind: 'first' }
  | { readonly kind: 'same' }
  | { readonly kind: 'up' | 'down'; readonly difference: Clp; readonly percent: number };
/** `percent` = round(|actual − anterior| / anterior × 100), solo con anterior > 0. */
export function compareTotals(current: Clp, previous: Clp): PeriodComparison;
```

### 3.3 Inicio (`domain/home-summary.ts`)
```ts
export interface PeriodSummary {
  readonly total: Clp;
  readonly previousTotal: Clp;
  readonly comparison: PeriodComparison;
}
export interface HomeSummary {
  readonly week: PeriodSummary;
  readonly month: PeriodSummary;
  /** Registros del mes hasta hoy, para la ganancia. */
  readonly monthRecords: readonly SaleRecord[];
}
export function homeSummary(records: readonly SaleRecord[], ranges: HomeRanges): HomeSummary;
```

### 3.4 Resumen mensual (`domain/monthly-summary.ts`)
```ts
export interface RankedProduct { readonly productId: ProductId; readonly revenue: Clp }
export interface RankedChannel { readonly channel: SaleChannel; readonly revenue: Clp }

export interface MonthlySummary {
  readonly month: YearMonth;
  readonly total: Clp;
  /** Registros con al menos un ítem activo. */
  readonly recordCount: number;
  /** D-20: los de mayor Σ cantidad × `unitPrice`; todos los empatados; vacío si no hay ventas o el máximo es $0. Orden por `productId` (el hook reordena por nombre). */
  readonly topProducts: readonly RankedProduct[];
  /** D-20: igual que arriba por canal; los registros sin canal no compiten; orden de `SALE_CHANNELS`. */
  readonly topChannels: readonly RankedChannel[];
}
export function monthlySummary(records: readonly SaleRecord[], month: YearMonth): MonthlySummary;

/** Límites de la navegación entre meses (D-30). */
export interface MonthNavigation { readonly canGoBack: boolean; readonly canGoForward: boolean }
/** Atrás hasta `earliestMonth` (sin ventas: no hay atrás); adelante hasta `currentMonth`. */
export function monthNavigation(month: YearMonth, currentMonth: YearMonth, earliestMonth: YearMonth | null): MonthNavigation;
/** `null` o un mes futuro → el mes de `today`; si no, el pedido. */
export function resolveMonth(requested: YearMonth | null, today: LocalDate): YearMonth;
```

### 3.5 Ganancia (`domain/profit.ts`, ADR-007)
```ts
/** Ganancia aproximada y qué parte de lo vendido tenía costo (ADR-007). */
export interface ProfitSummary {
  readonly profit: SignedClp;
  readonly revenueWithCost: Clp;
  readonly revenueTotal: Clp;
}
/**
 * Σ cantidad × (precio − costo efectivo) solo sobre ítems con costo efectivo
 * (`effectiveUnitCost(item, map.get(item.productVersionId) ?? null)`, D-26).
 * `null` si ningún ítem tiene costo efectivo. Satura en ±999.999.999.
 */
export function approximateProfit(
  records: readonly SaleRecord[],
  currentCostByVersion: ReadonlyMap<ProductVersionId, Clp | null>,
): ProfitSummary | null;
/** `partial` si `revenueWithCost < revenueTotal` (texto de D-15); si no, `full`. */
export function profitCoverage(summary: ProfitSummary): 'full' | 'partial';
/** Versiones de ítems sin `unitCost`, sin repetir y ordenadas: lo único que hay que pedir a `currentCostsFor`. */
export function versionIdsNeedingCurrentCost(records: readonly SaleRecord[]): readonly ProductVersionId[];
```

### 3.6 Query keys, hooks y screens
```ts
/** Raíz de lecturas de seguimiento sobre ventas y marcas. */
export const trackingKeys = {
  all: ['tracking'] as const,
  salesBetween: (from: LocalDate, to: LocalDate) => ['tracking', 'sales-between', from, to] as const,
  latest: (limit: number) => ['tracking', 'latest', limit] as const,
  earliest: () => ['tracking', 'earliest'] as const,
};
/** Raíz aparte para que guardar una venta no recargue los costos, y cambiar un costo no recargue las ventas. */
export const trackingCostKeys = {
  all: ['tracking-costs'] as const,
  forVersions: (ids: readonly ProductVersionId[]) => ['tracking-costs', ...ids] as const,
};
export const TRACKING_QUERY_DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['tracking'], tables: new Set(['sale_records', 'sale_items', 'no_sales_weeks']) },
  { rootKey: ['tracking-costs'], tables: new Set(['product_versions']) },
];

export function useSalesBetween(range: LocalDateRange): UseQueryResult<readonly SaleRecord[]>;
export function useCurrentCosts(ids: readonly ProductVersionId[]): { readonly isPending: boolean; readonly isError: boolean; readonly costs: ReadonlyMap<ProductVersionId, Clp | null> };
export function useProfit(records: readonly SaleRecord[] | undefined): { readonly isPending: boolean; readonly profit: ProfitSummary | null };
export function useHomeSummary(): { readonly status: 'pending' | 'error' | 'ready'; readonly summary: HomeSummary | null; readonly profit: ProfitSummary | null };
export function useLatestSales(): { readonly status: 'pending' | 'error' | 'ready'; readonly sales: readonly SaleRecordView[] };
export function useMonthlySummary(month: YearMonth): { readonly status: 'pending' | 'error' | 'ready'; readonly summary: MonthlySummary | null; readonly topProductNames: readonly ProductNameView[]; readonly profit: ProfitSummary | null };
export function useEarliestSaleMonth(): UseQueryResult<YearMonth | null>;

/** Nombre actual de un producto destacado, con el indicador de archivado (`name` es `null` si el producto no existe, regla 15). */
export interface ProductNameView { readonly productId: ProductId; readonly name: string | null; readonly isArchived: boolean; readonly revenue: Clp }

export interface HomeScreenProps {
  readonly onRegisterSale: () => void;
  readonly onOpenSale: (id: SaleRecordId) => void;
  readonly onOpenMonthlySummary: () => void;
}
export interface MonthlySummaryScreenProps {
  /** `null` = mes actual. Un mes futuro se muestra como el actual (`resolveMonth`). */
  readonly requestedMonth: YearMonth | null;
  readonly onChangeMonth: (month: YearMonth) => void;
  readonly onOpenSale?: (id: SaleRecordId) => void;
}
```
- `useProfit` usa `select` o `useMemo` sobre datos ya cargados; el cálculo vive en `approximateProfit`, nunca en el componente.
- `SaleRecordView` es el tipo de F3 (nombre actual, versión, `isArchived`, portada, total). Inicio lo usa tal cual para las últimas ventas.

---

## 4. Flujo de datos y manejo de estado

### 4.1 Inicio
```
HomeScreen
  useToday() ─► homeRanges(today) ─► fetch = [día 1 del mes anterior, hoy]
  useSalesBetween(fetch)            key ['tracking','sales-between',from,to]
      └─► homeSummary(records, ranges) ─► semana, mes y comparaciones (D-19)
      └─► monthRecords ─► versionIdsNeedingCurrentCost ─► useCurrentCosts(ids)
                              key ['tracking-costs', ...ids]  (sin ids: no consulta)
                          ─► approximateProfit(monthRecords, costs) ─► ProfitLine (oculta si null)
  useLatestSales()                  key ['tracking','latest',5] + ['products','by-ids',…]
      └─► SaleRecordView[] ─► LatestSalesList ─► onOpenSale(id) ─► /sales/[id]
  Primer uso: latest vacío (no hay ningún registro activo) ─► EmptyState (sistema de diseño 6.7) con "Registrar venta"
```
- **Por qué alcanza un rango**: el lunes de esta semana es, como mucho, 6 días antes del día 1 del mes. El lunes anterior queda como mucho 13 días antes, y siempre dentro del mes anterior, que tiene 28 días o más. Por eso `[día 1 del mes anterior, hoy]` contiene los cuatro tramos. Lo verifica un test de propiedad sobre todas las fechas de 2026 a 2028.
- **Tramo equivalente (D-19)**: la semana compara lunes→hoy contra lunes anterior→mismo día ISO. El mes compara 1→d contra 1→min(d, días del mes anterior). El 31 de marzo compara contra todo febrero. El 28 de febrero de un año no bisiesto compara contra 1→28 de enero.

### 4.2 Actualización
- **Guardar o borrar una venta** emite `sale_records`/`sale_items` → se invalida `['tracking']`. Inicio y el resumen montados se recargan. `['tracking-costs']` no se recarga, salvo que cambie el conjunto de versiones (cambia la key).
- **Cambiar un costo** emite `product_versions` → se invalidan `['tracking-costs']` y `['products']`. Aparece o cambia la ganancia sin recargar las ventas.
- **Cambiar de día o de semana**: `useToday()` cambia → cambian `fetch` y la key → se consulta el rango nuevo (ADR-009, punto 6). La key del resumen mensual no depende de hoy, salvo con `requestedMonth = null`.

### 4.3 Resumen mensual
```
/tracking/monthly?month=2026-10 ─► parseRouteParams
  inválido ─► <Redirect href="/tracking/monthly"> ─► mes actual
  válido   ─► MonthlySummaryScreen(requestedMonth)
       useToday() ─► resolveMonth(requested, today) ─► month
       useSalesBetween(monthRangeOf(month)) ─► monthlySummary + useProfit
       useProductsByIds(topProducts) ─► nombres actuales, ordenados por nombre (comparador de D-31)
       useEarliestSaleMonth() ─► monthNavigation ─► MonthSwitcher ─► onChangeMonth(m) ─► router.setParams
```
- Un mes sin ventas (dentro de la navegación o por un enlace) muestra un estado amable ("Este mes no registraste ventas"), sin culpa y con la navegación activa.
- El aviso de F7 abre `/tracking/monthly?month=<mes que terminó>` (sección 6, punto 2).

### 4.4 Estado
- Persistido: SQLite + TanStack Query (raíces `['tracking']`, `['tracking-costs']` y `['products']`). Sin store global.
- UI: el mes visible del resumen vive **en la URL** (`month`), no en `useState`. Así el aviso, el botón atrás y las pruebas comparten un único origen.
- Fechas: solo `useToday()`/`useCurrentWeek()`; nunca `new Date()`.

---

## 5. Tests que el code-writer escribe primero

### 5.1 Dominio (`node`, F4.2)
1. `year-month`: el esquema rechaza `2026-13`, `2026-1`, `26-01` y `2026-00`; `addMonths` cruza el año (diciembre + 1, enero − 1, ± 24); `monthRangeOf` de un febrero bisiesto (2028) y de uno no bisiesto; `yearMonthOf` del 31 de diciembre.
2. `homeRanges`:
   - lunes (los tramos de la semana tienen un día);
   - domingo (semana completa);
   - semana que cruza dos meses (domingo 1 de noviembre de 2026);
   - 31 de marzo contra febrero;
   - 28 de febrero de 2027 contra 1→28 de enero;
   - cruce de año (enero contra diciembre);
   - propiedad: `fetch` contiene los cuatro tramos para cada día de 2026 a 2028.
3. `totalBetween`: semana que cruza dos meses; las ventas del domingo cuentan en su semana y no en la siguiente; un registro sin ítems suma 0; saturación.
4. `compareTotals` (D-19): sube, baja, igual, anterior en 0 con el actual > 0 (`first`, sin dividir), los dos en 0 (`no_data`), actual en 0 con el anterior > 0 (`down`, 100 %) y redondeo del porcentaje.
5. `monthlySummary`:
   - mes sin ventas (total 0 y listas vacías);
   - producto más vendido por monto y no por cantidad (D-20);
   - empate de dos productos (vienen los dos);
   - canal principal con ventas sin canal (no compiten);
   - todas las ventas sin canal (`topChannels` vacío);
   - máximo $0 (lista vacía);
   - un registro fuera del mes se ignora.
6. `monthNavigation` y `resolveMonth`: el mes actual no tiene "siguiente"; el primer mes con ventas no tiene "anterior"; sin ventas no hay "anterior"; un mes futuro se resuelve al actual; `null` da el actual.
7. `approximateProfit` (los del plan):
   - sin costos devuelve `null`;
   - con todos los costos, el valor completo y `full`;
   - con cobertura parcial, el monto solo sobre los ítems con costo, `revenueWithCost < revenueTotal` y `partial`;
   - un ítem sin `unitCost` toma el costo del mapa, y uno con `unitCost` lo conserva aunque el mapa diga otra cosa;
   - un precio menor que el costo da ganancia negativa;
   - un costo de $0 cuenta como costo cargado;
   - un registro sin ítems no afecta;
   - una versión ausente del mapa cuenta como sin costo.
8. `versionIdsNeedingCurrentCost`: excluye los ítems con `unitCost`, no repite y ordena.

### 5.2 Datos (`node`, F4.3, si F3.3 ya cerró)
9. Contrato de `earliestSoldOn`: `null` sin registros; ignora los borrados y los registros sin ítems activos; devuelve el mínimo con varios registros.

### 5.3 Hooks (`ui`, `renderWithProviders` + dobles, F4.3)
10. `useHomeSummary` pide **un** `listBetween` con `fetch` (espía en el doble); no pide meses enteros ni "todo".
11. `useProfit` llama a `currentCostsFor` solo con las versiones de ítems sin `unitCost`; sin esas versiones no llama; la key cambia con el conjunto de ids.
12. Con Inicio montado: guardar una venta lo actualiza (`dataChanges` de `sale_records`); cambiar un costo (`product_versions`) recarga solo `['tracking-costs']` y hace aparecer la ganancia; un aviso de `tip_views` no recarga nada.
13. Con `FakeClock` el domingo a las 23:59, `advanceClockAndTimers` hasta el lunes a las 00:00: cambia la key, la semana arranca en $0 y la anterior es la que terminó.
14. Los agregados no se calculan en componentes: los componentes reciben `HomeSummary`, `MonthlySummary` y `ProfitSummary` ya calculados (revisión del reviewer y props tipadas).

### 5.4 Componentes y screens (`ui`, F4.4)
15. Los del plan:
    - el primer uso invita a registrar;
    - los montos usan `Amount`;
    - la ganancia no aparece sin costos;
    - la comparación usa texto positivo al subir y al bajar (`comparisonText` contra los patrones de culpa compartidos con F6.4 y F7.2);
    - Inicio no muestra consejos (ningún texto del catálogo y ninguna llamada a `tipViews`/`tipCatalog`);
    - tocar una venta reciente llama a `onOpenSale` con su id.
16. `ProfitLine`: texto completo de D-15 con `full` y con `partial`; ganancia negativa con `-$5.000` y un texto sin culpa.
17. Una venta pasada de un producto archivado muestra el nombre actual y "archivado" (con texto, no solo color).
18. `MonthSwitcher`: botones deshabilitados con `accessibilityState.disabled`; etiquetas "Mes anterior, octubre" y "Mes siguiente".
19. Ruta (`src/__tests__/tracking-routes.test.tsx` con `renderRouter`): `month=2026-13` y `month=abc` redirigen al mes actual; `month` repetido redirige; sin `month` se ve el actual; un mes futuro válido se ve como el actual; tocar "mes anterior" cambia el parámetro.

### 5.5 E2E al cierre (F4.6, `e2e/maestro/tracking/home-*.yaml`, pendiente de entorno)
- `home-totals.yaml`: con ventas creadas por los subflujos de F0.15 hoy y en días anteriores, Inicio muestra los totales de la semana y del mes.
- `home-updates.yaml`: registrar una venta actualiza Inicio sin reiniciar.
- `home-profit.yaml`: cargar un costo en el producto vendido hace aparecer "te quedaron aprox."; con dos productos y uno sin costo aparece el texto parcial.
- `home-monthly.yaml`: abrir el resumen del mes y navegar al anterior.
- F4 no agrega migraciones: no corresponde V-E2E-UPG.

---

## 6. Riesgos y decisiones abiertas para el orquestador

### Técnicas
1. **Sin contradicciones con ADRs.** `approximateProfit` y `ProfitSummary` tienen la firma de ADR-007. Lo nuevo es aditivo: `SaleRepository.earliestSoldOn`, `yearMonthSchema`, `buildSaleRecordView` y las exportaciones de `sales`.
2. **Destino del aviso mensual (coordinación con F7.0).** ADR-011 define `NotificationDeepLink = '/tracking/monthly'` sin mes. Sin parámetro, la ruta muestra el mes **actual**: el día 1 de diciembre, el aviso "tu resumen de noviembre" abriría diciembre vacío. **Propuesta**: el *payload* de la notificación lleva `month: YearMonth`, validado con `yearMonthSchema` (ADR-010, punto 4), y el manejador navega a `/tracking/monthly?month=…`. La ruta de ADR-011 no cambia; F7.0 lo tiene que recoger.
3. **Saturación** de totales y ganancia en ±$999.999.999, igual que `recordTotal` en F3. Con la saturación, `revenueWithCost` y `revenueTotal` podrían coincidir aunque la cobertura sea parcial. En la práctica no ocurre, y queda documentado en el test.
4. **Un ítem de $0 sin costo** no baja `revenueWithCost`, así que se informa la cobertura como `full` aunque falte un costo. Es la definición literal de ADR-007 y se mantiene.
5. **`SaleRecordView` puro en `sales/domain`.** Si F3.5 lo dejó dentro del hook, F4.3 lo extrae sin cambiar su forma, para que Inicio no duplique la resolución de nombres y del indicador de archivado.

### De producto (cada una con valor por defecto)
6. **Período de la ganancia en Inicio.** Por defecto, **solo el mes** ("este mes te quedaron aprox. $X"). El resumen mensual muestra la del mes que se ve. La alternativa es mostrar también la de la semana.
7. **Cantidad de últimas ventas en Inicio.** Por defecto **5** registros (`LATEST_SALES_LIMIT`), sin "ver todas" en la v1. El historial completo se ve en el calendario (F5).
8. **Banda de "parecido" en la comparación.** Por defecto **no hay**: `same` solo si los montos son iguales. La alternativa es tratar como "parecido" una diferencia de menos del 5 %. El texto lo define el designer en F4.1.
9. **Porcentaje o monto en la comparación.** El dominio entrega los dos (`difference` y `percent`). Por defecto el designer elige uno en F4.1. La propuesta es el monto, que es más concreto para quien no maneja porcentajes.
10. **Mes sin ventas y navegación.** Por defecto se puede navegar hacia atrás hasta el **primer mes con ventas** (no con marcas de "no vendí"). Los meses intermedios sin ventas se muestran con un estado amable.
11. **Empates en "más vendido".** Por defecto se muestran **todos** los empatados (D-20), ordenados por nombre. Si el máximo es $0 (solo ventas a $0), no se muestra "más vendido".
12. **Ventas sin canal en "dónde vendiste más".** Por defecto no compiten. Si ninguna venta del mes tiene canal, la sección no aparece.

Ninguna pregunta bloquea F4.2 con los valores por defecto. La 6 y la 8 cambian tests de componentes (F4.4), no del dominio.
