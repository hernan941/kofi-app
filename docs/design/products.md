# Especificación de pantallas — Productos (F1)

- **Tarea**: F1.1 de `docs/plan-v1.md`. La usan F1.5 (componentes y formulario) y F1.6 (pantallas y rutas).
- **Fuentes**: `docs/design-system.md` (Bruma), `docs/architecture/products.md` (F1.0), `docs/product.md` (D-16, D-27, D-31 a D-34) y los componentes de `@/shared/ui`.
- Este documento no define lógica de negocio. Cuando una pantalla "decide" algo, la decisión real la toma el dominio o el caso de uso; la UI solo lo muestra.
- **Fuera de alcance**: las fotos (F2.1 agrega la miniatura de la lista, la tira de fotos del formulario y la del detalle). Esta especificación deja su lugar marcado.

---

## 1. Decisiones de diseño

| Id | Decisión | Por qué |
|---|---|---|
| UX-P1 | **Un producto archivado se puede editar** (pregunta 6.18). El detalle de un archivado ofrece "Volver a usar" como acción principal y "Editar" como secundaria. El formulario avisa que el producto sigue archivado. | 1) Las ventas pasadas muestran el nombre **actual** del producto (ADR-007, regla 1): corregir un error de tipeo sin tener que reactivarlo es legítimo. 2) Es la única forma de reparar un producto que quedó sin versiones activas, que no se puede desarchivar (ADR-007, regla 15). 3) Obligar a desarchivar para editar agrega pasos y un estado intermedio raro (aparece en la lista solo para corregirlo). El riesgo, creer que editar lo reactiva, se cubre con un aviso en el formulario (3.6). |
| UX-P2 | Crear y editar se abren **como pantallas apiladas** (push), no como modal. | El formulario crece con las versiones y usa teclado: una pantalla completa con "Volver" es más estable. En iOS, un modal se cierra deslizando hacia abajo y es fácil perder lo escrito por accidente. Volver con cambios sin guardar pide confirmación (3.8), igual con el gesto de iOS y el botón atrás de Android. |
| UX-P3 | Al **crear**, se vuelve a la lista con el aviso "Producto guardado". Al **editar**, se vuelve al detalle con "Cambios guardados". | Quien carga productos suele cargar varios seguidos: volver a la lista deja el siguiente "Agregar producto" a un toque. Lo pide también el test de F1.6 ("crear un producto y volver a la lista"). Al editar, la persona vino desde el detalle y quiere ver el resultado. |
| UX-P4 | Con una sola versión, el botón para agregar la segunda dice **"Agregar otra opción"**, con un ejemplo debajo. Desde la segunda, el concepto se llama "versión" en toda la pantalla ("Versiones", "Nombre de la versión", "Agregar otra versión", "Quitar versión"). | La regla de producto es que con una versión **no aparece la palabra "versión"** (test de F1.5 y E2E de F1.8). "Opción" con un ejemplo concreto ("Print A4 y Print A3, o enmarcado") se entiende sin explicar nada. Cuando ya hay dos, la palabra "versión" tiene sentido porque la persona la está viendo. |
| UX-P5 | "A convenir" se elige con un **grupo de dos chips** ("Precio fijo" / "A convenir"), arriba del precio. Por defecto, "Precio fijo". | Es reversible, se ve el estado elegido (con check, no solo color) y no suma toques en el caso común. Un interruptor (switch) obliga a leer una frase para entender qué significa "encendido". Al volver a "Precio fijo", el precio escrito antes reaparece (lo conserva `priceText`). |
| UX-P6 | El costo se revela con el botón de texto **"Agregar costo"**. Una vez visible, queda visible; vaciarlo significa "sin costo". No hay botón "quitar costo". | Menos controles. El campo dice "(opcional)" y su ayuda explica que se puede dejar vacío. |
| UX-P7 | **"Quitar versión"** se aplica al guardar, igual que el resto del formulario. Una versión nueva (sin guardar) se quita al instante, sin preguntar. Una existente pide confirmación con un texto que dice qué va a pasar (D-33): con ventas se guarda en el historial, sin ventas se borra. | El formulario se comporta como un borrador: nada se escribe hasta "Guardar", y "Salir sin guardar" deshace todo. La confirmación solo aparece cuando hay algo guardado que perder. El botón del diálogo va en rojo ladrillo (borrar) solo cuando de verdad se borra; si la versión queda en el historial va como acción normal, para que el color diga la verdad. |
| UX-P7b | "Quitar versión" usa `DeleteButton` con la palabra **"Quitar"** y no "Borrar". Es una excepción explícita a la regla de 2.2 del sistema de diseño, que el reviewer debe tratar como tal. | "Quitar" es el término de producto (D-33) y es honesto: a veces borra y a veces archiva. El ícono `Trash` y el color siguen marcando que es una acción que saca algo. Para filas nuevas, sin nada guardado, no hay confirmación (`DeleteButton` dice "siempre con confirmación"; acá no hay nada que perder). |
| UX-P8 | Archivar **pide confirmación**; desarchivar ("Volver a usar") **no**. | Archivar saca el producto de la lista y del selector de ventas, y conviene explicarlo con calma. Desarchivar no quita nada y se deshace archivando otra vez. |
| UX-P9 | El acceso a archivados es un botón de texto al final de la lista, **"Ver archivados (n)"**, que solo aparece si hay alguno. | No ocupa espacio mientras no sirve. Al archivar, el aviso dice dónde quedó ("Lo encuentras en Archivados"), así la persona aprende el camino justo cuando lo necesita. |
| UX-P10 | En la lista, un producto con varias versiones muestra **"desde $10.000"** (el precio fijo más bajo). | Un solo número por fila, alineado a la derecha como pide el sistema de diseño. Mostrar un rango ("$10.000 – $45.000") ocupa el doble y se lee peor con letra grande. |
| UX-P11 | Las secciones de precio y versiones van **dentro de una tarjeta**; nombre y descripción van sobre el fondo. | Los campos se ven "hundidos" dentro de la tarjeta (sistema de diseño, 2.2) y así se agrupa lo que pertenece a cada versión. Con la tarjeta y el botón principal hay dos sombras por pantalla, y queda lugar para la tira de fotos de F2 sin pasar el máximo de tres. |

