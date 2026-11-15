# Auditoría de accesibilidad (F10.1, parte del designer)

- **Tarea**: F10.1 de `docs/plan-v1.md`. La usan el code-writer (correcciones con tests de RNTL) y el usuario (recorrido con TalkBack en su teléfono Android).
- **Fecha**: 2026-11-14.
- **Alcance**: todo `src/features/**/screens`, `src/features/**/components` y `src/shared/ui/**`, más la barra de pestañas de `src/app/(tabs)/_layout.tsx`, porque usa `TabBarLabel`. Quedan fuera las pantallas de `src/features/e2e`, que existen solo para las pruebas.
- **Criterios**: `.claude/rules/react-native/accessibility.md`, `docs/design-system.md` (secciones 2.3, 6 y 7), WCAG 2.x AA y los `docs/design/*.md` de cada feature.
- **Método**: revisé el código sin modificarlo. También leí las partes de HeroUI Native 1.0.11 (`node_modules/heroui-native/src`) de las que dependen el toast, el diálogo y los botones, porque varios hallazgos vienen de ahí.
- **Respaldo (F8)**: hay code-writers trabajando en `src/features/backup/**`. Los hallazgos de esos archivos son **provisionales**; los números de línea pueden moverse.

## Resumen

| Severidad | Cantidad | Qué significa |
|---|---|---|
| **Alta** | 5 | Impide o confunde mucho el uso con TalkBack o con letra grande en un flujo crítico (DT-15). Se corrige antes de cerrar F10.1. |
| **Media** | 12 | El flujo se puede completar, pero con información que falta, se repite o se corta. Se corrige en F10.1. |
| **Baja** | 9 | Detalles de pulido, de consistencia o de documentación. Se pueden agrupar en una sola tarea. |

Los cinco más importantes:

1. **A1.** Cada toast se puede leer hasta tres veces, y además hay un botón "Cerrar aviso" invisible al que llega TalkBack.
2. **A2.** El diálogo de confirmación no lleva el foco a la pregunta, y en Android tampoco impide que TalkBack recorra la pantalla de atrás.
3. **A3.** Con TalkBack, la cantidad de una venta y la hora del recordatorio probablemente se leen como un porcentaje ("2 por ciento").
4. **A4.** Los montos y las filas que están dentro de otro grupo accesible pueden aparecer como dos paradas del foco en Android: el lector lee la fila y después vuelve a leer el monto.
5. **A5.** Las hojas inferiores no tienen alto máximo. Con letra grande, el título y el botón de cerrar se salen por arriba de la pantalla.

Lo que ya está bien, para no tocarlo:

- Los íconos se ocultan siempre con los tres atributos (`Icon`).
- Las áreas táctiles son de 48 como mínimo en todo `shared/ui` y en las celdas del calendario.
- El botón principal no se deshabilita nunca.
- Lo elegido lleva un check, el día de hoy un borde y la intensidad del calendario puntos, así que nada depende solo del color.
- "Reducir movimiento" se respeta en `Sheet`, `FadeIn`, `ProgressBlock`, `SwitchRow` y la celebración.
- Las hojas, los diálogos y las pantallas con cambios sin guardar tienen botón atrás de Android.
- En la tabla 2.3, el contraste cumple en claro y en oscuro: `field-foreground` es igual a `foreground` y `overlay` es igual a `surface`, así que no aparecen pares nuevos.

---

## 1. Hallazgos de severidad alta

### A1. Los toasts se anuncian varias veces y dejan un botón invisible

- **Dónde**:
  - `src/shared/ui/toast.tsx:34`: `accessibilityLiveRegion="polite"`;
  - `src/shared/ui/toast.tsx:68`: `announce(message)`;
  - HeroUI `components/toast/toast.tsx:224-237`, la copia transparente que usa para medir el alto;
  - HeroUI `primitives/toast/toast.tsx:39-40`: `role="status"` y `aria-live="polite"`.
- **Problema**: el mismo aviso llega a TalkBack por tres caminos:
  1. la llamada a `announce()`;
  2. la región viva del toast visible;
  3. la región viva de la copia que HeroUI dibuja con `opacity-0` para medirse. Esa copia recibe las mismas props que el toast visible.

  Por lo tanto, "Venta borrada" se puede oír dos o tres veces seguidas. Además, la copia también incluye un `Toast.Close` que nadie ve, pero al que TalkBack sí llega al deslizar el dedo: es un botón "Cerrar aviso" fantasma.
- **Criterio que incumple**: `accessibility.md` (State & Live Regions) y el sistema de diseño 6.6 ("se anuncia al lector de pantalla", una vez). El riesgo ya estaba anotado en 6.10.
- **Corrección**:
  1. Dejar **un solo canal** de anuncio. Se queda `announce()` y se quita `accessibilityLiveRegion` de `AppToastView`: el anuncio llega aunque el foco esté en otro lado y no depende de cómo trate TalkBack una región viva recién montada.
  2. Ocultar la copia de medición. HeroUI no permite pasarle props distintas, así que hay dos opciones (ver la sección 5, decisión 1):
     - **(a) Recomendada**: un parche local de HeroUI con `patch-package`, que agregue `accessibilityElementsHidden` e `importantForAccessibility="no-hide-descendants"` a la copia. Es un cambio de dependencias y el `architect` tiene que registrarlo en un ADR.
     - **(b)** Ocultar al lector todo el contenido del toast y dejar solo el anuncio. En ese caso TalkBack ya no puede llegar al botón de cerrar, pero el aviso se cierra solo a los 4 segundos.
