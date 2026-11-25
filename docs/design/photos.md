# Especificación de pantallas — Fotos de producto (F2)

- **Tarea**: F2.1 de `docs/plan-v1.md`. La usa F2.5 (UI de fotos) y la verifica F2.8 (E2E).
- **Fuentes**: `docs/design-system.md` (Bruma), `docs/design/products.md` (F1.1), `docs/architecture/product-photos.md` (F2.0), `docs/product.md` (D-05, D-17, D-35) y los componentes de `@/shared/ui`.
- Este documento no define lógica de negocio. El cupo, el orden y la portada los deciden las funciones del dominio (`remainingPhotoSlots`, `movePhoto`, `makeCover`, `coverPhoto`); la UI solo las muestra.
- Completa los lugares que `docs/design/products.md` dejó reservados: la miniatura de la lista (3.1), la galería del detalle (3.3, punto 2) y la tira del formulario (3.5, punto 3).

---

## 1. Decisiones de diseño

| Id | Decisión | Por qué |
|---|---|---|
| UX-F1 | En el formulario, **dos botones a la vista**, "Galería" y "Cámara", debajo de las fotos. No hay un menú intermedio para elegir el origen. | Ahorra un toque en cada foto y deja claro desde el principio que se puede usar la cámara. Los dos son botones secundarios (sin sombra), así que no compiten con "Guardar". |
| UX-F2 | Las fotos del formulario van en una **grilla que se acomoda en filas** (80 × 80, `flex-wrap`), no en una tira con desplazamiento horizontal. | Con 6 fotos como máximo, la grilla las muestra todas sin esconder ninguna fuera de la pantalla. El desplazamiento horizontal es difícil de descubrir y de usar con TalkBack. |
| UX-F3 | **Tocar una foto abre una hoja** (`Sheet`) con la foto en grande y sus acciones: "Usar como portada", "Mover antes", "Mover después" y "Quitar foto". No hay ruta nueva. | D-35: sin arrastrar y sin zoom. Una sola hoja para todo evita botones diminutos sobre cada miniatura y es accesible con el lector de pantalla. La hoja ya existe (`Sheet`) y no necesita librerías nuevas. |
| UX-F4 | La portada se marca con la palabra **"Portada" debajo** de la primera miniatura, no con un sello encima de la foto. | Un texto sobre una foto no tiene contraste garantizado (la foto puede ser de cualquier color). Debajo, sobre el fondo, el contraste ya está medido (texto / fondo 14.6 y 15.7). |
| UX-F5 | **Quitar pide confirmación siempre**, también para una foto recién agregada (D-35). | Una foto es difícil de recuperar si se quitó por error (hay que volver a buscarla en la galería). El texto aclara cuándo se aplica. |
| UX-F6 | En el detalle se ve **la portada en grande** y, si hay más de una, una fila de miniaturas de 64 × 64. Tocar cualquiera abre la misma hoja, en modo solo lectura, con "Anterior" y "Siguiente". | Los productos son obras: la foto principal merece espacio. La portada se muestra **entera** (`contentFit="contain"`), sin recortar la obra; las miniaturas sí se recortan al cuadrado (`cover`). |
| UX-F7 | En listas (Productos y el selector de ventas), la miniatura de 40 × 40 **solo aparece si al menos un producto de esa lista tiene portada**. Los que no tienen foto muestran entonces un recuadro neutro con el ícono `Package`. | Si nadie usa fotos, una columna de íconos iguales es ruido. Si alguien las usa, el recuadro neutro mantiene los nombres alineados. |
| UX-F8 | Si falta el archivo de una foto, se muestra un **recuadro neutro con el ícono `Image`**, sin palabras de alarma. En la hoja, una frase tranquila explica qué hacer. | ADR-008 lo pide neutro. No es culpa de la persona y no tiene que asustarse: puede quitarla y agregarla otra vez. |
| UX-F9 | Sin pantalla previa al permiso de cámara (D-35). Si se niega, un diálogo amable ofrece "Abrir ajustes" y recuerda que la galería sigue disponible. | Tocar "Cámara" ya deja claro para qué es el permiso. El diálogo da una salida en vez de un callejón. |
| UX-F10 | Al llegar a 6, los dos botones se reemplazan por un texto que lo explica (test de F2.5). | El botón que no hace nada frustra; el texto dice cómo seguir. |

