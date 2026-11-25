# Especificación de pantallas — Registro de ventas (F3)

- **Tarea**: F3.1 de `docs/plan-v1.md`. La usan F3.6 (componentes), F3.7 (pantallas y rutas) y F3.9 (E2E).
- **Fuentes**: `docs/design-system.md` (Bruma), `docs/design/products.md` (F1.1), `docs/design/photos.md` (F2.1), `docs/architecture/sales.md` (F3.0), `docs/product.md` (D-01 a D-04, D-18, D-25, D-27, D-36 a D-38) y los componentes de `@/shared/ui`.
- Este documento no define lógica de negocio. Qué semana se ofrece para "no vendí", si una fecha es futura, si es la primera venta o si se quitó una marca lo deciden el dominio y los casos de uso (`noSalesPrompt`, `validateSoldOn`, `SaleSavedOutcome`); la UI solo lo muestra.

---

## 1. Decisiones de diseño

| Id | Decisión | Por qué |
|---|---|---|
| UX-S1 | **Una sola pantalla de registro.** Mientras no hay nada elegido, la lista de productos está **a la vista** dentro de la pantalla ("¿Qué vendiste?"). Tocar un producto lo agrega y la lista se pliega. Para agregar más, "Agregar otro producto" abre la misma lista en una hoja. | Elegir el producto es lo primero que todos hacen: mostrar la lista directamente ahorra el toque de "Agregar producto". Después de elegir, la lista ya no ocupa espacio y la pantalla queda corta: lo elegido, el total y "Guardar venta". |
| UX-S2 | La **versión** se elige en una hoja, solo si el producto tiene más de una activa. Con una sola, el producto entra directo con su precio. | Es el caso más común y no debe pagar el costo de un paso que no necesita (principio "con una versión no se ve el concepto de versión"). |
| UX-S3 | **El camino más corto son 3 toques** desde Inicio hasta ver la venta guardada (sección 2.1). | Es el número que verifica el E2E (F3.9). |
| UX-S4 | La **fecha va arriba**, con "Hoy" por defecto, y se mueve de a un día con `DateField`. Mañana nunca se ofrece. Para fechas lejanas, "Elegir otra fecha" abre un calendario en una hoja (componente nuevo, sección 6.2). | La persona suele registrar al final de la semana: ayer o anteayer están a uno o dos toques. Arriba, se ve antes de guardar sin tener que buscarla. |
| UX-S5 | **Cantidad y precio a la vista** en cada producto elegido, con el precio precargado y editable. La cantidad se puede escribir además de usar "+" y "−". | El precio editable cubre descuentos (product.md). En ferias se venden stickers o postales de a decenas: tocar "+" 40 veces no es aceptable. |
| UX-S6 | **"Más detalles"** (dónde vendiste y nota) empieza cerrado. Dónde vendiste son chips que se pueden **desmarcar** tocándolos otra vez. | Los dos son opcionales (product.md). Un chip que no se puede desmarcar obligaría a elegir "Otro" para arrepentirse. |
| UX-S7 | **"Esta semana no vendí"** es un botón secundario al final de la pantalla de registro (D-37), visible **solo mientras la persona no agregó ni cambió productos**. Al marcar: aviso breve y se queda en el registro. | Al final no compite con elegir productos ni con "Guardar venta". Esconderlo cuando la persona ya está anotando una venta evita dos botones que dicen cosas opuestas. |
| UX-S8 | Si la fecha elegida cae en una semana marcada como "no vendí", **antes de guardar** aparece una nota tranquila bajo la fecha. Después de guardar, la celebración lo confirma con una línea (D-02). | Nada cambia a escondidas: la persona lo sabe antes y después, sin sentir que hizo algo mal. |
| UX-S9 | Guardar una venta nueva lleva a una **celebración** en la misma pantalla, con el total en grande y un lugar reservado para el consejo de F6. La primera venta tiene su propio título (D-36). Editar no celebra: aviso y vuelta al detalle. | Celebrar refuerza el hábito, que es el corazón de la app. Repetirlo al corregir un precio sería ruido. |
| UX-S10 | Registrar, el detalle y editar son **pantallas apiladas** (push), como en productos (UX-P2). Salir con cambios sin guardar pide confirmación. | Consistencia con F1 y estabilidad con el teclado. |
| UX-S11 | Quitar un producto de la venta **no pide confirmación**, salvo que sea el último al **editar** (eso borra la venta). Borrar la venta desde el detalle **sí** pide confirmación (D-04). | Mientras no se guarda, todo se deshace saliendo sin guardar. La confirmación queda para lo que de verdad borra algo guardado. |
| UX-S12 | El mismo producto se puede agregar **dos veces** como filas separadas (D-38). | Cubre "vendí dos láminas a precio normal y una con descuento". Se anuncia, para que un toque doble por accidente no pase inadvertido. |
| UX-S13 | **Sin productos**, la pantalla invita a crear uno y vuelve al registro con ese producto listo para guardar. "Esta semana no vendí" sigue disponible. | No hay que salir del flujo para empezar. Quien no tiene productos igual puede registrar que no vendió. |

---

## 2. Navegación

```
Inicio "Registrar venta" ─► /sales/new (NewSaleScreen)
   ├─ (sin productos) "Agregar producto" ─► /products/new?from=sale ──(Guardar)──► back() al registro
   ├─ "Guardar venta" ─► celebración (misma pantalla) ─► "Listo" ─► onFinished(outcome)
   │                                                   F3: back() a Inicio (o replace('/') si se llegó por el recordatorio)
   │                                                   F6/F7: consejo y pedido de permiso se enganchan acá
   ├─ "Esta semana no vendí" ─► aviso y se queda en el registro
   └─ Volver con cambios ─► "¿Salir sin guardar?"

Inicio / Calendario: tocar una venta ─► /sales/[id] (SaleDetailScreen)
   ├─ "Editar venta" ─► /sales/[id]/edit ──(Guardar cambios)──► back() al detalle + aviso
   │                                      └─(quitó todo y confirmó)──► vuelve a donde se abrió el detalle + aviso
   └─ "Borrar venta" ─► confirmación ─► back() + aviso
```

- Las tres rutas son pantallas apiladas del `Stack` raíz, sin pestañas, con `ScreenHeader` propio (encabezados nativos ocultos).
- **Durante la celebración**, el botón "Volver", el gesto de iOS y el botón atrás de Android hacen lo mismo que "Listo" (llaman a `onFinished`). Así F6 y F7 nunca se saltan.
- `useConfirmLeave` (ya existe en `shared/lib`) intercepta la salida del registro y de la edición con cambios. Después de guardar, la salida no se intercepta.
- Un id inválido muestra `NotFoundScreen`; un id válido que no existe, el estado "no encontrado" de la pantalla (4.3).

