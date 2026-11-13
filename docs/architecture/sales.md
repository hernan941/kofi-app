# Diseño técnico — Registro de ventas (F3)

- **Tarea**: F3.0 de `docs/plan-v1.md`. Rige F3.2 a F3.9.
- **ADRs**: ADR-005, ADR-006, ADR-007 (principal), ADR-009, ADR-010 y ADR-015. **Decisiones**: D-01, D-02, D-03, D-04, D-18, D-25, D-26 y D-27. Base: `docs/architecture/foundations.md` (patrón `TransactionRunner` + escritores síncronos), `docs/architecture/products.md` y `docs/architecture/product-photos.md` (miniaturas).
- Este documento no cambia ninguna decisión aceptada. Usa las interfaces `SaleRepository` y `NoSalesWeekRepository` de ADR-007, les suma métodos de forma aditiva (`activeWeekStartsBetween`, que pide F3.3, y los escritores síncronos de foundations 3.2) y suma `findByIds` a `ProductRepository` (definido en `product-photos.md`, 3.4). La sección 6 marca lo que el orquestador tiene que resolver.

---

## 1. Resumen del enfoque

- **Feature nueva `src/features/sales/`**, con dependencia hacia `products` (`products` ← `sales`, ADR-005). `sales` importa de `@/features/products/domain` y los tipos de puertos de `@/features/products`, nunca al revés.
- **El agregado es `SaleRecord`** (ADR-007) con sus ítems activos. Las reglas son **funciones puras**: validar la fecha contra `today`, resolver cada ítem contra su versión (pertenencia, archivado, precio a convenir, copia de `unitCost` según D-26), calcular el total, el diff de ítems por id y las opciones de "no vendí". El dominio recibe `today: LocalDate` explícito y nunca lee un reloj. El caso de uso lo obtiene con `calendar.localDateOf(clock.now())`, y la UI con `useToday()`.
- **Leer, decidir y escribir en una sola transacción.** `saveSaleRecord`, `deleteSaleRecord`, `markNoSales` y `unmarkNoSales` corren cada uno en un `TransactionRunner.run`, con escritores síncronos (`SaleRecordWriter`, `NoSalesWeekWriter`) y el `ProductWriter` existente para leer versiones. D-02 (quitar la marca de la semana al guardar una venta) ocurre en esa misma transacción y produce **un** `DataChanges` con `sale_records`, `sale_items` y `no_sales_weeks`.
- **"No vendí" con id determinista**: `noSalesWeekId(weekStart)` = `deterministicId(weekStart)` (UUIDv5 de `week_start` con `NAMESPACE_CUANTOVENDI`, ADR-006 y ADR-007). Marcar una semana desmarcada reactiva la misma fila (`deleted_at = NULL`). La lógica de qué semana ofrecer (D-18, D-25 y la regla del lunes y el martes de ADR-007) es una función pura, `noSalesPrompt`.
- **Costo efectivo** (D-26): el ítem guarda solo el `unitCost` copiado al vender. Las lecturas de ventas **no** resuelven costos. `effectiveUnitCost(item, currentCost)` combina el costo copiado con el que entrega `ProductRepository.currentCostsFor`. Lo usa F4.
- **Lectura reactiva** con TanStack Query. Hay dos raíces: `['sales']` (depende de `sale_records` y `sale_items`) y `['no-sales-weeks']` (depende de `no_sales_weeks`). El historial usa `useInfiniteQuery` con el cursor *keyset* `(sold_on, created_at, id)`.
- **Flujo después de guardar como punto de extensión.** La screen de registro muestra la confirmación que celebra y, al cerrarla, llama a `onFinished(outcome: SaleSavedOutcome)`. La ruta `src/app/sales/new.tsx` decide adónde ir (ADR-005). En F3 vuelve a Inicio. F6 inserta el consejo y F7 el pedido de permiso usando `outcome.isFirstSale`, sin tocar `sales`.
- **Inicio** conecta "Registrar venta" con `router.push('/sales/new')`.

---

## 2. Archivos a crear o modificar

