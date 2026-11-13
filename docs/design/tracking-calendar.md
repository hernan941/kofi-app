# Especificación de pantallas — Calendario, detalle del día y racha (F5)

- **Tarea**: F5.1 de `docs/plan-v1.md`. La usan F5.3 (hooks, componentes y pantallas) y F5.5 (E2E).
- **Fuentes**: `docs/design-system.md` (Bruma), `docs/architecture/tracking-calendar.md` (F5.0), `docs/design/tracking-home.md` (F4.1: `MonthSwitcher`, filas de ventas, `AmountSentence`), `docs/design/sales.md` (F3.1: textos de "no vendí", `DatePickerSheet`), `docs/product.md` (D-01, D-03, D-18, D-25, D-37 y D-41) y los componentes de `@/shared/ui`.
- Este documento no define lógica de negocio. Los niveles de intensidad, la racha, qué semanas admiten "no vendí" y si un día se puede registrar los calculan el dominio y los casos de uso (`buildCalendarMonth`, `intensityLevels`, `loadStreak`, `noSalesWeekStatus`, `buildDayDetail`). La UI solo los muestra.

---

## 1. Decisiones de diseño

| Id | Decisión | Por qué |
|---|---|---|
| UX-C1 | **La intensidad se marca con 1, 2 o 3 puntos** bajo el número del día (poco, medio, mucho), en color `foreground`. Un día sin ventas no tiene puntos. | Contar puntos no depende del color ni del daltonismo, y se entiende sin leer nada. Los puntos en color de texto respetan la regla de que el acento es escaso. La alternativa (rellenar la celda con tonos) depende del color y sumaría tres pares de contraste nuevos. |
| UX-C2 | **La intensidad es relativa al mejor día del mes visible** (D-41). Debajo de la grilla, una leyenda lo explica: "Un punto es poco y tres puntos es tu mejor día del mes." | Quien vende poco igual ve días "llenos". Explicarlo una vez evita la duda de "¿tres puntos son mucha plata?". |
| UX-C3 | **La grilla va sobre el fondo, sin tarjeta**, con margen lateral `px-3` (12) en lugar de `px-4`. Las celdas reparten el ancho en 7 columnas iguales, con alto mínimo 56. | Con 7 columnas de 48 hacen falta 336 de ancho. En un teléfono de 360 de ancho, una tarjeta con `px-4` y `p-4` deja 292. Sin tarjeta y con `px-3` quedan 336: 48 por celda. Es una excepción explícita al margen de 4.1 del sistema de diseño, que el reviewer trata como tal. |
| UX-C4 | **Hoy** lleva el número dentro de un círculo con borde de 2 px `foreground` y `font-bold`, y la etiqueta accesible empieza con "Hoy,". Los **días futuros** se ven en `muted` con opacidad 0.6 y no se pueden tocar (D-03). Los **días de relleno** (del mes anterior o del siguiente) quedan **vacíos**: sin número y sin foco. | Igual que el `DatePickerSheet` de F3 (hoy con borde). Mostrar días de otro mes sin sus puntos haría creer que no hubo ventas. |
| UX-C5 | **Una semana marcada como "no vendí"** se ve en la grilla: la fila completa tiene un fondo `surface` redondeado (`rounded-2xl`), y debajo de la fila va la línea "Semana marcada como \"no vendí\"" con el ícono `Check` de 16, en `text-xs font-medium` `muted`. | Fondo **y** texto: el estado no depende del color. "Marcada" es positivo: esa semana cuenta para la racha. |
| UX-C6 | **"No vendí" se marca desde el Calendario en un bloque debajo de la grilla**, con una fila para "Esta semana" y otra para "La semana pasada" (D-18). Solo se ve cuando el mes visible es el actual. No se ofrece en el detalle del día. | Es una acción de semana, no de día. Un único lugar evita que haya dos caminos para lo mismo. Mirando el mes actual siempre se ven las dos semanas permitidas. |
| UX-C7 | **La racha va en el Calendario y en Inicio** (D-41). En el Calendario es una tarjeta (`StreakBadge` `full`) arriba de todo y siempre está, también en 0. En Inicio es una línea (`compact`) que solo aparece con 1 semana o más (UX-H8 de `tracking-home.md`). | El Calendario es donde se ve el ritmo, y ahí la racha tiene espacio para explicarse. En Inicio solo celebra. |
| UX-C8 | **La racha en 0 nunca habla de pérdida.** Dice cómo empieza ("Tu racha empieza cuando registras una semana") y no "perdiste" ni "volviste a cero". Si la semana actual todavía no cuenta, la tarjeta lo explica en positivo: "Esta semana suma cuando registres una venta o marques \"no vendí\"." | Tono positivo de producto: la app acompaña y no regaña. |
| UX-C9 | **El detalle del día** es una pantalla apilada con el total en `display`, la lista de registros y "Registrar una venta este día" si el día no es futuro. | Mismo patrón que el detalle de venta (F3): el número arriba y la acción en la zona del pulgar. |
| UX-C10 | El total del mes del Calendario usa `Amount` `total` (20, `accent`), no `display`. | El protagonista de esta pantalla es la grilla. Un monto de 44 la empujaría fuera de la vista en teléfonos chicos. Sigue siendo el monto principal y va en acento. |

