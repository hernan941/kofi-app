# Diseño técnico — Consejos (F6)

- **Tarea**: F6.0 de `docs/plan-v1.md`. Rige F6.2 a F6.8.
- **ADRs**: ADR-005 (composición en `src/app/`), ADR-006, ADR-007 (`Tip`, `TipCatalog`, `tip_views`; **enmendado el 2026-11-13** por este diseño), ADR-009 y ADR-010. **Decisiones**: D-06, D-11, D-21 y D-36. Contenido: `docs/content/consejos.md` (30 consejos, aprobado en CP7a). Base: `docs/architecture/sales.md` (`SaleSavedOutcome`, celebración) y `docs/architecture/tracking-calendar.md` (`loadStreak`).
- **Conciliación de categorías** (nota de F0.1, decisión del orquestador): se adoptan las **seis categorías del contenido**. ADR-007 queda enmendado con una nota fechada (sección "Enmiendas" del ADR), sin un ADR nuevo. La enmienda cambia `Tip.topic` (4 valores) por `Tip.category` (6), agrega `Tip.trigger`, define `TipId` con marca y fija que `tip_views.updated_at` es la última vez que se vio el consejo.

---

## 1. Resumen del enfoque

- **Catálogo incluido en la app** como un módulo TypeScript (`tips/domain/catalog.ts`) que transcribe `docs/content/consejos.md`. El archivo Markdown es la fuente editorial y el módulo, la fuente de la app. Un **test de fidelidad** (proyecto `node`) lee el Markdown, lo interpreta con un parser que solo usan los tests y exige que coincida con el módulo campo por campo y en el mismo orden. Así se cumple la aceptación de F6.4 sin parsear Markdown en el teléfono ni agregar un paso de build.
- **Elección pura**: `pickTipAfterSale(tips, views, context)` decide con reglas deterministas:
  1. prioridad por contexto mientras quede un consejo sin ver de ese contexto;
  2. después, cualquier consejo sin ver, en un orden que alterna categorías;
  3. si todos se vieron, el que se vio **hace más tiempo** (`lastSeenAt`).
- **Contextos** (`TipTrigger`): `no_costs`, `first_sale`, `streak`, `no_channel` y `fair_sale`, que corresponden a `sin-costos`, `primera-venta`, `racha`, `sin-canal` y `venta-feria`. `TipContext` reúne los hechos (si hay costos, si es la primera venta, el canal y la racha) y `activeTriggers` los traduce. `racha` se activa con **3 semanas o más**.
- **Visto = mostrado**: un consejo cuenta como visto cuando se muestra en la tarjeta posventa o cuando se abre su detalle en "Consejos". `tip_views` guarda la primera vez (`first_seen_at`) y la última (`updated_at`). Cerrar la tarjeta solo la oculta, porque ya está marcada (sección 6, punto 8).
- **Tarjeta dentro de la celebración**, como reserva `docs/design/sales.md` (UX-S9 y 3.7). La ruta `src/app/sales/new.tsx` inserta en `NewSaleScreen` el componente `AfterSaleTip` de `tips` mediante una prop de render (`renderAfterSave`). Las features no se importan entre sí: compone la ruta (ADR-005). Solo aparece al **crear** una venta, nunca al editar (D-36), ni al marcar "no vendí", ni en Inicio (D-11).
- **Elección congelada por venta**: el consejo de una venta se calcula una vez, con una query key por `recordId` en una raíz **sin tablas de las que dependa**. Marcar el consejo como visto no provoca otra elección mientras la celebración sigue abierta, así que el consejo que se cerró no vuelve a aparecer en esa venta (F6.6).
- **Sección "Consejos"** por categoría, con los vistos marcados con ícono y texto. El detalle va en `/tips/[id]`, y un id desconocido lleva a la lista.

---

## 2. Archivos a crear o modificar