- **Verificación**:
  - **RNTL**: `showSuccess` llama a `announce` una sola vez, y `AppToastView` no tiene `accessibilityLiveRegion`.
  - **TalkBack**: el aviso se oye una vez y, al deslizar el dedo, no aparece ningún "Cerrar aviso" sin toast a la vista.

### A2. El diálogo de confirmación no mueve ni retiene el foco

- **Dónde**: `src/shared/ui/confirm-dialog.tsx:37-69`, sobre el `Dialog` de HeroUI. En Android, `components/dialog/dialog.tsx` usa un `Fragment` en lugar de `FullWindowOverlay`, y el `Portal` dibuja el diálogo en el `PortalHost` de la raíz.
- **Problema**:
  - El diálogo no es una ventana nativa. TalkBack sigue con el foco en el botón que lo abrió (por ejemplo, "Borrar venta") y no lee la pregunta.
  - Al deslizar el dedo se puede recorrer toda la pantalla de atrás. `aria-modal` no tiene efecto en Android.
  - En los diálogos más delicados de la app ("¿Borrar esta venta?", "¿Reemplazar todos tus datos?", "¿Salir sin guardar?"), una persona ciega puede no darse cuenta de que se abrió una pregunta.
- **Criterio que incumple**: `accessibility.md` (Focus & Navigation: "move focus to new content (modals) on open and restore on close") y el checklist de F10.1 ("el foco en diálogos y hojas").
- **Corrección** (ver la sección 5, decisión 2):
  - **(a) Recomendada**: dibujar `ConfirmDialog` sobre el `Modal` de React Native, igual que `Sheet`. Se mantiene el aspecto (tarjeta, borde sticker y fondo `backdrop`) y la API del componente. El `Modal` crea una ventana propia: TalkBack se queda dentro, pone el foco en el primer elemento (la pregunta, con rol `header`) y `onRequestClose` maneja el botón atrás. Al cerrarse, se devuelve el foco al elemento que abrió el diálogo con `sendAccessibilityEvent(..., 'focus')`.
  - **(b)** Seguir con HeroUI: al abrir, mover el foco al título con `sendAccessibilityEvent`, y mientras esté abierto, ocultar el resto de la app con `importantForAccessibility="no-hide-descendants"` mediante un contexto en `app-providers`. Requiere más piezas y es más frágil.
  - Con cualquiera de las dos, se mantiene una regla: **nunca un diálogo sobre una hoja abierta** (ver M11).
- **Verificación**:
  - **RNTL**: con la opción (a), al abrir se renderiza un `Modal` visible con `onRequestClose`, y la pregunta tiene rol `header`.
  - **TalkBack**: al abrir, se lee la pregunta; al deslizar el dedo solo se recorren la descripción y los dos botones; el botón atrás cancela; al cerrar, el foco vuelve al botón que abrió el diálogo.

### A3. La cantidad y la hora se leen como porcentaje

- **Dónde**: `src/shared/ui/quantity-stepper.tsx:85-97`. Lo usan `sale-item-fields.tsx:103-110` ("Cantidad") y `notifications/components/weekly-reminder-fields.tsx:74-82` ("Hora").
- **Problema**:
  - El campo tiene el rol `adjustable` y `accessibilityValue={{ min, max, now }}`, sin `text`. En Android, React Native lo expone como un rango, y TalkBack lee los rangos sin texto como porcentaje: una cantidad de 3 entre 1 y 99 suena "2 por ciento", y las 8 entre 0 y 23 suenan "34 por ciento".
  - Además, como es un `TextInput` con rol `adjustable`, TalkBack puede presentarlo como "control deslizante" y no queda claro que se puede escribir.
- **Criterio que incumple**: WCAG 4.1.2 (nombre, rol y valor) y `accessibility.md` (custom components operable by the screen reader).
- **Corrección**:
  1. Agregar `text` al valor: `accessibilityValue={{ min, max, now: value, text: valueText }}`. Por defecto es `String(value)`; la hora puede pasar "8 horas" con una prop opcional `valueText`.
  2. En el recorrido con TalkBack, confirmar que tocar dos veces abre el teclado. Si el rol `adjustable` lo impide, se separa el control: un `TextInput` con rol de campo y las acciones `increment` y `decrement` en el grupo.
- **Verificación**:
  - **RNTL**: `accessibilityValue.text` es "3" y se actualiza al tocar "Agregar uno".
  - **TalkBack**: se lee "Cantidad de Lámina Colibrí, 3", deslizar hacia arriba o abajo cambia el valor y tocar dos veces deja escribir.

### A4. Montos y filas anidados dentro de otro grupo accesible (doble parada del foco en Android)

- **Dónde**:
  - `src/shared/ui/amount.tsx:38`: `Amount` lleva siempre `accessible`;
  - `src/shared/ui/list-row.tsx:64`: `Amount` dentro de una fila, que ya es `accessible` (`:85`) o `Pressable` (`:94`);
  - `src/features/tracking/components/home-summary-card.tsx:55` y `:68`: un `ListRow` estático (que ya es accesible) y un `Amount` dentro de un `View accessible`;
  - `src/features/sales/components/sale-form.tsx:435` (Total) y `sale-item-fields.tsx:141` (Subtotal);
  - `src/features/backup/components/restore-preview.tsx:117`: tres `ListRow` estáticos dentro de un `View accessible`;
  - `src/features/products/components/photo-gallery.tsx:39` y `:58`: un `ProductPhoto` no decorativo (`accessible`, rol `image`) dentro de un `Pressable` con etiqueta.