---

## 2. Navegación

No hay rutas nuevas (`docs/architecture/product-photos.md`, 2.3). Todo vive dentro de las pantallas de F1:

```
/products/new y /products/[id]/edit (formulario)
   ├─ "Galería" ─► selector del sistema ─► vuelve al formulario con las fotos preparándose
   ├─ "Cámara"  ─► (permiso del sistema la primera vez) ─► cámara del sistema ─► vuelve
   │                └─ permiso negado ─► diálogo "Abrir ajustes" / "Ahora no"
   └─ tocar una foto ─► hoja "Foto 2 de 3" (portada, mover, quitar ─► confirmación)

/products/[id] (detalle, activo o archivado)
   └─ tocar la portada o una miniatura ─► hoja "Foto 2 de 3" (solo ver: anterior / siguiente)
```

- La hoja se cierra con su botón de cerrar, deslizando hacia abajo, tocando el velo o con el botón atrás de Android. El botón atrás **cierra la hoja**, no sale del formulario.
- Salir del formulario sin guardar con fotos nuevas pasa por el mismo "¿Salir sin guardar?" de `docs/design/products.md` (3.8): agregar, quitar o reordenar fotos cuenta como un cambio. Si la persona sale, las fotos nuevas se descartan (D-35).

---

## 3. Pantallas

Los textos entre comillas son **exactos** (tabla completa en la sección 5).

### 3.1 Sección "Fotos" del formulario (`PhotoStrip`)

Va entre "Descripción" y la tarjeta de precio (`docs/design/products.md`, 3.5, punto 3), sobre el fondo, sin tarjeta propia (así el formulario sigue con dos sombras: la tarjeta de precio y "Guardar").

**Estructura**, de arriba abajo, con `gap-2`:

1. **Encabezado de la sección**, en una fila `flex-row justify-between items-baseline flex-wrap`:
   - a la izquierda, "Fotos (opcional)" en `text-sm font-medium` `foreground` (misma etiqueta que un campo);
   - a la derecha, el contador **"3 de 6"** en `text-sm` `muted`. Cuenta las fotos guardadas, las nuevas y las que se están preparando (`remainingPhotoSlots(photos.length + pendientes)`). Con 0 fotos dice "0 de 6".
2. **Ayuda** en `text-sm` `muted`:
   - sin fotos: "Una buena foto te ayuda a reconocer el producto al registrar ventas. La primera es la portada.";
   - con fotos: "La primera es la portada. Toca una foto para moverla o quitarla.".
3. **Grilla de fotos** (solo si hay al menos una o una preparándose): `flex-row flex-wrap gap-2`. Cada celda es una columna con:
   - la miniatura, 80 × 80, `rounded-xl`, borde de 2 px `field-border`, sin sombra, `contentFit="cover"`;
   - debajo, solo en la primera, "Portada" en `text-xs font-medium` `foreground`. Las demás dejan ese espacio vacío para que la grilla quede pareja.
   - Toda la celda es un botón (área de 80 × 100, más de 48 × 48) que abre la hoja de 3.2.
4. **Celdas que se preparan**: mismo tamaño, fondo `surface`, `Skeleton` de HeroUI (sin pulso si el sistema pide reducir movimiento). No se tocan. Para el lector, una sola etiqueta para el grupo: "Preparando 2 fotos" (o "Preparando 1 foto").
5. **Botones para agregar**, en una fila `flex-row flex-wrap gap-2`, cada uno `flex-1` con ancho mínimo de 140 (con letra grande se apilan):
   - `SecondaryButton` "Galería", ícono `Image`, `accessibilityHint` "Agrega fotos de la galería";
   - `SecondaryButton` "Cámara", ícono `Camera`, `accessibilityHint` "Toma una foto con la cámara". (El nombre accesible es el texto visible, como en el resto de los botones; la pista explica qué hace.)
   - Con **6 fotos** (contando las que se preparan), los dos botones se reemplazan por el texto "Ya tienes 6 fotos, el máximo. Para agregar otra, quita una." en `text-sm` `muted`, con el ícono `Info` (es un `InlineNotice`).
