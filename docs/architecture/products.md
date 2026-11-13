# Diseño técnico — Productos y versiones (F1)

- **Tarea**: F1.0 de `docs/plan-v1.md`. Rige F1.2 a F1.8.
- **ADRs**: ADR-005, ADR-006, ADR-007, ADR-009 y ADR-010, y `docs/architecture/foundations.md` (patrón `TransactionRunner` + escritores síncronos). **Decisiones**: D-16 y D-27.
- Este documento no cambia ninguna decisión aceptada. Extiende la interfaz `ProductRepository` de ADR-007 con `versionIdsWithSales` (ya prevista en F1.3) y le suma el escritor síncrono `ProductWriter` que describe `foundations.md` (3.2). La sección 6 marca lo que el orquestador tiene que resolver.

---

## 1. Resumen del enfoque

- **El agregado es `Product`** (ADR-007), con sus versiones activas y archivadas y sus fotos. Los **comandos son funciones puras** del dominio. Reciben el producto actual, la entrada ya validada, `Clock`, `IdGenerator` y, cuando hace falta, el conjunto de versiones con ventas. Devuelven `Result<Product, ProductErrors>` y nunca tocan la base.
- **Una sola fuente por regla**:
  - Los esquemas Zod de `domain/schemas.ts` cubren las reglas de cada campo: textos de D-27, precio y costo.
  - Las reglas que cruzan versiones (nombres obligatorios con dos o más versiones activas, unicidad sin mayúsculas ni tildes y al menos una versión activa) son funciones puras de `domain/rules.ts`. Las usan los comandos y el esquema del formulario, este último con `superRefine`.
- **Leer, decidir y escribir en una sola transacción**. Editar, archivar y desarchivar necesitan leer el estado actual (por ejemplo, qué versiones tienen ventas) antes de escribir. Para eso hay un caso de uso por acción en `use-cases/`, que corre `TransactionRunner.run` con el escritor síncrono `ProductWriter`. Así la decisión y la escritura ven el mismo estado (foundations, 3.2).
- **Quitar una versión** no obliga a la UI a adivinar. El caso de uso decide dentro de la transacción: si la versión tiene ventas, la archiva; si no, la borra lógicamente (ADR-007, regla 2). Ninguna verificación queda vieja entre la lectura de la pantalla y la escritura.
- **Lectura reactiva** con TanStack Query y dos raíces de query keys. `['products']` depende de las tablas de productos. `['product-version-usage']` depende de las de ventas, para que guardar una venta no recargue la lista de productos.
- **Formulario** con React Hook Form, `useFieldArray` para las versiones, montos como texto transformados a `Clp` con `clpTextSchema` (y un nuevo `optionalClpTextSchema` para el costo), y `useWatch`/`useFormState` en vez de `watch()` (ADR-009).

---

## 2. Archivos a crear o modificar

### 2.1 Feature `src/features/products/`

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `domain/product.ts` | Reexporta los tipos `Product`, `ProductVersion`, `ProductPhoto` y `VersionPricing` de ADR-007 (se definen acá, una sola vez). Incluye los comandos `createProduct`, `updateProduct`, `archiveProduct` y `unarchiveProduct`, y las funciones de lectura tolerantes (`activeVersions`, `hasSingleActiveVersion`, `compareProductsForList`). | F1.2 |
| `domain/version.ts` | Comandos de versión `addVersion`, `archiveVersion`, `deleteVersion` y `removeVersion`; `nextVersionPosition`; `firstVersionNameOnSplit` (D-16). | F1.2 |
| `domain/schemas.ts` | Esquemas Zod de las entradas de los comandos (D-27, precio, costo e ids). Los tipos de entrada se infieren. | F1.2 |
| `domain/rules.ts` | Reglas que cruzan versiones: `versionNameKey` (comparación sin mayúsculas ni tildes), `versionNameIssues`, `activeVersionIssues` y `validateProduct`. Funciones puras, sin Zod. | F1.2 |
| `domain/errors.ts` | `PRODUCT_ERROR_CODES` (lista `as const`), `ProductErrorCode`, `ProductError` y `ProductErrors`. Archivo extra respecto de la lista del plan: separa los códigos para que `components/error-messages.ts` y su test los recorran sin importar los comandos. | F1.2 |
| `domain/index.ts` | API pública del dominio (tipos, esquemas, comandos de lectura y códigos). Otras features (`sales`, `tracking`, `tips`, `backup`) importan solo de acá. | F1.2 |
| `data/product-repository.ts` | Interfaces `ProductRepository` (ADR-007 + `versionIdsWithSales`) y `ProductWriter` (síncrona). Solo tipos. | F1.3 |
| `data/drizzle-product-repository.ts` | `createDrizzleProductRepository(access)`: implementa las dos interfaces con el query builder básico de Drizzle. Mapea filas a tipos con marca con un *cast* centralizado (ADR-010, punto 6). | F1.3 |
| `data/product-repository.contract.ts` | Suite de contrato compartida: la corren la implementación Drizzle y el doble en memoria, para que el doble no mienta. | F1.3 |
| `data/testing/sales-fixtures.ts` | Helper solo para tests: inserta `sale_records` y `sale_items` directamente con Drizzle (la feature de ventas todavía no existe). | F1.3 |
| `testing/in-memory-product-repository.ts` | Doble de `ProductRepository & ProductWriter` para los tests de UI (proyecto `ui`, sin `better-sqlite3`). Emite `DataChanges` como la implementación real. | F1.3 |
| `use-cases/save-product.ts` | `saveProduct(deps, command)`: crea o edita dentro de una transacción. | F1.4 |
| `use-cases/set-product-archived.ts` | `setProductArchived(deps, command)`: archiva o desarchiva dentro de una transacción. | F1.4 |
| `hooks/query-keys.ts` | `productKeys` y `PRODUCTS_QUERY_DEPENDENCIES`. | F1.4 |
| `hooks/use-active-products.ts`, `use-archived-products.ts`, `use-product.ts`, `use-version-ids-with-sales.ts` | Lecturas con `useQuery`. | F1.4 |
| `hooks/use-save-product.ts`, `use-set-product-archived.ts` | Escrituras con `useMutation`. Devuelven el `Result` del dominio sin lanzar. | F1.4 |
| `components/product-form-schema.ts` | Esquema del formulario: texto → entrada del dominio, con `clpTextSchema`/`optionalClpTextSchema` y `superRefine` sobre `versionNameIssues`. Valores iniciales desde un `Product` (`toProductFormValues`) y salida (`toSaveProductInput`). | F1.5 |
| `components/product-form.tsx` | Formulario completo (nombre, descripción, versiones). Divulgación progresiva según el designer (F1.1). | F1.5 |
| `components/version-fields.tsx` | Fila de una versión: nombre (solo con dos o más), "a convenir", precio, "agregar costo" y quitar. | F1.5 |
| `components/product-list.tsx`, `product-list-item.tsx`, `product-detail.tsx` | Presentación de la lista y del detalle; montos con `Amount`. | F1.5 |
| `components/error-messages.ts` | `PRODUCT_ERROR_MESSAGES: Record<ProductErrorCode, string>`, en español y sin culpa, más `describeProductError`. | F1.5 |
| `screens/products-screen.tsx` (reemplaza la provisoria), `archived-products-screen.tsx`, `product-detail-screen.tsx`, `new-product-screen.tsx`, `edit-product-screen.tsx` | Componen hooks y componentes. Reciben callbacks de navegación (`onSaved`, `onOpenProduct`, `onOpenArchived`) desde las rutas (ADR-005). | F1.6 |
| `index.ts` | API pública para UI y composición. Exporta las screens, `PRODUCTS_QUERY_DEPENDENCIES`, `productKeys` y los tipos `ProductRepository` y `ProductWriter` (`export type`). | F1.6 |

