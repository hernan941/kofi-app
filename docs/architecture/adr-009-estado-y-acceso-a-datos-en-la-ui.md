# ADR-009: Manejo de estado y acceso a datos en la UI

- **Estado**: Aceptado
- **Fecha**: 2026-11-12 (revisado 2026-11-13 tras la revisión del reviewer)
- **Versiones verificadas (npm, 2026-11-12)**: `@tanstack/react-query` 5.107.1, `react-hook-form` 7.92.0 (la v8 está en beta), `@hookform/resolvers` 7.0.6. Revisadas como alternativas: `zustand` 5.1.0, `useLiveQuery` de `drizzle-orm/expo-sqlite`, `addDatabaseChangeListener` de `expo-sqlite`.

## Contexto
- La fuente de verdad es SQLite (ADR-006). La UI tiene que leer de forma reactiva: después de guardar una venta, Inicio, Calendario y Racha se actualizan solos, incluso las pantallas que siguen montadas en el stack.
- Los componentes no pueden depender de Drizzle ni de `expo-sqlite` (ADR-005), y los datos no se duplican en un store global.
- Hay formularios con listas dinámicas: versiones del producto e ítems de la venta.
- Con la sincronización futura, también va a escribir en la base un proceso que no es la UI.

## Opciones consideradas

### Lectura reactiva
| Opción | Pros | Contras |
|---|---|---|
| **`useLiveQuery` de Drizzle en componentes** | Mínimo código, reactivo por tabla. | Acopla la UI al query builder (rompe ADR-005), no pasa por los repositorios, tiene caché global limitada y depende del *update hook* de SQLite, que avisa por fila y no detecta ciertas operaciones. |
| **Store global (Zustand) espejo de la base** | Lecturas síncronas. | Duplica datos, hay que mantener dos fuentes coherentes y crece el consumo de memoria. Lo desaconsejan las reglas del proyecto. |
| **Hook propio `useRepositoryQuery`** | Sin dependencias. | Reimplementa caché, deduplicación, estados de carga y error, cancelación y GC. Es un costo de mantenimiento sin beneficio. |
| **TanStack Query sobre repositorios, con invalidación por tablas modificadas** | Estándar del ecosistema: caché compartida entre pantallas, deduplicación, estados explícitos, `select` para suscripciones estrechas, consultas paginadas e infinitas, devtools. Testeable con un `QueryClient` nuevo por test. Ya sirve para el estado de servidor cuando llegue el backend. | Es una dependencia más y requiere disciplina con las query keys. |

### Disparador de la invalidación
- **Invalidar a mano en cada `useMutation`.** Contras: es fácil olvidar una clave, y las escrituras que no vienen de la UI (sync, restauración) no invalidan.
- **`addDatabaseChangeListener` de `expo-sqlite`.** Contras: avisa por fila, puede llegar en medio de una transacción, depende del motor y no existe en los tests con `better-sqlite3`.
- **Notificador explícito de cambios** emitido por la capa de transacciones de los repositorios **después del commit**, con el conjunto de tablas tocadas. Pros: no depende del motor, es determinista en tests y cualquier escritor (UI, restauración, sync) pasa por ahí.

### Estado de formularios
- **`useState` a mano.** Contras: con listas dinámicas y validación por campo termina en mucho código propenso a errores.
- **React Hook Form + resolver de Zod.** Pros: es el estándar, tiene `useFieldArray` para versiones e ítems, renderiza poco y valida con los mismos esquemas del dominio (ADR-010).

## Decisión
1. **TanStack Query** es la única vía de lectura de datos persistidos en la UI. Los hooks de cada feature (`features/<f>/hooks/`) llaman a los repositorios obtenidos del `DependenciesProvider`. Los componentes nunca ven repositorios ni Drizzle.
2. **Configuración del `QueryClient`** para datos locales:
   - `networkMode: 'always'`, porque las consultas locales no se pausan sin red.
   - `staleTime: Infinity`, porque los datos solo cambian por escrituras propias, que invalidan.
   - `retry: false`, porque un error local es determinista y se muestra.
   - `refetchOnWindowFocus: false`.
   - `gcTime` por defecto.
3. **Notificador de cambios por tablas**: `runInTransaction` (ADR-006) es la **única vía de escritura de los repositorios** (la reciben por constructor junto con la base para leer). Acumula las tablas tocadas y, después del commit, emite `DataChanges.emit(tables)`. Un único puente en `core/providers` traduce tablas → raíces de query keys e invalida. Cada feature declara de qué tablas dependen sus claves:

```ts
/** Rango cerrado de fechas locales de una semana ISO. */
export interface WeekRange {
  readonly start: LocalDate;
  readonly end: LocalDate;
}

/** Nombre de tabla de la base, tomado del esquema Drizzle. */
export type TableName =
  | 'products'
  | 'product_versions'
  | 'product_photos'
  | 'sale_records'
  | 'sale_items'
  | 'no_sales_weeks'
  | 'tip_views'
  | 'notification_preferences';

/** Canal de avisos de cambios confirmados en la base. */
export interface DataChanges {
  /** Emite las tablas modificadas por una transacción ya confirmada. */
  emit(tables: ReadonlySet<TableName>): void;
  /**
   * Suscribe un oyente a los cambios.
   *
   * @returns Función que cancela la suscripción.
   */
  subscribe(listener: (tables: ReadonlySet<TableName>) => void): () => void;
}

/** Relación entre una raíz de query keys y las tablas de las que depende. */
export interface QueryDependency {
  readonly rootKey: readonly [string];
  readonly tables: ReadonlySet<TableName>;
}

/** Claves de consulta de la feature de ventas, centralizadas en una fábrica. */
export const salesKeys = {
  all: ['sales'] as const,
  between: (from: LocalDate, to: LocalDate) => ['sales', 'between', from, to] as const,
  recent: () => ['sales', 'recent'] as const,
  detail: (id: SaleRecordId) => ['sales', 'detail', id] as const,
};
```

   La función pura `rootKeysToInvalidate(dependencies, changedTables)` tiene su test. El puente agrupa los avisos de un mismo tick para no invalidar varias veces.
4. **Escrituras con `useMutation`**, que llaman a un caso de uso o a un repositorio. **No se usan actualizaciones optimistas** (la nota de `.claude/rules/react-native/patterns.md` lo aclara): una escritura local tarda milisegundos y la invalidación es inmediata, así se evita mantener lógica de rollback. Los errores se muestran como estado de UI (ADR-010).
5. **Lecturas acotadas**: las consultas piden rangos de fechas (`listBetween`) o páginas (`useInfiniteQuery` con el cursor `(sold_on, created_at, id)` de ADR-007 para el historial). **El rango forma parte de la query key**, nunca se calcula dentro del `queryFn`. Los agregados (totales, racha, resumen mensual, ganancia) se calculan en funciones puras del dominio con `select` o en el hook, nunca en componentes.
6. **"Hoy" reactivo**: como `staleTime` es `Infinity`, si las consultas calcularan "hoy" por su cuenta, quedarían viejas con la app abierta pasada la medianoche o al volver de segundo plano un día después. Por eso existen dos hooks en `shared`, implementados sobre `Clock` y `LocalCalendar` (ADR-015):
   - `useToday(): LocalDate` recalcula el día cuando la app vuelve a primer plano (`AppState`) y con un temporizador que despierta como máximo cada hora y en la próxima medianoche local. Al desmontar, quita el listener y limpia el temporizador.
   - `useCurrentWeek(): WeekRange` se deriva de `useToday()`.

   Los hooks de "esta semana" y "este mes" toman el rango de estos hooks y lo incluyen en la key: cuando cambia el día, cambia la key y se consulta el rango nuevo. Hay tests con reloj falso que cubren el cruce de medianoche, la vuelta a primer plano y la limpieza.
7. **Estado de UI** en `useState` local. Si dos pantallas necesitan compartir algo efímero, se usa contexto en el layout de ruta común. **No se adopta un store global** (Zustand u otro) mientras no aparezca un caso real. Los parámetros de navegación van por Expo Router, validados (ADR-010).
8. **Formularios con React Hook Form** + `zodResolver`, con `useFieldArray` para versiones e ítems:
   - Tipado con tres genéricos, `useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>`, para que el formulario trabaje con la entrada sin marca (texto o número) y el `onSubmit` reciba la salida con marca (ADR-010).
   - Los inputs de HeroUI Native son controlados, así que se conectan con `Controller`/`useController`, nunca con `register`. El designer provee envoltorios de campo (`FormTextField`, `FormAmountField`) que encapsulan `useController` y el mensaje de error accesible.
   - Por el React Compiler (ADR-013), se usa `useWatch` y `useFormState` en lugar de `watch()` y de leer `formState` desestructurado en el render.
9. **Estados explícitos**: todo hook de lectura expone `isPending`, `isError` y datos vacíos, y cada screen los presenta (accesibles, con texto).

## Consecuencias
- Hay una sola fuente de verdad (SQLite) y una sola caché (TanStack Query). No se duplican datos.
- La UI se actualiza igual venga la escritura de un formulario, de la restauración o del futuro sync, siempre que pase por `runInTransaction`. Escribir por fuera de esa función está prohibido y lo controla el reviewer.
- Tests: los hooks se prueban con `renderHook` dentro de `QueryClientProvider` (un cliente nuevo por test) y `DependenciesProvider` con dobles. El puente de invalidación se prueba aparte.
- Cuando llegue el servidor, sus consultas usan la misma librería, con `networkMode` por defecto en esas claves.
- Hay dos dependencias nuevas justificadas (`@tanstack/react-query` y `react-hook-form` con `@hookform/resolvers`). Ninguna es nativa.