---

## 2. Navegación

```
(tabs)/calendar ── Calendario (CalendarScreen, mes actual)
   ├─ "Mes anterior" / "Mes siguiente" ─► cambia el mes visible (estado de la pantalla, sin apilar)
   ├─ tocar un día (hoy o pasado) ─────► /tracking/day/[date]  (DayDetailScreen)
   │                                        ├─ tocar un registro ───────────► /sales/[id] (F3)
   │                                        └─ "Registrar una venta este día" ─► /sales/new?date=YYYY-MM-DD
   │                                                                              celebración ─► "Listo" ─► vuelve al detalle del día
   └─ bloque "no vendí" ───────────────► marca o desmarca y se queda en el Calendario (aviso)
```

- Calendario es una pestaña: sin volver. Al reabrir la pestaña conserva el mes que se estaba viendo. Al reiniciar la app, empieza en el mes actual (D-41).
- `/tracking/day/[date]` es una pantalla apilada del `Stack` raíz con `ScreenHeader` propio. Una fecha inválida muestra `NotFoundScreen`. Una fecha futura válida se muestra sin la acción de registrar.
- Después de registrar desde el detalle del día, "Listo" vuelve al detalle, que ya muestra la venta nueva (invalidación de F5.0).

---

## 3. Pantallas

Los textos entre comillas son **exactos** (tabla completa en la sección 5).

### 3.1 Calendario (`(tabs)/calendar`, `CalendarScreen`)

De arriba abajo, en un `ScrollView`:

1. `ScreenHeader` sin volver, con el título **"Calendario"**.
2. **Racha**: `StreakBadge` `full` (3.4), con `px-4`.
3. **`MonthSwitcher`** de F4 (`tracking-home.md`, 3.6), con `px-4`. El mes se muestra como "Noviembre" (o "Diciembre de 2025"). Anuncio al cambiar: "Calendario de {mes}". Límites en 3.1.1.
4. **Total del mes**: fila con "Vendiste en {mes}" (`text-base font-medium`) a la izquierda y `Amount` `total` a la derecha, con `px-4`.
5. **Grilla** (`MonthCalendar`), con `px-3`:
   - encabezado con las iniciales **"L M M J V S D"** (D-01), `text-xs font-medium` `muted`, centradas, decorativas (ocultas al lector de pantalla);
   - de 4 a 6 filas de 7 celdas (`CalendarDayCell`, 3.2), con `gap-y-1`;
   - las semanas marcadas como "no vendí" llevan el fondo y la línea de UX-C5.
6. **Leyenda** (solo si el mes tiene al menos un día con ventas), con `px-4`: tres muestras en fila ("•" Poco, "••" Medio, "•••" Mucho, en `text-xs` `muted`) y debajo "Un punto es poco y tres puntos es tu mejor día del mes." en `text-xs` `muted`. Para el lector de pantalla es un solo texto con la frase.
7. **Mes sin ventas** (en lugar de la leyenda): `InlineNotice` con el ícono `Info`: "Los días en que registres ventas se marcan aquí con puntos."
8. **Bloque "no vendí"** (`WeekNoSalesAction`, 3.3), solo en el mes actual, con `px-4` y `pt-2`.

- **Sombras**: solo la tarjeta de la racha. La grilla, la leyenda y el bloque "no vendí" (botones secundarios) no llevan sombra.
- **Acento**: la racha (ícono y número), el total del mes y la pestaña activa. Los puntos, el borde de hoy y los números van en `foreground`.
- No hay botón principal fijo. Registrar se hace desde Inicio o desde el detalle de un día.