- **Problema**: en Android, `accessible={true}` se traduce en `focusable`. TalkBack se detiene en el contenedor, que lee su etiqueta completa, y **otra vez** en cada hijo que también es `focusable`. Así, la fila "Lámina Colibrí, hoy, 15.000 pesos" va seguida de una parada "15.000 pesos", y la tarjeta de Inicio lee "En noviembre…" dos veces. En iOS no pasa, pero el objetivo de la v1 es Android.
- **Criterio que incumple**: el sistema de diseño 7 ("las tarjetas que se tocan son un solo elemento") y 6.4 ("toda la fila es un botón con una etiqueta completa").
- **Corrección**:
  - Que `ListRow` dibuje su contenido dentro de un `View` con `accessibilityElementsHidden` e `importantForAccessibility="no-hide-descendants"`. La etiqueta ya está en la fila.
  - Lo mismo en `HomeSummaryCard`, en los bloques Total y Subtotal y en la tarjeta de la vista previa: el contenedor que tiene la etiqueta oculta a sus hijos.
  - `PhotoGallery` pasa `isDecorative` a `ProductPhoto`, como ya hace `PhotoStrip`.
  - Se recomienda una prop en `Amount` (por ejemplo, `isGrouped`) para no tener que envolver cada uso.
- **Verificación**:
  - **RNTL**: dentro de una fila con `onPress` no hay ningún descendiente visible para la accesibilidad (`getByRole('button')` y, adentro, ningún elemento con `accessible`). Lo mismo en `HomeSummaryCard`.
  - **TalkBack**: en Inicio y en Productos, cada fila es una sola parada.

### A5. Las hojas no tienen alto máximo: con letra grande se cortan por arriba

- **Dónde**: `src/shared/ui/sheet.tsx:35-57`. Afecta a:
  - `products/components/photo-sheet.tsx`, en modo edición: la foto en 4:3 y hasta cinco botones;
  - `sales/components/product-picker.tsx:321`: el paso de versión, sin desplazamiento;
  - `notifications/components/weekly-reminder-sheet.tsx:23`: tiene un `ScrollView`, pero sin un alto que lo limite, así que no se desplaza;
  - `shared/ui/date-picker-sheet.tsx`.
- **Problema**: la hoja crece con su contenido dentro de un `flex-1 justify-end`, sin `max-height`. Con letra grande en un teléfono de 640 de alto, el contenido supera la pantalla y lo que sobra queda **arriba, fuera de la vista**: el título y la X de cerrar. El `ScrollView` interno no se desplaza porque nada lo limita. `docs/design/notifications.md` dice que la hoja de recordatorio se desplaza, pero el código no lo logra.
- **Criterio que incumple**: DT-15 ("tamaño de fuente máximo sin texto cortado"), el sistema de diseño 7 ("no se fijan altos" y nada se recorta) y WCAG 1.4.4 y 1.4.10.
- **Corrección**:
  1. `Sheet` limita su alto (por ejemplo, `max-h-[90%]`, o el alto de `useWindowDimensions` menos el área segura superior).
  2. El encabezado, con el título y la X, queda fijo.
  3. Los `children` van **dentro de un `ScrollView` que pone la propia `Sheet`**, con `keyboardShouldPersistTaps="handled"`.
  4. Las hojas que hoy tienen su propio `ScrollView` (la de recordatorio) lo quitan. La lista virtualizada del selector de productos sigue igual (`max-h-96`).
- **Verificación**:
  - **RNTL**: `Sheet` dibuja sus hijos dentro de un `ScrollView` y el encabezado queda fuera de él.
  - **Teléfono**: con la letra más grande, la X y el título están a la vista en las cuatro hojas y el botón final se alcanza desplazando.

---

## 2. Hallazgos de severidad media

### M1. Los controles de cada fila no dicen de qué producto son

- **Dónde**:
  - `sales/components/sale-item-fields.tsx:94` ("Cambiar"), `:115` ("Precio de cada uno") y `:132` ("Quitar");
  - los botones "Quitar uno" y "Agregar uno" de `shared/ui/quantity-stepper.tsx:79-104`;
  - `products/components/version-fields.tsx:79` ("Precio"), `:88` ("¿A cuánto lo vendes?") y `:120` ("Quitar versión").
- **Problema**: con dos productos en la venta, TalkBack lee dos "Precio de cada uno" y dos "Quitar" iguales. El nombre del producto está solo en `accessibilityHint`, y quien desactiva las sugerencias en TalkBack nunca lo oye. "Cantidad" sí lleva el nombre ("Cantidad de Lámina Colibrí").
- **Criterio que incumple**: WCAG 2.4.6 y 2.5.3 (etiquetas que describen) y `accessibility.md` (hint "only when the action is non-obvious").
- **Corrección**:
  - Pasar el nombre a la etiqueta: "Quitar Lámina Colibrí", "Cambiar versión de Lámina Colibrí", "Precio de cada uno de Lámina Colibrí".
  - En `QuantityStepper`, los botones toman el nombre del campo: "Quitar uno a la cantidad de Lámina Colibrí".
  - Para eso, `TextField` y `FormAmountField` necesitan una prop `accessibilityLabel` opcional; hoy está excluida en el `Omit` de `text-field.tsx:22-32`. La etiqueta visible no cambia.
  - En las versiones del producto, se usa el nombre de la versión cuando existe.
- **Verificación**: **RNTL**: con dos productos, `getByRole('button', { name: 'Quitar Lámina Colibrí' })` existe y es único.

### M2. "Más detalles" no dice si está abierto o cerrado

