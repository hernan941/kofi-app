# ADR-010: Validación de datos

- **Estado**: Aceptado
- **Fecha**: 2026-11-12 (revisado 2026-11-13 tras la revisión del reviewer)
- **Versiones verificadas (npm, 2026-11-12)**: `zod` 4.6.7 (`.brand<>()`, `z.input`/`z.output` y validadores de primer nivel como `z.uuid()`), `@hookform/resolvers` 7.0.6 (soporta Zod 4), `react-hook-form` 7.92.0 (`useForm<TFieldValues, TContext, TTransformedValues>`). Revisada: `valibot` 1.5.0.

## Contexto
Hay datos que llegan de fuentes no confiables o semiconfiables:
- formularios;
- parámetros de ruta y deep links, incluidos los de las notificaciones;
- **archivos de respaldo a restaurar** (ADR-012);
- en el futuro, respuestas del servidor.

Las reglas del proyecto exigen validar con esquemas en los bordes e inferir los tipos de los esquemas.

## Opciones consideradas
| Opción | Pros | Contras |
|---|---|---|
| **Zod 4** | Estándar de facto, inferencia, `safeParse`, errores con ruta, marcas (`brand`), integración con RHF, `zod/mini`. Ya aparece en las reglas del proyecto. | Pesa más que Valibot. |
| **Valibot 1** | Muy liviano. | Ecosistema y documentación más chicos. |
| **A mano** | Sin dependencias. | Sin inferencia; duplica tipos y reglas. |

### Tipos con marca: dónde se definen
- **Tipo TS con marca + esquema anotado `z.ZodType<Clp>`**: la marca queda definida dos veces. Además, `z.ZodType<Clp>` fija la entrada como `unknown`, lo que rompe la inferencia de entrada y salida en los formularios.
- **El esquema es la única fuente** (`z.number()….brand<'Clp'>()`) y el tipo sale de `z.infer`: una sola definición, y `z.input` / `z.output` quedan correctos. **Elegida.**

## Decisión
**Zod 4.** Se valida en los bordes, y cada invariante se expresa una sola vez.

### Dónde se valida
1. **Entradas del dominio (comandos)**: `domain/schemas.ts` de cada feature. Los tipos de entrada se infieren. Las fábricas puras devuelven `Result` para las reglas que cruzan entidades.
2. **Formularios**: React Hook Form con `zodResolver` y **los mismos** esquemas, tipado como `useForm<z.input<typeof s>, unknown, z.output<typeof s>>`. Si el formulario necesita otra forma (montos como texto), un esquema de formulario transforma al del dominio con `parseClpInput`, sin duplicar reglas.
3. **Rutas**: `safeParse` de los params y redirección si fallan; nunca un error lanzado durante el render.
4. **Payload de notificaciones**: `safeParse` antes de navegar.
5. **Respaldo a restaurar**: esquemas versionados, *strict*, con límites (ADR-012).
6. **Base de datos**: no se revalidan las filas propias (las garantizan los `CHECK`). Los repositorios convierten a tipos con marca con un *cast* centralizado en el mapeo, documentado y testeado.
7. **Futuro servidor**: toda respuesta se valida antes de entrar al dominio.

### Primitivas compartidas (`shared/domain`, única fuente de tipos con marca)
```ts
/** Monto CLP no negativo; fuente única del tipo `Clp`. */
export const clpSchema = z.number().int().min(0).max(999_999_999).brand<'Clp'>();

/** Fecha local `YYYY-MM-DD` que existe en el calendario; fuente única de `LocalDate`. */
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidCalendarDate)
  .brand<'LocalDate'>();

/** Instante en milisegundos epoch UTC; fuente única de `EpochMs`. */
export const epochMsSchema = z.number().int().nonnegative().brand<'EpochMs'>();

/** UUID en minúsculas; fuente única de `Uuid`. */
export const uuidSchema = z.uuid().brand<'Uuid'>();

/** Id de producto: UUID con marca propia, para que no se mezcle con ids de otras entidades. */
export const productIdSchema = uuidSchema.brand<'ProductId'>();

/** Id de versión de producto. */
export const productVersionIdSchema = uuidSchema.brand<'ProductVersionId'>();

/** Texto obligatorio: recorta espacios, exige al menos un carácter y aplica un máximo. */
export function requiredTextSchema(maxLength: number): z.ZodType<string, string>;

/** Texto opcional: vacío o solo espacios se normaliza a `null`. */
export function optionalTextSchema(maxLength: number): z.ZodType<string | null, string | null | undefined>;

/**
 * Resultado de una operación de dominio que puede fallar por una regla de negocio.
 * Se usa en lugar de excepciones para los errores esperables.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

El resto de los ids siguen el mismo patrón (`saleRecordIdSchema` y otros). Los tipos de retorno exactos de los helpers de texto se ajustan a la API de Zod 4.6 al implementar. Lo que importa es el contrato: la marca se define una sola vez, en el esquema.

### Mensajes
Los esquemas emiten **códigos** estables. La traducción al español, con tono amable, está en la UI de cada feature. Los errores llegan al lector de pantalla asociados a su campo.

### Montos: parseo y formato propios y puros
`Intl` en Hermes depende de la plataforma, y Jest corre en Node con otro `Intl`: un test verde no garantiza el mismo resultado en el teléfono. Por eso **no se usa `Intl` para formatear montos ni nombres de mes**.

- `formatClp(amount: Clp | SignedClp): string`:
  - inserta `.` cada tres dígitos y antepone `$`: `$15.000`, `$0`;
  - para negativos usa `-$5.000` (decisión; solo aparece en una ganancia negativa);
  - el componente `Amount` del sistema de diseño (ADR-014) lo usa.
- `parseClpInput(text: string): Result<Clp, ClpInputError>`. Primero quita los espacios y un `$` inicial. Después acepta **solo**:
  - dígitos sin separadores (`15000`);
  - miles agrupados con punto, bien formados (`^\d{1,3}(\.\d{3})+$`, por ejemplo `15.000` o `1.500.000`).

  Todo lo demás se rechaza, sin adivinar:

  | Entrada | Resultado | Motivo |
  |---|---|---|
  | `1.5` | `invalid_grouping` | Ambiguo: grupo de miles mal formado |
  | `1.50.0` | `invalid_grouping` | Grupos inválidos |
  | `15,000` | `comma_not_allowed` | La coma es decimal en es-CL y CLP no tiene decimales; mensaje: "escribe el monto sin comas" |
  | `15,5` | `comma_not_allowed` | Lo mismo |
  | `-500` | `negative_not_allowed` | Los montos no son negativos |
  | `1000000000` | `too_large` | Excede el máximo |
  | vacío | `empty` | El campo decide si es obligatorio |

  El campo de monto usa `keyboardType="number-pad"`, así que en la práctica llegan solo dígitos. Las reglas cubren el pegado de texto y los teclados externos.
- **Nombres de meses y días** en español: un catálogo propio en `shared/domain/calendar-names.ts`.
- Todo con tests unitarios exhaustivos.

## Consecuencias
- Cada regla y cada tipo con marca se definen una sola vez, y los formularios conservan la inferencia de entrada y salida.
- El formato de montos y fechas es idéntico en Jest, iOS y Android.
- La UI nunca muestra errores crudos de Zod.
- Límites de longitud (decisión, ADR-007): nombres de producto y de versión 80 caracteres, descripción 1000, nota 500.
