# Especificación de pantallas — Inicio y resumen mensual (F4)

- **Tarea**: F4.1 de `docs/plan-v1.md`. La usan F4.4 (componentes y pantallas) y F4.6 (E2E).
- **Fuentes**: `docs/design-system.md` (Bruma), `docs/architecture/tracking-home.md` (F4.0), `docs/design/sales.md` (F3.1), `docs/product.md` (D-11, D-15, D-19, D-20, D-30, D-39, D-40 y D-41) y los componentes de `@/shared/ui`.
- Este documento no define lógica de negocio. Los totales, la comparación, la ganancia, el resumen y la navegación entre meses los calcula el dominio (`homeSummary`, `compareTotals`, `approximateProfit`, `profitCoverage`, `monthlySummary`, `monthNavigation`). La UI solo los muestra.
- La racha de Inicio se especifica en `docs/design/tracking-calendar.md` (sección 3.4). Aquí solo se indica dónde va.

---

## 1. Decisiones de diseño

| Id | Decisión | Por qué |
|---|---|---|
| UX-H1 | **El monto principal de Inicio es lo vendido esta semana**, en `Amount` `display` y `accent`. El mes va debajo, en la misma tarjeta, con `Amount` `list` (color de texto). | La app acompaña un ritmo semanal (recordatorio del domingo, racha por semanas, "no vendí" por semana). Un solo monto en acento por pantalla mantiene clara la jerarquía. |
| UX-H2 | **La comparación muestra el monto de diferencia, no el porcentaje** (D-39), y siempre con lenguaje positivo. Al bajar, el texto informa la diferencia y agrega "Cada semana tiene su ritmo." Si esta semana va en $0, el texto habla de una semana "tranquila por ahora". | El monto es concreto para quien no maneja porcentajes. Bajar es normal en el arte (temporadas, ferias): la app lo dice sin juzgar. |
| UX-H3 | La comparación usa la frase **"a esta altura de…"** ("a esta altura de la semana pasada", "a esta altura de octubre"). | Es la forma simple de explicar D-19 (mismo tramo transcurrido) sin decir "tramo" ni "período". |
| UX-H4 | **La ganancia aproximada solo aparece cuando hay costos** y solo para el mes (D-39). Es una frase dentro de la tarjeta, no un número suelto: "Este mes te quedaron aprox. $9.000." Con costos parciales usa el texto de D-15. Sin costos **no se muestra nada**, ni siquiera una invitación. | Divulgación progresiva: el concepto aparece cuando ya tiene sentido. La invitación a cargar costos llega con un consejo después de una venta, y Inicio no muestra consejos (D-11). |
| UX-H5 | **Sin consejos en Inicio** (D-11): ninguna tarjeta, texto ni enlace de la sección "Consejos". | Decisión de producto. |
| UX-H6 | **Primer uso** (ningún registro de venta activo): estado vacío del sistema de diseño (6.7) con un único botón, "Registrar venta". No se ofrece "Esta semana no vendí" en Inicio. | El registro de ventas ya ofrece "no vendí" a un toque (UX-S7 de `sales.md`). Dos botones en una pantalla vacía hacen dudar a quien recién empieza. |
| UX-H7 | **Últimas 5 ventas** (D-39) en una tarjeta, sin "Ver todas". Cada fila es un registro completo (no un ítem), con el total del registro. | El historial completo está en el Calendario (F5). Una fila por registro coincide con lo que la persona anotó ("la feria del sábado"). |
| UX-H8 | La racha va en Inicio **solo si es de 1 semana o más**, como una línea sin tarjeta debajo del resumen. Con racha 0, Inicio no la muestra; el Calendario sí, con un texto amable. | En Inicio, una racha en 0 se lee como un reproche. En el Calendario tiene contexto y explicación. |
| UX-H9 | **"Ver resumen de {mes}"** es un botón de texto al final de la tarjeta del resumen. El resumen mensual es una pantalla apilada con su propio selector de mes. | Es un acceso secundario. Así no compite con "Registrar venta". |
| UX-H10 | En el resumen mensual, "Lo que más vendiste" y "Dónde vendiste más" dicen **"Según el monto vendido."** debajo del título. Si hay empate se muestran todos, con la línea "Empataron con el mismo monto." | D-20 y D-40. Aclarar que es por monto evita la duda de "pero vendí más unidades de otra cosa". |

---

## 2. Navegación