### 2.1 Feature `src/features/tips/`

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `domain/tip.ts` | `TIP_CATEGORIES`, `TipCategory`, `TIP_TRIGGERS`, `TipTrigger`, `tipIdSchema`, `TipId`, `Tip`, `TipCatalog`, `TipView`, `TIP_TITLE_MAX_LENGTH` y `TIP_BODY_MAX_LENGTH` (fijados en F6.2: 50 y 240). | F6.3 |
| `domain/context.ts` | `TipContext`, `STREAK_TIP_MIN_WEEKS`, `activeTriggers(context)` y `hasAnyCostLoaded(products)`. | F6.3 |
| `domain/pick.ts` | `TRIGGER_PRIORITY`, `EXCLUSIVE_TRIGGERS`, `rotationOrder(tips)` y `pickTipAfterSale(tips, views, context)`. | F6.3 |
| `domain/sections.ts` | `tipSections(tips, views)` (por categoría, en el orden de `TIP_CATEGORIES`, con `seen`) y `findTip(tips, id)`. | F6.3 |
| `domain/catalog.ts` | `BUNDLED_TIPS: readonly Tip[]` (los 30 consejos, en el orden del Markdown) y `bundledTipCatalog: TipCatalog`. | F6.4 |
| `domain/index.ts` | API pública del dominio. | F6.3 |
| `domain/testing/parse-tips-markdown.ts` | Solo para tests: interpreta las fichas de `docs/content/consejos.md` (`### \`id\`` y las líneas `- **campo**: valor`) y traduce los slugs de categoría y contexto a los códigos. | F6.4 |
| `domain/testing/tip-fixtures.ts` | Fábricas de `Tip` y `TipView` para los tests. | F6.3 |
| `data/tip-view-repository.ts` | `TipViewRepository` y `TipViewDatabaseAccess` (solo tipos). | F6.5 |
| `data/drizzle-tip-view-repository.ts` | Implementación con `runInTransaction`; emite `tip_views` después del commit. | F6.5 |
| `data/tip-view-repository.contract.ts` | Contrato compartido por la implementación Drizzle y el doble. | F6.5 |
| `testing/in-memory-tip-view-repository.ts` | Doble para los tests de UI; emite `DataChanges` como la real. | F6.5 |
| `hooks/query-keys.ts` | `tipKeys`, `tipAfterSaleKeys` y `TIPS_QUERY_DEPENDENCIES`. | F6.5 |
| `hooks/use-tip-sections.ts` | Catálogo + `listAll()` → `tipSections`. | F6.5 |
| `hooks/use-tip.ts` | `findTip` + si está visto, para el detalle. | F6.5 |
| `hooks/use-tip-after-sale.ts` | Elección congelada por venta (sección 4.1). | F6.5 |
| `hooks/use-mark-tip-seen.ts` | `useMutation` sobre `markSeen(id, clock.now())`. Un error se registra en el logger y no se muestra: no bloquea nada. | F6.5 |
| `components/category-labels.ts` | `TIP_CATEGORY_LABELS: Record<TipCategory, string>`: "Registro", "Costos", "Precios", "Ferias", "Redes" y "Flujo de dinero". | F6.6 |
| `components/after-sale-tip-card.tsx` | Tarjeta de la celebración: categoría, título, cuerpo y cerrar (`IconButton` con etiqueta). Presentacional. | F6.6 |
| `components/tip-list.tsx` | Secciones por categoría; cada fila con "Visto" (ícono y texto) si corresponde. | F6.6 |
| `components/tip-detail.tsx` | Título, categoría y cuerpo. | F6.6 |
| `screens/tips-screen.tsx` (existe, provisoria) | Lista real. Props: `onOpenTip(id)`. | F6.6 |
| `screens/tip-detail-screen.tsx` | Detalle; lo marca visto al abrirse. Props: `tipId`, `onUnknownTip()`. | F6.6 |
| `screens/after-sale-tip.tsx` | Pieza que se inserta en la celebración: `useTipAfterSale` + tarjeta + marcar visto al mostrarse + estado cerrado local. Sin consejo, error o carga: no dibuja nada. | F6.6 |
| `index.ts` (existe) | Exporta `TipsScreen`, `TipDetailScreen`, `AfterSaleTip`, `TIPS_QUERY_DEPENDENCIES`, `tipIdSchema` (para validar la ruta, que solo importa el `index`, ADR-005) y los tipos `TipViewRepository`, `TipCatalog`, `TipId` y `AfterSaleTipProps`. | F6.6 |

### 2.2 Rutas (`src/app/`)