---

## 2. Navegación

```
(tabs)/products ── Lista de productos
   ├─ "Agregar producto" ──────────────► /products/new ──(Guardar)──► back() a la lista + aviso
   ├─ tocar una fila ──────────────────► /products/[id] (detalle)
   │                                        ├─ "Editar producto" ──► /products/[id]/edit ──(Guardar)──► back() al detalle + aviso
   │                                        └─ "Archivar" ─► confirmación ─► back() + aviso
   └─ "Ver archivados (n)" ────────────► /products/archived
                                            └─ tocar una fila ─► /products/[id] (detalle de archivado)
                                                                   ├─ "Volver a usar" ─► queda en el detalle, ahora activo + aviso
                                                                   └─ "Editar" ─► /products/[id]/edit ──(Guardar)──► back() + aviso
```

- Todas las rutas fuera de `(tabs)` son pantallas apiladas del `Stack` raíz, sin barra de pestañas y con los encabezados nativos ocultos (`headerShown: false`): cada pantalla dibuja su propio encabezado (componente nuevo `ScreenHeader`, sección 6).
- "Volver" del encabezado, el gesto de iOS y el botón atrás de Android hacen lo mismo. En el formulario con cambios, los tres pasan por la confirmación de 3.8.
- Un `id` inválido en la ruta muestra `NotFoundScreen` (ya existe). Un `id` válido que no existe muestra el estado "no encontrado" de la propia pantalla (4.3).
- Las screens reciben los callbacks (`onOpenProduct`, `onAddProduct`, `onOpenArchived`, `onEdit`, `onSaved`, `onBack`, `onArchived`) desde las rutas y no importan `expo-router` (ADR-005).

---

## 3. Pantallas

Notación: los textos entre comillas son **exactos** (ver también la tabla completa en la sección 5). Los tokens son los de `docs/design-system.md`.

### 3.1 Lista de productos (`(tabs)/products`, `ProductsScreen`)

**Estructura** (de arriba abajo):

1. `ScreenHeader` sin botón de volver, con el título "Productos" (`text-title`, rol `header`).
2. Lista en `FlatList` (regla de rendimiento): las filas van visualmente dentro de **una sola tarjeta** (fondo `surface`, borde sticker, `rounded-3xl`, sombra), separadas con `ListSeparator`. Margen lateral `px-4`, `gap-4` con el encabezado.
3. Pie de la lista (`ListFooterComponent`): `TextButton` "Ver archivados (n)", centrado, con `pt-4`. Solo si `n > 0`.
4. Botón principal fijo abajo, sobre la barra de pestañas: `PrimaryButton` "Agregar producto", ícono `Plus`, `px-4 pb-4`. La lista deja `pb` suficiente para que la última fila y el pie no queden tapados.

**Orden**: alfabético sin distinguir mayúsculas ni tildes (D-31). Lo resuelve el hook con `select`; la pantalla no ordena.

**Fila** (`ListRow`, toda la fila es un botón → detalle):

| Caso | `title` | `subtitle` | Columna derecha | `accessibilityLabel` |
|---|---|---|---|---|
| Una versión, precio fijo | nombre | — | `Amount` del precio | "Lámina Colibrí, 15.000 pesos" (el que arma `ListRow`) |
| Una versión, a convenir | nombre | "A convenir" | — | "Lámina Colibrí, precio a convenir" |
| Varias, al menos una con precio fijo | nombre | "3 versiones" | "desde" + `Amount` del menor precio fijo | "Lámina Colibrí, 3 versiones, desde 10.000 pesos" |
| Varias, todas a convenir | nombre | "3 versiones · a convenir" | — | "Lámina Colibrí, 3 versiones, precio a convenir" |
| Sin versiones activas (datos rotos, regla 15) | nombre | "Sin precio por ahora" | — | "Lámina Colibrí, sin precio por ahora" |

