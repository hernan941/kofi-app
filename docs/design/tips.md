# Especificación de pantallas — Consejos (F6)

- **Tarea**: F6.2 de `docs/plan-v1.md`. La usan F6.3 (constantes de longitud), F6.4 (tests del catálogo), F6.6 (pantallas y rutas), F6.8 (E2E) y F7.8 (orden con el pedido de permiso).
- **Fuentes**: `docs/design-system.md` (Bruma), `docs/architecture/tips.md` (F6.0), `docs/design/sales.md` (UX-S9 y 3.7: celebración con lugar reservado), `docs/content/consejos.md` (30 consejos, CP7a), `docs/product.md` (D-06, D-11, D-21, D-36 y D-42) y los componentes de `@/shared/ui`.
- Este documento no define lógica de negocio. Qué consejo se muestra, cuándo cuenta como visto y en qué orden van las categorías lo deciden el dominio y los hooks (`pickTipAfterSale`, `tipSections`, `useMarkTipSeen`). La UI solo lo muestra.

---

## 1. Decisiones de diseño

| Id | Decisión | Por qué |
|---|---|---|
| UX-T1 | **El consejo posventa es una tarjeta dentro de la celebración**, en el lugar reservado (punto 7 de `sales.md` 3.7), debajo del total y de las frases. No es una pantalla ni un diálogo aparte. | La celebración ya está en pantalla y el consejo llega sin un toque más. Debajo de todo, nunca empuja ni tapa el total, que es lo más importante. |
| UX-T2 | **La tarjeta se cierra con una X** (`IconButton` "Cerrar consejo"). Cerrarla solo la oculta: la celebración sigue y "Listo" es la única salida. La tarjeta **no tiene enlaces** (ni "Ver todos los consejos" ni acciones como "Agregar costo"). | Un enlace sacaría a la persona de la celebración sin pasar por "Listo", y se saltaría el pedido de permiso de F7.8 (`sales.md` 2: un solo camino de salida). |
| UX-T3 | **Orden con el pedido de permiso de F7.8**: primero la celebración con el consejo; después de "Listo" (o de volver), y solo en la primera venta con el permiso sin decidir, la pantalla explicativa de F7. Nunca aparecen a la vez. | Cada cosa a su tiempo: festejar y aprender algo, y después decidir sobre los avisos con calma. El consejo no tapa el pedido ni al revés. |
| UX-T4 | **La tarjeta aparece con una entrada suave** (opacidad de 0 a 1 en 200 ms) cuando la elección termina, sin reservar espacio. Con "reducir movimiento", aparece de golpe. | Está al final del contenido y el pie con "Listo" es fijo: al aparecer no mueve nada de lo que ya se ve. Reservar un hueco vacío se vería como algo roto. |
| UX-T5 | **El cuerpo se muestra completo**, sin recortar ni "Leer más". Por eso el largo tiene un tope (UX-T6). | Un consejo cortado a la mitad obliga a un toque más o se queda sin leer. |
| UX-T6 | **Límites de longitud: título 50 caracteres, cuerpo 240 caracteres** (`TIP_TITLE_MAX_LENGTH` y `TIP_BODY_MAX_LENGTH`). | Cálculo en la sección 3.2. Con esos topes, en un teléfono de 360 de ancho el título ocupa 2 líneas y el cuerpo unas 8, y se lee en unos 12 segundos. El contenido aprobado ya cumple: el título más largo tiene 43 y el cuerpo más largo, 221. |
| UX-T7 | **"Consejos" es una lista por categoría**, en el orden de `TIP_CATEGORIES`, con una tarjeta por categoría. Los vistos dicen **"Visto"** con el ícono `Check`, en texto. Los no vistos no llevan ninguna marca (ni "Nuevo"). | "Visto" ayuda a encontrar lo que falta sin convertir la lista en una tarea pendiente. "Nuevo" en 30 filas se sentiría como una obligación. |
| UX-T8 | **Sin contador de leídos** ("Leíste 7 de 30"). | Por el mismo motivo: la sección es para curiosear, no un curso que hay que terminar. |
| UX-T9 | **El detalle de un consejo** es una pantalla apilada solo de lectura: categoría en el encabezado, título y cuerpo. Sin botones. | Lectura tranquila. Abrirlo lo marca como visto (D-42), así que no hace falta ninguna acción. |