```
(tabs)/index ── Inicio (HomeScreen)
   ├─ "Registrar venta" (pie fijo o estado vacío) ─► /sales/new  (celebración ─► "Listo" ─► vuelve a Inicio)
   ├─ tocar una de las últimas ventas ────────────► /sales/[id]  (SaleDetailScreen de F3)
   └─ "Ver resumen de {mes}" ─────────────────────► /tracking/monthly  (MonthlySummaryScreen, mes actual)
                                                       ├─ "Mes anterior" / "Mes siguiente" ─► router.setParams({ month })
                                                       └─ Volver ─► Inicio

Aviso mensual de F7 ─► /tracking/monthly?month=YYYY-MM  (si no hay pantalla debajo, Volver hace replace('/'))
```

- Inicio es una pestaña: sin botón de volver.
- `/tracking/monthly` es una pantalla apilada del `Stack` raíz, sin pestañas, con `ScreenHeader` propio. Cambiar de mes **no** apila pantallas: cambia el parámetro, y Volver sale del resumen.
- Un `month` inválido o repetido redirige a `/tracking/monthly`, que muestra el mes actual (F4.0). Un mes futuro válido se muestra como el actual.
- Las screens reciben callbacks (`onRegisterSale`, `onOpenSale`, `onOpenMonthlySummary`, `onChangeMonth`) y no importan `expo-router` (ADR-005).

---

## 3. Pantallas

Los textos entre comillas son **exactos** (tabla completa en la sección 5). Los tokens son los de `docs/design-system.md`.

### 3.1 Inicio con ventas (`(tabs)/index`, `HomeScreen`)

De arriba abajo, en un `ScrollView` con `px-4`, `gap-4` y espacio al final para el pie fijo:

1. `ScreenHeader` sin volver, con el título **"Inicio"** (`text-title`, rol `header`).
2. **Tarjeta del resumen** (`Card`, con sombra; componente `HomeSummaryCard`):
   1. **Bloque de la semana** (un solo elemento accesible, sección 7):
      - etiqueta "Esta semana" en `text-sm font-medium` `muted`;
      - `Amount` `display` (44, `accent`) con el total de la semana hasta hoy;
      - línea de comparación en `text-sm` `foreground` (textos en 5.2), con `pt-1`. Sin íconos ni flechas: el texto alcanza y una flecha hacia abajo se siente como una alarma.
   2. `ListSeparator`.
   3. **Bloque del mes**:
      - fila estática: a la izquierda "En {mes}" (`text-base font-medium`, "En noviembre"), a la derecha `Amount` `list` con el total del mes hasta hoy (`ListRow` sin `onPress`, con `title` y `amount`);
      - línea de comparación del mes en `text-sm` `foreground`;
      - **ganancia** (solo si `profit !== null`, sección 3.3), con `pt-2`.
   4. `TextButton` **"Ver resumen de {mes}"** ("Ver resumen de noviembre"), alineado a la izquierda, con `pt-1`.
3. **Racha** (solo si `streak.weeks >= 1`): `StreakBadge` variante `compact`, sin tarjeta (`docs/design/tracking-calendar.md`, 3.4).
4. **Tarjeta "Últimas ventas"** (`Card` con el título "Últimas ventas" en `text-heading`, rol `header`; componente `LatestSalesList`): hasta 5 filas `ListRow` tocables separadas por `ListSeparator`, de la más reciente a la más antigua (3.2).
5. **Pie fijo**: `PrimaryButton` **"Registrar venta"**, ícono `Plus`, sobre la barra de pestañas y respetando el área segura.

- **Sombras**: la tarjeta del resumen, la de últimas ventas y el botón principal. Son tres, el máximo (sistema de diseño 4.4). La racha no lleva sombra.
- **Acento**: solo el monto de la semana, el botón principal, la racha (ícono y número), el enlace "Ver resumen de…" y la pestaña activa.

### 3.2 Fila de "Últimas ventas"

Un `ListRow` por registro, tocable (`onOpenSale(id)`):