6. **Mensaje de foto que no se pudo agregar** (solo si pasó): debajo de los botones, ícono `WarningCircle` de 16 en `danger` y el texto en `text-sm` `danger` (sección 5.3). Se anuncia al aparecer. Desaparece al volver a tocar "Galería" o "Cámara", o al guardar. No bloquea nada: las demás fotos siguen.
7. **Aviso de selección recortada** (raro: el selector ya limita la cantidad): `InlineNotice` "Agregamos {n}: es el espacio que te quedaba." Se anuncia y desaparece igual que el mensaje anterior.

**Galería**: "Galería" abre el selector del sistema con el cupo que queda (`pickFromLibrary(cupo)`), con selección múltiple si el cupo es mayor que 1. Al volver, cada foto elegida aparece como celda "preparándose" y, al terminar, como miniatura, en el orden elegido, **al final** de la grilla. Si la persona cancela, no pasa nada y no se muestra ningún mensaje.

**Cámara**: "Cámara" pide el permiso del sistema la primera vez y abre la cámara. Si cancela, no pasa nada. Si el permiso queda negado, se abre el diálogo de 3.4.

**Foco y anuncios**:
- Al terminar de preparar las fotos se anuncia "Agregaste 2 fotos. Tienes 3 de 6." (o "Agregaste la foto. Tienes 1 de 6.").
- El foco no salta: queda donde estaba (en el botón que se tocó), para no desorientar.

**Guardar mientras se preparan fotos**: "Guardar" sigue activo (nunca se deshabilita). Si se toca con fotos preparándose, la etiqueta pasa a "Preparando fotos…", se anuncia "Esperando que terminen las fotos" y, cuando terminan, se guarda solo. Las fotos que no se pudieron agregar no impiden guardar.

### 3.2 Hoja de una foto en el formulario

`Sheet` con el título **"Foto 2 de 3"** (se actualiza si la foto cambia de lugar). Contenido con `gap-4`:

1. **La foto en grande**: ancho completo, alto máximo del 55 % de la pantalla, `contentFit="contain"` sobre `background`, `rounded-xl`. Sin zoom ni gestos (D-35). Etiqueta accesible: "Foto 2 de 3 de Lámina Colibrí" (o "Foto 2 de 3" si el producto todavía no tiene nombre).
2. **Portada**:
   - si es la primera: `InlineNotice` con el ícono `Star`: "Es la portada: se ve en tu lista y al registrar ventas.";
   - si no: `SecondaryButton` "Usar como portada", ícono `Star`, ancho completo.
3. **Mover**, en una fila `flex-row gap-2` (cada uno `flex-1`; con letra grande se apilan):
   - `SecondaryButton` "Mover antes", ícono `CaretLeft`, deshabilitado en la primera;
   - `SecondaryButton` "Mover después", ícono `CaretRight`, deshabilitado en la última.
   - Con una sola foto, la fila no se muestra.
4. **Quitar**: `DeleteButton` "Quitar foto", ícono `Trash`, alineado a la izquierda, con `pt-4` de separación. Abre la confirmación de 3.3. Usa "Quitar" y no "Borrar" por la misma excepción de UX-P7b de productos: la foto guardada recién se borra al guardar.

Al **usar como portada** o **mover**, la hoja queda abierta, el título cambia ("Foto 1 de 3"), la grilla de atrás se reordena y se anuncia "Ahora es la portada." o "Ahora es la foto 3 de 3.". El foco queda en el botón tocado; si ese botón quedó deshabilitado (llegó a un extremo) o desapareció ("Usar como portada"), va al título de la hoja.

### 3.3 Quitar foto (confirmación)

`ConfirmDialog` destructivo (`isDestructive`):