- `$0` se muestra como `$0` (D-34), sin texto especial.
- El "desde" va en `text-xs font-medium` `muted`, a la izquierda del monto y en la misma línea; con letra grande pasa encima del monto. Requiere el cambio de `ListRow` de la sección 6.
- La descripción no se muestra en la lista. La miniatura (`leading`) llega en F2.1.
- Los montos de la lista van en color de texto, nunca en acento.

**Archivados en la lista**: la pantalla también lee `useArchivedProducts` solo para el contador. Si esa lectura carga o falla, el enlace simplemente no aparece (no es crítico y no merece un error en pantalla).

**Estados**: ver 4.1.

### 3.2 Archivados (`/products/archived`, `ArchivedProductsScreen`)

1. `ScreenHeader` con volver ("Volver") y el título "Archivados".
2. Texto introductorio en `text-base` `muted`, `px-4`: "Aquí guardas lo que ya no vendes. Tus ventas pasadas no cambian y puedes volver a usar cualquiera."
3. La misma lista y las mismas filas de 3.1 (mismo componente), en orden alfabético. Tocar una fila abre el detalle.
4. Sin botón principal: la pantalla es de consulta. La acción "Volver a usar" vive en el detalle, para que la persona vea qué está recuperando antes de hacerlo.

**Estados**: ver 4.2.

### 3.3 Detalle de producto activo (`/products/[id]`, `ProductDetailScreen`)

1. `ScreenHeader` con volver y el **nombre del producto** como título (`text-title`, puede ocupar varias líneas; nunca se recorta).
2. Lugar reservado para las fotos (F2.1).
3. Descripción, si existe: `text-base` `foreground`, texto seleccionable, `px-4`. Si no hay, no se muestra nada (sin "Sin descripción").
4. **Precio** (una sola versión activa; no aparece la palabra "versión"):
   - Precio fijo: etiqueta "Precio" (`text-sm font-medium` `muted`) y debajo `Amount` en variante `display` (es el monto principal de la pantalla, en acento).
   - A convenir: etiqueta "Precio" y debajo "A convenir" en `text-heading` `foreground`, con la ayuda "El precio lo escribes al registrar cada venta." en `text-sm` `muted`.
   - Costo, si tiene: fila con "Te cuesta hacerlo" (`text-sm` `muted`) y `Amount` en variante `inline` a la derecha. Si no tiene, no se muestra nada.
5. **Versiones** (dos o más activas): `Card` con el título "Versiones" y una `ListRow` estática (sin `onPress`) por versión activa, en el orden guardado (`position`), separadas con `ListSeparator`:

   | Caso | `title` | `subtitle` | Derecha | `accessibilityLabel` |
   |---|---|---|---|---|
   | Fijo, sin costo | nombre de la versión | — | `Amount` | "Print A4, 15.000 pesos" |
   | Fijo, con costo | nombre | "Te cuesta $3.000" | `Amount` | "Print A4, 15.000 pesos, te cuesta 3.000 pesos" |
   | A convenir, sin costo | nombre | "A convenir" | — | "Personalizado, precio a convenir" |
   | A convenir, con costo | nombre | "A convenir · te cuesta $3.000" | — | "Personalizado, precio a convenir, te cuesta 3.000 pesos" |

   El costo del subtítulo se formatea con `formatClp` y la etiqueta accesible con `formatClpAccessible` (por eso la pantalla pasa su propio `accessibilityLabel`: así el lector no dice "dólares").
   Las versiones archivadas **no se muestran** (D-33: solo existen para el historial).
6. **Sin versiones activas** (datos rotos): en lugar de 4 o 5, un `InlineNotice` (sección 6) con "Este producto no tiene precios para vender. Edítalo para agregar uno."
7. Al final del contenido, con `pt-8`: `SecondaryButton` "Archivar", ícono `Archive`, ancho completo. No va fijo, para que no quede bajo el pulgar por accidente.
8. Botón principal fijo abajo (con el área segura): `PrimaryButton` "Editar producto", ícono `PencilSimple`.

**Archivar**: `ConfirmDialog` (no destructivo, es reversible):
- Título: "¿Archivar Lámina Colibrí?"
- Descripción: "Dejará de aparecer en tu lista y al registrar ventas. Tus ventas pasadas no cambian, y puedes volver a usarlo cuando quieras desde Archivados."
- Confirmar: "Archivar". Cancelar: "Cancelar".
- Al confirmar: `useSetProductArchived`. Si sale bien → `onArchived()` (la ruta hace `back()`) y aviso de éxito "Producto archivado. Lo encuentras en Archivados.". Si falla → el diálogo se cierra, la pantalla queda igual y aviso de error "No se pudo archivar. Inténtalo de nuevo.".

**Estados**: ver 4.3.

### 3.4 Detalle de producto archivado (misma ruta y screen)

Igual que 3.3, con estas diferencias:

- Debajo del encabezado, un `InlineNotice` con el ícono `Archive`: "Está archivado: no aparece en tu lista ni al registrar ventas. Tus ventas pasadas no cambian."
- Botón principal fijo: `PrimaryButton` "Volver a usar". Sin confirmación (UX-P8). Si sale bien, la pantalla se queda y pasa a verse como activa (3.3); aviso de éxito "Listo, vuelve a estar en tu lista.". Si falla, aviso de error "No se pudo volver a usar. Inténtalo de nuevo.".
- Al final del contenido: `SecondaryButton` "Editar", ícono `PencilSimple` (en lugar de "Archivar").
- **Sin versiones activas**: el producto no se puede desarchivar (`no_active_version`). La pantalla lo detecta antes (`activeVersions(product).length === 0`) y cambia los botones: el principal pasa a ser "Editar producto" y no se ofrece "Volver a usar". El aviso de 3.3, punto 6, dice: "Este producto no tiene precios para vender. Edítalo para agregar uno y después podrás volver a usarlo." Si igual llega `no_active_version` del caso de uso (carrera), se muestra como aviso de error con el texto del catálogo (5.4).

### 3.5 Crear producto (`/products/new`, `NewProductScreen`)

`ScreenHeader` con volver y el título "Nuevo producto". Debajo, un `ScrollView` con `keyboardShouldPersistTaps="handled"` y el formulario (`ProductForm`), y el botón principal fijo abajo.

#### Con una sola versión (estado inicial; no aparece la palabra "versión")

1. `FormTextField` "Nombre" — placeholder "Por ejemplo, Lámina Colibrí"; `maxLength={80}` (D-27); `autoCapitalize="sentences"`; `returnKeyType="next"`.
2. `FormTextField` "Descripción" con `isOptional` (se ve "Descripción (opcional)") — placeholder "Técnica, tamaño, materiales…"; `multiline`; `maxLength={1000}`; alto mínimo de tres líneas, crece con el texto.
3. Lugar reservado para las fotos (F2.1).
4. **Tarjeta de precio** (`Card` sin título), con `gap-4`:
   1. `ChipGroup` con la etiqueta "Precio" y las opciones "Precio fijo" (`fixed`) y "A convenir" (`negotiable`).
   2. Si es "Precio fijo": `FormAmountField` "¿A cuánto lo vendes?" — placeholder "15.000".
      Si es "A convenir": en lugar del campo, el texto "El precio lo escribes al registrar cada venta." en `text-sm` `muted`.
   3. Si el costo no está visible: `TextButton` "Agregar costo", ícono `Plus`, alineado a la izquierda, con `accessibilityHint` "Muestra un campo para anotar cuánto te cuesta".
      Si está visible: `FormAmountField` "¿Cuánto te cuesta hacerlo?" con `isOptional` — placeholder "3.000"; ayuda "Solo lo ves tú. Sirve para saber cuánto te queda de cada venta. Puedes dejarlo vacío.".
5. `TextButton` "Agregar otra opción", ícono `Plus`, con `accessibilityHint` "Por ejemplo, otro tamaño o el original". Debajo, en `text-sm` `muted`: "Por ejemplo, Print A4 y Print A3, o enmarcado. Cada una con su precio."
6. Botón principal fijo: `PrimaryButton` "Guardar".

#### Con dos o más versiones

Al tocar "Agregar otra opción":
- La primera fila recibe el nombre "Estándar" (o "Estándar 2" si choca, D-16 y D-34), **escrito en el campo y editable**, no como placeholder (`withAddedVersion`).
- Se agrega una fila vacía (precio fijo, sin costo visible), el foco va a su campo "Nombre de la versión", la vista se desplaza para mostrarla y se anuncia "Agregaste una versión. Ponle un nombre.".

La tarjeta pasa a ser:

1. `Card` con el título "Versiones" y, debajo del título, "Cada versión tiene su propio precio." en `text-sm` `muted`.
2. Por cada versión, en orden, separadas por `ListSeparator` con `gap-6`:
   1. `FormTextField` "Nombre de la versión" — placeholder "Por ejemplo, Print A3"; `maxLength={80}`.
   2. `ChipGroup` "Precio" ("Precio fijo" / "A convenir").
   3. El precio o el texto de "a convenir", como en la versión única.
   4. "Agregar costo" o el campo de costo, como en la versión única.
   5. `DeleteButton` con la etiqueta "Quitar versión" (ícono `Trash`, texto `danger`, sin relleno), alineado a la izquierda, con `accessibilityHint` "Quita la versión Print A3" (o "Quita esta versión" si no tiene nombre).
3. `TextButton` "Agregar otra versión", ícono `Plus` (ya sin el texto de ejemplo).

- Si se quitan versiones hasta que queda una sola, la pantalla vuelve al diseño de una sola versión: se ocultan "Versiones", el nombre y "Quitar versión". El nombre se conserva internamente (lo resuelve el esquema).
- "Quitar versión" nunca aparece con una sola fila.
- No hay límite de versiones.

#### Guardar