### 2.1 Feature `src/features/sales/`

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `domain/sale.ts` | Tipos de ADR-007 definidos acá una sola vez: `SaleChannel`, `SALE_CHANNELS`, `SaleItem`, `SaleRecord` y `NoSalesWeek`. Constantes: `SALE_NOTE_MAX_LENGTH = 500` (D-27), `QUANTITY_MIN = 1`, `QUANTITY_MAX = 9999` y `SALE_ITEMS_MAX` (pregunta 6.13). Lecturas tolerantes: `activeItemsTotal`, `recordTotal`, `hasItems`. | F3.2 |
| `domain/errors.ts` | `SALE_ERROR_CODES`, `SaleErrorCode`, `SaleError`, `SaleErrors` y `SaleErrorPath` (mismo patrón que `products/domain/errors.ts`). | F3.2 |
| `domain/schemas.ts` | Esquemas Zod de la entrada (`saleItemInputSchema`, `saveSaleRecordInputSchema`, `saleChannelSchema`, `saleNoteSchema`, `quantitySchema`). Los tipos de entrada se infieren. | F3.2 |
| `domain/rules.ts` | `validateSoldOn`, `resolveItems`, `effectiveUnitCost`, `diffItems`, `buildSaleRecord`, `planSaleRecordUpdate`. | F3.2 |
| `domain/no-sales.ts` | `noSalesWeekId`, `noSalesWeekOf`, `noSalesWeekStatus`, `noSalesPrompt` y `canUnmarkNoSales`. | F3.2 |
| `domain/index.ts` | API pública del dominio. `tracking`, `tips`, `notifications` y `backup` importan de acá. | F3.2 |
| `domain/testing/sale-fixtures.ts` | Fábricas de `SaleRecord`, `SaleItem` y entradas para tests (solo las importan los tests). | F3.2 |
| `data/sale-repository.ts` | Interfaces `SaleRepository` (ADR-007 + `activeWeekStartsBetween`), `SaleRecordWriter`, `NoSalesWeekRepository` (ADR-007), `NoSalesWeekWriter`, `SaleRecordCursor`, `SaleRecordPage` y `SalesDatabaseAccess`. Solo tipos. | F3.3 |
| `data/drizzle-sale-repository.ts` | `createDrizzleSaleRepository(access)`: implementa `SaleRepository & SaleRecordWriter`. Mapea las filas con un *cast* centralizado (ADR-010, punto 6). | F3.3 |
| `data/drizzle-no-sales-week-repository.ts` | `createDrizzleNoSalesWeekRepository(access)`: implementa `NoSalesWeekRepository & NoSalesWeekWriter`. | F3.3 |
| `data/sale-repository.contract.ts`, `data/no-sales-week-repository.contract.ts` | Suites de contrato que corren la implementación Drizzle y el doble en memoria. | F3.3 |
| `testing/in-memory-sale-repository.ts`, `testing/in-memory-no-sales-week-repository.ts` | Dobles para los tests de UI; emiten `DataChanges` como la implementación real. | F3.3 |
| `use-cases/sales-command-deps.ts` | `SalesCommandDeps`. | F3.4 |
| `use-cases/save-sale-record.ts` | Crear y editar (incluye quitar la marca por D-02 y borrar si se quitaron todos los ítems). | F3.4 |
| `use-cases/delete-sale-record.ts` | Borrado lógico del registro y sus ítems. | F3.4 |
| `use-cases/mark-no-sales.ts`, `use-cases/unmark-no-sales.ts` | Marcar y desmarcar con las reglas de D-18 y D-25 verificadas dentro de la transacción. | F3.4 |
| `hooks/query-keys.ts` | `salesKeys`, `noSalesKeys` y `SALES_QUERY_DEPENDENCIES`. | F3.5 |
| `hooks/use-sales-command-deps.ts` | Puertos de los casos de uso desde `useDependencies()`. | F3.5 |
| `hooks/use-recent-sales.ts` | `useInfiniteQuery` sobre `listRecent`. | F3.5 |
| `hooks/use-sale-record.ts` | Detalle por id; `null` es "no encontrado". | F3.5 |
| `hooks/use-sale-record-view.ts` | Combina el registro con `useProductsByIds` para mostrar nombres, versiones, portada e indicador de "archivado". | F3.5 |
| `hooks/use-products-by-ids.ts` | `useQuery` sobre `ProductRepository.findByIds`, con key bajo la raíz `['products']` (`productKeys.byIds`, que agrega `products`). | F3.5 |
| `hooks/use-sellable-products.ts` | Productos activos (de `useActiveProducts`, que ya excluye archivados) filtrados con `sellableVersions`; solo los que tienen al menos una versión activa. | F3.5 |
| `hooks/use-no-sales-prompt.ts` | `useNoSalesPrompt()`: `useToday()` + semanas actual y anterior + `activeWeekStartsBetween` + `listBetween` de marcas → `noSalesPrompt`. | F3.5 |
| `hooks/use-save-sale-record.ts`, `use-delete-sale-record.ts`, `use-mark-no-sales.ts`, `use-unmark-no-sales.ts` | `useMutation`. Resuelven con el `Result` del dominio; solo rechazan ante errores inesperados, que registran en el logger. | F3.5 |
| `components/sale-form-schema.ts` | Esquema del formulario (texto → entrada del dominio), `toSaleFormValues`, `toSaveSaleRecordCommand`, `applySaleErrors` y `newItemValues(product, version)`. | F3.6 |
| `components/sale-form.tsx` | Formulario completo con `useFieldArray` de ítems, fecha (`DateField` con `maxDate = useToday()`), "más detalles" (canal y nota) y total con `Amount`. | F3.6 |
| `components/sale-item-fields.tsx` | Fila de un ítem: producto con miniatura, versión (solo si hay más de una activa), cantidad (`QuantityStepper`), precio (`FormAmountField`) y quitar. | F3.6 |
| `components/product-picker.tsx` | Lista o grilla de productos vendibles con miniatura (`coverPhoto`) y después la versión si corresponde. | F3.6 |
| `components/no-sales-panel.tsx` | Presenta un `NoSalesPrompt`: botón secundario, elección "¿la semana pasada o esta?", texto amable de D-25 y estado "marcada" con desmarcar. | F3.6 |
| `components/sale-saved-celebration.tsx` | Confirmación que celebra, con el aviso suave si se quitó una marca. | F3.6 |
| `components/sale-detail.tsx` | Detalle de solo lectura. | F3.6 |
| `components/channel-labels.ts` | `SALE_CHANNEL_LABELS: Record<SaleChannel, string>` en español. | F3.6 |
| `components/error-messages.ts` | `SALE_ERROR_MESSAGES: Record<SaleErrorCode, string>` y `describeSaleError`, que mezcla los textos de `TEXT_ERROR_MESSAGES` y `CLP_INPUT_ERROR_MESSAGES`. | F3.6 |
| `screens/new-sale-screen.tsx` | Registro + "no vendí" + celebración. Props: `onFinished(outcome)`, `onCreateProduct()`, `onCancel()`. | F3.7 |
| `screens/sale-detail-screen.tsx` | Detalle con editar y borrar con confirmación. Props: `onEdit(id)`, `onDeleted()`. | F3.7 |
| `screens/edit-sale-screen.tsx` | Edición. Props: `onSaved(outcome)`, `onDeleted()`, `onCancel()`. | F3.7 |
| `index.ts` | Exporta las screens, `SALES_QUERY_DEPENDENCIES`, `salesKeys`, `noSalesKeys`, los tipos `SaleSavedOutcome`, `SaleRepository`, `SaleRecordWriter`, `NoSalesWeekRepository` y `NoSalesWeekWriter` (`export type`). | F3.7 |

### 2.2 Rutas (`src/app/`)

| Archivo | Responsabilidad |
|---|---|
| `(tabs)/index.tsx` (existe) | Reemplaza `registerSalePending` por `router.push('/sales/new')`. |
| `sales/new.tsx` | Destino del botón y del recordatorio (`NotificationDeepLink = '/sales/new'`, ADR-011). Renderiza `NewSaleScreen`. `onFinished` en F3 hace `router.back()` si hay historial y, si no (entrada por deep link), `router.replace('/')`. `onCreateProduct` hace `router.push({ pathname: '/products/new', params: { from: 'sale' } })`. |
| `sales/[id].tsx` | `parseRouteParams(z.object({ id: saleRecordIdSchema }), params)`; si falla, `NotFoundScreen`. Si es válido, `SaleDetailScreen`. |
| `sales/[id]/edit.tsx` | Igual validación; `EditSaleScreen`. `onSaved` vuelve al detalle; `onDeleted` vuelve dos niveles, a donde se abrió el detalle. |
| `products/new.tsx` (existe en F1.6) | Acepta el parámetro opcional `from=sale` (validado con `z.enum(['sale']).optional()`). Si viene, `onSaved` hace `router.back()` y vuelve al registro. |

`sales/new` y `sales/[id]/edit` se presentan como modal o *push* según F3.1.

### 2.3 Código existente que se modifica

| Archivo | Cambio | Tarea |
|---|---|---|
| `src/core/providers/app-dependencies.ts` | Suma `sales: SaleRepository`, `saleWriter: SaleRecordWriter`, `noSalesWeeks: NoSalesWeekRepository` y `noSalesWeekWriter: NoSalesWeekWriter` (`import type` desde `@/features/sales`). | F3.5 |
| `src/core/dependencies/create-app-dependencies.ts` | Crea los dos repositorios Drizzle con el **mismo** `runInTransaction` compartido (products.md 4.4) y la base diferida. | F3.5 |
| `src/core/providers/query/query-dependencies.ts` | `QUERY_DEPENDENCIES = [...PRODUCTS_QUERY_DEPENDENCIES, ...SALES_QUERY_DEPENDENCIES]`. | F3.5 |
| `src/core/testing/create-test-dependencies.ts` | Por defecto, los dobles en memoria de ventas y de "no vendí" conectados al mismo `dataChanges`. | F3.5 |
| `src/features/products/data/product-repository.ts` y su implementación | `findByIds` (ya definido en `product-photos.md`, 3.4). Si F2.4 no lo implementó, lo hace F3.3. | F3.3 |
| `src/features/products/hooks/query-keys.ts` | `productKeys.byIds(ids)` = `['products', 'by-ids', ...idsOrdenados]`. | F3.5 |
| `src/features/products/domain` | Exporta `sellableVersions(product)` (versiones activas y no archivadas, en orden) si no existe ya como `activeVersions`. | F3.2 |
| `src/features/products/data/testing/sales-fixtures.ts` | Se reemplaza por las fábricas de `sales/domain/testing` o pasa a usarlas, para no tener dos formas de insertar ventas en tests. | F3.3 |
| `e2e/maestro/_shared/` | Subflujos `create-product.yaml` (si no existe) y `register-sale.yaml`. Los datos de prueba de F0.15 suman las fábricas de ventas (nota de F3.7). | F3.9 |

---

## 3. Tipos e interfaces principales (firmas)

### 3.1 Tipos del agregado (`domain/sale.ts`)
`SaleChannel`, `SaleItem`, `SaleRecord` y `NoSalesWeek` son **exactamente** los de ADR-007:

```ts
/** Códigos estables de canal (ADR-007); las etiquetas en español viven en la UI. */
export const SALE_CHANNELS = ['fair', 'social_media', 'store_or_consignment', 'custom_order', 'other'] as const;
export type SaleChannel = (typeof SALE_CHANNELS)[number];

/** Límites de ítems (ADR-007) y de nota (D-27). */
export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 9999;
export const SALE_NOTE_MAX_LENGTH = 500;
/** Tope técnico de ítems por registro (pregunta 6.13). */
export const SALE_ITEMS_MAX = 100;

/** Σ cantidad × `unitPrice` de los ítems recibidos. Un registro sin ítems activos suma 0 (ADR-007, regla 15). */
export function recordTotal(record: Pick<SaleRecord, 'items'>): Clp;
```
- `SaleRecord.items` contiene **solo los ítems activos**, ordenados por `(position, id)`. Puede estar vacío en datos rotos, y las lecturas no fallan por eso.
- `recordTotal` satura en `MAX_CLP` si la suma lo supera (9999 × $999.999.999 desborda `Clp`) y deja un `logger.warn` en el hook que lo detecte. El tope de la suma lo decide la pregunta 6.14.

### 3.2 Errores por código (`domain/errors.ts`)
```ts
export const SALE_ERROR_CODES = [
  'required',               // nota u otro texto obligatorio (no hay en v1; reservado por el esquema compartido)
  'too_long',               // nota > 500 (D-27)
  'no_items',               // crear sin ítems
  'too_many_items',         // > SALE_ITEMS_MAX
  'quantity_out_of_range',  // fuera de 1..9999 o no entero
  'price_required',         // versión "a convenir" sin `unitPrice`
  'future_date',            // `soldOn` > hoy (D-03)
  'product_not_found',
  'product_archived',       // ítem nuevo (o con versión cambiada) de un producto archivado
  'version_not_found',
  'version_product_mismatch',
  'version_archived',       // ítem nuevo (o con versión cambiada) de una versión archivada
  'item_not_found',         // `itemId` que no pertenece al registro
  'record_not_found',
  'week_has_sales',         // D-25
  'week_not_allowed',       // D-18: ni la actual ni la anterior
  'not_a_week_start',       // `weekStart` que no es lunes
] as const;
export type SaleErrorCode = (typeof SALE_ERROR_CODES)[number];
/** Ruta del campo con la forma de Zod y React Hook Form: `['items', 1, 'unitPrice']`, `['soldOn']`. */
export type SaleErrorPath = readonly (string | number)[];
export interface SaleError { readonly code: SaleErrorCode; readonly path: SaleErrorPath }
export type SaleErrors = readonly [SaleError, ...SaleError[]];
```

### 3.3 Esquemas de entrada (`domain/schemas.ts`)
```ts
export const saleChannelSchema = z.enum(SALE_CHANNELS);
export const saleNoteSchema = optionalTextSchema(SALE_NOTE_MAX_LENGTH);
export const quantitySchema = z.number().int().min(QUANTITY_MIN).max(QUANTITY_MAX);

/**
 * Un ítem como lo envía el formulario. `itemId` es el id del ítem existente al editar, o
 * `null` si es nuevo. `unitPrice` es `null` cuando el usuario no lo tocó en una versión de
 * precio fijo: el dominio copia el precio de la versión. En "a convenir" es obligatorio (`0` vale).
 */
export const saleItemInputSchema = z.object({
  itemId: saleItemIdSchema.nullable(),
  productId: productIdSchema,
  productVersionId: productVersionIdSchema,
  quantity: quantitySchema,
  unitPrice: clpSchema.nullable(),
});
export type SaleItemInput = z.output<typeof saleItemInputSchema>;

/** Entrada de crear y editar. Al crear exige al menos un ítem; al editar, vacío significa borrar (ADR-007, regla 8). */
export const saveSaleRecordInputSchema = z.object({
  soldOn: localDateSchema,
  channel: saleChannelSchema.nullable(),
  note: saleNoteSchema,
  items: z.array(saleItemInputSchema).max(SALE_ITEMS_MAX),
});
export type SaveSaleRecordInput = z.output<typeof saveSaleRecordInputSchema>;
```
El `min(1)` de crear lo aplica `buildSaleRecord` (`no_items`), no el esquema, para que el formulario use un solo esquema en crear y editar.

### 3.4 Reglas puras (`domain/rules.ts`)
```ts
/**
 * D-03: `future_date` si `soldOn > today`. En una edición que **no** cambia la fecha no se
 * valida (un cambio de zona horaria pudo dejar una fecha "futura"; ADR-015, regla 6).
 */
export function validateSoldOn(soldOn: LocalDate, today: LocalDate, previous: LocalDate | null): readonly SaleError[];

/** Lo que el dominio necesita saber de los productos de los ítems, leído en la transacción. */
export type ProductsById = ReadonlyMap<ProductId, Product>;

/**
 * Convierte la entrada en ítems de dominio:
 * - un ítem **nuevo**, o uno existente al que se le cambió la versión, exige que el producto
 *   exista y no esté archivado y que la versión exista en `product.versions`, pertenezca al
 *   producto y no esté archivada; copia `unitCost = version.cost` (D-26);
 * - un ítem existente con la **misma versión** se acepta aunque el producto o la versión estén
 *   archivados o borrados (ADR-007: al editar se conservan los ítems de versiones archivadas)
 *   y **conserva** su `unitCost` copiado;
 * - `unitPrice`: el recibido; si es `null`, el precio fijo de la versión (en un ítem existente
 *   sin cambio de versión, el `unitPrice` guardado); en "a convenir" sin precio, `price_required`;
 * - `position` = índice en la entrada; `id` = `itemId` o `ids.next()`;
 * - un `itemId` que no está en `existing`, `item_not_found`.
 */
export function resolveItems(
  input: readonly SaleItemInput[],
  products: ProductsById,
  existing: readonly SaleItem[],
  ids: IdGenerator,
): Result<readonly SaleItem[], SaleErrors>;

/** D-26: el `unitCost` copiado si existe; si no, el costo actual recibido (que puede ser `null`). */
export function effectiveUnitCost(item: Pick<SaleItem, 'unitCost'>, currentCost: Clp | null): Clp | null;

/** Diferencia por id entre los ítems guardados y los nuevos. Sin cambios, las tres listas van vacías. */
export interface SaleItemsDiff {
  readonly inserted: readonly SaleItem[];
  readonly updated: readonly SaleItem[];
  readonly removed: readonly SaleItemId[];
}
export function diffItems(before: readonly SaleItem[], after: readonly SaleItem[]): SaleItemsDiff;

/** Contexto de las reglas que crean entidades. */
export interface SaleCommandContext {
  readonly now: EpochMs;
  readonly today: LocalDate;
  readonly ids: IdGenerator;
}

/** Crea un registro nuevo: valida fecha, ítems (`no_items` si no hay) y arma `SaleRecord` con `createdAt = updatedAt = now`. */
export function buildSaleRecord(
  input: SaveSaleRecordInput,
  products: ProductsById,
  context: SaleCommandContext,
): Result<SaleRecord, SaleErrors>;

/** Resultado de planificar una edición. */
export type SaleRecordUpdatePlan =
  | { readonly kind: 'update'; readonly record: SaleRecord; readonly diff: SaleItemsDiff; readonly changed: boolean }
  | { readonly kind: 'delete' };

/**
 * Edición: con `items` vacío devuelve `{ kind: 'delete' }` (la UI ya confirmó). Si no, aplica
 * `validateSoldOn` (con `previous = current.soldOn`), `resolveItems` y `diffItems`. `changed`
 * es `false` si no cambió ningún campo ni ítem; en ese caso `updatedAt` se conserva.
 */
export function planSaleRecordUpdate(
  current: SaleRecord,
  input: SaveSaleRecordInput,
  products: ProductsById,
  context: SaleCommandContext,
): Result<SaleRecordUpdatePlan, SaleErrors>;
```