| Caso | Título | Descripción | Confirmar | Cancelar |
|---|---|---|---|---|
| Foto ya guardada | "¿Quitar esta foto?" | "Se quita del producto cuando guardes los cambios." | "Quitar foto" | "Cancelar" |
| Foto nueva (de esta vez) | "¿Quitar esta foto?" | "Se quita de este producto. Si la quieres de nuevo, vuelve a elegirla." | "Quitar foto" | "Cancelar" |

Al confirmar: se cierran el diálogo y la hoja, la foto sale de la grilla (si era la portada, la siguiente pasa a serlo), se anuncia "Quitaste la foto. Tienes 2 de 6." y el foco va a la primera miniatura o, si no quedan, al botón "Galería". Cancelar vuelve a la hoja sin cambios.

Nota para F2.5: `Sheet` y `ConfirmDialog` son dos `Modal`. Si al probar en Android el diálogo no aparece encima de la hoja, se cierra la hoja antes de abrir el diálogo y se vuelve a abrir en la misma foto al cancelar; para la persona el resultado es el mismo.

### 3.4 Permiso de cámara negado

`ConfirmDialog` no destructivo:

- Título: "La cámara no tiene permiso"
- Descripción: "Para tomar fotos desde Kofi, permite el uso de la cámara en los ajustes del teléfono. Mientras tanto, puedes elegir fotos de la galería."
- Confirmar: "Abrir ajustes" (llama a `Linking.openSettings()`). Cancelar: "Ahora no".
- Al volver de los ajustes no se reintenta solo: la persona toca "Cámara" otra vez. Así nunca se abre la cámara sin que la pida.

### 3.5 Fotos en el detalle (`PhotoGallery`)

Va debajo del encabezado y antes de la descripción (`docs/design/products.md`, 3.3, punto 2). Es igual en un producto activo y en uno archivado (solo lectura en los dos). **Sin fotos no se muestra nada**: ni recuadro vacío ni invitación.

1. **Portada**: ancho completo menos el margen (`px-4`), proporción 4:3, `contentFit="contain"` sobre `surface`, `rounded-3xl`, borde sticker de 2 px **sin sombra** (el detalle ya tiene la tarjeta de versiones y el botón principal). Es un botón: abre la hoja de 3.6 en la foto 1. Etiqueta: "Foto 1 de 3 de Lámina Colibrí, portada"; pista: "Abre la foto en grande".
2. **Miniaturas** (solo con dos fotos o más): fila `flex-row flex-wrap gap-2 pt-2` con **todas** las fotos (la portada incluida, para que el orden se entienda), 64 × 64, `rounded-xl`, borde 2 px `field-border`, `contentFit="cover"`. Cada una es un botón (64 × 64 con `hitSlop` hasta 48 no hace falta: ya supera 48). Etiqueta: "Foto 2 de 3".

### 3.6 Hoja de una foto en el detalle

`Sheet` con el título "Foto 2 de 3":

1. La foto en grande, igual que en 3.2.
2. Fila `flex-row gap-2`: `SecondaryButton` "Anterior" (ícono `CaretLeft`) y "Siguiente" (ícono `CaretRight`), deshabilitados en los extremos. Con una sola foto no se muestran.
3. Al cambiar de foto, el título se actualiza y se anuncia ("Foto 3 de 3").

No hay acciones de edición: para cambiar fotos se usa "Editar producto".

### 3.7 Miniatura en listas (Productos, Archivados y selector de ventas)

- `ListRow` con `leading`: 40 × 40, `rounded-xl`, `contentFit="cover"`, decorativa (oculta al lector: la fila ya se lee con el nombre).
- Regla UX-F7: la columna de miniaturas aparece solo si **algún** producto de la lista tiene portada. Sin portada, el recuadro neutro de 3.8 con el ícono `Package`.
- La portada es siempre `coverPhoto(product)` (D-17). La pantalla no elige.

### 3.8 Recuadro neutro (falta el archivo o no hay foto)

| Caso | Fondo | Ícono | Etiqueta accesible |
|---|---|---|---|
| Falta el archivo (`onError` de `expo-image`) | `field-background` (= fondo) | `Image`, `muted`, 24 en miniaturas y 48 en grande | "Foto 2 de 3, no se puede mostrar" |
| Producto sin foto, en listas (UX-F7) | `field-background` | `Package`, `muted`, 20 | decorativo (oculto) |