### 2.2 Rutas (`src/app/`)

| Archivo | Responsabilidad |
|---|---|
| `(tabs)/products.tsx` (existe) | Renderiza `ProductsScreen` y le pasa la navegación a `/products/new`, `/products/archived` y `/products/[id]`. |
| `products/new.tsx` | `NewProductScreen`; `onSaved(id)` vuelve a la lista (o reemplaza por el detalle, según F1.1). |
| `products/archived.tsx` | **Nueva, no está en la lista de F1.6**: `ArchivedProductsScreen`. La ruta estática gana sobre `[id]`. |
| `products/[id].tsx` | `parseRouteParams(z.object({ id: productIdSchema }), params)`; si falla, `NotFoundScreen`. Si es válido, renderiza `ProductDetailScreen`. |
| `products/[id]/edit.tsx` | Igual validación; `EditProductScreen`. |

El designer decide en F1.1 si `new` y `edit` se presentan como modal. Un archivo `[id].tsx` puede convivir con la carpeta `[id]/` en Expo Router; si en F1.6 da problemas, se usa `[id]/index.tsx`, que es equivalente.

### 2.3 Código existente que se modifica

| Archivo | Cambio | Tarea |
|---|---|---|
| `src/core/providers/app-dependencies.ts` | Agrega `readonly products: ProductRepository` y `readonly productWriter: ProductWriter` (`import type` desde `@/features/products`). | F1.4 |
| `src/core/dependencies/create-app-dependencies.ts` | Comparte **una sola** instancia de `RunInTransaction` entre el `TransactionRunner` y los repositorios: `getRunInTransaction = once(...)`. Hoy se crea dentro de `getRunner`, y si un repositorio creara otra, la llamada interna no se uniría a la externa: abriría una transacción anidada (ver 6.2). Crea el repositorio Drizzle con acceso diferido a la base y lo asigna a `products` y `productWriter`. | F1.4 |
| `src/core/providers/query/query-dependencies.ts` | `QUERY_DEPENDENCIES = [...PRODUCTS_QUERY_DEPENDENCIES]`. | F1.4 |
| `src/core/testing/create-test-dependencies.ts` | Por defecto, `products` y `productWriter` apuntan a un `InMemoryProductRepository` conectado al mismo `dataChanges`. | F1.4 |
| `src/shared/ui/forms/clp-text-schema.ts` (o archivo hermano) | Agrega `optionalClpTextSchema`: texto vacío o con solo espacios → `null`; cualquier otro texto se pasa por `parseClpInput`. Hace falta para el costo. | F1.5 |
| `tools/eslint/layer-boundaries.js` | Ajuste para que `core/dependencies` pueda importar `@/features/*/data/drizzle-*` (ver 6.1). Requiere decisión del orquestador. | antes de F1.4 |

---

## 3. Tipos e interfaces principales (firmas)

### 3.1 Dominio: tipos del agregado
`Product`, `ProductVersion`, `ProductPhoto` y `VersionPricing` son **exactamente** los de ADR-007. Se definen en `domain/product.ts` y no se redefinen en ninguna otra capa. Cómo se interpretan:
- `Product.versions` contiene las versiones **no borradas**: activas (`archivedAt === null`) y archivadas, ordenadas por `(position, id)`. ADR-007 dice "versiones activas" en el sentido de "no borradas", porque el tipo trae `archivedAt`.
- `Product.photos` se lee desde F1 (vacío hasta F2) y está ordenado por `position`. **F1 no escribe fotos**: `save` no toca `product_photos`. Las escrituras de fotos las define F2.0.

```ts
/** Nombre que recibe la primera versión cuando el producto pasa a tener dos (D-16). Es un dato, no un texto de UI. */
export const DEFAULT_FIRST_VERSION_NAME = 'Estándar';

/** Límites de longitud de D-27. */
export const PRODUCT_NAME_MAX_LENGTH = 80;
export const VERSION_NAME_MAX_LENGTH = 80;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 1000;
```

### 3.2 Errores por código
```ts
/** Códigos estables de error de productos; la UI los traduce (ADR-010). */
export const PRODUCT_ERROR_CODES = [
  'required',
  'too_long',
  'version_name_required',
  'duplicate_version_name',
  'no_active_version',
  'version_not_found',
  'version_archived',
  'version_has_sales',
  'product_not_found',
] as const;

/** Código de error de productos. */
export type ProductErrorCode = (typeof PRODUCT_ERROR_CODES)[number];

/**
 * Ruta del campo afectado, con la forma de las rutas de Zod y de React Hook Form:
 * `['name']`, `['versions', 1, 'name']`. Vacía si el error es del producto entero.
 */
export type ProductErrorPath = readonly (string | number)[];

/** Error de una regla de productos, asociado a un campo cuando corresponde. */
export interface ProductError {
  readonly code: ProductErrorCode;
  readonly path: ProductErrorPath;
}

/** Uno o más errores; un comando que falla devuelve todos los que encontró. */
export type ProductErrors = readonly [ProductError, ...ProductError[]];
```