### 2.1 Número de toques (aceptación de F3.1)

**Camino más corto**: catálogo con dos o más productos; el elegido tiene una sola versión con precio fijo; la venta es de hoy, sin canal ni nota.

| Toque | Dónde | Qué pasa |
|---|---|---|
| 1 | Inicio, "Registrar venta" | Abre el registro con la fecha "Hoy" y la lista "¿Qué vendiste?" |
| 2 | La fila del producto | Se agrega con cantidad 1 y su precio; la lista se pliega; aparece el total |
| 3 | "Guardar venta" | Se guarda y se ve la celebración |

- **3 toques** hasta la venta guardada y la celebración a la vista. Un cuarto toque, "Listo", cierra la celebración (en F3 vuelve a Inicio; desde F6 lleva al consejo).
- Si el catálogo tiene **un solo producto vendible con una sola versión**, ya viene cargado (`toSaleFormValues`) y son **2 toques**.
- Cada cosa extra suma: versión (+1, en la hoja), otro producto (+2: "Agregar otro producto" y la fila), cantidad (+1 por unidad con "+", o escribirla), ayer (+1), "a convenir" (escribir el precio).
- El E2E `register-shortest.yaml` usa un catálogo de dos productos y cuenta 3 toques. Como la instalación es nueva, el título que espera es el de la primera venta: "¡Registraste tu primera venta!". Se sugiere un segundo caso con un único producto (2 toques).

---

## 3. Pantallas

Los textos entre comillas son **exactos** (tabla completa en la sección 5). Los tokens son los de `docs/design-system.md`.

### 3.1 Registrar venta (`/sales/new`, `NewSaleScreen`)

`ScreenHeader` con volver y el título **"Registrar venta"**. Debajo, una lista desplazable (`FlatList` o `ScrollView` con `keyboardShouldPersistTaps="handled"`, según si la lista de productos está a la vista) y un **pie fijo** abajo.

**Contenido**, de arriba abajo, con `px-4` y `gap-6` entre secciones:

1. **Fecha**: `DateField` con la etiqueta "¿Cuándo vendiste?", `value = soldOn`, `today = useToday()` y `maxDate = useToday()`. Se lee "Hoy, viernes 13 de noviembre"; con "Día anterior" pasa a "Ayer, …". "Día siguiente" está deshabilitado en hoy.
   - Debajo, a la derecha: `TextButton` "Elegir otra fecha", ícono `CalendarBlank`, que abre la hoja de calendario (3.6).
   - Si la semana de la fecha elegida está marcada como "no vendí" (dato de `useNoSalesPrompt`: solo la semana actual o la anterior), debajo va un `InlineNotice`: "Marcaste esa semana como \"no vendí\". Si guardas esta venta, esa marca se quita." (UX-S8).
2. **"¿Qué vendiste?"** (`text-heading`, rol `header`).
   - **Sin productos elegidos**: la lista de productos vendibles (3.2), dentro de una `Card`, y el mensaje de `no_items` si se tocó "Guardar venta" sin elegir nada (ícono `WarningCircle` + texto `danger`, se anuncia).
   - **Con productos elegidos**: una `Card` con cada producto elegido (3.3), separados por `ListSeparator`, y debajo de la tarjeta `TextButton` "Agregar otro producto", ícono `Plus`, que abre la hoja de 3.4.
3. **Más detalles**: `TextButton` "Más detalles", ícono `CaretDown` (cerrado) o `CaretUp` (abierto), con `accessibilityState={{ expanded }}` y la pista "Dónde vendiste y una nota". Abierto, muestra:
   1. `ChipGroup` con la etiqueta "¿Dónde vendiste? (opcional)" y los chips "Feria", "Redes sociales", "Tienda o consignación", "Encargo" y "Otro". Ninguno elegido al empezar. Tocar el elegido lo desmarca (cambio de `ChipGroup`, 6.2).
   2. `FormTextField` "Nota" con `isOptional` (se ve "Nota (opcional)"), placeholder "Por ejemplo, feria del parque o pedido de Ana", `multiline`, `maxLength={500}` (D-27), alto mínimo de tres líneas.
   - Al abrirlo, el foco va al grupo de chips. Cerrarlo no borra lo elegido; si hay canal o nota, el botón dice "Más detalles (Feria, con nota)" para que se vea que hay algo.
4. **"Esta semana no vendí"** (3.5): solo si la persona todavía no agregó, quitó ni cambió productos (los ítems siguen como empezaron, vacíos o con el precargado). Con `pt-2`, al final del contenido.
5. Relleno inferior suficiente para que el pie fijo no tape nada.

**Pie fijo** (sobre el teclado cuando está abierto, con `FormLayout` (ver `docs/design/tab-bar-and-keyboard.md`), respetando el área segura; fondo `background`, `px-4 pt-2 pb-4`, `gap-2`):

1. **Total** (solo con al menos un producto elegido): fila `flex-row justify-between items-baseline` con "Total" en `text-base font-medium` `foreground` y `Amount` en la variante nueva `total` (6.2), en acento: es el monto principal de esta pantalla. Etiqueta accesible del bloque: "Total: 45.000 pesos". Lo calcula `formTotal(items)` (ignora precios todavía no válidos). Con letra grande, el monto pasa debajo de "Total".
2. `PrimaryButton` **"Guardar venta"**, ícono `Check`. Nunca deshabilitado (`createSubmitHandler`): sin productos o con errores, marca los campos, lleva el foco al primero y anuncia "Revisa los campos marcados". Un segundo toque mientras guarda no envía otra vez; la etiqueta no cambia.

**Sombras a la vista**: la tarjeta de productos (o la de elegidos) y el botón principal: dos. La hoja suma la suya solo mientras está abierta.

**Al guardar**:
- `saved` → la pantalla pasa a la celebración (3.7).
- Errores de campo → `applySaleErrors` (textos de 5.4) y foco al primero.
- Errores sin campo → aviso de error con su texto de 5.4.
- Rechazo inesperado → aviso de error "No se pudo guardar la venta. Inténtalo de nuevo."; todo lo escrito se conserva.

**Medianoche con la pantalla abierta**: `useToday` cambia, el límite pasa al día nuevo y el texto de la fecha se actualiza ("Ayer, …"). La fecha elegida no se mueve sola.

### 3.2 Lista de productos para elegir (`ProductPicker`)