---

## 2. Navegación

### 2.1 Después de guardar una venta nueva

```
/sales/new "Guardar venta" ─► celebración (misma pantalla)
     ├─ total, frases y aviso D-02 (F3)
     ├─ AfterSaleTip: tarjeta del consejo (si hay) ─► "Cerrar consejo" ─► se oculta, la celebración sigue
     └─ "Listo" / Volver / gesto / atrás de Android ─► onFinished(outcome)
            ├─ primera venta y permiso sin decidir (F7.8) ─► pantalla explicativa de avisos (F7.1) ─► Inicio
            └─ si no ─► vuelve a donde se abrió el registro (Inicio o el detalle del día)
```

- Solo al **crear** una venta (D-36, D-42). Editar una venta, marcar "no vendí" o desmarcarlo no muestran consejo.
- Inicio nunca muestra consejos (D-11).

### 2.2 Sección "Consejos"

```
(tabs)/tips ── Consejos (TipsScreen)
   └─ tocar un consejo ─► /tips/[id] (TipDetailScreen) ─► Volver ─► la lista, ya con "Visto"
/tips/<id mal formado> ─► <Redirect href="/tips">
/tips/<id que no está en el catálogo> ─► replace('/tips')
```

- "Consejos" es una pestaña: sin volver.
- `/tips/[id]` es una pantalla apilada del `Stack` raíz, sin pestañas, con `ScreenHeader` propio.

---

## 3. Pantallas

Los textos entre comillas son **exactos** (tabla completa en la sección 5).

### 3.1 Tarjeta del consejo en la celebración (`AfterSaleTip` → `AfterSaleTipCard`)

Va en el lugar 7 de la celebración, con `pt-2`, ancho completo y texto alineado a la izquierda (aunque el resto de la celebración esté centrado: un párrafo centrado se lee peor).

`Card` con sombra, `p-4` y `gap-2`:

1. **Fila superior**: ícono `Lightbulb` de 20 en `muted` + **"Consejo · {categoría}"** ("Consejo · Costos") en `text-xs font-medium` `muted`. A la derecha, `IconButton` con el ícono `X` de 20 y la etiqueta **"Cerrar consejo"** (área de 48 × 48; puede sobresalir del relleno con `hitSlop`, sin agrandar la tarjeta).
2. **Título** en `text-heading` `foreground`, rol `header`.
3. **Cuerpo** en `text-base` `foreground`, completo.

- **Al aparecer**: entrada de UX-T4. El foco del lector **no** salta a la tarjeta: sigue en el título de la celebración (F3) y la tarjeta se lee después, en el orden normal.
- **Al cerrar**: la tarjeta desaparece (opacidad a 0 en 150 ms, o de golpe con "reducir movimiento"), se anuncia **"Consejo cerrado"** y el foco va a "Listo". No vuelve a aparecer en esa venta (F6.6).
- **Visto**: se marca al mostrarse, una sola vez (lo hace `AfterSaleTip`, D-42).
- **Sombras de la celebración**: la tarjeta y "Listo". Son dos.
- **Una mano**: la X queda arriba a la derecha, lejos del pulgar. Es aceptable porque cerrar es opcional: "Listo" (abajo, fijo) sale de la celebración con o sin la tarjeta.

### 3.2 Límites de longitud (UX-T6)

| Campo | Máximo | Qué ocupa en 360 de ancho, letra normal |
|---|---|---|
| Título | **50** caracteres | Ancho útil de la tarjeta: 360 − 32 (margen) − 4 (borde) − 32 (relleno) = 292. Lexend a 20 entra en unos 25 caracteres por línea: **2 líneas**. |
| Cuerpo | **240** caracteres | Lexend a 16 entra en unos 31 caracteres por línea: **8 líneas** (192 de alto). Son unas 40 palabras: unos 12 segundos de lectura. |