| Código | Origen | Ruta | Cuándo |
|---|---|---|---|
| `required` | esquema (`requiredTextSchema`) | `['name']` | Nombre de producto vacío o con solo espacios |
| `too_long` | esquema | `['name']`, `['description']`, `['versions', i, 'name']` | Supera D-27 después de recortar |
| `version_name_required` | `versionNameIssues` | `['versions', i, 'name']` | Dos o más versiones activas y una sin nombre |
| `duplicate_version_name` | `versionNameIssues` | `['versions', i, 'name']` (cada repetida **salvo la primera**) | Mismo `versionNameKey` entre versiones activas |
| `no_active_version` | `activeVersionIssues` | `['versions']` | El resultado quedaría sin versiones activas |
| `version_not_found` | comando | `['versions', i]` o `[]` | El id no pertenece al producto o está borrado |
| `version_archived` | comando | `['versions', i]` | Se intenta editar o archivar una versión ya archivada |
| `version_has_sales` | `deleteVersion` | `[]` | Borrar una versión con ventas (solo por llamada directa; la UI usa `removeVersion`) |
| `product_not_found` | caso de uso | `[]` | El producto no existe o está borrado |

Los errores de monto (`empty`, `invalid_grouping`, etc.) **no** son de productos: los emite `clpTextSchema` en el formulario y los traduce `FormAmountField` con `CLP_INPUT_ERROR_MESSAGES`. El dominio recibe `Clp` ya válido.

### 3.3 Esquemas de entrada (`domain/schemas.ts`)
```ts
export const productNameSchema = requiredTextSchema(PRODUCT_NAME_MAX_LENGTH);
export const productDescriptionSchema = optionalTextSchema(PRODUCT_DESCRIPTION_MAX_LENGTH);
/** Nombre de versión: opcional por campo; si es obligatorio lo decide `versionNameIssues`. */
export const versionNameSchema = optionalTextSchema(VERSION_NAME_MAX_LENGTH);

/** Precio de una versión: fijo con `Clp` (se acepta $0) o a convenir sin precio. */
export const versionPricingSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('fixed'), price: clpSchema }),
  z.object({ mode: z.literal('negotiable') }),
]);

/** Costo opcional, acotado como cualquier `Clp`; puede superar al precio. */
export const versionCostSchema = clpSchema.nullable();

/** Datos de una versión que se crea. */
export const newVersionInputSchema = z.object({
  name: versionNameSchema,
  pricing: versionPricingSchema,
  cost: versionCostSchema,
});

/** Datos de una versión existente que se edita. */
export const versionEditInputSchema = newVersionInputSchema.extend({ id: productVersionIdSchema });

/** Entrada de `createProduct`; al menos una versión. */
export const createProductInputSchema = z.object({
  name: productNameSchema,
  description: productDescriptionSchema,
  versions: z.array(newVersionInputSchema).min(1),
});
export type CreateProductInput = z.output<typeof createProductInputSchema>;

/**
 * Entrada de `updateProduct`. `versions` es la lista deseada de versiones activas, en el orden
 * de la pantalla: las que tienen `id` se editan y las que no se crean. `removedVersionIds`
 * son las versiones activas que el usuario quitó; cada una se archiva o se borra según tenga ventas.
 */
export const updateProductInputSchema = z.object({
  name: productNameSchema,
  description: productDescriptionSchema,
  versions: z.array(z.union([versionEditInputSchema, newVersionInputSchema])).min(1),
  removedVersionIds: z.array(productVersionIdSchema),
});
export type UpdateProductInput = z.output<typeof updateProductInputSchema>;
```
Los esquemas de entrada **no** llevan `superRefine` con las reglas que cruzan versiones: esas las aplican los comandos sobre el resultado final, y el formulario las agrega con su propio `superRefine` (3.7). Así la regla se escribe una sola vez (`rules.ts`) y no se ejecuta sobre un estado intermedio.

### 3.4 Reglas puras (`domain/rules.ts`)
```ts
/**
 * Clave de comparación de un nombre de versión: recorta, colapsa los espacios internos,
 * pasa a minúsculas y quita las tildes (á→a, é→e, í→i, ó→o, ú→u, ü→u, y sus variantes
 * con acento grave y circunflejo), tanto precompuestas como combinantes (U+0300–U+036F).
 * Usa una tabla propia, sin `Intl` ni `String.prototype.normalize`, para que el resultado
 * sea idéntico en Jest y en Hermes (mismo criterio que ADR-010). La `ñ` se conserva
 * (pregunta 6.14).
 */
export function versionNameKey(name: string): string;

/** Nombre con el que se compara o se muestra una versión, tolerante a datos rotos. */
export interface VersionNameEntry {
  readonly name: string | null;
  readonly path: ProductErrorPath;
}

/**
 * Errores de nombre entre las versiones activas: con dos o más, cada una necesita nombre
 * (`version_name_required`) y no puede repetir la clave de una anterior (`duplicate_version_name`).
 * Con una sola, el nombre puede ser `null`. La usan los comandos y el formulario.
 */
export function versionNameIssues(active: readonly VersionNameEntry[]): readonly ProductError[];

/** `no_active_version` si no queda ninguna versión activa. */
export function activeVersionIssues(product: Product): readonly ProductError[];

/**
 * Invariantes de escritura de un producto (ADR-007, reglas 2 y 3). Los comandos la aplican
 * sobre el resultado final, nunca sobre pasos intermedios.
 */
export function validateProduct(product: Product): Result<Product, ProductErrors>;
```