Mismo componente dentro de la pantalla (3.1) y en la hoja (3.4).

- Solo productos **vendibles** (`useSellableProducts`: activos, con al menos una versión activa), en el orden de la lista de productos (D-31).
- **Buscar** (solo con 10 productos vendibles o más): `TextField` "Buscar producto", ícono `MagnifyingGlass`, arriba de la lista. Filtra por nombre sin distinguir mayúsculas ni tildes (la misma normalización de D-31; la función pura la decide el architect). Sin resultados: "No encontramos productos con \"{texto}\"." en `text-base` `muted`.
- **Fila** (`ListRow`, toda la fila es un botón):

| Caso | `leading` | `title` | `subtitle` | Derecha | `accessibilityLabel` |
|---|---|---|---|---|---|
| Una versión, precio fijo | miniatura (UX-F7 de fotos) | nombre | — | `Amount` | "Lámina Colibrí, 15.000 pesos" |
| Una versión, a convenir | miniatura | nombre | "A convenir" | — | "Lámina Colibrí, precio a convenir" |
| Varias, alguna con precio fijo | miniatura | nombre | "3 versiones" | "desde" + `Amount` | "Lámina Colibrí, 3 versiones, desde 10.000 pesos" |
| Varias, todas a convenir | miniatura | nombre | "3 versiones · a convenir" | — | "Lámina Colibrí, 3 versiones, precio a convenir" |

  Es la misma tabla de la lista de productos (`docs/design/products.md`, 3.1) para que la persona reconozca sus filas. La pista de cada fila: "Agrega este producto a la venta" (una versión) o "Elige la versión" (varias).
- **Una versión**: tocar la fila agrega el producto (cantidad 1, precio precargado o vacío si es a convenir), pliega la lista (o cierra la hoja), y anuncia "Agregaste Lámina Colibrí.". Si ya estaba en la venta: "Agregaste otra Lámina Colibrí." (UX-S12).
- **Varias versiones**: tocar la fila muestra el paso de versión (3.4.1).
- **"A convenir"**: después de agregarlo, el foco va a su campo de precio y se abre el teclado numérico.

### 3.3 Producto elegido (`SaleItemFields`)

Cada producto elegido, dentro de la tarjeta, con `gap-3` y `py-3`:

1. **Encabezado**: fila `flex-row items-center gap-3`:
   - miniatura de 40 × 40 (con la regla UX-F7 de fotos, aplicada a los elegidos);
   - columna `flex-1`: nombre (`text-base font-medium`) y, solo si el producto tiene más de una versión, debajo el nombre de la versión (`text-xs` `muted`). Si el producto está archivado (solo al editar), se agrega "Archivado" al final de esa línea ("Print A4 · Archivado" o solo "Archivado"), con el ícono `Archive` de 16.
   - Con varias versiones y el producto activo: `TextButton` "Cambiar", con la pista "Cambia la versión de Lámina Colibrí". Abre el paso de versión de la hoja (3.4.1) para esta fila. Cambiar la versión pone su precio fijo (o vacía el precio si es a convenir) y anuncia "Ahora es Print A3.".
2. **Cantidad y precio**: fila `flex-row flex-wrap gap-4 items-start` (con letra grande, uno debajo del otro):
   - `QuantityStepper` "Cantidad" (con el cambio de 6.2: se puede escribir), `min={1}`, `max={9999}`. Etiqueta accesible: "Cantidad de Lámina Colibrí".
   - `FormAmountField` "Precio de cada uno", `flex-1`, placeholder "15.000". Precargado con el precio fijo (`formatClp` sin `$`). En "a convenir", vacío y con la ayuda "Escribe a cuánto lo vendiste." Etiqueta accesible: "Precio de cada uno, Lámina Colibrí".
3. **Pie de la fila**: fila `flex-row justify-between items-center`:
   - `DeleteButton` con la etiqueta "Quitar" y la pista "Quita Lámina Colibrí de esta venta". Mismo criterio de "Quitar" que UX-P7b de productos.
   - Solo con cantidad mayor que 1: "Subtotal" en `text-sm` `muted` y `Amount` `inline` a la derecha ("Subtotal $30.000"; accesible "Subtotal: 30.000 pesos").

**Quitar**:
- Al **registrar**: la fila sale sin preguntar y se anuncia "Quitaste Lámina Colibrí.". El foco va a "Agregar otro producto" o, si no quedan, al título "¿Qué vendiste?", y la lista de productos vuelve a estar a la vista.
- Al **editar**, si no es el último: igual, sin preguntar (se aplica al guardar).
- Al **editar**, si es el último: abre la confirmación de 3.10.

**Límite de 100 productos** (D-38): con 100 filas, "Agregar otro producto" se reemplaza por el `InlineNotice` "Llegaste a 100 productos en esta venta. Guárdala y registra el resto en otra.".

### 3.4 Hoja "Agregar otro producto"

`Sheet` con el título **"¿Qué más vendiste?"** y la lista de 3.2 dentro. Como la lista puede ser larga, va en una `FlatList` con alto máximo del 70 % de la pantalla.

#### 3.4.1 Paso de versión

Dentro de la misma hoja (no se abre una segunda): el título pasa a **"¿Qué versión de Lámina Colibrí?"**, arriba un `TextButton` "Ver todos los productos" (ícono `CaretLeft`) para volver al paso anterior (no aparece cuando se llegó desde "Cambiar"), y una tarjeta con las versiones activas, en su orden:

| Caso | `title` | `subtitle` | Derecha | `accessibilityLabel` |
|---|---|---|---|---|
| Precio fijo | nombre de la versión | — | `Amount` | "Print A4, 15.000 pesos" |
| A convenir | nombre | "A convenir" | — | "Personalizado, precio a convenir" |

Tocar una versión agrega el producto con esa versión (o la cambia, si se llegó desde "Cambiar"), cierra la hoja y anuncia "Agregaste Lámina Colibrí, Print A4.". Cuando la lista de productos está a la vista dentro de la pantalla (3.1) y se toca un producto con varias versiones, se abre esta hoja directamente en el paso de versión.

### 3.5 "Esta semana no vendí" (`NoSalesPanel`)

Bloque sin tarjeta (no suma sombra), con `gap-2`. Muestra uno de los cuatro `NoSalesPrompt`. Mientras `useNoSalesPrompt` carga o si falla, no se muestra nada (no es la acción principal; el fallo queda en el logger).