| Parte | Contenido |
|---|---|
| `leading` | Miniatura (40 × 40, `rounded-xl`) de la portada del **primer** producto del registro, si tiene foto (`ProductPhoto` de `products`). Sin foto, no hay `leading`. |
| `title` | Un producto: su nombre actual ("Lámina Colibrí"). Varios: "{primer producto} y {n} más" ("Lámina Colibrí y 2 más"), donde `n` es la cantidad de ítems restantes. |
| `subtitle` | La fecha corta ("Hoy", "Ayer", "9 de noviembre"; con año si no es el de hoy: "28 de diciembre de 2025"). Con un solo producto y versión visible (`showVersion` de F3): "{versión} · {fecha}". Si el primer producto está archivado, se agrega " · Archivado". |
| Derecha | `Amount` `list` con el total del registro (color de texto, no acento). |
| `accessibilityLabel` | "{título}, {versión si hay}, {fecha completa}, {monto} pesos" y "archivado" si corresponde: "Lámina Colibrí y 2 más, hoy, viernes 13 de noviembre, 45.000 pesos". |

- Un producto sin datos (regla 15 de ADR-007) se muestra como "Producto sin nombre" (texto de F3).
- Un registro con total $0 se muestra igual, con "$0".

### 3.3 Línea de ganancia (`ProfitLine`)

Frase en `text-base` `foreground`, con el monto dentro de la frase en `font-semibold` (componente `AmountSentence`, sección 6.2). Su etiqueta accesible lee el monto como "pesos".

| `profitCoverage` | Texto (en Inicio el período es "Este mes") |
|---|---|
| `full` | "Este mes te quedaron aprox. $9.000." |
| `partial` (D-15) | "Este mes, de lo que tiene costo cargado, te quedaron aprox. $9.000." |
| Ganancia negativa (`full` o `partial`) | La frase de arriba con el monto en negativo ("…te quedaron aprox. -$5.000.") y debajo, en `text-sm` `muted`: "A veces pasa, por ejemplo con descuentos o precios especiales." |
| `profit === null` (sin costos) | **No se dibuja nada.** |

- El monto negativo usa `Amount` con `SignedClp` ("-$5.000"; accesible "menos 5.000 pesos"). No se usa `danger`: perder plata en una venta no es un error de la app ni de la persona.
- Mientras los costos cargan (`useProfit` en `isPending`), la línea no se dibuja. Si fallan, tampoco (queda en el logger). Nunca bloquea el resto de Inicio.

### 3.4 Primer uso (sin ventas)

Se muestra cuando la consulta de últimas ventas está lista y vacía: no hay ningún registro activo. Reemplaza todo el contenido de 3.1.

- `ScreenHeader` "Inicio".
- `EmptyState` (sistema de diseño 6.7, `pt-12`):
  - ícono `Receipt`, peso `duotone`, 48, `muted`;
  - título **"Aquí vas a ver cuánto vendes"**;
  - descripción **"Registra tu primera venta y verás el total de la semana y del mes. Toma unos segundos."**;
  - acción principal **"Registrar venta"** (`onRegisterSale`). Es el botón principal de la pantalla, así que no hay pie fijo.
- Si la persona ya marcó "no vendí" (racha ≥ 1 sin ventas), debajo del estado vacío aparece la racha `compact`.

### 3.5 Resumen mensual (`/tracking/monthly`, `MonthlySummaryScreen`)

De arriba abajo, en un `ScrollView` con `px-4` y `gap-4`:

1. `ScreenHeader` con volver y el título **"Resumen del mes"**.
2. **`MonthSwitcher`**: `IconButton` `CaretLeft` · nombre del mes en `text-heading font-semibold` y centrado ("Noviembre", o "Diciembre de 2025" si no es el año de hoy) · `IconButton` `CaretRight`. Ver 3.6.
3. **Total**: etiqueta "Vendiste" (`text-sm font-medium` `muted`), `Amount` `display` (`accent`) y debajo, en `text-sm` `muted`, "{n} ventas registradas" ("1 venta registrada"). `n` es la cantidad de registros (D-41).
4. **Ganancia** (solo con costos): `ProfitLine` con el período del mes visto: "Este mes…" si es el mes actual y "En {mes}…" si no ("En octubre te quedaron aprox. $9.000.").
5. **Tarjeta "Lo que más vendiste"** (solo si `topProducts` no está vacío; D-40):
   - título en `text-heading`, rol `header`;
   - "Según el monto vendido." en `text-sm` `muted`;
   - si hay más de uno: "Empataron con el mismo monto." en `text-sm` `muted`;
   - un `ListRow` estático por producto, ordenados por nombre (comparador de D-31): `title` con el nombre actual, `subtitle` "Archivado" si corresponde y `Amount` `list` con lo vendido de ese producto en el mes.