### 3.5 Comandos (`domain/product.ts`, `domain/version.ts`)
```ts
/** Lo que un comando necesita del entorno; se inyecta para que los tests sean deterministas. */
export interface CommandContext {
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** Contexto de los comandos que pueden quitar versiones. */
export interface VersionRemovalContext extends CommandContext {
  /** Versiones del producto con al menos un ítem activo en un registro activo. */
  readonly versionIdsWithSales: ReadonlySet<ProductVersionId>;
}

/** Crea un producto con sus versiones (posiciones 0..n-1); `createdAt = updatedAt = clock.now()`. */
export function createProduct(input: CreateProductInput, context: CommandContext): Result<Product, ProductErrors>;

/**
 * Edita nombre, descripción y versiones en un solo paso. Aplica en este orden, sin validar
 * los pasos intermedios: edita las versiones existentes, crea las nuevas (posición
 * `nextVersionPosition`), quita las de `removedVersionIds` con `removeVersion` y al final
 * llama a `validateProduct`. Las rutas de error se refieren a los índices de `input.versions`.
 * Una versión activa que no está en `versions` ni en `removedVersionIds` se conserva sin cambios.
 */
export function updateProduct(
  current: Product,
  input: UpdateProductInput,
  context: VersionRemovalContext,
): Result<Product, ProductErrors>;

/** Archiva; si ya estaba archivado devuelve el mismo producto (idempotente, sin cambiar `updatedAt`). */
export function archiveProduct(current: Product, clock: Clock): Product;

/** Desarchiva; falla con `no_active_version` si el producto quedó sin versiones activas (ADR-007, regla 15). Idempotente. */
export function unarchiveProduct(current: Product, clock: Clock): Result<Product, ProductErrors>;

/**
 * Agrega una versión. Si el producto tenía una sola versión activa sin nombre, esta recibe
 * `firstVersionNameOnSplit(nuevoNombre)` (D-16). La nueva versión debe tener nombre.
 */
export function addVersion(
  current: Product,
  input: z.output<typeof newVersionInputSchema>,
  context: CommandContext,
): Result<Product, ProductErrors>;

/** Archiva una versión activa; falla con `no_active_version` si era la última. */
export function archiveVersion(current: Product, id: ProductVersionId, clock: Clock): Result<Product, ProductErrors>;

/** Borra lógicamente una versión sin ventas (deja de estar en `versions`); con ventas, `version_has_sales`. */
export function deleteVersion(
  current: Product,
  id: ProductVersionId,
  context: VersionRemovalContext,
): Result<Product, ProductErrors>;

/** "Quitar" de la UI: archiva si la versión tiene ventas y la borra si no. */
export function removeVersion(
  current: Product,
  id: ProductVersionId,
  context: VersionRemovalContext,
): Result<Product, ProductErrors>;

/** Posición de una versión nueva: máximo de las posiciones conocidas + 1, o 0. Nunca renumera. */
export function nextVersionPosition(product: Product): number;

/**
 * Nombre de la primera versión al agregar la segunda (D-16): "Estándar" o, si choca con
 * `otherName` según `versionNameKey`, "Estándar 2", "Estándar 3", etc. (pregunta 6.15).
 */
export function firstVersionNameOnSplit(otherNames: readonly (string | null)[]): string;
```

Funciones de lectura **tolerantes** (regla 15 de ADR-007: no fallan con datos rotos):
```ts
/** Versiones activas en orden; puede estar vacía en datos rotos. */
export function activeVersions(product: Product): readonly ProductVersion[];

/** `true` si hay exactamente una versión activa: la UI no muestra el concepto de versión. */
export function hasSingleActiveVersion(product: Product): boolean;

/** Orden de la lista de productos (pregunta 6.9; por defecto, por `versionNameKey(name)` y después por `createdAt`). */
export function compareProductsForList(a: Product, b: Product): number;
```

Semántica clave:
- **Borrar una versión** en el agregado significa que **deja de estar** en `versions`. El repositorio borra lógicamente las versiones que ya no aparecen (3.6). Es coherente porque `findById` siempre carga todas las versiones no borradas.
- `updatedAt` del producto pasa a `clock.now()` en todo comando que cambia algo. El repositorio usa ese instante para `updated_at` de las filas que escribe.
- **Un producto archivado se puede editar** en el dominio (es la única forma de reparar un producto sin versiones activas antes de desarchivarlo). Que la UI lo ofrezca lo decide el designer (pregunta 6.18).
- La unicidad de nombres se mide **solo entre versiones activas** (pregunta 6.12).

### 3.6 Puertos de datos (`data/product-repository.ts`)
```ts
/** Acceso asíncrono a productos para las lecturas y escrituras simples (ADR-007). */
export interface ProductRepository {
  /** Productos no archivados ni borrados, con sus versiones no borradas y sus fotos. */
  listActive(): Promise<readonly Product[]>;
  /** Productos archivados (no borrados). */
  listArchived(): Promise<readonly Product[]>;
  findById(id: ProductId): Promise<Product | null>;
  /** Versiones por id, en cualquier estado (activas, archivadas y, por tolerancia, borradas); los ids desconocidos se omiten. */
  findVersionsByIds(ids: readonly ProductVersionId[]): Promise<readonly ProductVersion[]>;
  /** Costo actual de cada versión existente (D-26), también de las archivadas; los ids desconocidos no aparecen en el mapa. */
  currentCostsFor(ids: readonly ProductVersionId[]): Promise<ReadonlyMap<ProductVersionId, Clp | null>>;
  /** Versiones del producto con al menos un `sale_item` activo cuyo `sale_record` también está activo. */
  versionIdsWithSales(productId: ProductId): Promise<ReadonlySet<ProductVersionId>>;
  save(product: Product): Promise<void>;
  setArchived(id: ProductId, archivedAt: EpochMs | null, now: EpochMs): Promise<void>;
}

/** Lecturas y escrituras síncronas para usar dentro de `TransactionRunner.run` (foundations, 3.2). */
export interface ProductWriter {
  findByIdSync(id: ProductId): Product | null;
  versionIdsWithSalesSync(productId: ProductId): ReadonlySet<ProductVersionId>;
  /**
   * Inserta o actualiza el producto y sus versiones **por id**:
   * - inserta las nuevas;
   * - actualiza solo las que cambiaron;
   * - borra lógicamente las que ya no están.
   * No toca las fotos.
   * @throws {Error} Si se intenta borrar una versión con ventas (defensa en profundidad; el dominio ya lo impide).
   */
  saveSync(product: Product): void;
  setArchivedSync(id: ProductId, archivedAt: EpochMs | null, now: EpochMs): void;
}

/** Acceso a la base que recibe la implementación Drizzle; la base se abre recién al primer uso. */
export interface ProductDatabaseAccess {
  readonly db: () => AppDatabase;
  readonly runInTransaction: RunInTransaction;
}

/** Implementación Drizzle de las dos interfaces sobre la misma conexión. */
export function createDrizzleProductRepository(access: ProductDatabaseAccess): ProductRepository & ProductWriter;
```