- **Dónde**: `sales/components/sale-form.tsx:394-401`.
- **Problema**: el botón despliega el canal y la nota, pero no expone `accessibilityState={{ expanded }}`. El cambio de ícono (`CaretDown` o `CaretUp`) es decorativo y está oculto.
- **Criterio que incumple**: `accessibility.md` (`accessibilityState` con `expanded`) y WCAG 4.1.2.
- **Corrección**: `ButtonBase` acepta `accessibilityState` y lo pasa al `Button` de HeroUI, y `TextButton` lo deja pasar. "Más detalles" envía `{ expanded: isDetailsOpen }`.
- **Verificación**: **RNTL**: `toHaveAccessibilityState({ expanded: false })` y, al tocarlo, `true`.

### M3. El nombre del grupo de chips se pierde cuando la respuesta es opcional

- **Dónde**: `shared/ui/chip-group.tsx:53-63`. Se ve en "¿Dónde vendiste? (opcional)" de `sale-form.tsx:405`.
- **Problema**:
  - La etiqueta visible está oculta al lector. Con `allowDeselect`, el contenedor no tiene rol y tampoco es `accessible`, así que su `accessibilityLabel` no se lee en ninguna plataforma. TalkBack dice "Feria, botón" sin decir de qué pregunta es.
  - Con el rol `radiogroup` (Día, Minutos, Precio, Semana), no está claro que TalkBack lea el nombre del grupo al entrar.
- **Criterio que incumple**: WCAG 1.3.1 y 2.4.6 y el sistema de diseño 6.10 ("se lee como un grupo de opciones").
- **Corrección**: no ocultar la etiqueta visible (se lee como un texto antes de los chips) y quitar el `accessibilityLabel` del contenedor sin rol. En el `radiogroup` se mantiene la etiqueta del grupo, pero sin ocultar el texto visible hasta confirmar en TalkBack que no se lee dos veces.
- **Verificación**:
  - **RNTL**: con `allowDeselect`, el texto "¿Dónde vendiste? (opcional)" es accesible.
  - **TalkBack**: al llegar al primer chip ya se oyó de qué trata el grupo.

### M4. Montos escritos con "$" dentro de un texto: el lector puede decir "dólares"

- **Dónde**:
  - `sales/screens/sale-detail-screen.tsx:124`: la descripción del diálogo "…por $45.000";
  - los cuerpos de los consejos en `tips/domain/catalog.ts` (líneas 33, 54, 61, 103, 138, 187 y 201), que se muestran en `tips/components/tip-detail.tsx:18` y `tips/components/after-sale-tip-card.tsx:35`.
- **Problema**: fuera de `Amount` y `AmountSentence`, el texto "$15.000" llega crudo a la voz de TalkBack. Muchas voces en español lo leen como "quince mil dólares". El checklist de F10.1 pide que los montos se lean como pesos.
- **Criterio que incumple**: el sistema de diseño 3.3 y 7 ("los montos se leen como '15.000 pesos'").
- **Corrección**:
  - Un helper en `shared/ui` (por ejemplo, `spokenPesos(text)`) que convierte `$15.000` en "15.000 pesos" para armar el `accessibilityLabel` del `Text`.
  - `ConfirmDialog` acepta una etiqueta accesible para la descripción, o directamente `parts` como `AmountSentence`.
  - Los consejos usan el helper en `TipDetail` y en `AfterSaleTipCard`.
- **Verificación**:
  - **RNTL**: la etiqueta de la descripción contiene "45.000 pesos" y no contiene "$".
  - **TalkBack**: se oye "pesos".

### M5. Calendario de la hoja de fecha: celdas de tamaño fijo y una fila más ancha que un teléfono de 360

- **Dónde**: `shared/ui/date-picker-sheet.tsx:58` y `:76` (`size-12`) y `:137` (encabezados `size-12`).
- **Problema**:
  - Siete celdas de 48 fijas, con `justify-between`, suman 336 de ancho. En una pantalla de 360 con `px-4` quedan 328, así que la fila se desborda en los Android de gama baja más comunes.
  - El número del día (`text-base`) crece sin límite dentro de un alto fijo de 48, y con letra grande se corta.
  - El calendario de la pestaña resolvió esto con celdas flexibles y `maxFontSizeMultiplier={2}`.
- **Criterio que incumple**: el sistema de diseño 7 ("no se fijan altos, solo altos mínimos") y DT-15.
- **Corrección**:
  - Celdas `flex-1` con `min-h-12` y un círculo interior con `min-h`/`min-w`, sin tamaño fijo.
  - El número usa `maxFontSizeMultiplier={2}` con la misma justificación que el calendario (`docs/design/tracking-calendar.md`, línea 268). La etiqueta accesible sigue completa.
- **Verificación**:
  - **RNTL**: las celdas no tienen la clase `size-12` y el número tiene `maxFontSizeMultiplier` de 2.
  - **Teléfono**: en 360 de ancho con la letra más grande, se ven las siete columnas completas.

### M6. Miniaturas de foto del formulario con alto y ancho fijos que contienen texto

- **Dónde**: `products/components/photo-strip.tsx:132` (`h-25 w-20`) con el texto "Portada" en `text-xs`.
- **Problema**: el `Pressable` mide 100 × 80 fijo. La foto (80) más la separación y "Portada" a 2× (unos 36 de alto y más de 80 de ancho) no caben, así que el texto se corta o se monta.
- **Criterio que incumple**: el sistema de diseño 7 (sin altos fijos) y DT-15.
- **Corrección**: quitar `h-25` y usar `min-w-20` en lugar de `w-20`, para que el botón crezca con su etiqueta. La foto se queda en 80 × 80, como pide `docs/design/photos.md`.
- **Verificación**:
  - **RNTL**: el botón de la miniatura no tiene la clase `h-25`.
  - **Teléfono**: con letra grande, "Portada" se lee completa.

### M7. Los estados vacíos no se desplazan