- El contenido aprobado cumple con margen (título máximo 43, cuerpo máximo 221).
- Con letra grande, la celebración se desplaza (es un `ScrollView` con "Listo" fijo). El total sigue arriba, a la vista al aparecer.
- `TIP_TITLE_MAX_LENGTH = 50` y `TIP_BODY_MAX_LENGTH = 240` reemplazan los valores provisorios de F6.0 (60 y 280). La sección "Formato de cada ficha" de `docs/content/consejos.md` tiene que decir lo mismo (lo actualiza el orquestador). El test de F6.4 usa estas constantes.

### 3.3 Sección "Consejos" (`(tabs)/tips`, `TipsScreen`)

`SectionList` con `px-4`:

1. **Encabezado de la lista**: `ScreenHeader` sin volver, con el título **"Consejos"**, y debajo, en `text-base` `muted`: **"Ideas breves para llevar tu negocio. Cada vez que registras una venta, te mostramos una."**
2. **Una sección por categoría** con consejos, en el orden de `TIP_CATEGORIES`: Registro, Costos, Precios, Ferias, Redes y Flujo de dinero.
   - Encabezado de sección: la categoría en `text-heading`, rol `header`, con `pt-6` y `pb-2`.
   - Las filas de la sección van dentro de una tarjeta (`Card` sin título), separadas por `ListSeparator`, en el orden del catálogo.
3. **Fila** (`ListRow` tocable, `onOpenTip(id)`):
   - `title`: el título del consejo (`text-base font-medium`, hasta 2 líneas, sin recortar);
   - visto: `subtitle` **"Visto"** con el ícono `Check` de 16 delante, en `text-xs` `muted` (requiere `subtitleIcon` en `ListRow`, sección 6.2);
   - no visto: sin subtítulo;
   - sin monto ni miniatura;
   - etiqueta accesible: "{título}, {categoría}, visto" o "{título}, {categoría}"; pista "Abre el consejo".

- **Sombras**: una por tarjeta de categoría. Cada una tiene de 4 a 6 filas (de 224 a 336 de alto), así que a la vista hay como mucho dos o tres, dentro del máximo del sistema de diseño (4.4).
- Al volver de un detalle, la fila pasa a "Visto" sola (invalidación de F6.0).

### 3.4 Detalle de un consejo (`/tips/[id]`, `TipDetailScreen`)

1. `ScreenHeader` con volver y la categoría como título ("Costos").
2. `ScrollView` con `px-4`, `pt-4` y `gap-4`:
   - **título** del consejo en `text-title`, rol `header`;
   - **cuerpo** en `text-base` `foreground`, seleccionable.
3. Sin botones, tarjetas ni sombras.

- Al abrirse, se marca como visto (D-42), una vez por apertura.
- El catálogo está en memoria: el contenido se dibuja de inmediato, sin esperar a saber si ya estaba visto.

---

## 4. Estados

### 4.1 Tarjeta posventa

| Estado | Qué se ve |
|---|---|
| Eligiendo (consulta pendiente) | Nada. La celebración se ve completa. |
| Hay consejo | La tarjeta, con la entrada de UX-T4. |
| Sin consejo (catálogo vacío o venta no encontrada) | Nada. |
| Error al elegir | Nada; queda un `logger.warn`. La venta ya se guardó y la celebración sigue igual. |
| Cerrada | Nada, hasta salir de la celebración. |
| Editar, "no vendí" | No se monta (2.1). |
| **Primera venta** | El título de primera venta de F3 y, debajo, el consejo que elija la prioridad (sin costos cargados, uno de costos; con costos, `registro-primera-venta`). |

### 4.2 Sección "Consejos"

| Estado | Qué se ve |
|---|---|
| Cargando los vistos | Encabezado y frase; `LoadingState` "Cargando consejos", `shape="rows"`, `count={6}`. Evita que las marcas "Visto" aparezcan de a una. |
| Error al leer los vistos | La lista completa **sin** marcas, y arriba un `InlineNotice` con `Info`: "No pudimos revisar cuáles ya leíste. Igual puedes leerlos todos." Los consejos están en la app, así que se pueden leer. |
| **Primer uso** (ninguno visto) | La lista completa, sin marcas. |
| Algunos vistos | Los vistos con "Visto". |
| Todos vistos | Todos con "Visto". Sin mensajes especiales. |
| Catálogo vacío (caso futuro con catálogo remoto) | `EmptyState` sin botón: ícono `Lightbulb`; título "Aquí vas a encontrar consejos"; descripción "Pronto vas a tener ideas para tu negocio en esta sección." |