#### 3.1.1 Límites del selector de mes

- Hacia adelante: hasta el mes actual.
- Hacia atrás: hasta el mes más antiguo entre el primer mes con ventas, el primer mes con una marca de "no vendí" y el mes del lunes de la semana pasada (para ver siempre las dos semanas que admiten "no vendí"). Sin ninguna actividad, solo se puede ir al mes de la semana pasada si es otro mes. Ver la pregunta 9.2.

### 3.2 Celda de un día (`CalendarDayCell`)

`Pressable` de ancho 1/7 y alto mínimo 56, con el contenido centrado y `gap-1`:

| Parte | Contenido |
|---|---|
| Número | `text-sm font-medium` `foreground`, `maxFontSizeMultiplier={2}` (7). Hoy: `font-bold`, dentro de un círculo de 28 × 28 como mínimo con borde de 2 px `foreground`. |
| Puntos | Fila de 1, 2 o 3 puntos de 6 × 6, `rounded-full`, `bg-foreground`, separados 2 (`gap-0.5`). Nivel 0: sin puntos, pero con su alto reservado (6) para que los números de una fila queden alineados. Los puntos no crecen con la letra. |

| Tipo de día | Aspecto | Toque | `accessibilityLabel` |
|---|---|---|---|
| Pasado u hoy con ventas | número + puntos | abre el detalle | "12 de noviembre, 45.000 pesos, 2 ventas" (hoy: "Hoy, 12 de noviembre, …"; "1 venta" en singular) |
| Pasado u hoy sin ventas | número, sin puntos | abre el detalle | "12 de noviembre, sin ventas" |
| En una semana marcada | lo anterior | abre el detalle | se agrega ", semana marcada como no vendí" |
| Futuro | número en `muted`, opacidad 0.6 | ninguno | "20 de noviembre, no disponible", con `accessibilityState={{ disabled: true }}` |
| Relleno (otro mes) | vacío | ninguno | oculto al lector (`importantForAccessibility="no-hide-descendants"`) |

- Rol `button` y pista "Abre el detalle del día" en los días que se pueden tocar. "N ventas" cuenta **registros** (D-41).
- Al presionar, la celda muestra un fondo `surface` mientras se mantiene el dedo (cambio inmediato, sin animación). No lleva sombra sticker: es un elemento de una grilla, no un bloque.
- Las etiquetas salen de `dayAccessibilityLabel(day)` (F5.0), con el formato exacto del plan.

### 3.3 Bloque "no vendí" (`WeekNoSalesAction`)

Encabezado: **"¿Una semana sin ventas?"** (`text-base font-semibold`, rol `header`) y debajo **"Anotarla también cuenta para tu racha."** (`text-sm` `muted`). Después, una fila por semana, primero "Esta semana" y después "La semana pasada", con `gap-4`:

- Rótulo de la fila: "Esta semana" o "La semana pasada" (`text-base font-medium`) y el rango en `text-sm` `muted` ("del 9 al 15 de noviembre"; formato de `week-range-label` de F3).
- Contenido según `noSalesWeekStatus` (D-18, D-25):

| Estado | Qué se ve |
|---|---|
| `markable` | `SecondaryButton` **"Marcar que no vendí"**, ancho completo. Etiqueta accesible: "Marcar que no vendí esta semana" / "Marcar que no vendí la semana pasada". |
| `marked` | Ícono `CheckCircle` de 20 en `accent` + "Marcada como \"no vendí\"" (`text-sm`) y `TextButton` **"Desmarcar"**, con la etiqueta "Desmarcar esta semana" / "Desmarcar la semana pasada". |
| `has_sales` | `InlineNotice` con `Info`: "Esta semana ya tiene ventas, así que no hace falta marcar \"no vendí\"." / "La semana pasada ya tiene ventas, así que no hace falta marcar \"no vendí\"." (D-25). |
| `not_allowed` | La fila no se muestra. |

- Marcar y desmarcar no piden confirmación: se deshacen con la acción contraria. Mientras se envía, el botón ignora toques repetidos.
- Éxito: aviso de F3 ("Listo, anotamos que esta semana no vendiste." / "Listo, anotamos que la semana pasada no vendiste." / "Quitamos la marca de esta semana." / "Quitamos la marca de la semana pasada."). La grilla muestra (o quita) la marca y la racha se actualiza solas, por invalidación.
- Error del dominio: aviso con el texto de `SALE_ERROR_MESSAGES` (`week_has_sales`, `week_not_allowed`). Rechazo inesperado: "No se pudo marcar. Inténtalo de nuevo." / "No se pudo quitar la marca. Inténtalo de nuevo.".
- Si el estado de las semanas falla al calcularse, el bloque no se muestra (queda en el logger): no es la acción principal.