### 3.5 "No vendí" (`domain/no-sales.ts`)
```ts
/** Id determinista de la marca de una semana (ADR-007): UUIDv5 de `weekStart` (texto `YYYY-MM-DD`) con `NAMESPACE_CUANTOVENDI`. */
export function noSalesWeekId(weekStart: LocalDate): NoSalesWeekId;

/** Marca de la semana que empieza en `weekStart`; `not_a_week_start` si no es lunes. */
export function noSalesWeekOf(weekStart: LocalDate): Result<NoSalesWeek, SaleErrors>;

/** Lo que se sabe de una semana para decidir. "Tiene ventas" = algún registro activo con al menos un ítem activo. */
export interface WeekFacts {
  readonly week: WeekRange;
  readonly hasSales: boolean;
  readonly isMarked: boolean;
}

/** Estado de una semana para "no vendí". */
export type NoSalesWeekStatus = 'markable' | 'marked' | 'has_sales' | 'not_allowed';

/** D-18 y D-25: `not_allowed` si no es la semana de `today` ni la anterior; después `has_sales`, `marked` o `markable`. */
export function noSalesWeekStatus(facts: WeekFacts, today: LocalDate): NoSalesWeekStatus;

/** Lo que muestra el panel de "no vendí". */
export type NoSalesPrompt =
  /** Una sola semana para marcar (en general, la actual). */
  | { readonly kind: 'single'; readonly week: WeekRange; readonly which: 'current' | 'previous' }
  /** Lunes o martes, con la semana anterior sin registro: se pregunta, con la anterior preseleccionada (ADR-007, decisión 2). */
  | { readonly kind: 'choose'; readonly previous: WeekRange; readonly current: WeekRange; readonly preselected: 'previous' }
  /** La semana actual ya está marcada: se muestra como hecha, con la opción de desmarcar. */
  | { readonly kind: 'marked'; readonly week: WeekRange }
  /** D-25: la semana actual tiene ventas y no hay otra que ofrecer; un texto amable lo explica. */
  | { readonly kind: 'has_sales'; readonly week: WeekRange };

/**
 * Regla única del panel:
 * 1. Si `isoWeekday(today)` es 1 o 2 y la semana anterior no tiene registro (ni ventas ni marca):
 *    - con la actual `markable` → `choose`;
 *    - con la actual `has_sales` o `marked` → `single` con `which: 'previous'`.
 * 2. Si no: según el estado de la actual → `single` (`current`), `marked` o `has_sales`.
 */
export function noSalesPrompt(today: LocalDate, current: WeekFacts, previous: WeekFacts): NoSalesPrompt;

/** Se puede desmarcar la misma ventana que se puede marcar (D-18): semana actual o anterior. */
export function canUnmarkNoSales(weekStart: LocalDate, today: LocalDate): boolean;
```

### 3.6 Puertos de datos (`data/sale-repository.ts`)
```ts
/** Cursor estable (ADR-007). */
export interface SaleRecordCursor { readonly soldOn: LocalDate; readonly createdAt: EpochMs; readonly id: SaleRecordId }
export interface SaleRecordPage { readonly records: readonly SaleRecord[]; readonly next: SaleRecordCursor | null }

/** Acceso asíncrono a ventas (ADR-007); los rangos son cerrados y excluyen lo borrado. */
export interface SaleRepository {
  /** Orden `(sold_on, created_at, id)` ascendente. Incluye registros sin ítems activos (`items: []`). */
  listBetween(from: LocalDate, to: LocalDate): Promise<readonly SaleRecord[]>;
  /** Orden `(sold_on DESC, created_at DESC, id DESC)`; *keyset* `(sold_on, created_at, id) < cursor`; pide `limit + 1` para saber si hay `next`. */
  listRecent(limit: number, cursor?: SaleRecordCursor): Promise<SaleRecordPage>;
  findById(id: SaleRecordId): Promise<SaleRecord | null>;
  save(record: SaleRecord): Promise<void>;
  softDelete(id: SaleRecordId, now: EpochMs): Promise<void>;
  /** Lunes de las semanas con algún registro activo con al menos un ítem activo, sin repetir y ascendentes. Se calcula con `isoWeekStart` en TS sobre los `sold_on` distintos, no con fechas de SQL (ADR-015). */
  activeWeekStartsBetween(from: LocalDate, to: LocalDate): Promise<readonly LocalDate[]>;
}

/** Lecturas y escrituras síncronas para usar dentro de `TransactionRunner.run` (foundations, 3.2). */
export interface SaleRecordWriter {
  findByIdSync(id: SaleRecordId): SaleRecord | null;
  /**
   * Inserta o actualiza el registro y sus ítems **por id** (ADR-007, regla 12) con `diffItems`
   * contra lo guardado: inserta los nuevos, actualiza solo los que cambiaron y pone `deleted_at`
   * en los que ya no están. `created_at`/`updated_at` de los ítems escritos = `record.updatedAt`.
   * @throws {Error} Si `item.productId` no coincide con `product_versions.product_id` (ADR-007), o si `items` está vacío.
   */
  saveSync(record: SaleRecord): void;
  /** Borra lógicamente el registro y sus ítems activos; `false` si no existía o ya estaba borrado. */
  softDeleteSync(id: SaleRecordId, now: EpochMs): boolean;
  /** Algún registro activo con al menos un ítem activo y `sold_on` en el rango cerrado. */
  hasSalesBetweenSync(from: LocalDate, to: LocalDate): boolean;
  /** Si existió alguna vez un registro, incluidos los borrados (pregunta 6.6). */
  hasAnyRecordEverSync(): boolean;
}

/** Acceso a las marcas de "no vendí" (ADR-007). */
export interface NoSalesWeekRepository {
  /** Marcas activas con `week_start` en el rango cerrado. */
  listBetween(from: LocalDate, to: LocalDate): Promise<readonly NoSalesWeek[]>;
  mark(week: NoSalesWeek, now: EpochMs): Promise<void>;
  unmark(id: NoSalesWeekId, now: EpochMs): Promise<void>;
}

/** Escrituras síncronas de marcas; devuelven si cambiaron algo, para emitir solo cuando corresponde. */
export interface NoSalesWeekWriter {
  isMarkedSync(id: NoSalesWeekId): boolean;
  /** Inserta la fila con el id determinista o limpia `deleted_at` de la existente; `false` si ya estaba activa. */
  markSync(week: NoSalesWeek, now: EpochMs): boolean;
  /** Pone `deleted_at`; `false` si no existía o ya estaba desmarcada. */
  unmarkSync(id: NoSalesWeekId, now: EpochMs): boolean;
}

/** Igual que `ProductDatabaseAccess`: la base se abre recién al primer uso. */
export interface SalesDatabaseAccess {
  readonly db: () => AppDatabase;
  readonly runInTransaction: RunInTransaction;
}
export function createDrizzleSaleRepository(access: SalesDatabaseAccess): SaleRepository & SaleRecordWriter;
export function createDrizzleNoSalesWeekRepository(access: SalesDatabaseAccess): NoSalesWeekRepository & NoSalesWeekWriter;
```

Tablas que toca cada escritura (se emiten después del commit):

| Método | Tablas |
|---|---|
| `saveSync` (nuevo) | `sale_records`, `sale_items` |
| `saveSync` (edición) | `sale_records` si cambió el registro; `sale_items` si el diff no está vacío |
| `softDeleteSync` | `sale_records` y, si había ítems activos, `sale_items` |
| `markSync`/`unmarkSync` | `no_sales_weeks`, solo si devolvieron `true` |