### 4.3 Detalle

| Estado | Qué se ve |
|---|---|
| Id válido del catálogo | 3.4, de inmediato. |
| Error al marcar visto | Igual que el éxito; queda en el logger (no bloquea nada). |
| Id bien formado fuera del catálogo | Vuelve a la lista (`replace('/tips')`), sin aviso. |
| Id mal formado | Vuelve a la lista (`Redirect`). |

---

## 5. Textos

Español neutro con tuteo y sin culpa. Mismas palabras prohibidas que `tracking-home.md` (sección 5). El texto de cada consejo sale del catálogo (`docs/content/consejos.md`) y no se edita en la UI.

| Clave sugerida | Texto |
|---|---|
| Categorías (`TIP_CATEGORY_LABELS`) | `recording` "Registro" · `costs` "Costos" · `pricing` "Precios" · `fairs` "Ferias" · `social_media` "Redes" · `money_flow` "Flujo de dinero" |
| Tarjeta: encabezado | "Consejo · {categoría}" |
| Tarjeta: cerrar | "Cerrar consejo" (etiqueta del `IconButton`) |
| Anuncio al cerrar | "Consejo cerrado" |
| Título de la sección | "Consejos" |
| Introducción | "Ideas breves para llevar tu negocio. Cada vez que registras una venta, te mostramos una." |
| Marca de visto | "Visto" |
| Etiqueta de fila | "{título}, {categoría}, visto" / "{título}, {categoría}" |
| Pista de fila | "Abre el consejo" |
| Cargando | "Cargando consejos" |
| Error de vistos | "No pudimos revisar cuáles ya leíste. Igual puedes leerlos todos." |
| Catálogo vacío | "Aquí vas a encontrar consejos" · "Pronto vas a tener ideas para tu negocio en esta sección." |

---

## 6. Componentes

### 6.1 Se usan de `@/shared/ui` sin cambios

`Screen`, `ScreenHeader`, `Card`, `ListRow`/`ListSeparator`, `IconButton`, `Icon`, `InlineNotice`, `EmptyState`, `LoadingState`, `announce`.

### 6.2 Nuevos o cambiados en `shared/ui` (con sus tests, TDD)

| Componente | Necesidad | Especificación |
|---|---|---|
| **`ListRow`: `subtitleIcon`** (cambio, **necesario**) | "Visto" con el ícono `Check` (3.3). También sirve para "Archivado" con `Archive` si se quiere más adelante. | Prop opcional `subtitleIcon?: PhosphorIcon`, dibujada con `Icon` de 16 en `muted` delante del subtítulo, decorativa (oculta al lector). Tests: con la prop se ve el ícono y la etiqueta accesible no cambia; sin la prop, el comportamiento actual no cambia. |
| **`FadeIn`** (nuevo, **necesario**) | La entrada de la tarjeta (UX-T4) y su salida al cerrar. También la puede usar la celebración de F3 (`sales.md` 3.7, punto 1). | Envuelve a sus hijos y los muestra con opacidad de 0 a 1 en `duration` (200 por defecto) con Reanimated. Con `useReducedMotion`, sin animación. Tests: con movimiento reducido se dibuja con opacidad 1 de entrada; los hijos son accesibles desde el principio. Si F3 ya tiene un equivalente para el ícono de la celebración, se generaliza ese. |
| **`icons.ts`** (necesario) | Íconos de esta especificación. | `XIcon` y `CheckIcon` (si falta). `LightbulbIcon` ya existe. |

### 6.3 Componentes de la feature (`src/features/tips/components/`)

Los de `docs/architecture/tips.md` (2.1), con estas precisiones:
- `after-sale-tip-card.tsx`: 3.1. Recibe `tip` y `onClose`. Presentacional: no marca visto ni guarda estado.
- `screens/after-sale-tip.tsx`: elige, marca visto al mostrarse, guarda el cerrado en un `useState`, envuelve la tarjeta en `FadeIn`, anuncia "Consejo cerrado" y lleva el foco a "Listo". Para lo último necesita una referencia al botón: la celebración de F3 le pasa una función `focusDone()` junto con `outcome` en `renderAfterSave` (cambio aditivo en `sales`; ver la pregunta 9.2).
- `tip-list.tsx`: 3.3 (`SectionList` con tarjetas por sección).
- `tip-detail.tsx`: 3.4.
- `category-labels.ts`: tabla de la sección 5.