| `prompt` | Qué se ve |
|---|---|
| `single`, `current` | Texto `text-sm` `muted`: "¿No vendiste nada esta semana? Anotarlo también cuenta." · `SecondaryButton` **"Esta semana no vendí"**, ancho completo. |
| `single`, `previous` | Texto: "¿No vendiste nada la semana pasada (del {lunes} al {domingo})? Anotarlo también cuenta." · `SecondaryButton` **"La semana pasada no vendí"**. |
| `choose` | Texto: "¿No vendiste nada? Elige la semana." · `ChipGroup` "Semana" con "La semana pasada" (preseleccionada) y "Esta semana", y debajo de cada chip, en el texto de la etiqueta accesible, el rango ("del 2 al 8 de noviembre", "desde el lunes 9") · `SecondaryButton` **"Marcar que no vendí"**. |
| `marked` | `InlineNotice` con el ícono `CheckCircle`: "Marcaste que esta semana no vendiste." · `TextButton` "Desmarcar", con la pista "Quita la marca de esta semana". |
| `has_sales` | `InlineNotice` con el ícono `Info`: "Esta semana ya tiene ventas, así que no hace falta marcar \"no vendí\"." (D-25). Sin botón. |

- Los rangos usan `formatDateLabel` sin el día de la semana cuando cabe; el texto exacto del rango: "del 2 al 8 de noviembre" o, si cruza el mes, "del 30 de noviembre al 6 de diciembre" (y con año si cruza el año).
- **Marcar** (`useMarkNoSales`, sin confirmación: se deshace con "Desmarcar"): éxito → aviso "Listo, anotamos que esta semana no vendiste." (o "…que la semana pasada no vendiste.") y la persona **se queda** en el registro (D-37); el panel pasa a `marked` solo, por invalidación. Error del dominio (`week_has_sales`, `week_not_allowed`) → aviso de error con su texto de 5.4. Rechazo inesperado → "No se pudo marcar. Inténtalo de nuevo.".
- **Desmarcar** (`useUnmarkNoSales`, sin confirmación): éxito → aviso "Quitamos la marca de esta semana." y el panel vuelve a `single`. Rechazo → "No se pudo quitar la marca. Inténtalo de nuevo.".
- Un toque repetido mientras marca o desmarca no envía otra vez.
- Si se marcó la semana **pasada**, el panel muestra lo que quede para esta semana (lo recalcula `noSalesPrompt`).

### 3.6 Hoja de calendario ("Elegir otra fecha")

`Sheet` con el título **"¿Qué día vendiste?"** y el componente nuevo `DatePickerSheet` (6.2):

- Encabezado del mes: `IconButton` "Mes anterior" (`CaretLeft`), el mes y el año en `text-base font-semibold` ("Noviembre de 2026", rol `header`) y `IconButton` "Mes siguiente" (`CaretRight`), deshabilitado en el mes de hoy.
- Fila de iniciales de los días, de **lunes a domingo** (D-01): "L M M J V S D", `text-xs` `muted`, decorativas.
- Grilla de días de 48 × 48 como mínimo. Hoy lleva borde de 2 px `foreground` y el día elegido va relleno de `accent` con texto `accent-foreground` (más el estado `selected`). Los días posteriores a hoy van deshabilitados (opacidad 0.6) y no se pueden tocar (D-03).
- Etiqueta de cada día: `formatDateLabel` ("Ayer, jueves 12 de noviembre"), con "elegido" o "no disponible" en `accessibilityState`.
- Tocar un día lo elige, cierra la hoja y anuncia la fecha. Sin fecha mínima (D-38).

### 3.7 Celebración (`SaleSavedCelebration`)

Reemplaza el contenido del registro (misma ruta). `ScreenHeader` sin título y con volver (que equivale a "Listo"). Contenido centrado con `pt-12` y `gap-4`:

1. Ícono `Confetti` de Phosphor, peso `duotone`, tamaño 48, en `accent` (éxito = acento, sistema de diseño 2.2). Decorativo. Entrada suave (opacidad y escala de 0.9 a 1 en 200 ms); sin animación si el sistema pide reducir movimiento.
2. Título en `text-title`, rol `header`:
   - primera venta (`isFirstSale`): **"¡Registraste tu primera venta!"**;
   - las demás: **"¡Venta registrada!"**.
3. `Amount` variante `display` con el total.
4. Línea `text-base` `muted`: "{fecha} · {n} productos" ("Hoy, viernes 13 de noviembre · 3 productos"; "1 producto" en singular). `n` es la suma de las cantidades.
5. Frase en `text-base` `foreground`:
   - primera venta: "Así empieza tu historial. Cada venta que anotas te ayuda a ver tu ritmo.";
   - las demás: "Ya quedó en tu historial.".
6. Si `clearedNoSalesWeek` no es `null` (D-02): `InlineNotice` con el ícono `Info`: "Como vendiste esa semana, quitamos la marca de \"no vendí\"." (si es la semana actual: "Como vendiste esta semana, quitamos la marca de \"no vendí\".").
7. **Lugar reservado para el consejo de F6** (F6.2 especifica su tarjeta). En F3 no se dibuja nada.
8. Pie fijo: `PrimaryButton` **"Listo"** → `onFinished(outcome)`.

- Al aparecer, el foco va al título y se anuncia "Venta registrada. Total: 45.000 pesos." (o "Registraste tu primera venta. Total: 45.000 pesos.").
- No hay "Registrar otra" ni otras acciones: un solo camino de salida, para que F6 y F7 siempre se ejecuten.
- Sombras: solo el botón (y la tarjeta del consejo cuando llegue F6).

### 3.8 Detalle de venta (`/sales/[id]`, `SaleDetailScreen`)

1. `ScreenHeader` con volver y el título con la fecha: `formatDateLabel(soldOn, today)` ("Hoy, viernes 13 de noviembre"; "Lunes 2 de marzo"; con año si no es el de hoy).
2. "Total" (`text-sm font-medium` `muted`) y debajo `Amount` `display`: el monto principal de la pantalla.
3. `Card` con el título "Lo que vendiste" y una `ListRow` **estática** por ítem, en su orden, separadas por `ListSeparator`:

| Caso | `leading` | `title` | `subtitle` | Derecha | `accessibilityLabel` |
|---|---|---|---|---|---|
| Una versión, cantidad 1 | miniatura | nombre | — | `Amount` del subtotal | "Lámina Colibrí, 15.000 pesos" |
| Con cantidad > 1 | miniatura | nombre | "2 × $15.000" | subtotal | "Lámina Colibrí, 2 de 15.000 pesos, 30.000 pesos" |
| Con versión (`showVersion`) | miniatura | nombre | "Print A4 · 2 × $15.000" | subtotal | "Lámina Colibrí, Print A4, 2 de 15.000 pesos, 30.000 pesos" |
| Producto archivado | miniatura | nombre | "… · Archivado" | subtotal | "…, archivado, …" |

   Los montos del subtítulo con `formatClp`; las etiquetas con `formatClpAccessible`. Los montos de la lista en color de texto, no en acento.