Notas de implementación:
- *Keyset* con comparación de filas de SQLite: `(sold_on, created_at, id) < (?, ?, ?)`. La soportan los dos motores (SQLite ≥ 3.15). Usa el índice parcial `sale_records(sold_on, created_at, id) WHERE deleted_at IS NULL`.
- Los ítems de una página se cargan con un segundo `SELECT … WHERE sale_record_id IN (…) AND deleted_at IS NULL ORDER BY position, id`, sin N+1.
- `markSync` es un `INSERT … ON CONFLICT(id) DO UPDATE SET deleted_at = NULL, updated_at = ? WHERE deleted_at IS NOT NULL`, o su equivalente en dos pasos dentro de la transacción. Usa el **id** como conflicto, y la `UNIQUE (week_start)` queda como defensa.

### 3.7 Casos de uso (`use-cases/`)
```ts
/** Puertos de los casos de uso de ventas. */
export interface SalesCommandDeps {
  readonly transactions: TransactionRunner;
  readonly sales: SaleRecordWriter;
  readonly noSalesWeeks: NoSalesWeekWriter;
  readonly products: Pick<ProductWriter, 'findByIdSync'>;
  readonly clock: Clock;
  readonly calendar: LocalCalendar;
  readonly ids: IdGenerator;
}

/** Crear o editar desde el formulario. */
export type SaveSaleRecordCommand =
  | { readonly kind: 'create'; readonly input: SaveSaleRecordInput }
  | { readonly kind: 'update'; readonly recordId: SaleRecordId; readonly input: SaveSaleRecordInput };

/** Lo que recibe la navegación posventa (punto de extensión de F6 y F7). */
export interface SaleSavedOutcome {
  readonly kind: 'created' | 'updated';
  readonly recordId: SaleRecordId;
  readonly soldOn: LocalDate;
  /** Primer registro de la historia del dispositivo (pregunta 6.6); solo puede ser `true` al crear. */
  readonly isFirstSale: boolean;
  /** Semana cuya marca de "no vendí" se quitó por D-02, para el aviso suave; `null` si no había. */
  readonly clearedNoSalesWeek: LocalDate | null;
}

/** Resultado de guardar: guardado o, si una edición quitó todos los ítems, borrado. */
export type SaveSaleRecordResult =
  | { readonly kind: 'saved'; readonly outcome: SaleSavedOutcome }
  | { readonly kind: 'deleted'; readonly recordId: SaleRecordId };

/**
 * Dentro de **una** `transactions.run`:
 * 1. `now = clock.now()`, `today = calendar.localDateOf(now)`;
 * 2. carga con `products.findByIdSync` los productos de los ítems (sin repetir);
 * 3. crear: `isFirstSale = !sales.hasAnyRecordEverSync()`, luego `buildSaleRecord`;
 *    editar: `findByIdSync` (`record_not_found` si no existe), luego `planSaleRecordUpdate`;
 *    `delete` → `softDeleteSync` y devuelve `deleted`;
 * 4. si hay error del dominio, devuelve el `Result` sin escribir nada;
 * 5. `sales.saveSync(record)` (si `changed`);
 * 6. D-02: `id = noSalesWeekId(isoWeekStart(record.soldOn))`; `noSalesWeeks.unmarkSync(id, now)`;
 *    si devuelve `true`, `clearedNoSalesWeek = isoWeekStart(record.soldOn)`.
 *    Se aplica al crear y al editar (también si la fecha no cambió, para reparar un estado roto).
 * Un `throw` de cualquier escritor revierte todo y llega como rechazo.
 */
export function saveSaleRecord(
  deps: SalesCommandDeps,
  command: SaveSaleRecordCommand,
): Promise<Result<SaveSaleRecordResult, SaleErrors>>;

/** Borrado lógico (D-04; la confirmación la hace la UI). No crea ni restaura marcas. `record_not_found` si no existe. */
export function deleteSaleRecord(deps: SalesCommandDeps, recordId: SaleRecordId): Promise<Result<void, SaleErrors>>;

/** Comando de marcar o desmarcar una semana. */
export interface NoSalesWeekCommand { readonly weekStart: LocalDate }

/**
 * Dentro de `transactions.run`: `today` del reloj; `noSalesWeekOf` (`not_a_week_start`);
 * `noSalesWeekStatus` con `hasSalesBetweenSync` e `isMarkedSync` (`week_not_allowed`,
 * `week_has_sales`); `markSync`. Marcar una semana ya marcada devuelve `ok` sin escribir ni emitir.
 */
export function markNoSales(deps: SalesCommandDeps, command: NoSalesWeekCommand): Promise<Result<void, SaleErrors>>;

/** `canUnmarkNoSales` (`week_not_allowed`) y `unmarkSync`; desmarcar una semana no marcada devuelve `ok` sin escribir. */
export function unmarkNoSales(deps: SalesCommandDeps, command: NoSalesWeekCommand): Promise<Result<void, SaleErrors>>;
```

### 3.8 Query keys y dependencias (`hooks/query-keys.ts`)
```ts
/** Claves de ventas (ADR-009); el rango forma parte de la key. */
export const salesKeys = {
  all: ['sales'] as const,
  between: (from: LocalDate, to: LocalDate) => ['sales', 'between', from, to] as const,
  recent: () => ['sales', 'recent'] as const,
  detail: (id: SaleRecordId) => ['sales', 'detail', id] as const,
  weekStarts: (from: LocalDate, to: LocalDate) => ['sales', 'week-starts', from, to] as const,
};

/** Claves de las marcas de "no vendí". */
export const noSalesKeys = {
  all: ['no-sales-weeks'] as const,
  between: (from: LocalDate, to: LocalDate) => ['no-sales-weeks', 'between', from, to] as const,
};

export const SALES_QUERY_DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['sales'], tables: new Set(['sale_records', 'sale_items']) },
  { rootKey: ['no-sales-weeks'], tables: new Set(['no_sales_weeks']) },
];
```
`salesKeys` es la fábrica de ADR-009 más `weekStarts`. Los nombres de productos de una venta se leen por la raíz `['products']`, que ya depende de `products`, `product_versions` y `product_photos`.

### 3.9 Hooks
```ts
export function useRecentSales(pageSize?: number): UseInfiniteQueryResult<InfiniteData<SaleRecordPage>, Error>; // 20 por defecto
/** `data === null` es "no encontrado". */
export function useSaleRecord(id: SaleRecordId): UseQueryResult<SaleRecord | null>;
/** Registro + productos para mostrar; tolera productos archivados o versiones borradas (indicador "archivado"). */
export function useSaleRecordView(id: SaleRecordId): { readonly status: 'pending' | 'error' | 'not_found' | 'ready'; readonly view: SaleRecordView | null };
export function useSellableProducts(): UseQueryResult<readonly Product[]>;
/** Semana actual (`useCurrentWeek`) y anterior; `isPending` mientras cargan las dos consultas. */
export function useNoSalesPrompt(): { readonly isPending: boolean; readonly isError: boolean; readonly prompt: NoSalesPrompt | null };
export function useSaveSaleRecord(): UseMutationResult<Result<SaveSaleRecordResult, SaleErrors>, Error, SaveSaleRecordCommand>;
export function useDeleteSaleRecord(): UseMutationResult<Result<void, SaleErrors>, Error, SaleRecordId>;
export function useMarkNoSales(): UseMutationResult<Result<void, SaleErrors>, Error, NoSalesWeekCommand>;
export function useUnmarkNoSales(): UseMutationResult<Result<void, SaleErrors>, Error, NoSalesWeekCommand>;
```
- `useNoSalesPrompt` consulta `salesKeys.weekStarts(previous.start, current.end)` y `noSalesKeys.between(previous.start, current.end)`, y arma los `WeekFacts` y el `prompt` en el hook (ADR-009, punto 5). Cuando `useToday` cambia (medianoche o vuelta a primer plano), cambian las keys.
- `SaleRecordView` (tipo de `hooks/`) agrega a cada ítem `productName`, `versionName | null`, `showVersion` (más de una versión no borrada en el producto), `isArchived` y `coverPhotoId | null`, más `total = recordTotal(record)`.