| Archivo | Responsabilidad |
|---|---|
| `(tabs)/tips.tsx` (existe) | `TipsScreen` con `onOpenTip(id)` → `/tips/[id]`. |
| `tips/[id].tsx` | `parseRouteParams(z.object({ id: tipIdSchema }), params)`. Inválido → `<Redirect href="/tips" />`. Válido → `TipDetailScreen` con `onUnknownTip` → `router.replace('/tips')` (id bien formado pero que no está en el catálogo). |
| `sales/new.tsx` (F3) | Pasa `renderAfterSave={(outcome) => outcome.kind === 'created' ? <AfterSaleTip recordId={outcome.recordId} isFirstSale={outcome.isFirstSale} /> : null}`. `onFinished` no cambia en F6. En F7.8 decide si sigue al pedido de permiso. |

### 2.3 Código existente que se modifica

| Archivo | Cambio | Tarea |
|---|---|---|
| `docs/architecture/adr-007-modelo-de-datos.md` | Nota de enmienda del 2026-11-13 (hecha en F6.0). | F6.0 |
| `src/features/sales/screens/new-sale-screen.tsx` y `components/sale-saved-celebration.tsx` | Prop opcional `renderAfterSave?: (outcome: SaleSavedOutcome) => ReactNode`, que la celebración dibuja en el lugar reservado (`docs/design/sales.md` 3.7, punto 7). Sin la prop no se dibuja nada (comportamiento de F3). | F6.5 |
| `src/core/providers/app-dependencies.ts` | Suma `tipViews: TipViewRepository` y `tipCatalog: TipCatalog` (ya previstos en ADR-005). | F6.5 |
| `src/core/dependencies/create-app-dependencies.ts` | `createDrizzleTipViewRepository({ db, runInTransaction })` con el mismo `runInTransaction` compartido, y `tipCatalog: bundledTipCatalog`. | F6.5 |
| `src/core/testing/create-test-dependencies.ts` | Doble en memoria de `tipViews` conectado al mismo `dataChanges` y un `tipCatalog` de fixtures por defecto (los tests de contenido usan el real). | F6.5 |
| `src/core/providers/query/query-dependencies.ts` | Suma `...TIPS_QUERY_DEPENDENCIES`. | F6.5 |
| `src/shared/lib/testing/guilt-patterns.ts` (nuevo) | Patrones de culpa compartidos por F4.4, F5.3, F6.4 y F7.2 ("llevas … sin", "otra vez", "deberías", "todavía no", "olvidaste", "fallaste", etc.). Solo los importan tests. El listado final lo aprueba el orquestador. | F6.4 |

---

## 3. Tipos e interfaces principales (firmas)

### 3.1 Consejo (`domain/tip.ts`; reemplaza el `Tip` de ADR-007, ver la enmienda)
```ts
/** Categorías del contenido aprobado; los textos en español viven en la UI. */
export const TIP_CATEGORIES = ['recording', 'costs', 'pricing', 'fairs', 'social_media', 'money_flow'] as const;
export type TipCategory = (typeof TIP_CATEGORIES)[number];

/** Situaciones en las que un consejo tiene prioridad después de una venta. */
export const TIP_TRIGGERS = ['no_costs', 'first_sale', 'streak', 'no_channel', 'fair_sale'] as const;
export type TipTrigger = (typeof TIP_TRIGGERS)[number];

/** Slug estable en kebab-case; `tip_views` lo referencia y no cambia nunca. */
export const tipIdSchema = z.string().max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).brand<'TipId'>();
export type TipId = z.infer<typeof tipIdSchema>;

export const TIP_TITLE_MAX_LENGTH = 50;
export const TIP_BODY_MAX_LENGTH = 240;

/** Consejo del catálogo incluido en la app. */
export interface Tip {
  readonly id: TipId;
  readonly category: TipCategory;
  readonly title: string;
  readonly body: string;
  /** Contexto en el que tiene prioridad; `null` si no tiene. */
  readonly trigger: TipTrigger | null;
}

/** Fuente de consejos; hoy incluida en la app, en el futuro remota (ADR-007). */
export interface TipCatalog {
  all(): readonly Tip[];
}

/** Lo que se sabe de un consejo ya visto. */
export interface TipView {
  readonly tipId: TipId;
  readonly firstSeenAt: EpochMs;
  /** Última vez que se mostró (`tip_views.updated_at`). */
  readonly lastSeenAt: EpochMs;
}
```
Correspondencia con `docs/content/consejos.md` (la usa solo el parser de tests):