Cómo se sabe si una versión tiene ventas:
```sql
SELECT DISTINCT si.product_version_id
FROM sale_items si
JOIN sale_records sr ON sr.id = si.sale_record_id
JOIN product_versions pv ON pv.id = si.product_version_id
WHERE pv.product_id = ? AND si.deleted_at IS NULL AND sr.deleted_at IS NULL
```
Se une por `product_versions` y no por `sale_items.product_id` (desnormalizado), para no depender de esa copia. Lo cubre el índice `sale_items(product_version_id)`. Las ventas borradas lógicamente **no cuentan** (pregunta 6.13): no se pueden recuperar y la FK sigue siendo válida con la versión borrada lógicamente.

Tablas que toca cada escritura (y que emite `DataChanges` después del commit):

| Método | Tablas |
|---|---|
| `save` / `saveSync` | `products` siempre (cambia `updated_at`); `product_versions` solo si insertó, actualizó o borró alguna |
| `setArchived` / `setArchivedSync` | `products` |

### 3.7 Casos de uso (`use-cases/`)
Se justifican por ADR-005: coordinan `TransactionRunner`, `ProductWriter`, `Clock` e `IdGenerator`, y necesitan leer y decidir dentro de la misma transacción.
```ts
/** Puertos de los casos de uso de productos. */
export interface ProductCommandDeps {
  readonly transactions: TransactionRunner;
  readonly products: ProductWriter;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** Crear o editar desde el formulario. */
export type SaveProductCommand =
  | { readonly kind: 'create'; readonly input: CreateProductInput }
  | { readonly kind: 'update'; readonly productId: ProductId; readonly input: UpdateProductInput };

/**
 * Dentro de `transactions.run`: lee el producto y sus versiones con ventas (al editar),
 * aplica el comando puro y guarda. Devuelve el id guardado o los errores del dominio.
 * Los errores inesperados (base) se propagan como rechazo.
 */
export function saveProduct(deps: ProductCommandDeps, command: SaveProductCommand): Promise<Result<ProductId, ProductErrors>>;

/** Archivar o desarchivar. */
export interface SetProductArchivedCommand {
  readonly productId: ProductId;
  readonly archived: boolean;
}

/** Dentro de `transactions.run`: lee, aplica `archiveProduct` o `unarchiveProduct` y escribe solo si cambió. */
export function setProductArchived(
  deps: ProductCommandDeps,
  command: SetProductArchivedCommand,
): Promise<Result<void, ProductErrors>>;
```

### 3.8 Query keys y dependencias (`hooks/query-keys.ts`)
```ts
/** Claves de consulta de productos. */
export const productKeys = {
  all: ['products'] as const,
  active: () => ['products', 'active'] as const,
  archived: () => ['products', 'archived'] as const,
  detail: (id: ProductId) => ['products', 'detail', id] as const,
};

/** Claves de uso de versiones en ventas; raíz aparte para no recargar productos al vender. */
export const productVersionUsageKeys = {
  all: ['product-version-usage'] as const,
  withSales: (productId: ProductId) => ['product-version-usage', productId] as const,
};

/** Tablas de las que dependen las raíces de productos (ADR-009). */
export const PRODUCTS_QUERY_DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['products'], tables: new Set(['products', 'product_versions', 'product_photos']) },
  { rootKey: ['product-version-usage'], tables: new Set(['sale_items', 'sale_records', 'product_versions']) },
];
```
`QueryDependency` se importa con `import type` desde `@/core/providers/query/root-keys-to-invalidate` (los hooks pueden importar `core/providers`). Las claves de costos actuales para la ganancia (`currentCostsFor`) **no** son de esta feature: las define `tracking` en F4.0, con dependencia de `product_versions`.

### 3.9 Hooks
```ts
export function useActiveProducts(): UseQueryResult<readonly Product[]>;
export function useArchivedProducts(): UseQueryResult<readonly Product[]>;
/** `data === null` es "no encontrado": la screen muestra su estado, no lanza. */
export function useProduct(id: ProductId): UseQueryResult<Product | null>;
/** Pista para la UI (explicar "se archivará porque tiene ventas"); la decisión real la toma el caso de uso. */
export function useVersionIdsWithSales(productId: ProductId): UseQueryResult<ReadonlySet<ProductVersionId>>;
/** `mutateAsync` resuelve con el `Result`; solo rechaza ante errores inesperados, que registra en el logger. */
export function useSaveProduct(): UseMutationResult<Result<ProductId, ProductErrors>, Error, SaveProductCommand>;
export function useSetProductArchived(): UseMutationResult<Result<void, ProductErrors>, Error, SetProductArchivedCommand>;
```
El orden de la lista (`compareProductsForList`) se aplica con `select` en el hook, nunca en el componente ni en SQL.