4. **Dónde vendiste** (solo si hay): etiqueta "Dónde vendiste" (`text-sm font-medium` `muted`) y el valor con el ícono `Storefront` de 20 ("Feria").
5. **Nota** (solo si hay): etiqueta "Nota" y el texto en `text-base` `foreground`, seleccionable.
6. Al final del contenido, con `pt-8`: `DeleteButton` "Borrar venta" (no fijo, lejos del pulgar).
7. Pie fijo: `PrimaryButton` "Editar venta", ícono `PencilSimple`.

**Borrar**: `ConfirmDialog` destructivo:
- Título: "¿Borrar esta venta?"
- Descripción: "Se borra la venta del {fecha} por {total}. No se puede deshacer." ("…del viernes 13 de noviembre por $45.000…")
- Confirmar: "Borrar venta". Cancelar: "Cancelar".
- Éxito → `onDeleted()` (la ruta vuelve) y aviso "Venta borrada". Error → el diálogo se cierra, la pantalla queda igual y aviso "No se pudo borrar la venta. Inténtalo de nuevo.". `record_not_found` → aviso "No encontramos esta venta. Puede que ya no exista" y se vuelve.

### 3.9 Editar venta (`/sales/[id]/edit`, `EditSaleScreen`)

El formulario de 3.1, con estas diferencias:

- Título **"Editar venta"**.
- Valores iniciales del registro (`toSaleFormValues(record, today, sellable)`): fecha, ítems en su orden (los de productos archivados también, con su "Archivado"), canal y nota. "Más detalles" empieza **abierto** si hay canal o nota.
- La lista de productos **no** está a la vista (ya hay ítems); para agregar, "Agregar otro producto". Si el registro llega sin ítems (datos rotos), se ve como en 3.1 sin productos elegidos.
- **Sin** panel de "no vendí" ni nota de "esa semana está marcada" (la marca se quita igual al guardar y lo dice el aviso).
- `DateField` con `maxDate = hoy`. Si la fecha guardada quedó "en el futuro" por un cambio de zona horaria, se muestra tal cual; "Día siguiente" queda deshabilitado y la fecha se puede bajar.
- Un ítem de un producto archivado conserva cantidad y precio editables; "Cambiar" versión no aparece (UX: no se puede elegir otra versión de un archivado).
- Pie fijo: total y `PrimaryButton` **"Guardar cambios"**.
- Resultado:
  - `saved` → `onSaved(outcome)` (vuelve al detalle) y aviso "Cambios guardados" (D-36: sin celebración). Si `clearedNoSalesWeek` no es `null`, el aviso es "Cambios guardados. Quitamos la marca de \"no vendí\" de esa semana.".
  - `deleted` (se quitaron todos y se confirmó) → `onDeleted()` y aviso "Venta borrada".
  - `record_not_found` → aviso "No encontramos esta venta. Puede que ya no exista" y `onCancel()`.

### 3.10 Quitar el último producto al editar (confirmación)

`ConfirmDialog` destructivo:
- Título: "¿Borrar esta venta?"
- Descripción: "Si quitas el último producto, la venta se borra. No se puede deshacer."
- Confirmar: "Borrar venta" → envía la edición con `items: []`. Cancelar: "Cancelar" → el producto se queda.

### 3.11 Salir sin guardar

Igual que en productos (3.8 de `docs/design/products.md`), con `useConfirmLeave`:
- Registrar: título "¿Salir sin guardar?", descripción "La venta que estabas anotando no se guardará.", confirmar "Salir sin guardar", cancelar "Seguir anotando".
- Editar: título "¿Salir sin guardar?", descripción "Los cambios que hiciste no se guardarán.", confirmar "Salir sin guardar", cancelar "Seguir editando".
- Marcar o desmarcar "no vendí" no cuenta como cambio del formulario (ya quedó guardado).

---

## 4. Estados

### 4.1 Registrar

| Estado | Qué se ve |
|---|---|
| Cargando productos | Fecha y "¿Qué vendiste?" a la vista; en lugar de la lista, `LoadingState` "Cargando tus productos", `shape="rows"`, `count={4}`. "Guardar venta" visible. |
| Error al cargar productos | En lugar de la lista, `ErrorState` "No se pudieron cargar tus productos. Inténtalo de nuevo." con "Reintentar". La fecha y "no vendí" siguen disponibles. |
| **Sin productos vendibles** | Fecha oculta. `EmptyState`: ícono `Package`; título "Primero, agrega lo que vendes"; descripción "Guarda un producto con su precio y después registras tus ventas en segundos."; principal "Agregar producto" (`onCreateProduct`). Debajo, el panel de "no vendí" (3.5). Sin pie fijo (el botón del estado vacío es el principal: uno por pantalla). |
| Vuelta de crear un producto | La lista se actualiza sola. Si el formulario no tenía cambios, se vuelve a iniciar con `toSaleFormValues`: con un único producto de una versión, ya queda elegido y basta "Guardar venta". Aviso "Producto guardado" (el de F1). |
| Con productos, nada elegido | 3.1 con la lista a la vista. |
| Con productos elegidos | 3.1 con la tarjeta de elegidos y el total. |
| Errores de validación | En cada campo, borde `danger`, `WarningCircle` y texto (ya lo hace `TextField`). `no_items` bajo "¿Qué vendiste?". |
| Guardando | Igual; los toques repetidos se ignoran. |
| Éxito | Celebración (3.7). |
| Error al guardar | Aviso de error; el formulario no cambia. |

### 4.2 "No vendí"

| Estado | Qué se ve |
|---|---|
| Cargando o error | Nada (3.5). |
| `single` / `choose` / `marked` / `has_sales` | 3.5. |
| Marcado con éxito | Aviso y el panel pasa a `marked`. |
| Error | Aviso de error; el panel no cambia. |

### 4.3 Detalle

| Estado | Qué se ve |
|---|---|
| Cargando | Encabezado con volver y sin título; `LoadingState` "Cargando venta", `shape="cards"`, `count={2}`. Sin botón principal. |
| Error | Encabezado con volver; `ErrorState` "No se pudo cargar esta venta. Inténtalo de nuevo." |
| No encontrado (`not_found`) | Encabezado con volver; `EmptyState`: ícono `Receipt`; título "No encontramos esta venta"; descripción "Puede que ya no exista."; principal "Volver". |
| Listo | 3.8. Si un producto no se encuentra (datos rotos), la fila dice "Producto sin nombre" y sigue mostrando el monto. |