| Markdown | Código |
|---|---|
| `registro`, `costos`, `precios`, `ferias`, `redes`, `flujo-de-dinero` | `recording`, `costs`, `pricing`, `fairs`, `social_media`, `money_flow` |
| `sin-costos`, `primera-venta`, `racha`, `sin-canal`, `venta-feria` | `no_costs`, `first_sale`, `streak`, `no_channel`, `fair_sale` |

Las `fuentes` no viajan a la app (sección 6, punto 11).

### 3.2 Contexto (`domain/context.ts`)
```ts
/** Racha mínima, en semanas, que activa `streak`. */
export const STREAK_TIP_MIN_WEEKS = 3;

/** Hechos de la venta recién guardada que deciden la prioridad. */
export interface TipContext {
  /** Algún producto activo tiene alguna versión activa con costo (incluido $0). */
  readonly hasAnyCost: boolean;
  /** `SaleSavedOutcome.isFirstSale` (D-36). */
  readonly isFirstSale: boolean;
  readonly channel: SaleChannel | null;
  /** `loadStreak(...).weeks`, ya con la venta guardada. */
  readonly streakWeeks: number;
}

/**
 * `no_costs` si `!hasAnyCost`; `first_sale` si `isFirstSale`; `streak` si `streakWeeks >= 3`;
 * `no_channel` si `channel === null`; `fair_sale` si `channel === 'fair'`.
 */
export function activeTriggers(context: TipContext): ReadonlySet<TipTrigger>;

/** Lo que define `hasAnyCost`, a partir de `ProductRepository.listActive()`. */
export function hasAnyCostLoaded(products: readonly Product[]): boolean;
```
El plan sugería incluir en el contexto "si hay versiones a convenir". Se deja fuera porque ningún consejo del contenido aprobado lo usa (YAGNI). Si se agrega uno, se suma un `TipTrigger` y un campo.

### 3.3 Elección (`domain/pick.ts`)
```ts
/** Orden de prioridad entre contextos activos. */
export const TRIGGER_PRIORITY: readonly TipTrigger[] = ['no_costs', 'first_sale', 'fair_sale', 'streak', 'no_channel'];

/** Contextos cuyos consejos **solo** se eligen después de una venta si el contexto está activo. */
export const EXCLUSIVE_TRIGGERS: ReadonlySet<TipTrigger> = new Set(['first_sale']);

/**
 * Orden de rotación determinista: alterna categorías (el 1.º de cada categoría en el orden de
 * `TIP_CATEGORIES`, después el 2.º, …), respetando el orden del catálogo dentro de cada una.
 */
export function rotationOrder(tips: readonly Tip[]): readonly Tip[];

/**
 * 1. Elegibles: todos, salvo los de un contexto exclusivo que no está activo.
 * 2. Para cada contexto activo en `TRIGGER_PRIORITY`: el primer elegible **sin ver** con ese contexto, según `rotationOrder`.
 * 3. Si no: el primer elegible sin ver según `rotationOrder`.
 * 4. Si todos se vieron: el de menor `lastSeenAt`; si empatan, el primero según `rotationOrder`.
 * 5. Sin elegibles (catálogo vacío): `null`.
 * Las vistas de ids que ya no están en el catálogo se ignoran.
 */
export function pickTipAfterSale(
  tips: readonly Tip[],
  views: ReadonlyMap<TipId, TipView>,
  context: TipContext,
): Tip | null;
```
- "Sin costos, el consejo de costos tiene prioridad **hasta que se vea**" (F6.3): hay dos consejos `sin-costos`. Mientras no haya costos, las dos ventas siguientes muestran uno cada una. Después, `no_costs` no tiene nada sin ver y la elección sigue con el resto.
- Con `lastSeenAt` (y no `firstSeenAt`) la rotación avanza: al volver a mostrar un consejo se actualiza su `lastSeenAt` y pasa al final de la fila. Con `firstSeenAt` se elegiría siempre el mismo.