- `PrimaryButton` "Guardar", nunca deshabilitado, con `createSubmitHandler`. Si hay errores, los campos se marcan, el foco va al primero (la vista se desplaza hasta él) y se anuncia "Revisa los campos marcados" (ya lo hace `createSubmitHandler`).
- Mientras se guarda, los toques repetidos se ignoran (la screen no vuelve a llamar a `mutateAsync` si `isPending`). La etiqueta no cambia: guardar en SQLite es casi instantáneo y un cambio de texto parpadearía.
- Resultado:
  - `ok` → `onSaved(id)` (la ruta hace `back()`) y aviso "Producto guardado".
  - Errores de campo → `applyProductErrors` los pone en sus campos, con los textos de 5.4.
  - Errores sin campo → aviso de error con su texto del catálogo.
  - Rechazo inesperado → aviso de error "No se pudo guardar. Inténtalo de nuevo."; el formulario conserva todo lo escrito.

#### Teclado y botón fijo

- El botón "Guardar" queda **sobre el teclado** cuando está abierto (con `FormLayout`, ver `docs/design/tab-bar-and-keyboard.md`) y siempre respeta el área segura de abajo.
- Los campos de monto usan el teclado numérico (ya lo hace `MoneyField`).

### 3.6 Editar producto (`/products/[id]/edit`, `EditProductScreen`)

Mismo formulario de 3.5, con estas diferencias:

- Título "Editar producto".
- Valores iniciales desde el producto (`toProductFormValues`): solo versiones activas, en su orden. El costo aparece ya visible en las versiones que lo tienen.
- Si el producto está **archivado**, arriba del formulario va un `InlineNotice` con el ícono `Info`: "Este producto está archivado. Puedes corregirlo y seguirá archivado hasta que elijas \"Volver a usar\"." (UX-P1).
- "Quitar versión" de una versión **nueva** (sin `versionId`) la quita al instante y anuncia "Quitaste la versión.". De una versión **existente**, abre la confirmación de 3.7.
- Al guardar: `onSaved(id)` → `back()` al detalle y aviso "Cambios guardados".
- `product_not_found` al guardar (alguien lo borró, por ejemplo con una restauración): aviso de error "No encontramos este producto. Puede que ya no exista." y `onBack()`.

### 3.7 Quitar versión (confirmación)

Solo para versiones que ya estaban guardadas. La pista viene de `useVersionIdsWithSales` (la decisión final la toma el caso de uso al guardar, D-33). `{nombre}` es el nombre actual del campo; si está vacío, el título usa "esta versión".

| Caso | Título | Descripción | Confirmar | Estilo |
|---|---|---|---|---|
| Tiene ventas | "¿Quitar Print A3?" | "Como ya la vendiste, queda guardada en tu historial y tus ventas pasadas no cambian. No aparecerá al registrar ventas nuevas. Se aplica cuando guardes." | "Quitar" | normal (`PrimaryButton`) |
| No tiene ventas | "¿Quitar Print A3?" | "Se borra cuando guardes los cambios." | "Quitar" | destructivo (`isDestructive`) |
| No se sabe (la pista carga o falló) | "¿Quitar Print A3?" | "Si ya la vendiste, queda guardada en tu historial y tus ventas pasadas no cambian. Si no, se borra. Se aplica cuando guardes." | "Quitar" | destructivo |

Cancelar: "Cancelar". Al confirmar, la fila desaparece del formulario, su id pasa a `removedVersionIds`, el foco va al botón "Agregar otra versión" (o "Agregar otra opción" si quedó una) y se anuncia "Quitaste la versión.".

### 3.8 Salir sin guardar

Si el formulario tiene cambios (`isDirty`) y la persona intenta salir (volver del encabezado, gesto de iOS o atrás de Android), se intercepta la salida (`usePreventRemove`, que exporta `expo-router`) y se muestra:

- `ConfirmDialog` destructivo. Título: "¿Salir sin guardar?". Descripción: "Los cambios que hiciste no se guardarán.". Confirmar: "Salir sin guardar". Cancelar: "Seguir editando".
- Sin cambios, se sale directo. Después de guardar con éxito, la salida no se intercepta.

---

## 4. Estados

### 4.1 Lista de productos

| Estado | Qué se ve |
|---|---|
| Cargando | Encabezado "Productos" y `LoadingState` con `label` "Cargando productos", `shape="rows"`, `count={4}`. Sin botón principal. |
| Error | Encabezado y `ErrorState` con "No se pudieron cargar tus productos. Inténtalo de nuevo." y "Reintentar" (`refetch`). Sin botón principal. |
| Vacío, sin archivados | `EmptyState`: ícono `Package`; título "Aquí vas a ver tus productos"; descripción "Agrega lo que vendes con su precio y registrar tus ventas será más rápido."; acción principal "Agregar producto". El botón fijo no se muestra (el del estado vacío lo reemplaza: uno por pantalla). |
| Vacío, con archivados | `EmptyState`: ícono `Package`; título "No tienes productos en tu lista"; descripción "Los que archivaste siguen guardados."; principal "Agregar producto"; secundaria "Ver archivados". |
| Con datos | 3.1. |
| Éxito | Al volver de crear: aviso "Producto guardado". De archivar: "Producto archivado. Lo encuentras en Archivados.". La lista se actualiza sola (invalidación por `DataChanges`). |

### 4.2 Archivados