6. **Tarjeta "Dónde vendiste más"** (solo si `topChannels` no está vacío; D-40): igual que la anterior, con `leading` el ícono `Storefront` de 20 en `muted` y `title` con la etiqueta del canal de F3 ("Feria", "Redes sociales"…).

- **Sombras**: como mucho las dos tarjetas. No hay botón principal: la pantalla es de lectura.
- La pantalla no muestra la lista de ventas del mes (eso es el Calendario). `onOpenSale` queda sin uso en la v1.

### 3.6 Selector de mes (`MonthSwitcher`)

Lo comparten el resumen mensual y el Calendario (F5).

- Fila de alto mínimo 48: `IconButton` "Mes anterior" (`CaretLeft`) a la izquierda, el mes al centro y `IconButton` "Mes siguiente" (`CaretRight`) a la derecha.
- Etiquetas accesibles: "Mes anterior, octubre" y "Mes siguiente, diciembre". Deshabilitado: "Mes anterior" o "Mes siguiente", con `accessibilityState={{ disabled: true }}`, opacidad 0.6 y sin respuesta al toque.
- Límites del resumen: hacia adelante hasta el mes actual y hacia atrás hasta el primer mes con ventas (`monthNavigation`, D-30). Sin ventas, los dos botones están deshabilitados.
- El nombre del mes es un `header` con `accessibilityLiveRegion="polite"`. Al cambiar de mes se anuncia "Resumen de {mes}" (en el Calendario, "Calendario de {mes}").
- No hay deslizamiento lateral para cambiar de mes: choca con el gesto de volver de iOS y no se descubre.

---

## 4. Estados

### 4.1 Inicio

| Estado | Qué se ve |
|---|---|
| Cargando (resumen o últimas ventas pendientes) | `ScreenHeader` "Inicio"; `LoadingState` "Cargando tus ventas", `shape="cards"`, `count={2}`. Sin pie fijo. Así no aparece el estado vacío por un instante antes de los datos. |
| Error del resumen | `ErrorState` "No se pudieron cargar tus ventas. Inténtalo de nuevo." con "Reintentar" (vuelve a pedir el resumen y las últimas ventas). El pie "Registrar venta" **sigue visible**: registrar no depende de leer. |
| Error solo de las últimas ventas | El resumen se ve normal. Dentro de la tarjeta "Últimas ventas": `InlineNotice` con `WarningCircle` "No se pudieron cargar tus últimas ventas." y `TextButton` "Reintentar". |
| **Primer uso** (sin registros activos) | 3.4. |
| Con ventas en la historia, pero $0 esta semana y este mes | 3.1 con "$0" en los dos montos y los textos de comparación para $0 (5.2). La lista muestra las últimas 5, aunque sean de meses anteriores. |
| Con ventas, sin costos | 3.1 sin la línea de ganancia. |
| Con costos parciales | 3.1 con el texto de D-15. |
| Éxito (listo) | 3.1. Se actualiza solo al guardar, editar o borrar una venta y al cambiar un costo (invalidación de F4.0), sin animar los montos (sistema de diseño 3.3). |
| Cambio de día o de semana con la app abierta | Los montos se recalculan solos. El lunes la semana arranca en $0 con su texto. |

### 4.2 Resumen mensual

| Estado | Qué se ve |
|---|---|
| Cargando | `ScreenHeader` "Resumen del mes"; `MonthSwitcher` con el mes (los botones, deshabilitados hasta saber el primer mes con ventas); `LoadingState` "Cargando el resumen", `shape="cards"`, `count={2}`. |
| Error | `MonthSwitcher` activo; `ErrorState` "No se pudo cargar el resumen. Inténtalo de nuevo." |
| Mes sin ventas (mes actual) | `MonthSwitcher`; `EmptyState` sin botón: ícono `CalendarBlank`, título "{Mes} no tiene ventas anotadas" ("Noviembre no tiene ventas anotadas"), descripción "Las ventas que registres este mes van a aparecer aquí." |
| Mes sin ventas (mes pasado) | Igual, con la descripción "Si vendiste algo en {mes}, puedes registrarlo eligiendo esa fecha." |
| Sin ninguna venta en la historia | El caso "mes actual sin ventas", con los dos botones del selector deshabilitados. |
| Mes con ventas a $0 solamente | Total "$0"; sin "Lo que más vendiste" (máximo $0, D-40). |
| Sin canal en ninguna venta | Sin "Dónde vendiste más" (D-40). |
| Éxito | 3.5. |