### 3.4 Secciones (`domain/sections.ts`)
```ts
export interface TipListItem { readonly tip: Tip; readonly seen: boolean }
export interface TipSection { readonly category: TipCategory; readonly items: readonly TipListItem[] }
/** Una sección por categoría con consejos, en el orden de `TIP_CATEGORIES`; dentro, orden del catálogo. */
export function tipSections(tips: readonly Tip[], views: ReadonlyMap<TipId, TipView>): readonly TipSection[];
export function findTip(tips: readonly Tip[], id: TipId): Tip | null;
```

### 3.5 Repositorio (`data/tip-view-repository.ts`)
```ts
/** Consejos vistos (ADR-007: PK = slug, sin `deleted_at`). */
export interface TipViewRepository {
  listAll(): Promise<readonly TipView[]>;
  /**
   * Primera vez: inserta con `first_seen_at = updated_at = now`. Después: solo
   * `updated_at = max(updated_at, now)`, **conserva** `first_seen_at`. Siempre emite `tip_views`.
   */
  markSeen(tipId: TipId, now: EpochMs): Promise<void>;
}
export interface TipViewDatabaseAccess {
  readonly db: () => AppDatabase;
  readonly runInTransaction: RunInTransaction;
}
export function createDrizzleTipViewRepository(access: TipViewDatabaseAccess): TipViewRepository;
```
`markSeen` es un `INSERT … ON CONFLICT(tip_id) DO UPDATE SET updated_at = max(updated_at, excluded.updated_at)`, con literales entre comillas simples (ADR-006). No hacen falta escritores síncronos: no hay casos de uso que lean y escriban en la misma transacción.

### 3.6 Query keys y hooks
```ts
export const tipKeys = {
  all: ['tips'] as const,
  views: () => ['tips', 'views'] as const,
};
/** Elección congelada por venta: no depende de ninguna tabla a propósito. */
export const tipAfterSaleKeys = {
  all: ['tip-after-sale'] as const,
  forRecord: (id: SaleRecordId) => ['tip-after-sale', id] as const,
};
export const TIPS_QUERY_DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['tips'], tables: new Set(['tip_views']) },
  /** Se registra vacía para dejar explícito que no se invalida (sección 4.1). */
  { rootKey: ['tip-after-sale'], tables: new Set() },
];

export function useTipSections(): { readonly status: 'pending' | 'error' | 'ready'; readonly sections: readonly TipSection[] };
export function useTip(id: TipId): { readonly status: 'pending' | 'error' | 'ready'; readonly tip: Tip | null; readonly seen: boolean };
export interface AfterSaleTipInput { readonly recordId: SaleRecordId; readonly isFirstSale: boolean }
export function useTipAfterSale(input: AfterSaleTipInput): UseQueryResult<Tip | null>;
export function useMarkTipSeen(): UseMutationResult<void, Error, TipId>;

export interface AfterSaleTipProps extends AfterSaleTipInput {}
export interface TipsScreenProps { readonly onOpenTip: (id: TipId) => void }
export interface TipDetailScreenProps { readonly tipId: TipId; readonly onUnknownTip: () => void }
```

---

## 4. Flujo de datos y manejo de estado