### 4.4 Editar

| Estado | Qué se ve |
|---|---|
| Cargando | Encabezado "Editar venta"; `LoadingState` "Cargando venta", `shape="cards"`, `count={2}`. Sin "Guardar cambios". |
| Error | `ErrorState` "No se pudo cargar esta venta. Inténtalo de nuevo." |
| No encontrado | El estado de 4.3. |
| Listo | 3.9. |
| Guardado | Se sale y aparece el aviso (3.9). |

---

## 5. Textos

Español neutro con tuteo. Sin "error", "inválid", "incorrect", "debes", "falló" ni "mal" en lo que lee la persona.

### 5.1 Títulos, etiquetas y botones

| Clave sugerida | Texto |
|---|---|
| Título registrar | "Registrar venta" |
| Título editar | "Editar venta" |
| Título detalle | la fecha (`formatDateLabel`) |
| Fecha | "¿Cuándo vendiste?" |
| Otra fecha | "Elegir otra fecha" · hoja "¿Qué día vendiste?" · "Mes anterior" · "Mes siguiente" |
| Sección de productos | "¿Qué vendiste?" |
| Buscar | "Buscar producto" · sin resultados: "No encontramos productos con \"{texto}\"." |
| Agregar más | "Agregar otro producto" · hoja "¿Qué más vendiste?" |
| Paso de versión | "¿Qué versión de {producto}?" · "Ver todos los productos" |
| Cambiar versión | "Cambiar" · pista "Cambia la versión de {producto}" |
| Cantidad | "Cantidad" · accesible "Cantidad de {producto}" |
| Precio | "Precio de cada uno" · placeholder "15.000" · ayuda a convenir "Escribe a cuánto lo vendiste." |
| Subtotal | "Subtotal" |
| Quitar | "Quitar" · pista "Quita {producto} de esta venta" |
| Archivado | "Archivado" |
| Límite de ítems | "Llegaste a 100 productos en esta venta. Guárdala y registra el resto en otra." |
| Más detalles | "Más detalles" · pista "Dónde vendiste y una nota" · con datos "Más detalles ({canal}, con nota)" / "Más detalles ({canal})" / "Más detalles (con nota)" |
| Dónde vendiste | "¿Dónde vendiste? (opcional)" (formulario) · "Dónde vendiste" (detalle) |
| Canales (`SALE_CHANNEL_LABELS`) | `fair` "Feria" · `social_media` "Redes sociales" · `store_or_consignment` "Tienda o consignación" · `custom_order` "Encargo" · `other` "Otro" |
| Nota | "Nota" (+ "(opcional)") · placeholder "Por ejemplo, feria del parque o pedido de Ana" |
| Total | "Total" |
| Guardar (registrar) | "Guardar venta" |
| Guardar (editar) | "Guardar cambios" |
| Detalle: ítems | "Lo que vendiste" · subtítulo "{versión} · {n} × {precio}" |
| Detalle: editar | "Editar venta" |
| Detalle: borrar | "Borrar venta" |
| Producto sin datos | "Producto sin nombre" |

### 5.2 "No vendí"

| Situación | Texto |
|---|---|
| `single` actual | "¿No vendiste nada esta semana? Anotarlo también cuenta." · botón "Esta semana no vendí" |
| `single` anterior | "¿No vendiste nada la semana pasada ({rango})? Anotarlo también cuenta." · botón "La semana pasada no vendí" |
| `choose` | "¿No vendiste nada? Elige la semana." · grupo "Semana" · "La semana pasada" · "Esta semana" · botón "Marcar que no vendí" |
| `marked` | "Marcaste que esta semana no vendiste." · "Desmarcar" (pista "Quita la marca de esta semana") |
| `has_sales` (D-25) | "Esta semana ya tiene ventas, así que no hace falta marcar \"no vendí\"." |
| Nota bajo la fecha (UX-S8) | "Marcaste esa semana como \"no vendí\". Si guardas esta venta, esa marca se quita." |

### 5.3 Celebración

| Situación | Texto |
|---|---|
| Título, primera venta | "¡Registraste tu primera venta!" |
| Título, las demás | "¡Venta registrada!" |
| Resumen | "{fecha} · {n} productos" / "{fecha} · 1 producto" |
| Frase, primera venta | "Así empieza tu historial. Cada venta que anotas te ayuda a ver tu ritmo." |
| Frase, las demás | "Ya quedó en tu historial." |
| Aviso D-02 | "Como vendiste esta semana, quitamos la marca de \"no vendí\"." / "Como vendiste esa semana, quitamos la marca de \"no vendí\"." |
| Botón | "Listo" |
| Anuncio | "Venta registrada. Total: {monto} pesos." / "Registraste tu primera venta. Total: {monto} pesos." |

### 5.4 `SALE_ERROR_MESSAGES` (un texto por código de `SALE_ERROR_CODES`)

| Código | Texto |
|---|---|
| `required` | "Completa este campo" |
| `too_long` | "Es demasiado largo. Acórtalo un poco" |
| `no_items` | "Elige al menos un producto que vendiste" |
| `too_many_items` | "Llegaste a 100 productos en esta venta. Guárdala y registra el resto en otra" |
| `quantity_out_of_range` | "Escribe una cantidad entre 1 y 9.999" |
| `price_required` | "Escribe a cuánto lo vendiste, por ejemplo 15.000" |
| `future_date` | "Elige hoy o un día anterior" |
| `product_not_found` | "Este producto ya no está. Quítalo y elige otro" |
| `product_archived` | "Este producto está archivado. Elige otro o vuelve a usarlo desde Productos" |
| `version_not_found` | "Esta versión ya no está. Elige otra" |
| `version_product_mismatch` | "Esta versión no corresponde a este producto. Vuelve a elegirla" |
| `version_archived` | "Esta versión ya no está a la venta. Elige otra" |
| `item_not_found` | "Esta venta cambió mientras la editabas. Vuelve a abrirla" |
| `record_not_found` | "No encontramos esta venta. Puede que ya no exista" |
| `week_has_sales` | "Esta semana ya tiene ventas, así que no hace falta marcar \"no vendí\"" |
| `week_not_allowed` | "Solo puedes marcar esta semana o la anterior" |
| `not_a_week_start` | "No pudimos marcar esa semana. Inténtalo de nuevo" |