### 3.4 Racha (`StreakBadge`)

Un componente con dos variantes. El ícono es `Fire` (peso `fill` con racha, `bold` en 0).

**`full`** (Calendario): `Card` con sombra, fila con `gap-3`:
- ícono `Fire` de 24 a la izquierda;
- título en `text-heading font-semibold` y debajo una frase en `text-sm` `muted`.

| Situación | Ícono | Título | Frase |
|---|---|---|---|
| `weeks >= 1`, `includesCurrentWeek` | `accent` | "{n} semanas seguidas" / "1 semana" (en `accent`) | "Semanas registrando, con ventas o con \"no vendí\"." |
| `weeks >= 1`, sin la semana actual | `accent` | igual | "Esta semana suma cuando registres una venta o marques \"no vendí\"." |
| `weeks === 0` | `muted` | "Tu racha empieza cuando registras una semana" (en `foreground`) | "Cuenta las semanas en que anotas ventas o marcas \"no vendí\"." |

**`compact`** (Inicio, solo con `weeks >= 1`): fila sin tarjeta, alto mínimo 48, con `Fire` de 20 en `accent` y el texto "{n} semanas seguidas registrando" / "1 semana registrando" en `text-sm font-semibold` `accent`.

- Es un elemento estático (no se toca), con un solo `accessibilityLabel`: "Racha: 4 semanas seguidas registrando." / "Racha: 1 semana registrando." / en 0: "Tu racha empieza cuando registras una semana. Cuenta las semanas en que anotas ventas o marcas no vendí."
- Mientras carga o si falla, no se dibuja (sin esqueleto): la racha no es lo principal y el lugar no salta, porque está al principio de la pantalla y aparece casi de inmediato (una consulta local).
- La racha no se anima al subir.

### 3.5 Detalle del día (`/tracking/day/[date]`, `DayDetailScreen`)

1. `ScreenHeader` con volver y el título con la fecha: `formatDateLabel(date, today)` ("Hoy, jueves 12 de noviembre"; "Lunes 2 de marzo"; con año si no es el de hoy).
2. **Total**: etiqueta "Vendiste" (`text-sm font-medium` `muted`), `Amount` `display` (`accent`) y debajo "{n} ventas" / "1 venta" en `text-sm` `muted`.
3. **Tarjeta "Ventas de este día"** (`Card` con título, rol `header`): un `ListRow` tocable por registro (`onOpenSale(id)`), en el orden en que se registraron:
   - `leading`, `title` y "Archivado": como las filas de últimas ventas (`tracking-home.md`, 3.2);
   - `subtitle`: el canal si hay ("Feria") y la cantidad de productos ("Feria · 3 productos"; sin canal, "3 productos"; con un solo producto y versión visible, "{versión}");
   - derecha: `Amount` `list` con el total del registro;
   - etiqueta: "{título}, {canal}, {n} productos, {monto} pesos".
4. **Pie fijo** (solo si `canRegister`): `PrimaryButton` **"Registrar una venta este día"**, ícono `Plus` → `onRegisterSale(date)`.
5. **Día futuro** (sin `canRegister`): en lugar del pie, `InlineNotice` con `Info`: "Puedes registrar ventas de hoy o de días anteriores."

- **Sombras**: la tarjeta y el botón principal.

---

## 4. Estados

### 4.1 Calendario

| Estado | Qué se ve |
|---|---|
| Cargando el mes | Racha (si ya cargó), `MonthSwitcher` y, en lugar del total y la grilla, `LoadingState` "Cargando el calendario", `shape="cards"`, `count={1}`. |
| Error del mes | `MonthSwitcher` activo; `ErrorState` "No se pudo cargar el calendario. Inténtalo de nuevo." |
| **Primer uso** (sin ventas ni marcas) | Racha en 0 (3.4), mes actual, total "$0", grilla sin puntos, el aviso "Los días en que registres ventas se marcan aquí con puntos." y el bloque "no vendí" con las dos semanas en `markable`. |
| Mes sin ventas (con historia) | Igual que el primer uso, pero con la racha que corresponda. Las semanas marcadas se ven igual. |
| Mes con ventas | 3.1 con puntos y leyenda. |
| Mes pasado | Sin el bloque "no vendí". |
| Marcar o desmarcar | 3.3: aviso, la marca en la grilla y la racha nueva. |
| Medianoche o semana nueva con la app abierta | Se queda en el mes que se veía (D-41). "Hoy" pasa al día nuevo; la racha se recalcula (la semana nueva todavía no cuenta y la tarjeta usa la frase "Esta semana suma cuando…"). |