### 4.1 Después de guardar una venta
```
NewSaleScreen ─ guardar ─► saveSaleRecord ─► ok (kind 'created') ─► celebración
  SaleSavedCelebration ─► renderAfterSave(outcome)  (lo pasa src/app/sales/new.tsx)
    AfterSaleTip({ recordId, isFirstSale })
      useTipAfterSale ─ key ['tip-after-sale', recordId], staleTime Infinity, sin invalidación
        queryFn (después del commit, así que ve la venta):
          record   = sales.findById(recordId)                    → null ⇒ no hay consejo
          products = products.listActive()                        → hasAnyCostLoaded
          streak   = loadStreak({ sales, noSalesWeeks }, isoWeekStart(calendar.localDateOf(clock.now())))
          views    = tipViews.listAll()                           → Map por tipId
          pickTipAfterSale(tipCatalog.all(), views, { hasAnyCost, isFirstSale, channel: record.channel, streakWeeks: streak.weeks })
      tip ≠ null ─► AfterSaleTipCard
                 ─► efecto una vez por montaje: useMarkTipSeen(tip.id)  → tip_views → invalida ['tips']
                                                                          (['tip-after-sale'] no cambia)
      cerrar ─► useState closed = true ─► la tarjeta desaparece; la celebración sigue
  "Listo" ─► onFinished(outcome) ─► la ruta navega (F3: vuelve; F7.8: pedido de permiso en la primera venta)
```
- **Orden respecto del permiso de F7.8**: primero la celebración con el consejo; el pedido de permiso llega **después** de "Listo", desde `onFinished`. El consejo nunca tapa el pedido ni lo contrario. F6.2 lo confirma.
- **Errores**: si la elección falla, `AfterSaleTip` no dibuja nada y registra `logger.warn`. El flujo de la venta no se interrumpe.
- **Carga**: mientras la elección está pendiente no se dibuja nada; el lugar no salta, porque el designer reserva el espacio o anima la entrada (F6.2).
- **Edición y "no vendí"**: no hay `renderAfterSave` (D-36 y `sales.md` 6.9/6.10).
- **D-11**: Inicio no importa `AfterSaleTip` ni ningún hook de `tips`.

### 4.2 Sección "Consejos"
```
TipsScreen ─► useTipSections ─ key ['tips','views'] ─► tipViews.listAll ─► tipSections(catalog, views)
  fila ─► onOpenTip(id) ─► /tips/[id]
TipDetailScreen ─► useTip(id): null ─► onUnknownTip ─► replace('/tips')
                               tip  ─► TipDetail + efecto: useMarkTipSeen(id) ─► invalida ['tips'] ─► la lista lo marca
```

### 4.3 Estado
- Persistido: `tip_views` en SQLite, leído por TanStack Query (`['tips']`). El catálogo es una constante en memoria; no pasa por la caché.
- La elección posventa se guarda en la caché bajo `['tip-after-sale', recordId]` con el `gcTime` por defecto. Es una instantánea deliberada y por eso no va en un store.
- La tarjeta cerrada es `useState` local de `AfterSaleTip`.

### 4.4 Sincronización futura (nota)
`tip_views` se fusiona por unión: gana el `first_seen_at` más antiguo (ADR-007) y el `updated_at` más nuevo (enmienda). El catálogo remoto futuro implementa `TipCatalog`; los ids del catálogo incluido no cambian nunca.

---

## 5. Tests que el code-writer escribe primero

### 5.1 Dominio (`node`, F6.3)
1. `activeTriggers`: cada hecho activa su contexto; `streakWeeks` 2 no activa y 3 sí; `channel` `'fair'` activa `fair_sale` y no `no_channel`; `null` activa `no_channel`.
2. `hasAnyCostLoaded`: sin productos → `false`; un costo de $0 → `true`; un costo solo en una versión archivada → `false`.
3. `pickTipAfterSale` (los del plan):
   - sin costos, un consejo de costos tiene prioridad hasta que se vean los dos;
   - no se repite un consejo visto mientras queden consejos sin ver;
   - cuando todos están vistos, se elige el de menor `lastSeenAt`, no el de menor `firstSeenAt` (caso que lo distingue);
   - el desempate es determinista: misma entrada, mismo resultado; con `lastSeenAt` iguales gana el primero de `rotationOrder`;
   - con el catálogo vacío devuelve `null`.
4. Se suman:
   - primera venta sin costos → consejo de costos (F6.8); primera venta con costos → `registro-primera-venta`;
   - `registro-primera-venta` no se elige nunca fuera de la primera venta, ni siquiera en la rotación con todo visto;
   - venta en feria con costos → un consejo de `fair_sale`;
   - prioridad `fair_sale` sobre `streak` sobre `no_channel` con los tres activos;
   - una vista de un id que no está en el catálogo se ignora.
5. `rotationOrder`: alterna categorías y respeta el orden interno; con categorías de distinto tamaño, las que se terminan se saltan.
6. `tipSections`: 6 secciones en el orden de `TIP_CATEGORIES` con el catálogo real; `seen` según las vistas; una categoría sin consejos no aparece.
7. `tipIdSchema`: acepta `costos-tu-tiempo` y rechaza `Costos`, `costos_tu`, `-costos`, `costos--x` y el texto vacío.