| Estado | Qué se ve |
|---|---|
| Cargando | `LoadingState` "Cargando archivados", `shape="rows"`, `count={3}`. |
| Error | `ErrorState` "No se pudieron cargar tus archivados. Inténtalo de nuevo." |
| Vacío | `EmptyState`: ícono `Archive`; título "No tienes productos archivados"; descripción "Cuando archives un producto, lo encuentras aquí."; sin acciones. El texto introductorio de 3.2 no se muestra. |
| Con datos | 3.2. |

### 4.3 Detalle

| Estado | Qué se ve |
|---|---|
| Cargando | Encabezado con volver y sin título; `LoadingState` "Cargando producto", `shape="cards"`, `count={2}`. |
| Error | Encabezado con volver; `ErrorState` "No se pudo cargar este producto. Inténtalo de nuevo." |
| No encontrado (`data === null`) | Encabezado con volver; `EmptyState`: ícono `Question`; título "No encontramos este producto"; descripción "Puede que ya no exista."; principal "Ir a Productos" (`onBack`). |
| Activo / archivado | 3.3 / 3.4. |

### 4.4 Formulario

| Estado | Qué se ve |
|---|---|
| Crear | Formulario vacío de inmediato (no carga nada). |
| Editar, cargando | Encabezado "Editar producto"; `LoadingState` "Cargando producto", `shape="cards"`, `count={2}`. Sin botón "Guardar". |
| Editar, error | `ErrorState` "No se pudo cargar este producto. Inténtalo de nuevo." |
| Editar, no encontrado | El mismo estado "no encontrado" de 4.3. |
| Errores de validación | En cada campo: borde `danger`, ícono `WarningCircle` y el texto (ya lo hace `TextField`). |
| Guardado | Se sale de la pantalla y aparece el aviso (3.5 y 3.6). |

`useVersionIdsWithSales` **no** bloquea el formulario: si carga o falla, se usa el texto "No se sabe" de 3.7.

---

## 5. Textos

Español neutro con tuteo. Sin "error", "inválido", "incorrecto", "debes" ni "falló" en lo que lee la persona.

### 5.1 Títulos, etiquetas y botones

| Clave sugerida | Texto |
|---|---|
| Título lista | "Productos" |
| Título archivados | "Archivados" |
| Título crear | "Nuevo producto" |
| Título editar | "Editar producto" |
| Volver (botón del encabezado, `accessibilityLabel`) | "Volver" |
| Agregar producto | "Agregar producto" |
| Ver archivados | "Ver archivados (n)" |
| Intro archivados | "Aquí guardas lo que ya no vendes. Tus ventas pasadas no cambian y puedes volver a usar cualquiera." |
| Nombre | "Nombre" · placeholder "Por ejemplo, Lámina Colibrí" |
| Descripción | "Descripción" (+ "(opcional)") · placeholder "Técnica, tamaño, materiales…" |
| Grupo de precio | "Precio" · opciones "Precio fijo", "A convenir" |
| Precio | "¿A cuánto lo vendes?" · placeholder "15.000" |
| Ayuda a convenir (formulario) | "El precio lo escribes al registrar cada venta." |
| Agregar costo | "Agregar costo" · pista "Muestra un campo para anotar cuánto te cuesta" |
| Costo | "¿Cuánto te cuesta hacerlo?" (+ "(opcional)") · placeholder "3.000" |
| Ayuda del costo | "Solo lo ves tú. Sirve para saber cuánto te queda de cada venta. Puedes dejarlo vacío." |
| Agregar la segunda | "Agregar otra opción" · pista "Por ejemplo, otro tamaño o el original" |
| Ejemplo bajo el botón | "Por ejemplo, Print A4 y Print A3, o enmarcado. Cada una con su precio." |
| Título de la tarjeta | "Versiones" · "Cada versión tiene su propio precio." |
| Nombre de versión | "Nombre de la versión" · placeholder "Por ejemplo, Print A3" |
| Agregar más | "Agregar otra versión" |
| Quitar | "Quitar versión" · pista "Quita la versión {nombre}" / "Quita esta versión" |
| Guardar | "Guardar" |
| Detalle: precio | "Precio" |
| Detalle: a convenir | "A convenir" · "El precio lo escribes al registrar cada venta." |
| Detalle: costo | "Te cuesta hacerlo" |
| Detalle: editar | "Editar producto" (activo) · "Editar" (archivado, secundario) |
| Detalle: archivar | "Archivar" |
| Detalle: desarchivar | "Volver a usar" |
| Subtítulos de fila | "A convenir" · "{n} versiones" · "{n} versiones · a convenir" · "Sin precio por ahora" · "Te cuesta $3.000" · "A convenir · te cuesta $3.000" |
| Prefijo de monto | "desde" |

### 5.2 Avisos (toasts)

| Situación | Tipo | Texto |
|---|---|---|
| Producto creado | éxito | "Producto guardado" |
| Producto editado | éxito | "Cambios guardados" |
| Archivado | éxito | "Producto archivado. Lo encuentras en Archivados." |
| Desarchivado | éxito | "Listo, vuelve a estar en tu lista." |
| Guardar falló (inesperado) | error | "No se pudo guardar. Inténtalo de nuevo." |
| Archivar falló | error | "No se pudo archivar. Inténtalo de nuevo." |
| Desarchivar falló | error | "No se pudo volver a usar. Inténtalo de nuevo." |
| Producto inexistente al guardar | error | "No encontramos este producto. Puede que ya no exista." |