### 3.10 Formulario (`components/product-form-schema.ts`)
```ts
/** Valores de una fila de versión: todo como texto, tal como lo maneja la UI. */
export interface VersionFormValues {
  /** Id de la versión existente, o `null` si es nueva. No se llama `id` para no chocar con la clave de `useFieldArray`. */
  readonly versionId: string | null;
  readonly name: string;
  readonly pricingMode: 'fixed' | 'negotiable';
  /** Se conserva al pasar a "a convenir", para no perderlo si el usuario vuelve a precio fijo. */
  readonly priceText: string;
  readonly costText: string;
  /** "Agregar costo" ya se tocó, o la versión ya tenía costo. Es estado de presentación; el esquema lo descarta. */
  readonly costVisible: boolean;
}

/** Valores del formulario de producto. */
export interface ProductFormValues {
  readonly name: string;
  readonly description: string;
  readonly versions: readonly VersionFormValues[];
  /** Ids de versiones existentes que el usuario quitó; se aplican al guardar. */
  readonly removedVersionIds: readonly string[];
}

/**
 * Esquema del formulario. Transforma el texto en la entrada del dominio:
 * - `priceText` pasa por `clpTextSchema` solo si `pricingMode === 'fixed'`;
 * - `costText` pasa por `optionalClpTextSchema` (vacío → `null`);
 * - con una sola fila, el nombre de la versión no se muestra y su valor se conserva tal cual.
 * Después, `superRefine` agrega las reglas de `versionNameIssues` con las rutas `versions.i.name`.
 * Los mensajes de los issues son los códigos (`ProductErrorCode` o `ClpInputError`).
 */
export const productFormSchema: z.ZodType<UpdateProductFormOutput, ProductFormValues>;

/** Salida del esquema: la entrada de `updateProduct` (en una creación, `removedVersionIds` va vacío y ninguna versión tiene id). */
export type UpdateProductFormOutput = UpdateProductInput;

/** Valores iniciales: vacío para crear (una fila "fixed" sin costo visible) o desde un `Product` para editar (solo versiones activas). */
export function toProductFormValues(product: Product | null): ProductFormValues;

/** Convierte la salida del formulario en el comando del caso de uso. */
export function toSaveProductCommand(productId: ProductId | null, output: UpdateProductFormOutput): SaveProductCommand;

/**
 * Valores tras tocar "agregar otra versión": agrega una fila vacía y, si había una sola
 * fila sin nombre, le pone `firstVersionNameOnSplit` (D-16), visible y editable.
 */
export function withAddedVersion(values: ProductFormValues): ProductFormValues;

/** Asigna los errores del dominio a los campos (`setError(path.join('.'), { message: code })`); devuelve los que no tienen campo. */
export function applyProductErrors(
  errors: ProductErrors,
  setError: UseFormSetError<ProductFormValues>,
): readonly ProductError[];
```
- `useForm<ProductFormValues, unknown, UpdateProductFormOutput>({ resolver: zodResolver(productFormSchema) })`, con los tres genéricos de ADR-009.
- `useFieldArray({ control, name: 'versions' })`. Agregar una versión aplica D-16 sobre la primera fila (`setValue('versions.0.name', firstVersionNameOnSplit(...))`) **antes** del `append`, con la misma función que usa `addVersion`.
- **Quitar** una fila: si tiene `versionId`, se agrega a `removedVersionIds`. El botón no aparece cuando queda una sola fila. Si `useVersionIdsWithSales` dice que tiene ventas, la UI explica que se archiva y sigue en el historial (texto del designer).
- `useWatch({ name: 'versions' })` decide si se muestra el concepto de versión (más de una fila) y, en cada fila, `useWatch({ name: 'versions.i.pricingMode' })` y `costVisible`. Los errores se leen con `useFormState` o `fieldState`, nunca con `watch()` ni con `formState` desestructurado (ADR-009).
- Los campos usan `FormTextField` y `FormAmountField` con `describeError = describeProductError`. Esa función mezcla `PRODUCT_ERROR_MESSAGES`, `TEXT_ERROR_MESSAGES` y `CLP_INPUT_ERROR_MESSAGES`.
- El botón principal usa `createSubmitHandler` y nunca se deshabilita. Al resolver la mutación:
  - `ok` → `onSaved(id)`;
  - `!ok` → `applyProductErrors`, y los errores sin campo (`no_active_version`, `product_not_found`) se muestran como `Toast` o `ErrorState`.

---

## 4. Flujo de datos y manejo de estado

### 4.1 Lectura
```
ProductsScreen → useActiveProducts() → useDependencies().products.listActive()
              → select: [...].sort(compareProductsForList)
              → estados: isPending → LoadingState | isError → ErrorState | [] → EmptyState | lista
ProductDetailScreen(id) → useProduct(id) → findById → null → estado "no encontrado"
EditProductScreen(id) → useProduct(id) + useVersionIdsWithSales(id) → toProductFormValues(product)
```

### 4.2 Escritura
```
ProductForm (RHF) → submit → productFormSchema (texto → Clp, reglas de nombres)
  → useSaveProduct().mutateAsync(toSaveProductCommand(...))
  → saveProduct(deps): transactions.run(() => {
        current = productWriter.findByIdSync(id)          (update)
        withSales = productWriter.versionIdsWithSalesSync(id)
        result = updateProduct(current, input, { clock, ids, versionIdsWithSales: withSales })
        if ok → productWriter.saveSync(result.value)       (runInTransaction se une a la externa)
        return result
     })
  → commit → DataChanges.emit({products, product_versions})
  → DataChangesBridge → invalidate ['products'] (y ['product-version-usage'] si tocó product_versions)
  → la lista y el detalle montados se recargan solos; el hook no invalida a mano
  → screen: ok → onSaved(id) → la ruta navega | error → campos marcados
```
Archivar y desarchivar siguen el mismo camino con `setProductArchived`. La confirmación (`ConfirmDialog`) es estado local de la screen.

### 4.3 Estado
- **Persistido**: solo en SQLite y en la caché de TanStack Query. Sin store global.
- **Formulario**: en React Hook Form. `costVisible` vive en los valores para que sobreviva a agregar y quitar filas.
- **UI efímera** (diálogo de confirmación, toast): `useState` local de la screen.
- **Navegación**: las rutas validan `id` con `parseRouteParams` y le pasan callbacks a las screens. Las screens no importan `expo-router` para navegar entre features.

### 4.4 Composición (`create-app-dependencies.ts`)
```
dataChanges
getDatabase           = once(openAppDatabase)
getRunInTransaction   = once(() => createRunInTransaction(getDatabase().db, dataChanges))
runInTransaction      = (work) => getRunInTransaction()(work)
transactions          = createTransactionRunner(runInTransaction)
productStore          = createDrizzleProductRepository({ db: () => getDatabase().db, runInTransaction })
products = productWriter = productStore
```
La base sigue abriéndose recién en `migrateDatabase` o en el primer acceso. Construir el repositorio no la toca.

---

## 5. Tests que el code-writer escribe primero

Se suman a los de F1.2 a F1.6 del plan y los precisan.