- Mismo tamaño, radio y borde que la foto que reemplaza.
- En la hoja del formulario (3.2), debajo del recuadro grande: "No pudimos mostrar esta foto. Puedes quitarla y agregarla de nuevo." en `text-sm` `muted`. En la hoja del detalle: "No pudimos mostrar esta foto." Las acciones (portada, mover, quitar) siguen disponibles.
- Contraste: `muted` sobre fondo es 6.6 (claro) y 9.0 (oscuro), ya medido en la tabla 2.3.
- El registro en el logger lo hace `ProductPhoto` (una vez por id); la UI no muestra nada técnico.

---

## 4. Estados

### 4.1 Formulario (sección Fotos)

| Estado | Qué se ve |
|---|---|
| Sin fotos | Etiqueta, "0 de 6", ayuda de "sin fotos" y los dos botones. Sin grilla. |
| Preparando | Celdas con `Skeleton` al final de la grilla; el contador ya las cuenta. Los botones siguen disponibles mientras quede cupo. |
| Con fotos | Grilla, "Portada" bajo la primera, contador y botones (o el texto de 6). |
| Lleno (6) | Grilla y el texto "Ya tienes 6 fotos, el máximo. Para agregar otra, quita una." en lugar de los botones. |
| Foto que no se pudo agregar | Mensaje de 3.1, punto 6; las demás fotos se agregan normalmente. |
| Permiso negado | Diálogo de 3.4. |
| La galería o la cámara no abren (rechazo inesperado) | Aviso de error (toast): "No se pudo abrir la galería. Inténtalo de nuevo." o "No se pudo abrir la cámara. Inténtalo de nuevo." |
| Archivo faltante | Recuadro neutro de 3.8 en su celda. |
| Guardado | Igual que F1: se sale y aparece "Producto guardado" o "Cambios guardados". |
| Error del dominio al guardar (`too_many_photos`, `duplicate_photo`) | Aviso de error con el texto de 5.4; el formulario y sus fotos quedan como estaban. |

### 4.2 Detalle

| Estado | Qué se ve |
|---|---|
| Sin fotos | Nada (la descripción sube). |
| Una foto | Solo la portada en grande. |
| Varias | Portada y fila de miniaturas. |
| Cargando o error del producto | Los estados de `docs/design/products.md`, 4.3 (las fotos no tienen estado propio). |
| Archivo faltante | Recuadro neutro de 3.8 (también en la portada grande). |

---

## 5. Textos

Español neutro con tuteo. Sin "error", "inválid", "incorrect", "debes", "falló" ni "mal".

### 5.1 Etiquetas y botones

| Clave sugerida | Texto |
|---|---|
| Etiqueta de la sección | "Fotos (opcional)" |
| Contador | "{n} de 6" · accesible: "{n} de 6 fotos" |
| Ayuda sin fotos | "Una buena foto te ayuda a reconocer el producto al registrar ventas. La primera es la portada." |
| Ayuda con fotos | "La primera es la portada. Toca una foto para moverla o quitarla." |
| Galería | "Galería" · pista: "Agrega fotos de la galería" |
| Cámara | "Cámara" · pista: "Toma una foto con la cámara" |
| Lleno | "Ya tienes 6 fotos, el máximo. Para agregar otra, quita una." |
| Marca de portada | "Portada" |
| Título de la hoja | "Foto {i} de {n}" |
| Nota de portada (hoja) | "Es la portada: se ve en tu lista y al registrar ventas." |
| Usar como portada | "Usar como portada" |
| Mover | "Mover antes" · "Mover después" |
| Quitar | "Quitar foto" |
| Navegar (detalle) | "Anterior" · "Siguiente" |
| Guardar esperando fotos | "Preparando fotos…" |
| Recuadro sin archivo (formulario) | "No pudimos mostrar esta foto. Puedes quitarla y agregarla de nuevo." |
| Recuadro sin archivo (detalle) | "No pudimos mostrar esta foto." |

### 5.2 Etiquetas accesibles y anuncios