### 5.3 Notas, diálogos y anuncios

| Situación | Texto |
|---|---|
| Nota de archivado (detalle) | "Está archivado: no aparece en tu lista ni al registrar ventas. Tus ventas pasadas no cambian." |
| Nota de archivado (formulario) | "Este producto está archivado. Puedes corregirlo y seguirá archivado hasta que elijas \"Volver a usar\"." |
| Sin versiones activas (activo) | "Este producto no tiene precios para vender. Edítalo para agregar uno." |
| Sin versiones activas (archivado) | "Este producto no tiene precios para vender. Edítalo para agregar uno y después podrás volver a usarlo." |
| Archivar | 3.3 |
| Quitar versión | 3.7 |
| Salir sin guardar | 3.8 |
| Anuncio al agregar versión | "Agregaste una versión. Ponle un nombre." |
| Anuncio al quitar versión | "Quitaste la versión." |
| Anuncio con errores al guardar | "Revisa los campos marcados" (ya existe: `FORM_ERRORS_ANNOUNCEMENT`) |

### 5.4 `PRODUCT_ERROR_MESSAGES` (un texto por código de `PRODUCT_ERROR_CODES`)

| Código | Texto |
|---|---|
| `required` | "Escribe el nombre del producto" |
| `too_long` | "Es demasiado largo. Acórtalo un poco" |
| `version_name_required` | "Ponle un nombre, por ejemplo Print A4" |
| `duplicate_version_name` | "Ya tienes otra versión con este nombre. Prueba con uno distinto" |
| `no_active_version` | "Agrega al menos un precio para poder venderlo" |
| `version_not_found` | "Esta versión ya no está. Vuelve a abrir el producto para ver cómo quedó" |
| `version_archived` | "Esta versión ya está en tu historial y no se puede cambiar. Vuelve a abrir el producto" |
| `version_has_sales` | "Esta versión ya tiene ventas, así que queda guardada en tu historial" |
| `product_not_found` | "No encontramos este producto. Puede que ya no exista" |

- En `describeProductError`, el catálogo de productos **gana** sobre `TEXT_ERROR_MESSAGES` (así `required` del nombre dice "Escribe el nombre del producto" y no "Completa este campo"). Los errores de monto siguen con `CLP_INPUT_ERROR_MESSAGES` (por ejemplo, precio vacío: "Escribe un monto, por ejemplo 15.000").
- `required` solo puede venir de `['name']` (el nombre de versión usa `version_name_required`), por eso puede nombrar el campo.
- `too_long` casi nunca se ve: los campos tienen `maxLength` con los límites de D-27. Queda para textos pegados o datos importados.
- Lista de palabras prohibidas para el test de F1.5 (sin distinguir mayúsculas ni tildes): "error", "inválid", "incorrect", "debes", "falló", "mal".

---

## 6. Componentes

### 6.1 Se usan de `@/shared/ui` sin cambios

`Screen`, `Card`, `ListRow`/`ListSeparator` (con el cambio de 6.2), `Amount`, `PrimaryButton`, `SecondaryButton`, `TextButton`, `DeleteButton`, `IconButton`, `ChipGroup`, `FormTextField`, `FormAmountField`, `createSubmitHandler`, `ConfirmDialog`, `EmptyState`, `ErrorState`, `LoadingState`, `NotFoundScreen`, `useAppToast`, `announce`.

### 6.2 Nuevos o cambiados en `shared/ui` (con sus tests, TDD)

| Componente | Necesidad | Especificación |
|---|---|---|
| **`ScreenHeader`** (nuevo, **necesario**) | Los encabezados nativos están ocultos y hoy ninguna pantalla apilada tiene "Volver". Lo usarán también ventas, ajustes y consejos. | Props: `title?: string`, `onBack?: () => void`. Fila con `px-4 pt-2 pb-4 gap-2`, `flex-row items-start`. Si hay `onBack`: `IconButton` con `CaretLeft` y `accessibilityLabel="Volver"` (área de 48 × 48). Título en `text-title font-semibold text-foreground`, `accessibilityRole="header"`, `flex-1`, que se ajusta en varias líneas y nunca se recorta. Sin sombra ni fondo propio (`background`). Tests: sin `onBack` no hay botón; con `onBack` el botón se llama "Volver" y lo invoca; el título es un `header`. |
| **`ListRow`: `amountPrefix?: string`** (cambio, **necesario**) | El "desde $10.000" de la lista (UX-P10). | Texto en `text-xs font-medium text-muted` a la izquierda del monto, en la misma columna derecha (`flex-row items-baseline gap-1`); con letra grande se apila. Se incluye en la etiqueta por defecto: "…, desde 10.000 pesos". Sin `amount`, se ignora. Tests: aparece y se lee en la etiqueta; sin `amount` no se dibuja. |
| **`InlineNotice`** (nuevo, recomendado) | Nota de "archivado" en el detalle y en el formulario, y "sin precios para vender". Servirá para D-25 ("esta semana ya tiene ventas") en F3. | Props: `message: string`, `icon?: PhosphorIcon` (por defecto `Info`). Fila `flex-row items-start gap-2`, ícono de 20 en `muted` decorativo, texto `text-sm text-muted flex-1`. Sin borde, sin sombra y sin fondo propio, para no competir con las tarjetas. Contraste ya verificado (secundario sobre fondo 6.6 / 9.0 y sobre tarjeta 5.9 / 7.7). Un solo elemento accesible con el texto. No se usa para errores (esos son `danger` con `WarningCircle`). Tests: muestra el texto, el ícono está oculto al lector y el bloque se lee entero. |