### 5.1 Dominio (`node`, F1.2)
1. `productNameSchema`: recorta; vacío o solo espacios → `required`; 80 caracteres después de recortar → ok; 81 → `too_long`. Lo mismo para `versionNameSchema` (vacío → `null`) y `productDescriptionSchema` (1000/1001).
2. `versionPricingSchema`: `fixed` sin `price` falla; `fixed` con `0` pasa; `negotiable` con `price` falla (objeto estricto o descartado, según lo que defina el test); `cost` acepta `null`, `0` y `999.999.999`, y rechaza negativos, decimales y `1.000.000.000`.
3. `versionNameKey`: "Print A4" = "print a4"; "Lámina" = "Lamina"; "LÁMINA" = "lamina"; "Print  A4 " = "print a4"; con tilde combinante (`"La\u0301mina"`) = "lamina"; "Año" ≠ "Ano" (si se confirma 6.14).
4. `versionNameIssues`: una entrada con `null` → sin errores; dos con una `null` → `version_name_required` en su ruta; "Print A4" y "print a4" → `duplicate_version_name` solo en la segunda; tres con dos repetidas → un error por repetida.
5. `createProduct`: ids de `SequentialIdGenerator`, `createdAt = updatedAt = clock.now()`, posiciones 0..n-1, `archivedAt = null`, sin fotos; una versión sin nombre → ok; dos sin nombre → errores con rutas `versions.0.name` y `versions.1.name`; devuelve `Result`, nunca lanza.
6. `addVersion` (D-16): una versión `null` + nueva "Print A3" → la primera queda "Estándar"; nueva "estandar" → la primera queda "Estándar 2" y no choca; si la primera ya tenía nombre, no se renombra; la nueva sin nombre → `version_name_required`; posición = máximo + 1, también con archivadas de posición más alta.
7. `updateProduct`:
   - editar nombres sin cambiar posiciones;
   - intercambiar los nombres de dos versiones en un paso → ok, porque no se valida el paso intermedio;
   - quitar una y crear otra con el mismo nombre en un paso → ok;
   - quitar la única activa y crear otra en un paso → ok;
   - quitar todas → `no_active_version`;
   - `removedVersionIds` con ventas → archivada (`archivedAt = now`), sigue en `versions`;
   - sin ventas → ya no está en `versions`;
   - editar una archivada → `version_archived`;
   - un id ajeno → `version_not_found`;
   - las posiciones de las que quedan no cambian (estabilidad);
   - `updatedAt = now`, `createdAt` intacto.
8. `archiveVersion` de la última activa → `no_active_version`; `deleteVersion` con ventas → `version_has_sales`; `removeVersion` decide según `versionIdsWithSales`.
9. `archiveProduct`/`unarchiveProduct`: idempotentes (mismo objeto, `updatedAt` sin cambiar); desarchivar un producto sin versiones activas → `no_active_version`.
10. **Tolerancia (regla 15)**: `activeVersions`, `hasSingleActiveVersion` y `compareProductsForList` no lanzan con un producto sin versiones activas ni con nombres repetidos; `updateProduct` sobre un producto con nombres repetidos exige corregirlos (`duplicate_version_name`).
11. `PRODUCT_ERROR_CODES` no tiene repetidos y el dominio no exporta textos en español salvo `DEFAULT_FIRST_VERSION_NAME`.

### 5.2 Datos (`node`, `createTestDatabase`, F1.3)
12. **Suite de contrato** (`product-repository.contract.ts`), corrida contra Drizzle y contra `InMemoryProductRepository`:
   - `save` de uno nuevo y `findById` lo devuelve igual, con versiones ordenadas por posición;
   - `save` de uno editado actualiza las versiones por id: la versión sin cambios conserva su `updated_at` (en Drizzle se verifica leyendo la fila), la editada lo cambia, la nueva se inserta y la quitada queda con `deleted_at`;
   - `listActive` excluye archivados y borrados; `listArchived` solo archivados;
   - `setArchived` cambia `archived_at` y `updated_at`;
   - `versionIdsWithSales` cuenta solo ítems activos de registros activos, no mezcla productos y devuelve vacío sin ventas;
   - `findVersionsByIds` y `currentCostsFor` incluyen versiones archivadas, omiten los ids desconocidos y dan `null` sin costo;
   - `saveSync` que borra una versión con ventas lanza y no escribe nada.
13. Solo Drizzle:
   - cada escritura emite **un** `DataChanges` con exactamente las tablas de 3.6;
   - `save` sin cambios en versiones emite solo `products`;
   - las lecturas no emiten;
   - un `saveSync` dentro de `transactions.run` se une a la externa y emite una sola vez;
   - el mapeo convierte `pricing_mode`/`price` en `VersionPricing`.

### 5.3 Casos de uso (`node`, base real, F1.4)
14. `saveProduct`:
   - `create` guarda y devuelve el id;
   - `update` de un producto inexistente → `product_not_found`;
   - `update` que quita una versión con ventas la archiva y una sin ventas la borra;
   - un error del dominio no escribe nada ni emite;
   - un error de la base llega como rechazo y hace rollback.
15. `setProductArchived`: archivar y desarchivar; repetir no escribe ni emite; producto inexistente → `product_not_found`.

### 5.4 Hooks (`ui`, `renderWithProviders` + `InMemoryProductRepository`, F1.4)
16. `useActiveProducts`: carga, vacío, datos ordenados y error (el doble lanza).
17. `useSaveProduct`: devuelve el `Result` con errores sin rechazar; con un error inesperado rechaza y lo registra en `RecordingLogger`; después de guardar, `useActiveProducts` montado muestra el producto nuevo **sin invalidar a mano** (por `DataChanges` → puente).
18. Guardar una venta (simulado con `dataChanges.emit({sale_items})`) invalida `useVersionIdsWithSales` y no recarga `useActiveProducts`.

### 5.5 Componentes (`ui`, F1.5)
19. `productFormSchema`:
   - precio "15.000" → `15000`;
   - "a convenir" ignora `priceText`;
   - costo vacío → `null` y "15,5" → `comma_not_allowed` en `versions.0.costText`;
   - nombres repetidos → error en `versions.1.name`.
20. `withAddedVersion` aplica D-16; `toProductFormValues` solo incluye versiones activas y deja `costVisible` en `true` si había costo.
21. Los del plan (F1.5): con una versión no aparece "versión"; "Agregar costo" muestra el campo solo al tocarlo; "A convenir" oculta el precio; errores como texto asociado al campo, con ícono; agregar y quitar versiones; montos con `Amount`.
22. `PRODUCT_ERROR_MESSAGES` tiene un texto para **cada** elemento de `PRODUCT_ERROR_CODES` (el test los recorre), sin palabras de culpa ("error", "inválido", "incorrecto"; lista final con el designer).
23. `applyProductErrors` asigna los errores con ruta y devuelve los que no la tienen.