| Situación | Texto |
|---|---|
| Miniatura del formulario | "Foto {i} de {n}" + ", portada" en la primera · pista: "Abre la foto para verla, moverla o quitarla" |
| Portada del detalle | "Foto 1 de {n} de {nombre}, portada" · pista: "Abre la foto en grande" |
| Miniatura del detalle | "Foto {i} de {n}" |
| Foto grande en la hoja | "Foto {i} de {n} de {nombre}" |
| Foto sin archivo | "Foto {i} de {n}, no se puede mostrar" |
| Celdas preparándose | "Preparando {k} fotos" / "Preparando 1 foto" |
| Fotos agregadas | "Agregaste {k} fotos. Tienes {n} de 6." / "Agregaste la foto. Tienes {n} de 6." |
| Portada cambiada | "Ahora es la portada." |
| Foto movida | "Ahora es la foto {i} de {n}." |
| Foto quitada | "Quitaste la foto. Tienes {n} de 6." |
| Guardar esperando | "Esperando que terminen las fotos" |

### 5.3 Fotos que no se pudieron agregar (`PhotoImportErrorCode`)

| Caso | Texto |
|---|---|
| `unreadable` (una foto) | "No pudimos abrir esta imagen. Prueba con otra." |
| `write_failed` (una foto) | "No pudimos guardar la foto. Revisa que el teléfono tenga espacio e inténtalo de nuevo." |
| `invalid_id` (una foto; no debería pasar) | "No pudimos guardar la foto. Inténtalo de nuevo." |
| Varias fotos, cualquier código | "No pudimos agregar {k} de las fotos. Prueba con otras o inténtalo de nuevo." |
| Selección recortada | "Agregamos {n}: es el espacio que te quedaba." |
| La galería no abre | "No se pudo abrir la galería. Inténtalo de nuevo." |
| La cámara no abre | "No se pudo abrir la cámara. Inténtalo de nuevo." |

### 5.4 Códigos nuevos de `PRODUCT_ERROR_MESSAGES`

| Código | Texto |
|---|---|
| `too_many_photos` | "Puedes tener hasta 6 fotos. Quita alguna para agregar otra" |
| `duplicate_photo` | "Esta foto ya está en el producto" |
| `photo_not_found` | "Esta foto ya no está. Vuelve a abrir el producto" |

### 5.5 Diálogos

Ver 3.3 (quitar) y 3.4 (permiso).

---

## 6. Componentes

### 6.1 Se usan de `@/shared/ui` sin cambios

`SecondaryButton` (ya acepta `icon` e `isDisabled`, que usan "Mover antes/después" y "Anterior/Siguiente"), `DeleteButton` (con `label="Quitar foto"`), `InlineNotice`, `Sheet`, `ConfirmDialog`, `ListRow` (prop `leading`), `useAppToast`, `announce`, `Icon`.

### 6.2 Cambios en `shared/ui`

| Cambio | Necesidad | Especificación |
|---|---|---|
| **`icons.ts`: íconos nuevos** (necesario) | Los pide esta especificación. | `ImageIcon`, `CameraIcon`, `StarIcon`, `CaretRightIcon` (hoy `DateField` lo importa directo; conviene re-exportarlo), `TrashIcon` y `WarningCircleIcon` si todavía no están re-exportados. |

No hace falta un componente de imagen en `shared/ui`: `ProductPhoto` (en `features/products/components`, ADR-008) es el único que dibuja fotos. Como ventas (F3) e inicio (F4) muestran miniaturas, **`features/products/index.ts` tiene que exportar `ProductPhoto`** (o un `ProductThumbnail` que lo envuelva con los tamaños de 3.7). Lo confirma el architect: no cambia ninguna regla de ADR-005, porque `sales` ya depende de `products`.

### 6.3 Componentes de la feature (`src/features/products/components/`)