---

## 5. Textos

Español neutro con tuteo y sin culpa. No se usan "todavía no", "deberías", "olvidaste", "otra vez", "llevas", "fallaste", "error", "mal" ni "perdiste" en lo que lee la persona (patrones de `guilt-patterns` de F6.4 y palabras prohibidas de F3).

### 5.1 Títulos, etiquetas y botones

| Clave sugerida | Texto |
|---|---|
| Título de Inicio | "Inicio" |
| Semana | "Esta semana" |
| Mes en Inicio | "En {mes}" ("En noviembre") |
| Enlace al resumen | "Ver resumen de {mes}" |
| Últimas ventas | "Últimas ventas" |
| Fila con varios productos | "{producto} y {n} más" |
| Archivado | "Archivado" |
| Producto sin datos | "Producto sin nombre" |
| Botón principal | "Registrar venta" |
| Primer uso | "Aquí vas a ver cuánto vendes" · "Registra tu primera venta y verás el total de la semana y del mes. Toma unos segundos." · "Registrar venta" |
| Título del resumen | "Resumen del mes" |
| Total del mes | "Vendiste" · "{n} ventas registradas" / "1 venta registrada" |
| Más vendido | "Lo que más vendiste" · "Según el monto vendido." · "Empataron con el mismo monto." |
| Canal principal | "Dónde vendiste más" · "Según el monto vendido." · "Empataron con el mismo monto." |
| Selector | "Mes anterior, {mes}" · "Mes siguiente, {mes}" · deshabilitados: "Mes anterior" · "Mes siguiente" |
| Mes sin ventas | "{Mes} no tiene ventas anotadas" · actual: "Las ventas que registres este mes van a aparecer aquí." · pasado: "Si vendiste algo en {mes}, puedes registrarlo eligiendo esa fecha." |

- `{mes}` va en minúscula dentro de una frase ("noviembre") y con mayúscula inicial al empezar ("Noviembre"). Si el mes no es del año de hoy, se agrega el año ("diciembre de 2025"), salvo en las frases de comparación, donde basta el nombre.

### 5.2 Comparación (`comparisonText(comparison, period)`)

`{P}` es "a esta altura de la semana pasada" (semana) o "a esta altura de {mes anterior}" (mes, "a esta altura de octubre"). `{dif}` es `difference` y `{anterior}` es `previousTotal`, con `formatClp`.

| `kind` | Semana | Mes |
|---|---|---|
| `up` | "{dif} más que {P}." → "$5.000 más que a esta altura de la semana pasada." | "$12.000 más que a esta altura de octubre." |
| `first` (antes $0, ahora > $0) | "{actual} más que {P}." (la diferencia es el total actual) | igual, con el mes |
| `same` | "Igual que a esta altura de la semana pasada." | "Igual que a esta altura de octubre." |
| `down` (ahora > $0) | "{dif} menos que {P}. Cada semana tiene su ritmo." | "{dif} menos que {P}. Cada mes tiene su ritmo." |
| `down` con `percent === 100` (ahora $0) | "Semana tranquila por ahora. A esta altura de la semana pasada habías vendido {anterior}." | "Mes tranquilo por ahora. A esta altura de octubre habías vendido {anterior}." |
| `no_data` | "Lo que registres esta semana se va sumando aquí." | "Lo que registres este mes se va sumando aquí." |

- La etiqueta accesible repite el texto con los montos en "pesos" ("5.000 pesos más que a esta altura de la semana pasada").
- Sin banda de "parecido": "Igual que…" solo con montos idénticos (D-39).

### 5.3 Ganancia

| Situación | Texto |
|---|---|
| Completa | "{Período} te quedaron aprox. {X}." |
| Parcial (D-15) | "{Período}, de lo que tiene costo cargado, te quedaron aprox. {X}." |
| Negativa (debajo de la frase) | "A veces pasa, por ejemplo con descuentos o precios especiales." |

`{Período}`: "Este mes" (Inicio y resumen del mes actual) o "En {mes}" (resumen de un mes pasado).

### 5.4 Estados