- En `describeSaleError`, este catálogo gana sobre `TEXT_ERROR_MESSAGES`; los errores de monto siguen con `CLP_INPUT_ERROR_MESSAGES` (precio vacío en precio fijo: "Escribe un monto, por ejemplo 15.000").
- Palabras prohibidas para el test de F3.6 (sin distinguir mayúsculas ni tildes): "error", "inválid", "incorrect", "debes", "falló", "mal".

### 5.5 Avisos (toasts)

| Situación | Tipo | Texto |
|---|---|---|
| "No vendí" marcado (actual / anterior) | éxito | "Listo, anotamos que esta semana no vendiste." / "Listo, anotamos que la semana pasada no vendiste." |
| "No vendí" desmarcado | éxito | "Quitamos la marca de esta semana." |
| Edición guardada | éxito | "Cambios guardados" / "Cambios guardados. Quitamos la marca de \"no vendí\" de esa semana." |
| Venta borrada | éxito | "Venta borrada" |
| Guardar (inesperado) | error | "No se pudo guardar la venta. Inténtalo de nuevo." |
| Marcar (inesperado) | error | "No se pudo marcar. Inténtalo de nuevo." |
| Desmarcar (inesperado) | error | "No se pudo quitar la marca. Inténtalo de nuevo." |
| Borrar (inesperado) | error | "No se pudo borrar la venta. Inténtalo de nuevo." |

### 5.6 Anuncios del lector de pantalla

| Situación | Texto |
|---|---|
| Producto agregado | "Agregaste {producto}." / "Agregaste {producto}, {versión}." / "Agregaste {producto} otra vez." |
| Versión cambiada | "Ahora es {versión}." |
| Producto quitado | "Quitaste {producto}." |
| Fecha elegida en el calendario | la fecha (`formatDateLabel`) |
| Guardar con errores | "Revisa los campos marcados" (`FORM_ERRORS_ANNOUNCEMENT`) |
| Celebración | 5.3 |

---

## 6. Componentes

### 6.1 Se usan de `@/shared/ui` sin cambios

`Screen`, `ScreenHeader`, `Card`, `ListRow`/`ListSeparator` (con `leading` y `amountPrefix`), `Amount` (`display`, `list`, `inline`), `PrimaryButton`, `SecondaryButton`, `TextButton`, `DeleteButton`, `IconButton`, `DateField`, `FormTextField`, `FormAmountField`, `TextField`, `createSubmitHandler`, `ConfirmDialog`, `Sheet`, `InlineNotice`, `EmptyState`, `ErrorState`, `LoadingState`, `NotFoundScreen`, `useAppToast`, `announce`, `formatDateLabel`; de `shared/lib`, `useConfirmLeave`. De `features/products`, la miniatura (`ProductPhoto`, ver `docs/design/photos.md`, 6.2).

### 6.2 Nuevos o cambiados en `shared/ui` (con sus tests, TDD)

| Componente | Necesidad | Especificación |
|---|---|---|
| **`QuantityStepper`: valor que se puede escribir** (cambio, **necesario**) | UX-S5: cantidades de decenas. | El valor central pasa a ser un campo numérico (`keyboardType="number-pad"`, mismo aspecto: fondo de campo, borde de 2 px, `min-w-16`, texto `text-lg font-bold` centrado). Al salir del campo, un valor vacío, 0 o no entero vuelve al último válido, y uno mayor que `max` queda en `max`. "+" y "−" siguen igual. Para el lector sigue siendo `adjustable` con `increment`/`decrement`, y además se puede editar. Tests: escribir "40" llama a `onChange(40)`; "0" o vacío vuelve al anterior al perder el foco; "12000" con `max` 9999 queda en 9999; los botones siguen respetando los límites. |
| **`ChipGroup`: `allowDeselect`** (cambio, **necesario**) | UX-S6: "Dónde vendiste" es opcional y se tiene que poder desmarcar. | Con `allowDeselect`, `onChange` recibe `T \| null`; tocar el chip elegido llama a `onChange(null)`. Como un radio no se desmarca, en este modo el grupo no es `radiogroup`: cada chip es un botón con `accessibilityState={{ selected }}` (rol `toggle` de `Chip`) y el contenedor lleva la etiqueta del grupo. Tests: tocar el elegido lo desmarca; sin `allowDeselect` el comportamiento actual no cambia; los roles de cada modo. |
| **`Amount`: variante `total`** (cambio, **necesario**) | El total del pie fijo del registro y de la edición: es el monto principal de la pantalla, pero `display` (44) ocupa demasiado en un pie fijo sobre el teclado. | `text-heading font-bold text-accent text-right`, una línea, `adjustsFontSizeToFit`, `maxFontSizeMultiplier={1.5}`. Contraste ya medido (acento / fondo 7.2 y 7.8). Tests: clases, una línea y etiqueta "45.000 pesos". |
| **`DatePickerSheet`** (nuevo, **recomendado**) | UX-S4: llegar a una fecha de hace semanas sin tocar "Día anterior" muchas veces (D-38 no pone fecha mínima). | Props: `isOpen`, `title`, `value: LocalDate`, `maxDate: LocalDate`, `today: LocalDate`, `onSelect(date)`, `onClose()`. Usa `Sheet`. Mes en grilla de lunes a domingo (D-01), días de 48 × 48, días después de `maxDate` deshabilitados, mes siguiente deshabilitado si pasa de `maxDate`. Fechas con las funciones de `shared/domain` (sin `Date`, ADR-015). Tests: no se puede elegir mañana; elegir un día llama a `onSelect` y cierra; el mes empieza en lunes; cruce de año; etiquetas accesibles con `formatDateLabel`. Si no entra en F3, `DateField` alcanza para la última semana y el botón "Elegir otra fecha" se omite. |
| **`icons.ts`: íconos nuevos** (necesario) | Los pide esta especificación. | `CheckIcon`, `CheckCircleIcon`, `ConfettiIcon`, `StorefrontIcon`, `CaretDownIcon`, `CaretUpIcon`, `CaretRightIcon`, `MagnifyingGlassIcon`, `WarningCircleIcon` y `TrashIcon` (los que no estén re-exportados todavía). |

### 6.3 Componentes de la feature (`src/features/sales/components/`)