### 4.2 Detalle del día

| Estado | Qué se ve |
|---|---|
| Cargando | `ScreenHeader` con la fecha; `LoadingState` "Cargando el día", `shape="cards"`, `count={2}`. Sin pie fijo. |
| Error | `ErrorState` "No se pudo cargar este día. Inténtalo de nuevo." Sin pie fijo. |
| Hoy sin ventas | `EmptyState`: ícono `CalendarBlank`; título "Hoy sin ventas anotadas"; descripción "Cuando vendas algo, regístralo aquí en segundos."; principal "Registrar una venta este día". Sin pie fijo (un botón principal por pantalla). |
| Día pasado sin ventas | `EmptyState`: ícono `CalendarBlank`; título "Sin ventas anotadas este día"; descripción "Si vendiste algo, regístralo con esta fecha."; principal "Registrar una venta este día". |
| Día futuro | Título con la fecha, total "$0" y el aviso de 3.5, punto 5. Sin botón. |
| Fecha inválida | `NotFoundScreen` (F5.0). |
| Con ventas | 3.5. |
| Vuelta de registrar o de editar | Se actualiza solo. Si se borró la última venta del día, pasa al estado sin ventas. |

---

## 5. Textos

Español neutro con tuteo y sin culpa. Mismas palabras prohibidas que `tracking-home.md` (sección 5).

### 5.1 Calendario

| Clave sugerida | Texto |
|---|---|
| Título | "Calendario" |
| Total del mes | "Vendiste en {mes}" |
| Días de la semana | "L M M J V S D" |
| Leyenda | "Poco" · "Medio" · "Mucho" · "Un punto es poco y tres puntos es tu mejor día del mes." |
| Mes sin ventas | "Los días en que registres ventas se marcan aquí con puntos." |
| Semana marcada | "Semana marcada como \"no vendí\"" |
| Etiqueta de un día | "{día} de {mes}, {monto} pesos, {n} ventas" · "{día} de {mes}, sin ventas" · prefijo "Hoy, " · sufijo ", semana marcada como no vendí" · futuro "{día} de {mes}, no disponible" |
| Pista de un día | "Abre el detalle del día" |
| Anuncio al cambiar de mes | "Calendario de {mes}" |

### 5.2 "No vendí" en el Calendario

| Situación | Texto |
|---|---|
| Encabezado | "¿Una semana sin ventas?" · "Anotarla también cuenta para tu racha." |
| Rótulos | "Esta semana" · "La semana pasada" · rango "del 9 al 15 de noviembre" |
| `markable` | "Marcar que no vendí" (accesible: "Marcar que no vendí esta semana" / "…la semana pasada") |
| `marked` | "Marcada como \"no vendí\"" · "Desmarcar" (accesible: "Desmarcar esta semana" / "Desmarcar la semana pasada") |
| `has_sales` (D-25) | "Esta semana ya tiene ventas, así que no hace falta marcar \"no vendí\"." / "La semana pasada ya tiene ventas, así que no hace falta marcar \"no vendí\"." |
| Avisos | "Listo, anotamos que esta semana no vendiste." · "Listo, anotamos que la semana pasada no vendiste." · "Quitamos la marca de esta semana." · "Quitamos la marca de la semana pasada." · "No se pudo marcar. Inténtalo de nuevo." · "No se pudo quitar la marca. Inténtalo de nuevo." |

### 5.3 Racha

| Situación | Texto |
|---|---|
| Título con racha | "{n} semanas seguidas" / "1 semana" |
| Frase, cuenta la semana actual | "Semanas registrando, con ventas o con \"no vendí\"." |
| Frase, sin la semana actual | "Esta semana suma cuando registres una venta o marques \"no vendí\"." |
| Racha en 0 | "Tu racha empieza cuando registras una semana" · "Cuenta las semanas en que anotas ventas o marcas \"no vendí\"." |
| Inicio (`compact`) | "{n} semanas seguidas registrando" / "1 semana registrando" |
| Etiqueta accesible | "Racha: {n} semanas seguidas registrando." / "Racha: 1 semana registrando." |