| Situación | Texto |
|---|---|
| Cargando Inicio | "Cargando tus ventas" |
| Error de Inicio | "No se pudieron cargar tus ventas. Inténtalo de nuevo." · "Reintentar" |
| Error de últimas ventas | "No se pudieron cargar tus últimas ventas." · "Reintentar" |
| Cargando resumen | "Cargando el resumen" |
| Error del resumen | "No se pudo cargar el resumen. Inténtalo de nuevo." · "Reintentar" |
| Anuncio al cambiar de mes | "Resumen de {mes}" |

---

## 6. Componentes

### 6.1 Se usan de `@/shared/ui` sin cambios

`Screen`, `ScreenHeader`, `Card`, `ListRow`/`ListSeparator`, `Amount` (`display`, `list`, `inline`), `PrimaryButton`, `TextButton`, `IconButton`, `EmptyState`, `ErrorState`, `LoadingState`, `InlineNotice`, `announce`, `formatDateLabel`. De `features/products`, la miniatura (`ProductPhoto`).

### 6.2 Nuevos o cambiados en `shared/ui` (con sus tests, TDD)

| Componente | Necesidad | Especificación |
|---|---|---|
| **`AmountSentence`** (nuevo, **necesario**) | La comparación y la ganancia son frases con un monto adentro, y el lector de pantalla tiene que leer "pesos". | Props: `parts: readonly (string \| { amount: Clp \| SignedClp })[]`, `tone?: 'foreground' \| 'muted'`, `size?: 'sm' \| 'base'`. Dibuja un `Text` con los montos formateados (`formatClp`, `font-semibold`) y arma `accessibilityLabel` con `formatClpAccessible`. Tests: "$5.000 más que…" a la vista y "5.000 pesos más que…" en la etiqueta; un monto negativo se ve "-$5.000" y se lee "menos 5.000 pesos"; respeta el tamaño de letra del sistema. |
| **`formatShortDateLabel`** (nuevo, en `date-label.ts`, **necesario**) | El subtítulo de las filas de últimas ventas (3.2) y del detalle del día de F5. | "Hoy", "Ayer", "9 de noviembre", y "28 de diciembre de 2025" si el año no es el de `today`. Sin `Date` (ADR-015). Tests: hoy, ayer, mismo año, otro año y 1 de enero contra el 31 de diciembre. |
| **`Amount` con `SignedClp` negativo** (verificar) | La ganancia puede ser negativa. | Si `Amount` todavía no lo hace: "-$5.000" a la vista y "menos 5.000 pesos" en la etiqueta. Test con un valor negativo en las tres variantes. |
| **`icons.ts`** (necesario) | Íconos que pide esta especificación. | `CaretRightIcon`, `StorefrontIcon`, `WarningCircleIcon` y `FireIcon` (este último lo usa la racha), los que no estén reexportados todavía. |

### 6.3 Componentes de la feature (`src/features/tracking/components/`)

Los de `docs/architecture/tracking-home.md` (2.2), con estas precisiones:
- `home-summary-card.tsx`: 3.1, punto 2. Recibe `HomeSummary`, `ProfitSummary | null`, el mes y `onOpenMonthlySummary`.
- `comparison-text.ts`: tabla 5.2, función pura con su test (un caso por fila y por período).
- `profit-line.tsx`: 3.3. Recibe `ProfitSummary | null` y el período.
- `latest-sales-list.tsx`: 3.2, dentro de la tarjeta "Últimas ventas". Son 5 filas como máximo: alcanza con un `map` dentro del `ScrollView` de la pantalla (no hay listas virtualizadas anidadas).
- `monthly-summary-view.tsx`: 3.5, puntos 3 a 6, y los estados de 4.2.
- `month-switcher.tsx`: 3.6. Recibe `month`, `navigation: MonthNavigation`, `onChange` y `announcePrefix` ("Resumen de" o "Calendario de").
- `month-label.ts`: `formatMonthLabel(month, today)` de F4.0.

---

## 7. Accesibilidad