- **Dónde**: `shared/ui/empty-state.tsx:36`. Se usa directo en `tracking/screens/home-screen.tsx:83` (con la racha debajo), `products/screens/products-screen.tsx:55` (dos botones), `tracking/components/day-detail-view.tsx:106`, `sales/screens/new-sale-screen.tsx:123` (con el panel "no vendí" debajo) y `shared/ui/not-found-screen.tsx`.
- **Problema**: con letra grande, el ícono de 48, el título, la frase y uno o dos botones superan el alto de la pantalla. Sin `ScrollView`, los botones quedan fuera de alcance. En el registro de venta sin productos, el panel "Esta semana no vendí" queda abajo, inalcanzable.
- **Criterio que incumple**: DT-15 y WCAG 1.4.10.
- **Corrección**: `EmptyState` (y `ErrorState`, por coherencia) se dibuja dentro de un `ScrollView` con `contentContainerClassName="flex-grow"`. Si no, cada pantalla lo envuelve. Se recomienda hacerlo en el componente.
- **Verificación**:
  - **RNTL**: `EmptyState` contiene un `ScrollView`.
  - **Teléfono**: en Inicio vacío y en Productos vacío, con la letra más grande, se alcanzan todos los botones.

### M8. Las etiquetas de las pestañas pueden cortarse a 1,5×

- **Dónde**: `shared/ui/tab-bar-item.tsx:36-37` (`maxFontSizeMultiplier={1.5}` y `numberOfLines={1}`) y las cinco pestañas de `src/app/(tabs)/_layout.tsx`.
- **Problema**: en 360 de ancho, cada pestaña tiene unos 72. "Calendario" en Lexend `text-xs` ya ocupa casi eso a 1×. A 1,5× se corta con puntos suspensivos ("Calend…"). El límite está documentado en el sistema de diseño 7, pero no evita el corte.
- **Criterio que incumple**: DT-15 ("sin texto cortado").
- **Corrección**: ver la sección 5, decisión 3.
- **Verificación**: **Teléfono** solamente. Con letra grande en 360 de ancho, las cinco etiquetas se ven completas.

### M9. El foco se pierde al cambiar de paso dentro de una hoja o al cerrarla

- **Dónde**:
  - `sales/components/product-picker.tsx:293` y `:297-329`: al tocar un producto con varias versiones, la fila tocada desaparece y el título de la hoja cambia sin aviso. Lo mismo pasa con "Ver todos los productos";
  - `sales/components/sale-form.tsx:218`: al elegir, la hoja se cierra, se anuncia "Agregaste…" y el foco queda donde lo deje Android;
  - `shared/ui/sheet.tsx`, en general: al cerrar, el foco no vuelve al botón que la abrió.
- **Problema**: TalkBack queda sin foco o vuelve al principio de la pantalla. Hay que recorrer todo de nuevo para encontrar la fila agregada.
- **Criterio que incumple**: `accessibility.md` ("move focus to new content… and restore on close").
- **Corrección**:
  - `Sheet` expone un `ref` del título (o una prop `focusKey`) para llevar el foco al encabezado cada vez que cambia el paso.
  - Al cerrar, quien abrió la hoja devuelve el foco con `sendAccessibilityEvent`: al botón que la abrió, o a la fila nueva, como ya se hace con "Agregar otro producto" al quitar.
- **Verificación**:
  - **RNTL**: se llama a `sendAccessibilityEvent` con el título al pasar al paso de versión.
  - **TalkBack**: después de cada paso, lo primero que se oye es el nuevo título.

### M10. Al guardar con errores se pisan varios anuncios

- **Dónde**: `shared/ui/forms/create-submit-handler.ts:17-19` ("Revisa los campos marcados") junto con `shared/ui/text-field.tsx:86` (cada campo anuncia su propio error) y el foco al primer campo con error.
- **Problema**: con tres campos vacíos se lanzan cuatro anuncios casi al mismo tiempo, más la lectura del campo que recibe el foco. En Android, cada anuncio interrumpe al anterior, así que la persona oye un fragmento cualquiera, no necesariamente el resumen.
- **Criterio que incumple**: `accessibility.md` (los anuncios de validación deben ser útiles) y el sistema de diseño 6.10.
- **Corrección**:
  - Un solo anuncio al enviar: el resumen. Después, el foco va al primer campo, que lee su error como sugerencia.
  - `TextField` anuncia su error solo cuando aparece **fuera** de un envío, por ejemplo un error del servidor asignado a un campo después de guardar. Se puede resolver con una prop `announceError` que `FormTextField` controla según `formState.isSubmitting`, o haciendo que el anuncio del envío incluya el primer error ("Revisa los campos marcados. Nombre: escribe un nombre").
- **Verificación**:
  - **RNTL**: al enviar un formulario con tres errores, `announce` se llama una vez.
  - **TalkBack**: se oye el resumen completo y después el campo con su error.

### M11. Un diálogo que se abre mientras se cierra una hoja

- **Dónde**: `products/components/photo-strip.tsx:204` (`isOpen={removing === null}`) y `:228`.
- **Problema**:
  - Al tocar "Quitar foto", la hoja empieza a cerrarse con su animación y el diálogo se abre en el mismo cuadro.
  - En Android, el `Modal` de la hoja es una ventana que tapa el `PortalHost` de HeroUI, así que el diálogo queda **debajo** hasta que termina la animación (unos 300 ms). Mientras tanto, TalkBack sigue dentro de la ventana que se está cerrando.
  - Hoy es el único caso en la app. Las demás hojas y diálogos nunca coinciden, y hay que mantenerlo así.