### 5.6 Screens y rutas (`ui`, F1.6)
24. Los del plan: lista vacía con invitación, crear y volver, archivar con confirmación y verlo en archivados, desarchivar, id inválido → not-found (`src/__tests__/products-routes.test.tsx` con `renderRouter`). Se suma: un id válido pero inexistente muestra el estado "no encontrado" de la screen.

### 5.7 E2E al cierre (F1.8, `e2e/maestro/products/`, pendiente de entorno)
- `create-single-version.yaml`: crear con una versión, sin ver la palabra "versión".
- `create-three-versions.yaml`: tres versiones, una "a convenir" y una con costo; comprobar "Estándar" en la primera.
- `edit-version-name.yaml`: editar el nombre de una versión.
- `archive-unarchive.yaml`: archivar, verlo en archivados y desarchivar.
- `version-name-accents.yaml` (sugerido): "Lámina" y "lamina" chocan en el dispositivo, para confirmar `versionNameKey` en Hermes.
- F1 no agrega migraciones, así que no corresponde V-E2E-UPG.

---

## 6. Riesgos y decisiones abiertas para el orquestador

### Técnicas (no contradicen ADRs, pero requieren acción)
1. **El lint impide conectar el repositorio Drizzle.** ADR-005 permite que `core/dependencies` importe implementaciones de `data`, pero `tools/eslint/layer-boundaries.js` lo bloquea por dos lados:
   - `DEEP_IMPORT_PATTERNS` prohíbe `@/features/*/data/**` en todo `src/`;
   - el bloque de la feature prohíbe que su `index.ts` importe `**/data/drizzle-*`.

   El lint es más estricto que el ADR. Propuesta: excepción solo para `src/core/dependencies/**` que permita `@/features/*/data/drizzle-*`, sin reexportar la implementación por el `index.ts`. Es un cambio de tooling de F0.5. Como el reviewer está revisando F0, lo tiene que decidir el orquestador antes de F1.4.
2. **Instancia única de `RunInTransaction`.** Hoy `create-app-dependencies.ts` crea `runInTransaction` dentro del `TransactionRunner`. Si los repositorios recibieran otra instancia, su `runInTransaction` no detectaría la transacción externa y llamaría a `db.transaction` anidado. Eso rompe la emisión única de `DataChanges` y puede fallar en el driver. F1.4 tiene que compartirla (4.4) y agregar un test de composición. Toca código de F0.
3. **Desvíos de la lista de archivos del plan** (todos aditivos): `use-cases/` (justificado en 3.7), `domain/errors.ts`, `testing/in-memory-product-repository.ts`, `data/product-repository.contract.ts` y la ruta `src/app/products/archived.tsx`, que F1.6 no lista y hace falta para "verlo en archivados".
4. **`optionalClpTextSchema` nuevo en `shared/ui/forms`** (F1.5): sin él, un costo revelado y vacío daría `empty`.
5. **Comparación de nombres sin `normalize`.** `versionNameKey` usa una tabla propia para que Jest y Hermes den lo mismo (criterio de ADR-010). Si se prefiere `String.prototype.normalize('NFD')`, hay que verificar antes que exista en el Hermes de las dos plataformas. El E2E sugerido lo confirma en Android.
6. **Longitud de D-27 en unidades UTF-16** (lo que cuentan Zod `.max` y `TextInput maxLength`): un emoji cuenta 2. Es coherente entre el campo y la validación. Si el producto exige "caracteres visibles", haría falta contar *grapheme clusters*, y eso no se recomienda.
7. **`DEFAULT_FIRST_VERSION_NAME = 'Estándar'` vive en el dominio.** Es un dato que se guarda, no un texto de UI, y F1.2 lo exige ("la primera recibe el nombre 'Estándar'"). El reviewer debe tratarlo como excepción explícita a "el dominio no tiene textos de UI".
8. **ADR-007, decisión aplicada 8** dice "se pide su nombre en ese momento, con la sugerencia 'Estándar'". D-16 dice "pasa a llamarse 'Estándar' (editable)". El diseño cumple los dos: el campo aparece con el valor "Estándar" ya escrito y editable, no como placeholder. No es una contradicción, pero el designer debe saberlo.

### De producto (preguntas; cada una tiene un valor por defecto que permite seguir)
9. **Orden de la lista de productos** (no hay columna de posición): por defecto, **alfabético** sin distinguir mayúsculas ni tildes. La alternativa es el más reciente primero.
10. **¿Las versiones archivadas se pueden volver a usar?** El plan no lista `unarchiveVersion`. Por defecto **no** en v1: las versiones archivadas solo existen para el historial. Agregarlo después es aditivo: un comando y una sección en el formulario.
11. **¿El usuario puede elegir archivar una versión sin ventas?** ADR-007 lo permite. Por defecto, "quitar" decide solo: borra si no tiene ventas y archiva si tiene. `archiveVersion` existe en el dominio, pero la UI no lo ofrece.
12. **Unicidad de nombres de versión**: por defecto, **solo entre activas**. Una archivada "Print A4" no impide crear otra activa "Print A4". La alternativa es incluir las archivadas, con riesgo de confusión en el historial.
13. **¿Cuentan las ventas borradas para "tiene ventas"?** Por defecto **no**.
14. **¿"ñ" equivale a "n" al comparar?** ("Año" vs "Ano"). Por defecto **no**: la ñ es una letra y no una tilde de acento.
15. **Colisión de D-16**: si la nueva versión se llama "Estándar", la primera pasa a "Estándar 2" (por defecto). En el formulario esto casi no ocurre, porque el valor se escribe antes de que el usuario nombre la nueva.
16. **Precio fijo de $0**: por defecto **se permite** (coherente con `unit_price` 0 de ADR-007).
17. **Nombres de producto repetidos**: por defecto **se permiten** (no hay regla en `docs/product.md`).
18. **¿Se puede editar un producto archivado desde la UI?** El dominio lo permite, porque es la forma de reparar un producto sin versiones activas. Que la pantalla lo ofrezca lo decide el designer (F1.1). Por defecto, el detalle de un archivado muestra "volver a usar" y también "editar".

Ninguna pregunta bloquea F1.2 si se aceptan los valores por defecto. Las 9, 12 y 14 cambian tests concretos del dominio, así que conviene confirmarlas antes de F1.2.