---

## 7. Accesibilidad

- **Orden de lectura** en la celebración: título → total → resumen → frase → aviso D-02 → "Consejo · Costos" → "Cerrar consejo" → título del consejo → cuerpo → "Listo".
- **Foco**: al aparecer la tarjeta, el foco no se mueve. Al cerrarla, el foco va a "Listo" y se anuncia "Consejo cerrado".
- **Encabezados**: "Consejos", cada categoría, el título del consejo en la tarjeta y en el detalle.
- **Visto sin color**: ícono `Check` **y** la palabra "Visto" a la vista, y "visto" en la etiqueta accesible (F6.0, test 19).
- **Letra grande**: título y cuerpo crecen sin límite y no se recortan (UX-T5). La celebración y el detalle se desplazan. Las filas de la lista crecen en alto.
- **Contraste**: no se agrega ningún par nuevo (`foreground` y `muted` sobre `surface` y `background`).
- **Áreas táctiles**: la X de 48 × 48 y las filas de 56 de alto como mínimo.
- **Reducir movimiento**: la tarjeta aparece y desaparece sin animación.

---

## 8. Pruebas sugeridas para F6.4 y F6.6 (además de las del plan)

**Catálogo (F6.4)**
- Todo título tiene 50 caracteres o menos y todo cuerpo 240 o menos, contados con `[...texto].length` (caracteres, no bytes: hay tildes y "ñ").

**Tarjeta posventa**
- Muestra "Consejo · {categoría}", el título y el cuerpo completo (sin `numberOfLines`).
- "Cerrar consejo" la oculta, anuncia "Consejo cerrado" y la celebración sigue con "Listo"; no vuelve en esa venta.
- No tiene ningún botón aparte de "Cerrar consejo" (no hay enlaces que salten "Listo").
- Con `useReducedMotion` en `true`, se dibuja con opacidad 1 desde el principio.
- Mientras elige, con error o sin consejo, no dibuja nada y la celebración se ve igual.
- Primera venta sin costos: aparece un consejo de la categoría "Costos" debajo de "¡Registraste tu primera venta!".

**Orden con F7.8**
- En la primera venta con el permiso sin decidir, la pantalla explicativa aparece **después** de tocar "Listo" (y después de volver con el gesto o el botón atrás), nunca mientras la celebración está a la vista.

**Lista**
- Seis secciones en el orden Registro, Costos, Precios, Ferias, Redes y Flujo de dinero con el catálogo real.
- Un consejo visto muestra "Visto" y su etiqueta termina en ", visto"; uno no visto no muestra nada.
- Con error al leer los vistos, la lista se ve completa con el aviso "No pudimos revisar cuáles ya leíste…".
- Mientras carga, se ve "Cargando consejos" y no una lista sin marcas.

**Detalle**
- El encabezado muestra la categoría y el cuerpo es seleccionable; abrirlo marca visto una vez.

**E2E (F6.8)**: los de F6.0 (5.6), buscando "Consejo · Costos", "Cerrar consejo" y "Visto".

---

## 9. Preguntas abiertas

1. **Límites de longitud (para el usuario).** Recomiendo **50 y 240** (UX-T6): el contenido aprobado ya cumple y la tarjeta queda legible sin recortar. La alternativa es mantener **60 y 280**, que da más margen para escribir consejos nuevos, a cambio de tarjetas de hasta 10 líneas en teléfonos chicos. Si se eligen 50 y 240, hay que actualizar el formato de `docs/content/consejos.md` y las constantes de F6.0.
2. **Foco en "Listo" al cerrar (para el architect).** Llevar el foco a "Listo" pide que la celebración de F3 le pase a `renderAfterSave` una forma de enfocarlo (`focusDone`). Si no se agrega, el valor por defecto es solo anunciar "Consejo cerrado" y dejar el foco donde el sistema lo ponga.