- **Criterio que incumple**: el riesgo de dos `Modal` en Android y `accessibility.md` (Focus).
- **Corrección**:
  - Abrir el diálogo cuando la hoja ya se cerró. En iOS se usa `onDismiss` del `Modal`; en Android, `animationType="none"` para ese cierre puntual o una espera hasta el siguiente cuadro después de `visible={false}`.
  - Si se adopta A2 (a), este caso pasa a ser un `Modal` que se abre después de cerrar otro, nunca uno sobre otro.
  - Agregar la regla al sistema de diseño 6.10: "un diálogo nunca se abre con una hoja visible".
- **Verificación**: **TalkBack**: al tocar "Quitar foto", lo primero que se oye es "¿Quitar esta foto?" y el diálogo se ve de inmediato.

### M12. Anuncios redundantes junto a un cambio de foco o de estado

- **Dónde**:
  - `sales/components/sale-saved-celebration.tsx:91-92`: anuncia "Venta registrada. Total…" y en el mismo cuadro mueve el foco al título "¡Venta registrada!";
  - `notifications/screens/notification-settings-screen.tsx:94`: anuncia "Recordatorio semanal activado" cuando TalkBack ya dice "activado" por el rol `switch`;
  - `notifications/components/weekly-reminder-fields.tsx:60`: anuncia el resumen en cada cambio, justo después de que TalkBack lee "Martes, marcado".
- **Problema**: la persona oye dos veces lo mismo, o el anuncio corta la lectura del foco nuevo.
- **Criterio que incumple**: el checklist de F10.1 (anuncios duplicados).
- **Corrección**:
  - **Celebración**: mover el foco al `Amount` principal, o a un bloque con el título y el total, y no anunciar aparte. Así se oye "¡Venta registrada! 45.000 pesos" una vez.
  - **Interruptores**: anunciar solo si falla. El éxito ya lo dice el estado `checked`.
  - **Recordatorio**: el resumen se anuncia con un pequeño retraso, o se deja como región viva educada en el texto del resumen, sin `announce()`. Hay que confirmarlo con TalkBack.
- **Verificación**:
  - **RNTL**: `announce` no se llama al cambiar un interruptor con éxito.
  - **TalkBack**: en cada caso, lo nuevo se oye una sola vez.

---

## 3. Hallazgos de severidad baja

| ID | Dónde | Problema | Criterio | Corrección |
|---|---|---|---|---|
| B1 | `tracking/components/latest-sales-list.tsx:74-77` | El error de "Últimas ventas" usa `InlineNotice` con tono `info`: ícono `muted` y sin anuncio. | Sistema de diseño 2.2 (el error lleva `WarningCircle` en `danger`) y 7 (los errores se anuncian). | `tone="danger"`. Test: el mensaje se anuncia. |
| B2 | `products/components/product-photo.tsx:49` y `backup/components/backup-progress.tsx:38` (provisional) | Lo decorativo se oculta solo para Android (`importantForAccessibility`), sin `accessibilityElementsHidden`, a diferencia de `Icon`. | Consistencia entre iOS y Android pedida en la tarea. | Usar siempre los tres: `accessible={false}`, `accessibilityElementsHidden` e `importantForAccessibility="no-hide-descendants"`. Test: ambos atributos presentes. |
| B3 | `sales/components/sale-detail.tsx:68-71`, `tracking/components/day-detail-view.tsx:121-127`, `tracking/components/monthly-summary-view.tsx:90-93` y `tracking/screens/calendar-screen.tsx:79-83` | "Total", "Vendiste" o "Vendiste en noviembre" y su monto son dos o tres paradas separadas. | Sistema de diseño 6.2 y 7 (agrupar lo relacionado). | Un `View accessible` con la etiqueta "Vendiste en noviembre: 45.000 pesos, 3 ventas" que oculte a sus hijos (ver A4). Test por etiqueta. |
| B4 | `backup/components/backup-progress.tsx:71` (provisional) | Un paso pendiente se lee igual que su título, sin "pendiente". El hecho dice "hecho". | WCAG 1.3.1. | Etiqueta "…, pendiente". Test por etiqueta. |
| B5 | `products/components/product-form.tsx:320` | Mientras espera las fotos, el botón cambia su texto a "Guardando…", pero no expone `busy`. | `accessibility.md` (estado con `accessibilityState`). | Pasar `accessibilityState={{ busy: true }}` (requiere lo mismo que M2 en `ButtonBase`). Test de estado. |
| B6 | `tracking/components/calendar-day-cell.tsx:42` | La excepción `maxFontSizeMultiplier={2}` está justificada en `docs/design/tracking-calendar.md`, pero el sistema de diseño 7 dice que solo el monto principal y las pestañas tienen límite. | Fuente de verdad única. | **Hecho**: las excepciones del calendario y de M5 están en la tabla de la sección 7 del sistema de diseño. Solo documentación. |
| B7 | `tracking/components/calendar-day-cell.tsx:36` | Los días futuros usan `muted` con opacidad 0.6 (unos 2.6:1). | WCAG excluye lo deshabilitado; el estado también se dice en la etiqueta. | Ninguna. Es informativo y queda registrado para que no se repita en un elemento activo. |
| B8 | `shared/ui/text-field.tsx:108` y `:131-141` | El error y la ayuda se leen como sugerencia del campo **y** como texto aparte al deslizar el dedo. | Posible duplicado. | Conservarlo mientras no moleste: quien apaga las sugerencias en TalkBack solo oye el error como texto. Se confirma en el recorrido. |
| B9 | `shared/ui/announce.ts:9` | Toda la estrategia de anuncios depende de `announceForAccessibility`, que Android 16 marca como obsoleto. | Riesgo a futuro. | Ninguna en la v1. Si TalkBack deja de leerlos en una versión nueva, se migra a regiones vivas o a `accessibilityPaneTitle`. Lo registra el `architect`. |