### 5.4 Detalle del día

| Situación | Texto |
|---|---|
| Título | la fecha (`formatDateLabel`) |
| Total | "Vendiste" · "{n} ventas" / "1 venta" |
| Lista | "Ventas de este día" · subtítulo "{canal} · {n} productos" / "{n} productos" / "1 producto" |
| Botón | "Registrar una venta este día" |
| Hoy sin ventas | "Hoy sin ventas anotadas" · "Cuando vendas algo, regístralo aquí en segundos." |
| Día pasado sin ventas | "Sin ventas anotadas este día" · "Si vendiste algo, regístralo con esta fecha." |
| Día futuro | "Puedes registrar ventas de hoy o de días anteriores." |
| Cargando | "Cargando el día" |
| Error | "No se pudo cargar este día. Inténtalo de nuevo." · "Reintentar" |

---

## 6. Componentes

### 6.1 Se usan de `@/shared/ui` sin cambios

`Screen`, `ScreenHeader`, `Card`, `ListRow`/`ListSeparator`, `Amount` (`display`, `list`), `PrimaryButton`, `SecondaryButton`, `TextButton`, `Icon`, `InlineNotice`, `EmptyState`, `ErrorState`, `LoadingState`, `NotFoundScreen`, `useAppToast`, `announce`, `formatDateLabel`. De F4 (`tracking`), `MonthSwitcher`, `formatMonthLabel` y la fila de ventas. De F3 (`sales`), `week-range-label` y `SALE_ERROR_MESSAGES`.

### 6.2 Nuevos o cambiados en `shared/ui` (con sus tests, TDD)

| Componente | Necesidad | Especificación |
|---|---|---|
| **`Amount` variante `total`** (de F3, **necesario**) | El total del mes del Calendario (UX-C10). | La de `docs/design/sales.md` 6.2. Si F3 ya la hizo, se reutiliza sin cambios. |
| **`icons.ts`** (necesario) | Íconos de esta especificación. | `FireIcon`, `CheckIcon`, `CheckCircleIcon`, `CaretRightIcon` (los que falten). |

La cuadrícula del mes se arma con `monthGrid` de `shared/domain/calendar` (F5.0). Si el `DatePickerSheet` de F3 se construye después, conviene que dibuje sus celdas con la misma estructura de fila y celda (sin los puntos), para que las dos grillas se vean iguales.

### 6.3 Componentes de la feature (`src/features/tracking/components/`)

Los de `docs/architecture/tracking-calendar.md` (2.3), con estas precisiones:
- `month-calendar.tsx`: 3.1, punto 5 (encabezado, filas y marca de semana de UX-C5). Sin listas virtualizadas.
- `calendar-day-cell.tsx`: 3.2, memoizada. Incluye los puntos (`IntensityDots`, interno, con `testID` `intensity-{nivel}` para los tests).
- `calendar-legend.tsx` (nuevo): 3.1, puntos 6 y 7.
- `day-label.ts`: tabla 5.1, "Etiqueta de un día".
- `streak-badge.tsx`: 3.4, con `variant: 'full' | 'compact'`. Lo exporta el `index.ts` de `tracking` para Inicio.
- `week-no-sales-action.tsx`: 3.3.
- `day-detail-view.tsx`: 3.5 y estados de 4.2.

---

## 7. Accesibilidad