### 5.2 Catálogo (`node`, F6.4)
8. Contenido (los del plan): ids únicos y en kebab-case (`tipIdSchema`); categorías válidas; título ≤ `TIP_TITLE_MAX_LENGTH` y cuerpo ≤ `TIP_BODY_MAX_LENGTH`; ningún texto coincide con `guilt-patterns`; al menos 3 por categoría; entre 20 y 30 en total.
9. **Fidelidad**: `parseTipsMarkdown(fs.readFileSync('docs/content/consejos.md'))` es igual a `BUNDLED_TIPS`, en el mismo orden (id, categoría, título, cuerpo y contexto).
10. Cada `TipTrigger` tiene al menos un consejo; `first_sale` tiene exactamente uno.
11. Montos de ejemplo con el formato `$15.000` (regex: ningún `$` seguido de 4 o más dígitos sin punto).

### 5.3 Datos (`node`, F6.5)
12. Contrato (Drizzle y en memoria): `markSeen` la primera vez crea con `firstSeenAt = lastSeenAt = now`; la segunda **conserva** `first_seen_at` y actualiza `updated_at`; con un `now` anterior no retrocede `updated_at`; `listAll` devuelve todas.
13. Solo Drizzle: cada `markSeen` emite **un** `DataChanges` con `tip_views`; `listAll` no emite.

### 5.4 Hooks (`ui`, F6.5)
14. `useTipAfterSale` usa el contexto de la venta recién guardada: con un registro de canal `'fair'` en el doble y costos cargados, elige un consejo de feria; con `isFirstSale` y sin costos, el de costos.
15. Marcar visto (`dataChanges` de `tip_views`) **no** vuelve a elegir: el consejo de esa venta sigue siendo el mismo (espía en `listAll`: una sola llamada de la elección).
16. Un `recordId` inexistente da `null`; un error de `listAll` da error, que `AfterSaleTip` no dibuja (y queda en `RecordingLogger`).
17. `useTipSections` muestra todos los consejos con los vistos marcados y se actualiza al marcar uno.

### 5.5 Componentes, screens y rutas (`ui`, F6.6)
18. `AfterSaleTip`: al mostrarse llama a `markSeen` una sola vez; cerrar la oculta y no vuelve a aparecer en esa venta (los del plan); sin consejo no dibuja nada; con error, tampoco.
19. `TipList`: "Visto" se anuncia con texto en la etiqueta accesible, no solo con color ni ícono.
20. `TipDetailScreen` marca visto al abrirse.
21. Rutas (`src/__tests__/tips-routes.test.tsx`): `/tips/no-existe` (bien formado, fuera del catálogo) → lista; `/tips/MAL_ID` → lista; un id válido abre el detalle.
22. Integración con F3 (`src/__tests__/sales-routes.test.tsx`): crear una venta muestra la tarjeta en la celebración; editar no la muestra; marcar "no vendí" no la muestra.
23. D-11: `HomeScreen` montada con el catálogo de fixtures no muestra ningún título del catálogo y no llama a `tipViews.listAll`.

### 5.6 E2E al cierre (F6.8, `e2e/maestro/tips/`, pendiente de entorno)
- `first-sale-costs-tip.yaml`: instalación nueva, producto sin costo, primera venta → la celebración muestra un consejo de costos (`costos-para-que-sirven`, el primero según la prioridad); cerrarlo; "Listo".
- `tips-seen.yaml`: en "Consejos", ese consejo aparece como "Visto".
- `home-no-tip.yaml`: Inicio no muestra el consejo.
- `unknown-tip-link.yaml` (sugerido): abrir el enlace interno `/tips/no-existe` (con el esquema de la app de ADR-016) lleva a la lista.
- F6 no agrega migraciones (`tip_views` existe desde `0000`): no corresponde V-E2E-UPG.

---

## 6. Riesgos y decisiones abiertas para el orquestador