- **Orden de lectura** de Inicio: título → bloque de la semana → bloque del mes → ganancia → "Ver resumen de…" → racha → "Últimas ventas" y sus filas → "Registrar venta".
- **Bloque de la semana**: un solo elemento (`accessible`) con la etiqueta "Esta semana vendiste {monto} pesos. {comparación}." El bloque del mes, igual: "En noviembre vendiste {monto} pesos. {comparación}."
- **Encabezados** (`accessibilityRole="header"`): "Inicio", "Últimas ventas", "Resumen del mes", el nombre del mes, "Lo que más vendiste" y "Dónde vendiste más".
- **Filas**: cada fila de últimas ventas es un botón con la etiqueta completa de 3.2 y la pista "Abre el detalle de la venta". Las filas del resumen mensual son estáticas.
- **Nada solo por color**: "Archivado" es texto; la comparación es texto (sin flechas de color); el botón deshabilitado del selector tiene estado y etiqueta.
- **Letra grande**: el monto `display` se ajusta a una línea (`maxFontSizeMultiplier={1.5}`). Las frases de comparación y ganancia crecen sin límite y se ajustan en varias líneas. En las filas, el monto pasa debajo del nombre (`flex-wrap` de `ListRow`). Se prueba con el tamaño más grande en Android: el pie fijo no tapa la última fila (espacio al final del `ScrollView`).
- **Contraste**: no se agrega ningún color ni par nuevo. Todo usa `foreground`, `muted` y `accent` sobre `background` o `surface` (tabla 2.3).
- **Áreas táctiles**: filas de 56 de alto como mínimo; "Ver resumen de…" y los botones del selector, 48.
- **Una mano**: "Registrar venta" fijo abajo. El selector de mes queda arriba, pero no es la acción principal y la pantalla se lee de arriba abajo.

---

## 8. Pruebas sugeridas para F4.4 (además de las del plan)

**Inicio**
- Sin registros: se ve "Aquí vas a ver cuánto vendes" y "Registrar venta" llama a `onRegisterSale`; no hay pie fijo (un solo botón principal).
- Mientras carga, no aparece el estado vacío (se ve "Cargando tus ventas").
- Con ventas: el monto de la semana usa `Amount` `display` y el del mes `Amount` `list` (por `testID` o variante).
- `comparisonText`: un caso por fila de 5.2 y por período; ninguno coincide con `guilt-patterns`; `down` con el total actual en $0 usa "Semana tranquila por ahora…".
- La etiqueta del bloque de la semana dice "Esta semana vendiste 45.000 pesos. 5.000 pesos más que a esta altura de la semana pasada."
- `ProfitLine`: con `null` no dibuja nada; `full` y `partial` con los textos exactos de 5.3; negativa con "-$5.000" y la línea de ayuda; nunca usa `danger`.
- Últimas ventas: muestra 5 como máximo; un registro de varios productos dice "{producto} y {n} más"; un producto archivado agrega "Archivado" al subtítulo y "archivado" a la etiqueta; tocar una fila llama a `onOpenSale(id)`.
- Error solo de últimas ventas: el resumen se ve y "Reintentar" vuelve a pedir.
- La racha no aparece con 0 semanas y aparece con 1 o más.
- D-11: ningún título del catálogo de consejos aparece y no se llama a `tipViews.listAll`.
- Con `FakeClock`, del domingo a las 23:59 al lunes a las 00:00, el monto de la semana pasa a "$0" y el texto a "Lo que registres esta semana se va sumando aquí." (o "Semana tranquila por ahora…" si el lunes anterior hubo ventas).

**Resumen mensual**
- El mes actual sin ventas muestra "Noviembre no tiene ventas anotadas" con el texto del mes actual; un mes pasado, el texto del mes pasado.
- "Mes siguiente" está deshabilitado en el mes actual y "Mes anterior" en el primer mes con ventas; al cambiar se anuncia "Resumen de octubre".
- Empate de dos productos: se ven los dos, ordenados por nombre, con "Empataron con el mismo monto.".
- Sin canal en ninguna venta: no aparece "Dónde vendiste más".
- La ganancia de un mes pasado dice "En octubre te quedaron aprox. …".
- "{n} ventas registradas" en plural y "1 venta registrada" en singular.

**E2E (F4.6)**: los de F4.0 (5.5), buscando los textos exactos de este documento ("Esta semana", "te quedaron aprox.", "de lo que tiene costo cargado").

---

## 9. Preguntas abiertas para el usuario

1. **Texto de ejemplo del sistema de diseño (6.7).** El ejemplo "Todavía no hay ventas esta semana" (y la pantalla provisoria de Inicio) choca con el patrón de culpa "todavía no" de F6.4. Esta especificación ya no lo usa. Propuesta: cambiar el ejemplo de 6.7 por el título de 3.4 ("Aquí vas a ver cuánto vendes"), o sacar "todavía no" de la lista de patrones. Recomiendo lo primero.