- `photo-strip.tsx`: 3.1 a 3.4. Recibe las fotos del formulario, las pendientes y los callbacks; maneja la hoja y los diálogos con `useState`.
- `photo-sheet.tsx` (sugerido): la hoja de 3.2 y 3.6 con una prop `mode: 'edit' | 'view'`, para no duplicar la foto grande ni el recuadro neutro.
- `photo-gallery.tsx`: 3.5.
- `product-photo.tsx`: `expo-image` con `cachePolicy="memory"`, `recyclingKey`, tamaño, `contentFit`, etiqueta y el recuadro de 3.8 ante `onError`.
- `product-list-item.tsx` (existe): suma `leading` según UX-F7; la lista le pasa `showThumbnails`.

---

## 7. Accesibilidad

- **Áreas táctiles**: celdas de 80 × 100, miniaturas del detalle de 64 × 64, botones de 48 de alto como mínimo.
- **Orden de lectura**: etiqueta → contador → ayuda → fotos en orden (la primera dice "portada") → "Galería" → "Cámara" → mensajes. En la hoja: título → foto → portada → mover → quitar.
- **Nada solo por color**: la portada se dice con texto ("Portada"), los extremos con el estado deshabilitado, los errores con ícono y texto.
- **Letra grande**: los botones se apilan (`flex-wrap`); el contador pasa debajo de la etiqueta; las fotos mantienen su tamaño (son imágenes, no texto).
- **Lector de pantalla**: cada foto es un solo elemento con su posición; las acciones de mover se anuncian con la posición nueva; el contador se lee como "3 de 6 fotos".
- **Reducir movimiento**: el `Skeleton` no pulsa y la hoja no se desliza (ya lo hace `Sheet`).
- **Contraste**: no se agregan colores ni pares nuevos.
- **Una mano**: los botones para agregar quedan en la mitad de la pantalla y la hoja aparece abajo, a la altura del pulgar.

---

## 8. Pruebas sugeridas para F2.5 (además de las del plan)

- Con 0 fotos: "0 de 6", la ayuda de "sin fotos" y los dos botones; sin grilla.
- "Galería" llama a `pickFromLibrary` con el cupo que queda (6 − fotos − pendientes); "Cámara" llama a `takePhoto`.
- Mientras se preparan 2 fotos con 3 guardadas, el contador dice "5 de 6" y "Galería" pide cupo 1.
- Con 6 fotos (o 5 + 1 preparándose) no están "Galería" ni "Cámara" y aparece "Ya tienes 6 fotos, el máximo. Para agregar otra, quita una.".
- Una de tres fotos falla con `unreadable`: aparece "No pudimos abrir esta imagen. Prueba con otra." (con dos que fallan, el texto de varias) y las otras dos se agregan.
- Permiso negado: el diálogo muestra "Abrir ajustes" y al tocarlo se llama a `Linking.openSettings`; "Ahora no" lo cierra sin abrir la cámara.
- Cancelar la galería o la cámara no muestra ningún mensaje.
- La primera miniatura tiene la etiqueta "Foto 1 de 3, portada" y el texto "Portada" debajo.
- En la hoja de la foto 3: "Usar como portada" la pasa a la posición 0, el título cambia a "Foto 1 de 3" y se anuncia "Ahora es la portada."; "Mover después" está deshabilitado en la última.
- Quitar pide confirmación (con los dos textos según sea nueva o guardada); cancelar no cambia nada; confirmar baja el contador y la siguiente pasa a ser portada.
- Guardar con fotos preparándose cambia la etiqueta a "Preparando fotos…" y guarda al terminar, con las fotos en el orden de la grilla.
- Detalle sin fotos no dibuja nada; con una, solo la portada; con tres, portada y tres miniaturas; la hoja navega con "Anterior" y "Siguiente".
- `ProductPhoto` con `onError` muestra el recuadro neutro con la etiqueta "…, no se puede mostrar".
- La lista de productos sin ninguna portada no dibuja miniaturas; con una portada, las filas sin foto muestran el recuadro `Package`.
- Ningún texto de este documento contiene las palabras prohibidas (el test de mensajes de F1.5 se extiende a los nuevos).

E2E (F2.8): los cuatro flujos de `docs/architecture/product-photos.md`, 5.7, ubican los elementos por estos textos: "Galería", "Cámara", "1 de 6", "Portada", "Usar como portada", "Quitar foto" y "Ya tienes 6 fotos, el máximo. Para agregar otra, quita una.".