### Técnicas
1. **Enmienda de ADR-007 hecha** (decisión del orquestador): `category` con 6 valores, `trigger`, `TipId` con marca y `tip_views.updated_at` = última vez visto (con fusión por el máximo). Los dos últimos puntos **no estaban en la instrucción**. Se incluyen porque la regla "el visto hace más tiempo" necesita la última vista. Si se veta, la rotación con todo visto queda fija en el mismo consejo. El esquema no cambia (la columna ya existe), así que no hay migración.
2. **Tarjeta en la celebración en vez de la ruta `/tips/after-sale`.** ADR-005 da como ejemplo de composición que la ruta navegue a `/tips/after-sale`. Este diseño mantiene el principio (compone `src/app/`, las features no se importan) pero usa una prop de render, porque `docs/design/sales.md` (UX-S9, 3.7 y 6.3) ya reserva el lugar dentro de la celebración y así se ahorra un toque y una pantalla. **El orquestador confirma** si basta con esta nota o si ADR-005 lleva su propia nota de enmienda. La alternativa literal (una ruta `/tips/after-sale?recordId&first`) reutiliza `AfterSaleTip` tal cual.
3. **Cambio aditivo en `sales`** (`renderAfterSave`). Conviene hacerlo en F6.5 y no tocar F3.6/F3.7 mientras están en curso.
4. **Raíz de query sin tablas.** `['tip-after-sale']` se registra con un conjunto vacío a propósito. El reviewer lo verifica: una elección que se invalida rompe F6.6.
5. **El test de fidelidad lee `docs/`** desde Jest (`node`). Si alguien edita el Markdown sin el módulo, o al revés, falla. Es lo que se busca.

### De producto (cada una con valor por defecto)
6. **Racha que activa `racha`.** Por defecto **3 semanas o más** (`STREAK_TIP_MIN_WEEKS`), contando la semana de la venta. Con un solo consejo `racha`, se muestra una vez y después entra en la rotación.
7. **Prioridad entre contextos.** Por defecto `sin-costos` > `primera-venta` > `venta-feria` > `racha` > `sin-canal`. F6.8 exige que la primera venta sin costos muestre el consejo de costos. **Consecuencia**: `registro-primera-venta` solo aparece después de una venta si la persona cargó costos antes de su primera venta (o si lo lee en "Consejos"). La celebración ya felicita la primera venta (`docs/design/sales.md` 3.7), así que no se pierde ese momento. La alternativa es poner `primera-venta` primero y cambiar F6.8.
8. **Cuándo cuenta como visto.** Por defecto, **al mostrarse** (en la tarjeta o en el detalle). Así un gesto de volver, "Listo" sin cerrar la tarjeta o cerrar la app no dejan el consejo como "no visto" para repetirlo. El test del plan ("cerrar lo marca como visto") se cumple, porque al cerrarlo ya está marcado. La alternativa es marcar solo al cerrar o al tocar "Listo".
9. **Contextos exclusivos.** Por defecto solo `primera-venta` es exclusivo (su texto no tiene sentido en otra venta). Los consejos de `sin-costos`, `venta-feria`, `sin-canal` y `racha` también se pueden mostrar en la rotación fuera de su contexto. En el contenido, "contexto" significa prioridad, no exclusividad.
10. **Un consejo en cada venta nueva.** Por defecto **sí** (`docs/product.md`: "Al guardar se muestra un consejo"), también cuando ya se vieron todos (rotación). La alternativa es limitarlos (por ejemplo, uno por día) si resultan repetitivos.
11. **Fuentes en la app.** Por defecto **no** se muestran ni se incluyen en el módulo: son referencias editoriales, mayormente en inglés, y abrir enlaces sumaría una dependencia (`expo-web-browser` o `Linking`). La alternativa es una línea "Fuente" en el detalle.
12. **"No vendí" no muestra consejo** (`sales.md` 6.9), aunque `registro-semana-sin-ventas` encajaría. Por defecto se mantiene así.
13. **Contenido: `registro-para-que-inventario`** sugiere llevar un inventario, y la app no tiene stock (`docs/product.md`, fuera de alcance). El consejo habla de una lista propia, fuera de la app, y está aprobado en CP7a. Se anota por si el usuario prefiere evitar la confusión.

Ninguna pregunta bloquea F6.3 con los valores por defecto. La 6, la 7 y la 9 definen tests del dominio, así que conviene confirmarlas antes de F6.3.