---

## 4. Cómo se verifica cada hallazgo

### 4.1 Con tests de RNTL (el code-writer, una corrección con su test)

| Hallazgo | Qué afirma el test |
|---|---|
| A1 | `showSuccess` o `showError` llaman a `announce` una sola vez. `AppToastView` no tiene `accessibilityLiveRegion`. Con el parche: la copia de medición está oculta. |
| A2 | Con `isOpen`, se renderiza un `Modal` visible con `onRequestClose`. El título tiene rol `header`. Cancelar o el atrás llaman a `onCancel`. |
| A3 | `accessibilityValue.text` refleja el valor y cambia con las acciones `increment` y `decrement`. |
| A4 | Dentro de un `ListRow` con `onPress` no hay descendientes accesibles. Lo mismo en `HomeSummaryCard`, Total y Subtotal y la vista previa. `PhotoGallery` usa fotos decorativas. |
| A5 | `Sheet` envuelve sus hijos en un `ScrollView` y el encabezado queda fuera de él. |
| M1 | Las etiquetas "Quitar {producto}", "Precio de cada uno de {producto}" y similares son únicas con dos filas. |
| M2 | "Más detalles" tiene `expanded` en `false` o `true`. |
| M3 | Con `allowDeselect`, la etiqueta del grupo es alcanzable. |
| M4 | Las etiquetas de la descripción del diálogo y de los consejos dicen "pesos" y no contienen "$". |
| M5 | Las celdas no tienen tamaño fijo y el número tiene un multiplicador de 2. |
| M6 | La miniatura no tiene alto fijo. |
| M7 | `EmptyState` y `ErrorState` contienen un `ScrollView`. |
| M9 | Se llama a `sendAccessibilityEvent(título, 'focus')` al cambiar de paso. |
| M10 | Un solo `announce` al enviar un formulario con varios errores. |
| M12 | No hay `announce` en los cambios correctos de un interruptor. La celebración no anuncia aparte del foco. |
| B1, B2, B3, B4, B5 | Por tono, atributos, etiqueta y estado, como dice la tabla 3. |

### 4.2 Solo en el teléfono (con TalkBack o con la letra al máximo)

Esto no se puede probar con RNTL, porque depende de la ventana nativa, de TalkBack o del dibujo real:

- cuántas veces suena un anuncio (A1, M10 y M12) y si existe el botón fantasma del toast (A1);
- si el diálogo retiene el foco (A2);
- si la cantidad se lee como porcentaje y si se puede escribir en ella (A3);
- si hay dobles paradas del foco (A4), que en Android depende de cómo trata TalkBack los elementos `focusable` anidados;
- si las hojas, el calendario de fecha, las miniaturas, los estados vacíos y las pestañas se cortan (A5, M5, M6, M7 y M8);
- dónde queda el foco al cerrar una hoja (M9) y el orden entre la hoja y el diálogo (M11);
- si el grupo de chips se lee (M3) y si "pesos" se pronuncia bien (M4).

---

## 5. Decisiones para el usuario

> **Resueltas por el orquestador (registradas en `docs/design-system.md`, sección 7):**
> 1. Toast: opción **(b)**. Todo el toast se oculta al lector y el aviso llega solo por `announce()`, con un único anuncio. Sin `patch-package`.
> 2. Diálogo: opción **(a)**. `ConfirmDialog` se rehace sobre el `Modal` de React Native.
> 3. Pestañas: opción **(a)**. Hasta dos líneas con multiplicador 1,3, a confirmar en el teléfono.
>
> Las tres opciones originales quedan abajo como registro.

Son tres. En cada una recomiendo la primera opción.

1. **Toast duplicado (A1).**
   - **(a)** Parchar HeroUI con `patch-package` para ocultar al lector la copia invisible. TalkBack lee el aviso una vez y todavía puede llegar al botón de cerrar. Requiere un ADR.
   - **(b)** Ocultar todo el toast al lector y dejar solo el anuncio. Es más simple, pero el botón de cerrar solo se puede usar tocando la pantalla, sin TalkBack.
2. **Diálogo de confirmación (A2).**
   - **(a)** Hacerlo con el `Modal` de React Native, igual que las hojas. Se ve igual, y Android encierra el foco por sí solo.
   - **(b)** Mantener el diálogo de HeroUI y mover y ocultar el foco a mano. Tiene más piezas y falla más fácil.
3. **Etiquetas de las pestañas (M8).** Antes de decidir, se mira en el teléfono si se cortan.
   - **(a)** Permitir dos líneas (`numberOfLines={2}`) y un multiplicador de 1,3. La barra crece un poco en alto con letra grande, pero nada se corta.
   - **(b)** Dejar 1,5× en una línea y aceptar el corte en las pantallas más angostas. No cumple DT-15.

---

## 6. Recorrido manual con TalkBack (para el usuario)

**Preparación**:

- Usa el teléfono Android conectado, con la app instalada en modo release (`npm run android:release`) y los datos de prueba grandes.
- Activa TalkBack en Ajustes → Accesibilidad → TalkBack.
- Gestos: deslizar el dedo a la derecha o a la izquierda pasa al elemento siguiente o al anterior, y tocar dos veces activa el elemento.
- Repite cada flujo en dos rondas: primero con la letra normal y TalkBack, y después **sin** TalkBack, con el **tamaño de letra y de pantalla al máximo** (Ajustes → Pantalla → Tamaño de la fuente y Zoom de pantalla).
- Anota cada paso como ✅ o ❌, con una frase sobre lo que pasó.