### 3.10 Formulario (`components/sale-form-schema.ts`)
```ts
/** Fila de ítem como la maneja la UI. */
export interface SaleItemFormValues {
  /** Id del ítem existente o `null`. No se llama `id` por la clave de `useFieldArray`. */
  readonly itemId: string | null;
  readonly productId: string;
  readonly productVersionId: string;
  readonly quantity: number;
  /** Precargado con el precio fijo de la versión; vacío en "a convenir". */
  readonly priceText: string;
  /** Modo de precio de la versión elegida; es estado de presentación y el esquema lo usa para exigir el precio. */
  readonly pricingMode: 'fixed' | 'negotiable';
}

export interface SaleFormValues {
  readonly soldOn: LocalDate;
  readonly channel: SaleChannel | null;
  readonly note: string;
  readonly items: readonly SaleItemFormValues[];
}

/**
 * Texto → `SaveSaleRecordInput`: `priceText` pasa por `clpTextSchema` (obligatorio en las dos
 * modalidades, porque en precio fijo ya viene precargado); en "a convenir" vacío → `price_required`
 * en `items.i.priceText`. El formulario siempre envía `unitPrice` con valor, así que el `null`
 * de la entrada del dominio queda para otros llamadores (tests y, en el futuro, sync).
 */
export const saleFormSchema: z.ZodType<SaveSaleRecordInput, SaleFormValues>;

/** Valores iniciales: `soldOn = today`, sin canal ni nota y, si hay un único producto vendible con una única versión, ese ítem ya cargado. */
export function toSaleFormValues(record: SaleRecord | null, today: LocalDate, sellable: readonly Product[]): SaleFormValues;

/** Fila nueva para un producto y versión: cantidad 1 y precio fijo precargado (`formatClp` sin `$`). */
export function newItemValues(product: Product, version: ProductVersion): SaleItemFormValues;

export function toSaveSaleRecordCommand(recordId: SaleRecordId | null, output: SaveSaleRecordInput): SaveSaleRecordCommand;
/** Asigna los errores del dominio a los campos (`items.1.priceText`, `soldOn`); devuelve los que no tienen campo. */
export function applySaleErrors(errors: SaleErrors, setError: UseFormSetError<SaleFormValues>): readonly SaleError[];
```
- `useForm<SaleFormValues, unknown, SaveSaleRecordInput>({ resolver: zodResolver(saleFormSchema) })`, con los tres genéricos de ADR-009.
- El total se calcula con `useWatch({ name: 'items' })` y una función pura (`formTotal(items)`, que parsea cada `priceText` con `parseClpInput` e ignora los inválidos). Se muestra con `Amount`.
- La fecha usa `DateField` con `maxDate = useToday()` y `today`. Así mañana nunca se ofrece, y el dominio lo vuelve a validar con el reloj.
- "Más detalles" (canal y nota) es estado local (`useState`) y empieza cerrado. Al editar un registro que ya tiene canal o nota, empieza abierto.
- **Quitar el último ítem** en la edición abre `ConfirmDialog` ("¿Borrar este registro?"). Si se confirma, se envía `items: []`, que el caso de uso convierte en borrado. Al crear, quitar el último ítem solo deja el formulario sin ítems.
- El botón principal usa `createSubmitHandler`. Un segundo toque mientras `isPending` no envía otra vez.

---

## 4. Flujo de datos y manejo de estado

### 4.1 Registrar (camino corto)
```
Inicio "Registrar venta" → router.push('/sales/new')
NewSaleScreen
  useSellableProducts() → [] → EmptyState "Crea tu primer producto" → onCreateProduct()
                              → /products/new?from=sale → guardar → router.back()
                              → la lista se actualiza por invalidación de ['products']
  useToday() → soldOn por defecto
  useNoSalesPrompt() → NoSalesPanel (botón secundario)
  SaleForm: elegir producto (miniatura = coverPhoto) → versión solo si hay > 1
          → cantidad 1, precio precargado → Guardar
  → useSaveSaleRecord().mutateAsync({ kind: 'create', input })
  → saveSaleRecord: transactions.run(() => {
       today = calendar.localDateOf(clock.now())
       products = findByIdSync(...)       isFirst = !hasAnyRecordEverSync()
       record = buildSaleRecord(input, products, { now, today, ids })
       sales.saveSync(record)                               → sale_records, sale_items
       noSalesWeeks.unmarkSync(noSalesWeekId(isoWeekStart(soldOn)), now) → no_sales_weeks?
    })
  → commit → DataChanges.emit(unión) → puente → invalida ['sales'], ['no-sales-weeks'],
             ['product-version-usage'] (F1) → Inicio, panel y detalles montados se recargan
  → screen: ok → fase "celebración" (SaleSavedCelebration, con aviso si clearedNoSalesWeek)
           → "Listo" → onFinished(outcome) → ruta: F3 vuelve; F6/F7 se enganchan acá
           error → applySaleErrors (campos) o Toast (sin campo)
```

### 4.2 "No vendí"
```
NoSalesPanel(prompt)
  single  → "Esta semana no vendí" (o "La semana pasada no vendí") → useMarkNoSales({ weekStart })
  choose  → "¿La semana pasada o esta?" con la pasada preseleccionada → confirmar → mark
  marked  → "Marcaste que esta semana no vendiste" + "Desmarcar" → useUnmarkNoSales
  has_sales → texto amable de D-25, sin botón
  → markNoSales: transactions.run(() => status (hasSalesBetweenSync, isMarkedSync) → markSync)
  → DataChanges {no_sales_weeks} → invalida ['no-sales-weeks'] → el panel pasa a "marked"
```
Después de marcar, la screen muestra una confirmación breve (Toast) y se queda en el registro. Si el designer prefiere volver a Inicio, se usa `onFinished` con otro tipo de resultado (pregunta 6.9).

### 4.3 Detalle, edición y borrado
```
/sales/[id] → parseRouteParams → SaleDetailScreen → useSaleRecordView(id)
  not_found → estado "no encontrado" de la screen
  Editar → /sales/[id]/edit → EditSaleScreen → toSaleFormValues(record, today, sellable)
    → los ítems existentes muestran su producto aunque esté archivado (no se puede elegir uno archivado para un ítem nuevo)
    → guardar → saveSaleRecord(update) → saved → onSaved → detalle actualizado por invalidación
                                     → deleted (sin ítems) → onDeleted
  Borrar → ConfirmDialog → useDeleteSaleRecord → onDeleted
```

### 4.4 Estado
- **Persistido**: SQLite + TanStack Query (raíces `['sales']` y `['no-sales-weeks']`). Sin store global.
- **Formulario**: React Hook Form (`useFieldArray` de ítems). La selección de producto en curso, "más detalles" abierto, la fase de celebración y los diálogos son `useState` local de la screen.
- **Fechas**: la UI usa `useToday`/`useCurrentWeek`. El caso de uso usa `Clock` + `LocalCalendar`, y el dominio recibe `today`. Nunca `new Date()` (lo revisa F3.8).
- **Navegación**: las screens no importan `expo-router`. Las rutas pasan callbacks y deciden el flujo posventa.