- **Orden de lectura** del Calendario: título → racha → mes anterior → mes → mes siguiente → total → días en orden (de lunes a domingo, semana por semana) → línea de semana marcada → leyenda → bloque "no vendí".
- **Días**: cada celda tocable es un botón con la etiqueta de 3.2. Las iniciales del encabezado y los días de relleno se ocultan al lector, así que el lector recorre solo los días del mes.
- **Intensidad sin color**: 1, 2 o 3 puntos (forma y cantidad) y, para el lector, el monto exacto en la etiqueta. La semana marcada lleva fondo **y** texto. Hoy lleva borde **y** "Hoy," en la etiqueta. Los días futuros llevan opacidad **y** "no disponible".
- **Letra grande**: los números de los días tienen `maxFontSizeMultiplier={2}`. Es una excepción a la regla de 7 del sistema de diseño ("el resto no tiene límite"), porque con 3× el número no cabe en 1/7 del ancho. La información completa sigue en la etiqueta y en el detalle del día, que crece sin límite. Las celdas tienen alto mínimo (no fijo) y crecen. El resto de la pantalla no tiene límite.
- **Áreas táctiles**: celdas de al menos 48 × 56 en pantallas de 360 de ancho o más (UX-C3). En pantallas de 320 (muy poco comunes) quedan de 42 de ancho, por encima de los 40 pero por debajo de 44: se anota como limitación conocida. Los botones del bloque "no vendí" y del selector, 48.
- **Contraste**: no se agrega ningún par nuevo. Puntos y borde de hoy en `foreground` sobre `background` (14.6 y 15.7); la banda de semana marcada es `surface` con texto `muted` (5.9 y 7.7) y números `foreground` (13.0 y 13.6); los días futuros siguen la regla de deshabilitado.
- **Anuncios**: al cambiar de mes ("Calendario de octubre"); al marcar o desmarcar, el aviso.
- **Reducir movimiento**: no hay animaciones propias.
- **Una mano**: "Registrar una venta este día" va fijo abajo. El bloque "no vendí" queda al final del desplazamiento, cerca del pulgar.

---

## 8. Pruebas sugeridas para F5.3 (además de las del plan)

**Calendario**
- Las etiquetas de los días siguen 5.1: "12 de noviembre, 45.000 pesos, 2 ventas"; "1 venta" en singular; "Hoy, …"; ", semana marcada como no vendí"; un día futuro dice "no disponible", tiene `disabled` y no llama a `onOpenDay`.
- Los niveles 1, 2 y 3 se distinguen sin color: `testID` `intensity-1`, `intensity-2` e `intensity-3` con 1, 2 y 3 puntos; un día sin ventas no tiene puntos.
- Los días de relleno no tienen número ni se pueden tocar.
- Una semana marcada muestra "Semana marcada como \"no vendí\"" debajo de su fila.
- La leyenda aparece solo con ventas en el mes; sin ventas se ve "Los días en que registres ventas se marcan aquí con puntos.".
- El bloque "no vendí" aparece solo en el mes actual; `markable`, `marked` y `has_sales` con sus textos; "Marcar que no vendí" llama a la mutación una sola vez con toques repetidos.
- "Mes siguiente" está deshabilitado en el mes actual; al cambiar se anuncia "Calendario de octubre".
- Primer uso: racha "Tu racha empieza cuando registras una semana", total "$0" y las dos semanas en `markable`.

**Racha**
- `full` con `includesCurrentWeek` y sin ella usa las frases de 5.3; en 0, el ícono va en `muted` y el título en `foreground`.
- `compact` no se dibuja en 0.
- Ningún texto de la racha coincide con `guilt-patterns`, y ninguno contiene "perdiste" ni "cero".
- Singular "1 semana" y "1 semana registrando".

**Detalle del día**
- Hoy sin ventas: "Hoy sin ventas anotadas" con "Registrar una venta este día", que llama a `onRegisterSale(date)`; sin pie fijo.
- Día pasado con ventas: total en `display`, "2 ventas", filas con "Feria · 3 productos", tocar una llama a `onOpenSale(id)`; pie "Registrar una venta este día".
- Día futuro: sin botón y con "Puedes registrar ventas de hoy o de días anteriores.".

**E2E (F5.5)**: los de F5.0 (5.4), buscando las etiquetas exactas de los días, "Semana marcada como \"no vendí\"" y el título de la racha ("1 semana").

---

## 9. Preguntas abiertas para el usuario

1. **Cómo se marca la intensidad.** Recomiendo **1 a 3 puntos** (UX-C1): se cuentan, no dependen del color y mantienen el acento escaso. La alternativa es rellenar la celda con tres tonos de ciruela, más vistosa pero dependiente del color y del contraste de cada tono. Conviene verlo en el teléfono antes de cerrarlo.
2. **Hasta dónde se retrocede en el Calendario** (3.1.1, para el architect). La propuesta necesita saber el primer mes con una marca de "no vendí", algo que F5.0 no consulta hoy (`earliestSoldOn` solo mira ventas). Valor por defecto si no se agrega: hasta el mes más antiguo entre el primer mes con ventas y el mes de la semana pasada; las marcas anteriores a la primera venta quedarían sin verse en el calendario, aunque siguen contando para la racha.