Los de `docs/architecture/sales.md` (2.1), con estas precisiones:
- `product-picker.tsx`: 3.2 y 3.4 (con el paso de versión), usable dentro de la pantalla o de la hoja (`variant: 'inline' | 'sheet'`).
- `sale-item-fields.tsx`: 3.3.
- `sale-form.tsx`: 3.1 y 3.9 (fecha, nota de semana marcada, productos, más detalles y pie con total).
- `no-sales-panel.tsx`: 3.5.
- `sale-saved-celebration.tsx`: 3.7, con una prop `children` (o `tipSlot`) vacía en F3 para que F6 inserte su tarjeta sin tocar el componente.
- `sale-detail.tsx`: 3.8 (sin los botones fijos, que son de la screen).
- `week-range-label.ts` (sugerido): texto de los rangos de 3.5 ("del 2 al 8 de noviembre").

---

## 7. Accesibilidad

- **Áreas táctiles** de al menos 48 × 48: filas, chips, botones, "+" y "−", días del calendario. Las filas miden al menos 56 de alto.
- **Orden de lectura** igual al visual: fecha → (nota de semana marcada) → "¿Qué vendiste?" → productos (por cada uno: nombre → versión → cambiar → cantidad → precio → quitar → subtotal) → agregar otro → más detalles → "no vendí" → total → guardar.
- **Etiquetas**: cada fila de producto es un solo elemento con la etiqueta de las tablas; la cantidad y el precio nombran a su producto (hay varios iguales en pantalla); "Quitar" y "Cambiar" llevan el nombre en la pista; los montos se leen como "pesos"; "Más detalles" anuncia si está abierto (`expanded`); el chip "La semana pasada" se anuncia elegido en `choose`.
- **Foco y anuncios**: al agregar o quitar un producto se anuncia y el foco va a un lugar estable (3.3); con "a convenir", el foco va al precio; al guardar con errores, al primer campo; la celebración lleva el foco al título.
- **Nada solo por color**: chips elegidos con check; día elegido relleno y con estado; hoy con borde; archivado con ícono y palabra; errores con ícono y texto; quitar y borrar con `Trash` y palabra.
- **Letra grande**: cantidad y precio se apilan; el total pasa debajo de "Total"; el monto de las filas pasa debajo del nombre; el `Amount` `total` y el `display` se limitan a 1,5×. Se prueba con el tamaño más grande en Android, con el teclado abierto (el pie fijo no puede tapar el campo con foco).
- **Contraste**: no se agrega ningún color ni par nuevo. El día elegido usa texto sobre acento (7.2 y 7.8) y hoy un borde `foreground` (14.6 y 15.7).
- **Reducir movimiento**: sin entrada animada en la celebración; la hoja no se desliza.
- **Una mano**: "Guardar venta", "Listo" y "Editar venta" van fijos abajo; las hojas aparecen abajo; "Borrar venta" va al final del contenido, lejos del pulgar en reposo.

---

## 8. Pruebas sugeridas para F3.6 y F3.7 (además de las del plan)

**Registro**
- Al abrir con dos productos, la fecha dice "Hoy, …", "Día siguiente" está deshabilitado y la lista "¿Qué vendiste?" está a la vista.
- Tocar un producto de una versión lo agrega con cantidad 1 y su precio, pliega la lista, muestra "Total" con ese monto y anuncia "Agregaste {producto}.".
- Camino corto: "Registrar venta" → producto → "Guardar venta" muestra "¡Registraste tu primera venta!" (primera) y, en la segunda venta, "¡Venta registrada!".
- Con un único producto de una versión, el producto ya está elegido al abrir y "Guardar venta" basta.
- Un producto con varias versiones abre "¿Qué versión de {producto}?"; elegir una la agrega con su precio; "Cambiar" cambia versión y precio.
- "A convenir": el precio empieza vacío con "Escribe a cuánto lo vendiste." y el foco va al campo; guardar vacío muestra "Escribe a cuánto lo vendiste, por ejemplo 15.000".
- Escribir 40 en la cantidad y 1.500 en el precio deja el subtotal y el total en $60.000.
- Agregar dos veces el mismo producto deja dos filas y anuncia "Agregaste {producto} otra vez.".
- "Guardar venta" sin productos marca "Elige al menos un producto que vendiste" y lo anuncia.
- "Más detalles" está cerrado; al abrirlo aparecen los cinco canales y la nota; tocar "Feria" dos veces la desmarca; cerrado con datos dice "Más detalles (Feria, con nota)".
- Con 100 productos, "Agregar otro producto" se reemplaza por el aviso del límite.
- "Elegir otra fecha" no deja tocar mañana ni pasar al mes siguiente del actual.
- Con la semana actual marcada, elegir hoy muestra la nota "Marcaste esa semana como \"no vendí\"…"; al guardar, la celebración muestra "Como vendiste esta semana, quitamos la marca de \"no vendí\".".
- Volver con un producto elegido abre "¿Salir sin guardar?"; sin cambios sale directo.
- Durante la celebración, el botón atrás llama a `onFinished` igual que "Listo".

**"No vendí"**
- Un miércoles sin ventas: "Esta semana no vendí"; al tocarlo, aviso "Listo, anotamos que esta semana no vendiste.", se sigue en el registro y el panel pasa a "Marcaste que esta semana no vendiste." con "Desmarcar".
- Un lunes con la semana pasada vacía: `choose` con "La semana pasada" elegida y anunciada como elegida.
- Con ventas esta semana: el texto de D-25, sin botón.
- Al agregar un producto, el panel desaparece; al quitar todos, vuelve.
- Sin productos: el estado vacío y, debajo, el panel.

**Detalle, edición y borrado**
- El detalle muestra la fecha como título, el total en grande, "2 × $15.000" en el subtítulo con cantidad > 1, "Archivado" en un producto archivado, y canal y nota solo si existen.
- "Borrar venta" pide confirmación con fecha y total; confirmar vuelve y avisa "Venta borrada"; cancelar no cambia nada.
- Editar empieza con "Más detalles" abierto si hay canal o nota, no muestra el panel de "no vendí" y guarda con "Cambios guardados", sin celebración.
- Quitar el último producto al editar abre "¿Borrar esta venta?"; confirmar borra y vuelve; cancelar lo deja.
- Un ítem de un producto archivado se puede editar en cantidad y precio y no ofrece "Cambiar".
- Un id válido inexistente muestra "No encontramos esta venta".

**E2E (F3.9)**, ubicando por estos textos: "Registrar venta", "¿Qué vendiste?", "Guardar venta", "¡Registraste tu primera venta!", "¡Venta registrada!", "Listo", "Día anterior", "Día siguiente", "Más detalles", "Feria", "Esta semana no vendí", "Editar venta", "Borrar venta", "Agregar producto". `register-shortest.yaml` cuenta exactamente 3 toques (2.1).