Sobre la confirmación de 3.8: "salir sin guardar" también lo va a necesitar el formulario de ventas (F3). Conviene un hook compartido (`useConfirmLeave(isDirty)`, que devuelve el estado del `ConfirmDialog`), pero dónde vive (`shared/ui` o `shared/hooks`) es una decisión de estructura: la dejo al architect o al code-writer.

### 6.3 Componentes de la feature (`src/features/products/components/`)

- `product-list.tsx` / `product-list-item.tsx`: lista y fila de 3.1, reutilizadas en archivados. La fila arma `subtitle`, `amount`, `amountPrefix` y `accessibilityLabel` según la tabla de 3.1.
- `product-detail.tsx`: contenido de 3.3 y 3.4 (sin los botones fijos, que son de la screen).
- `product-form.tsx` / `version-fields.tsx`: 3.5 a 3.7. `version-fields` recibe `index`, `isMultiple` y `onRemove`. Con `isMultiple === false` no dibuja el nombre ni "Quitar versión".

---

## 7. Accesibilidad

- **Áreas táctiles** de al menos 48 × 48 en todo lo que se toca (botones, chips, filas, "Volver"). Las filas miden al menos 56 de alto.
- **Orden de lectura** igual al visual. En el formulario: nombre → descripción → (por versión) nombre de la versión → precio (grupo de radio) → monto → costo → quitar → agregar → guardar.
- **Etiquetas**:
  - las filas de la lista y del detalle son un solo elemento con la etiqueta de las tablas de 3.1 y 3.3; los montos se leen como "pesos";
  - el botón "Volver" (solo ícono) se llama "Volver";
  - el `ChipGroup` se lee como grupo de radio llamado "Precio", con cada chip `checked`;
  - "Quitar versión" lleva la pista con el nombre, para distinguir varios botones iguales;
  - los íconos que acompañan texto son decorativos.
- **Foco y anuncios**:
  - al agregar una versión, el foco va al nombre nuevo y se anuncia;
  - al quitarla, el foco va al botón de agregar y se anuncia;
  - al revelar el costo, el foco va al campo de costo;
  - al guardar con errores, el foco va al primero y se anuncia "Revisa los campos marcados";
  - los avisos se anuncian (ya lo hace `useAppToast`).
- **Nada solo por color**: chip elegido con check; errores con ícono y texto; archivado con ícono `Archive` y texto; quitar con ícono `Trash` y palabra.
- **Letra del sistema**: sin altos fijos; el título del encabezado y los nombres largos (80 caracteres) se ajustan en varias líneas; el monto de las filas pasa debajo del nombre; el `Amount` del detalle usa la variante `display` (que ya limita a 1,5×). Se prueba con el tamaño más grande en Android.
- **Estado de carga**: `LoadingState` se anuncia como ocupado con su etiqueta.
- **Contraste**: no se agrega ningún color ni par nuevo; todo sale de la tabla 2.3 del sistema de diseño, en claro y oscuro.
- **Una mano**: las acciones principales ("Agregar producto", "Guardar", "Editar producto", "Volver a usar") van fijas abajo; "Archivar" va al final del contenido, lejos del pulgar en reposo.

---

## 8. Pruebas sugeridas para F1.5 y F1.6 (además de las del plan)

- Con una versión, ningún texto visible contiene "versión" (incluye "Agregar otra opción" y su ejemplo).
- Al tocar "Agregar otra opción", la primera fila muestra "Estándar" en el campo, editable, y el foco va al nombre de la segunda.
- "A convenir" oculta "¿A cuánto lo vendes?" y muestra "El precio lo escribes al registrar cada venta."; al volver a "Precio fijo" reaparece el monto escrito.
- "Quitar versión" de una fila nueva no abre diálogo; de una existente abre el diálogo con el texto según la pista de ventas.
- Volver con cambios abre "¿Salir sin guardar?"; sin cambios, sale directo.
- La lista muestra "desde" con varias versiones y "A convenir" con una sola a convenir.
- "Ver archivados (n)" aparece solo con `n > 0`.
- El detalle de un archivado muestra la nota, "Volver a usar" y "Editar"; sin versiones activas, no ofrece "Volver a usar".
- Un id válido que no existe muestra "No encontramos este producto".