### 6.1 Registrar una venta (DT-15)

1. En Inicio, al llegar a "Registrar venta", se oye "Registrar venta, botón".
2. En la pantalla nueva, lo primero que se oye es "Volver" o "Registrar venta, encabezado".
3. Fecha: se oye "¿Cuándo vendiste?: Hoy, sábado 14 de noviembre". "Día siguiente" dice "desactivado".
4. "Elegir otra fecha" abre la hoja. Se oye el título "¿Qué día vendiste?". Los días futuros dicen "desactivado". Al elegir un día se oye la fecha y la hoja se cierra. **Anota dónde queda el foco** (M9).
5. Toca un producto con varias versiones. **¿Se oye el nuevo título "¿Qué versión de…?"?** (M9)
6. En la fila agregada, la cantidad. **¿Se oye "3" o "2 por ciento"?** (A3) Desliza hacia arriba y hacia abajo: ¿cambia? Toca dos veces: ¿se abre el teclado?
7. Con dos productos, **¿los botones "Quitar" y los campos "Precio de cada uno" dicen de qué producto son?** (M1)
8. "Más detalles": **¿dice "contraído" o "expandido"?** (M2) En los chips de "¿Dónde vendiste?", **¿se oye la pregunta antes del primer chip?** (M3) Al elegir uno, se oye "seleccionado".
9. Borra el precio y toca "Guardar venta". **¿Qué se oye exactamente? ¿Una frase completa o fragmentos?** (M10) ¿El foco queda en el campo con error?
10. Guarda bien. **¿Se oye "Venta registrada" una vez o dos?** (M12) El total se oye en pesos. "Listo" vuelve a Inicio.
11. Repasa toda la pantalla de Inicio. **¿Cada venta de "Últimas ventas" es una sola parada, o después de la fila se oye otra vez el monto?** (A4)

### 6.2 "Esta semana no vendí" (DT-15)

1. En el Calendario, en "¿Una semana sin ventas?", toca "Marcar que no vendí esta semana".
2. **¿El aviso "Listo, anotamos…" se oye una, dos o tres veces?** (A1) Desliza el dedo: **¿aparece un "Cerrar aviso" cuando ya no hay aviso a la vista?** (A1)
3. "Desmarcar" funciona y avisa.
4. En la cuadrícula, cada día se lee con la fecha y lo vendido. La semana marcada lo dice.

### 6.3 Crear un producto (DT-15)

1. "Agregar producto": cada campo se lee con su etiqueta. "Descripción" dice "(opcional)".
2. Agrega una foto y tócala: se abre la hoja con "Foto 1 de 1". Toca "Quitar foto". **¿El diálogo aparece al instante y se oye la pregunta? ¿Se puede pasar a la pantalla de atrás deslizando el dedo?** (A2 y M11) El botón atrás cancela.
3. "Agregar otra opción": el foco va al nombre de la versión y se oye "Agregaste una versión…".
4. Sal con cambios sin guardar: "¿Salir sin guardar?". **¿El foco va a la pregunta?** (A2)

### 6.4 Ver el resumen (DT-15)

1. En Inicio, la tarjeta de la semana es una sola parada: "Esta semana vendiste 45.000 pesos. …". **¿El mes se lee dos veces?** (A4)
2. "Ver resumen de noviembre": el mes anterior y el siguiente se anuncian al cambiar ("Resumen de octubre").
3. Montos, productos y canales se leen en pesos. "Vendiste" y su monto: **¿son una o dos paradas?** (B3)
4. Consejos: abre uno con un monto. **¿Dice "pesos" o "dólares"?** (M4)

### 6.5 Respaldar (DT-15)

1. "Crear respaldo": se anuncia el avance, sin un anuncio por cada foto. Mientras trabaja, el botón atrás dice "Espera a que termine".
2. "Elegir un respaldo": la vista previa pone el foco en el título. **¿La tarjeta de cantidades es una sola parada?** (A4)
3. "Reemplazar mis datos": **¿el foco va a la pregunta del diálogo?** (A2)
4. Los pasos de la restauración se distinguen: hecho, en curso y pendiente (B4).

### 6.6 Con la letra al máximo (sin TalkBack)

Marca ❌ si algún texto se corta, se monta o queda fuera de alcance:

- [ ] Las cinco pestañas: ¿se lee "Calendario" completo? (M8)
- [ ] Las hojas de producto, de versión, de foto (modo edición), de fecha y de recordatorio: ¿se ven el título y la X? ¿Se llega al último botón? (A5)
- [ ] La hoja de fecha: ¿se ven las siete columnas, con los números enteros? (M5)
- [ ] Las miniaturas del formulario: ¿se lee "Portada" completo? (M6)
- [ ] Inicio sin ventas, Productos sin productos y un día sin ventas: ¿se alcanzan todos los botones? (M7)
- [ ] Registrar venta con el teclado abierto: ¿el total y "Guardar venta" no tapan el campo con foco?
- [ ] El monto principal se achica para caber en una línea y el de las filas pasa debajo del nombre.
- [ ] Licencias: el texto largo se desplaza hasta el final.

### 6.7 "Reducir movimiento" y modo oscuro

- [ ] Activa Ajustes → Accesibilidad → Quitar animaciones. Las hojas aparecen sin deslizarse, el confeti de la celebración no se anima, el consejo aparece sin fundido, la barra de progreso queda quieta y el interruptor salta sin animación. El esqueleto de carga y el `Spinner` de HeroUI no laten ni giran.
- [ ] Con el modo oscuro: la misma ronda de pantallas. Ningún texto se ve apagado sobre las tarjetas y el error se distingue por el ícono y el texto, no solo por el color.