### 4.5 Composición
```
salesAccess   = { db: () => getDatabase().db, runInTransaction }   (la misma instancia de products.md 4.4)
saleStore     = createDrizzleSaleRepository(salesAccess)           → sales, saleWriter
noSalesStore  = createDrizzleNoSalesWeekRepository(salesAccess)    → noSalesWeeks, noSalesWeekWriter
```

---

## 5. Tests que el code-writer escribe primero

Se suman a los de F3.2 a F3.7 del plan y los precisan.

### 5.1 Dominio (`node`, F3.2)
1. Esquemas: cantidad 0, 10000 y 1,5 → error; 1 y 9999 → ok; `unitPrice` 0 → ok; −1 y 1.000.000.000 → error; canal fuera de `SALE_CHANNELS` → error; nota de 500 → ok y de 501 → `too_long`; nota con solo espacios → `null`; más de `SALE_ITEMS_MAX` ítems → error.
2. `validateSoldOn` con `FakeClock` y `deviceLocalCalendar` en las tres zonas (`test:tz`): a las 23:59 y a las 00:00 locales, hoy pasa y mañana da `future_date`; el día de salto hacia adelante en `America/Santiago`; una edición que no cambia una fecha "futura" pasa, y una que la cambia a otra futura falla.
3. `resolveItems`: versión de otro producto → `version_product_mismatch`; versión archivada en un ítem nuevo → `version_archived`; producto archivado en un ítem nuevo → `product_archived`; ítem existente con versión archivada y sin cambio de versión → ok y conserva `unitCost`; cambio de versión en un ítem existente → vuelve a copiar `unitCost` y vuelve a validar; "a convenir" sin precio → `price_required` en `['items', i, 'unitPrice']`; `0` en "a convenir" → ok; precio fijo con `null` → precio de la versión; `itemId` ajeno → `item_not_found`; `unitCost` copiado = `version.cost` (incluido `null`).
4. `recordTotal`: Σ cantidad × `unitPrice`; registro sin ítems → 0; saturación en el máximo (pregunta 6.14).
5. `effectiveUnitCost`: copiado 1000 y actual 2000 → 1000; copiado `null` y actual 2000 → 2000; los dos `null` → `null`; copiado 0 → 0 (no se confunde con "sin costo").
6. `diffItems`: insertado, actualizado (cantidad, precio o versión), borrado y sin cambios (las tres listas vacías); cambiar solo el orden → actualizados por `position`.
7. `buildSaleRecord`: sin ítems → `no_items`; ids de `SequentialIdGenerator`; posiciones 0..n-1; `createdAt = updatedAt = now`. `planSaleRecordUpdate`: `items: []` → `delete`; sin cambios → `changed: false` y `updatedAt` intacto.
8. `noSalesWeekId`: estable para el mismo lunes, distinto entre semanas, válido para `noSalesWeekIdSchema` e igual a `deterministicId(weekStart)`. `noSalesWeekOf` con un miércoles → `not_a_week_start`.
9. `noSalesWeekStatus` y `noSalesPrompt` (D-18, D-25, ADR-007):
   - miércoles sin nada → `single` actual;
   - lunes con la anterior sin registro → `choose` con `previous` preseleccionada;
   - martes con la anterior con ventas → `single` actual;
   - lunes con la anterior marcada → `single` actual;
   - lunes con la anterior sin registro y la actual con ventas → `single` anterior;
   - actual con ventas (jueves) → `has_sales`;
   - actual marcada → `marked`;
   - semana de hace dos → `not_allowed`;
   - semana futura → `not_allowed`;
   - cruce de año (lunes 2027-01-04 con la anterior 2026-12-28).
10. `canUnmarkNoSales`: actual y anterior → `true`; hace dos semanas → `false`.
11. Tolerancia (regla 15): un registro sin ítems activos suma 0, no cuenta como "tiene ventas" y se muestra sin lanzar.
12. `SALE_ERROR_CODES` sin repetidos; el dominio no exporta textos en español.

### 5.2 Datos (`node`, `createTestDatabase`, F3.3)
13. Suite de contrato de ventas (Drizzle y en memoria):
    - `save` nuevo + `findById` igual, con ítems por posición;
    - `save` editado actualiza por id: el ítem sin cambios conserva `updated_at` (en Drizzle se verifica la fila), el editado lo cambia, el nuevo se inserta y el quitado queda con `deleted_at`;
    - `listBetween` cerrado (incluye los bordes), excluye borrados y no incluye ítems borrados;
    - un ítem conserva su `unit_cost` aunque después cambie el costo de la versión;
    - `listRecent` paginado y estable con tres registros del mismo `sold_on` y el mismo `created_at` (desempata por id), sin duplicados ni saltos entre páginas, y `next = null` en la última;
    - `softDelete` del registro y sus ítems;
    - `activeWeekStartsBetween` devuelve lunes sin repetir, ignora los registros sin ítems activos y los borrados, e incluye una semana que cruza el año.
14. Solo Drizzle:
    - `saveSync` con un `productId` que no coincide con la versión lanza y no escribe;
    - cada escritura emite **un** `DataChanges` con las tablas de 3.6;
    - las lecturas no emiten;
    - `hasAnyRecordEverSync` cuenta los borrados.
15. Suite de "no vendí": `mark` inserta con el id determinista; `unmark` pone `deleted_at`; volver a marcar reutiliza la misma fila (una sola fila con ese `week_start`, `deleted_at = NULL`); `markSync` de una ya activa devuelve `false` y no emite; `listBetween` excluye las desmarcadas; un `week_start` que no es lunes viola el `CHECK`.

### 5.3 Casos de uso (`node`, base real, F3.4)
16. Guardar en una semana marcada quita la marca y emite **un solo** `DataChanges` con `sale_records`, `sale_items` y `no_sales_weeks`; `clearedNoSalesWeek` es ese lunes.
17. Si falla la inserción de un ítem (escritor que lanza en el segundo ítem), no queda nada escrito, la marca sigue y no se emite.
18. Una edición que mueve la fecha a otra semana marcada quita esa marca; la marca de la semana original (si se marcó después, por datos rotos) no se toca.
19. Borrar un registro no recrea marcas, y `deleteSaleRecord` de uno inexistente da `record_not_found`.
20. `isFirstSale`: `true` en el primer registro; `false` en el segundo; `false` después de borrar todos y crear otro (pregunta 6.6); siempre `false` al editar.
21. Edición con `items: []` → `deleted` y el registro queda borrado lógicamente.
22. Crear con fecha futura según `FakeClock` → `future_date` sin escribir.
23. `markNoSales` en una semana con ventas → `week_has_sales`; de hace dos semanas → `week_not_allowed`; repetido → `ok` sin emitir. `unmarkNoSales` fuera de la ventana → `week_not_allowed`.
24. Una venta y un "no vendí" de la misma semana en carrera (marcar después de vender en la misma semana) → `week_has_sales`, porque la verificación está dentro de la transacción.

### 5.4 Hooks (`ui`, `renderWithProviders` + dobles, F3.5)
25. `useSaveSaleRecord` y `useDeleteSaleRecord` devuelven los errores por código sin rechazar; un error inesperado rechaza y queda en `RecordingLogger`.
26. `useRecentSales` usa `useInfiniteQuery`: `fetchNextPage` trae la segunda página con el cursor de la primera; `hasNextPage` es `false` al final.
27. `useSaleRecord(id)`: carga, `null` y error.
28. `useNoSalesPrompt` + `useMarkNoSales`: con `FakeClock` un lunes, `choose`; después de marcar, sin invalidar a mano, pasa a `marked`; al cruzar la medianoche del domingo al lunes (`advanceClockAndTimers`), el prompt se recalcula para la semana nueva.
29. Las pantallas montadas se actualizan por invalidación: con `useRecentSales` montado, guardar una venta la muestra; un `dataChanges.emit({no_sales_weeks})` no recarga `['sales']`.

### 5.5 Componentes (`ui`, F3.6)
30. Los del plan:
    - con una sola versión se precarga el precio y no se muestra el selector de versión; con varias, sí;
    - "a convenir" exige el precio con un mensaje amable;
    - el total se recalcula al cambiar la cantidad o el precio;
    - "más detalles" oculto hasta tocarlo;
    - la fecha por defecto viene de `useToday` y mañana no se puede elegir;
    - los productos archivados no aparecen;
    - cada código de `SALE_ERROR_CODES` tiene su mensaje (el test los recorre), sin palabras de culpa.
31. `saleFormSchema`: "15.000" → 15000; "a convenir" vacío → `price_required` en `items.0.priceText`; "15,5" → `comma_not_allowed`.
32. `toSaleFormValues`: un único producto vendible con una única versión ya queda cargado como ítem; al editar, los ítems de un producto archivado aparecen con su indicador.
33. Quitar el último ítem en la edición pide confirmación; al crear no.
34. `NoSalesPanel` presenta los cuatro `NoSalesPrompt`; en `choose`, la semana pasada está preseleccionada y se anuncia como seleccionada (`accessibilityState.selected`).
35. `SaleSavedCelebration` muestra el aviso suave solo si `clearedNoSalesWeek` no es `null`; los montos se muestran con `Amount`.

### 5.6 Screens y rutas (`ui`, F3.7)
36. Los del plan: registrar y ver la confirmación; marcar "no vendí"; editar y ver el cambio; borrar con confirmación; sin productos, invitar a crear uno y volver al registro con el producto disponible; un id inválido lleva a not-found (`src/__tests__/sales-routes.test.tsx` con `renderRouter`). Se suman:
    - un id válido pero inexistente muestra el estado "no encontrado" de la screen;
    - "Registrar venta" de Inicio navega a `/sales/new` (`src/__tests__/navigation.test.tsx`);
    - `onFinished` recibe `isFirstSale: true` en la primera venta (contrato para F7.8).

### 5.7 E2E al cierre (F3.9, `e2e/maestro/sales/`, pendiente de entorno)
- `register-shortest.yaml`: un producto con una versión y precio fijo, hoy, en el número exacto de toques que documente F3.1.
- `register-fair.yaml`: tres ítems (uno "a convenir"), canal "Feria" y nota; total correcto.
- `change-date-yesterday.yaml`: cambiar la fecha a ayer y verla en el detalle.
- `future-date-blocked.yaml`: el control de "día siguiente" está deshabilitado en hoy.
- `no-sales-then-sale.yaml`: marcar "no vendí", registrar una venta esa semana y comprobar que la marca desaparece (con el aviso suave).
- `edit-delete.yaml`: editar y borrar con confirmación.
- `empty-catalog.yaml` (sugerido): sin productos, crear uno desde el registro y volver.
- F3 no agrega migraciones (las tablas existen desde `0000`), así que no corresponde V-E2E-UPG.

---

## 6. Riesgos y decisiones abiertas para el orquestador

### Técnicas (no contradicen ADRs, pero requieren acción o confirmación)
1. **Sin contradicciones con ADRs aceptados.** Las interfaces de ADR-007 se usan tal cual y solo se les suman métodos (`activeWeekStartsBetween`, que pide F3.3, los escritores síncronos de foundations 3.2 y `ProductRepository.findByIds`). Es el mismo criterio que F1 con `versionIdsWithSales`.
2. **Clave del UUIDv5.** ADR-007 dice "UUIDv5 de `week_start`". El diseño usa la cadena `YYYY-MM-DD` tal cual, sin prefijo. Es irreversible: si cambia después, las marcas existentes dejan de coincidir entre dispositivos. Conviene confirmarlo antes de F3.2 (es la lectura literal del ADR).
3. **Qué cuenta como "tiene ventas"** (D-25, racha y `activeWeekStartsBetween`): un registro activo **con al menos un ítem activo**. Un registro roto sin ítems no bloquea "no vendí" ni cuenta para la racha. Es coherente con la regla 15 ("suma 0"). F5 tiene que usar la misma definición.
4. **`sales` lee productos con `ProductWriter.findByIdSync`** dentro de la transacción (un `findByIdSync` por producto distinto del registro). Evita un puerto nuevo, pero hace una consulta por producto. Con el tope de ítems es acotado. Si F10 mide un problema, se agrega `findByIdsSync`.
5. **Desvíos de la lista de archivos del plan** (todos aditivos): `domain/errors.ts`, `domain/no-sales.ts`, `testing/*`, las suites de contrato, `use-products-by-ids.ts` y el parámetro `from=sale` en `products/new`.

### De producto (preguntas; cada una tiene un valor por defecto que permite seguir)
6. **¿Qué es la "primera venta"?** Por defecto, el primer registro de la historia del dispositivo, **incluidos los borrados**: borrar todo y volver a registrar no cuenta como primera venta otra vez. Así el pedido de permiso de F7 no se repite. La alternativa es "no hay ningún registro activo".
7. **"No vendí" de la semana anterior de miércoles a domingo** (D-18). La regla de ADR-007 solo ofrece la anterior el lunes y el martes. Por defecto, en F3 la semana anterior **solo** se ofrece así, y F5 (Calendario) permite marcarla desde el detalle de esa semana mientras siga en la ventana. El caso de uso ya acepta cualquiera de las dos.
8. **Dónde está "Esta semana no vendí"**. Por defecto, como botón secundario en la pantalla de registro (destino también del recordatorio). F4 decide si además aparece en Inicio. El designer lo confirma en F3.1.
9. **Qué pasa después de marcar "no vendí"**. Por defecto, una confirmación breve (Toast, sin consejo) y la persona sigue en la pantalla de registro. La alternativa es volver a Inicio. F6 decide si "no vendí" también muestra un consejo.
10. **¿La edición celebra?** Por defecto **no**: guardar cambios muestra un Toast y vuelve al detalle, sin consejo ni pedido de permiso. La celebración y el flujo posventa son solo para registros nuevos.
11. **¿Se puede desmarcar "no vendí"?** Por defecto **sí**, en la misma ventana en que se puede marcar (semana actual y anterior), desde el panel o el calendario.
12. **Fecha mínima.** Por defecto no hay límite hacia atrás en el dominio. `DateField` mueve de a un día, y el designer decide si hace falta un selector de calendario para fechas lejanas.
13. **Tope de ítems por registro.** Por defecto, 100 (`SALE_ITEMS_MAX`), como límite técnico que la persona no debería alcanzar nunca, con un mensaje amable si ocurre.
14. **Total que excede $999.999.999.** Con 9999 unidades y precios altos la suma puede desbordar `Clp`. Por defecto el dominio **satura** en el máximo y registra una advertencia, sin bloquear el guardado (cada ítem es válido). La alternativa es rechazar el registro con un código nuevo.
15. **Ítem de un producto archivado al editar.** Por defecto se conserva y se puede cambiar la cantidad y el precio, pero no elegir otra versión archivada. Cambiarle la versión a una activa sí se permite (copia el costo nuevo).
16. **Dos ítems con la misma versión en un registro.** Por defecto **se permiten** (por ejemplo, el mismo producto vendido a dos precios en la feria). La alternativa es unirlos.
17. **El aviso suave de D-02.** Por defecto la celebración agrega una línea: "Quitamos la marca de 'no vendí' de esa semana". El texto final lo decide el designer.

Ninguna pregunta bloquea F3.2 si se aceptan los valores por defecto. La 2, la 6 y la 7 definen tests del dominio y de los casos de uso, así que conviene confirmarlas antes de F3.2.
