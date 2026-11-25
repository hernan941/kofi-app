# Sistema de diseño — Bruma

Este documento es la **fuente de verdad** visual de Kofi. Todo color, tamaño, espacio, borde o sombra de la app sale de aquí, nunca de valores escritos a mano (`.claude/rules/react-native/coding-style.md`). La base técnica es HeroUI Native + Uniwind (ADR-004). La fuente y los íconos están en ADR-014 (Propuesto).

---

## 1. Filosofía

- **Tres tonos y nada más.** Hay un **fondo** y unas **tarjetas** casi iguales (gris azulado claro, sin blanco) y un **acento ciruela apagado**. Aparte de eso solo existe el texto casi negro y su versión secundaria. La app debe sentirse tranquila, como una mañana con bruma.
- **Estilo sticker.** Lo importante parece un sticker pegado: borde de 2 px y sombra sólida desplazada 3 px hacia abajo a la derecha, sin desenfoque. Al tocarlo, el sticker "se aprieta": baja 2 px y la sombra se achica.
- **El acento es escaso, y por eso funciona.** Se usa solo en:
  - el **botón principal** (uno por pantalla);
  - el **monto principal** de la pantalla (por ejemplo, "cuánto vendiste esta semana");
  - la **racha**;
  - lo **activo o seleccionado** (pestaña actual, chip o versión elegida, campo con foco);
  - los **enlaces**.
- **Nunca** se usa el acento como decoración, en fondos grandes, en montos de una lista (esos van en color de texto) ni para errores.
- **Los números mandan.** Los montos son lo más grande y legible de cada pantalla, siempre alineados a la derecha en las listas y siempre con el componente `Amount` (ver 3.3).

---

## 2. Color

### 2.1 Tokens base (los tres tonos y el texto)

| Token (CSS / Tailwind) | Qué es | Claro | Oscuro |
|---|---|---|---|
| `background` | Fondo de la pantalla | `#E7EFF3` | `#131A1E` |
| `surface` | Tarjetas, hojas, toasts | `#D5E3EA` | `#1D272D` |
| `accent` | Acento ciruela (ver usos arriba) | `#743A59` | `#D79BBB` |
| `accent-foreground` | Texto e íconos sobre el acento (= fondo) | `#E7EFF3` | `#131A1E` |
| `foreground` | Texto principal | `#171D21` | `#EDF3F6` |
| `muted` | Texto secundario, placeholders, íconos inactivos | `#4C5459` | `#B3BABE` |

### 2.2 Estados (derivados de los tonos base; un único color nuevo: el error)

| Token | Qué es | Claro | Oscuro | Cómo se obtiene |
|---|---|---|---|---|
| `danger` | Error de validación, acciones de borrar | `#9C3B22` | `#EE9A72` | **Nuevo**: ladrillo apagado |
| `danger-foreground` | Texto sobre un botón de borrar relleno | `#E7EFF3` | `#131A1E` | = fondo |
| `focus` | Indicador de foco y borde del campo activo | `#743A59` | `#D79BBB` | = acento |
| `field-border` | Borde de los campos de texto | `#4C5459` | `#B3BABE` | = texto secundario |
| `field-background` | Fondo de los campos de texto | `#E7EFF3` | `#131A1E` | = fondo (el campo se ve "hundido" dentro de la tarjeta) |
| `field-placeholder` | Texto de ejemplo en campos | `#4C5459` | `#B3BABE` | = texto secundario |
| `border` (borde sticker) | Borde de tarjetas y botones | `#171D21` | `#B3BABE` | claro = texto; oscuro = texto secundario |
| `sticker-shadow-color` | Color de la sombra sticker | `#171D21` | `#000000` | claro = texto; oscuro = negro |
| `separator` | Líneas entre filas de una lista (decorativas) | `≈ #96A1A8` | `≈ #545E63` | `color-mix` de 70 % tarjeta y 30 % texto |
| Deshabilitado | Controles no disponibles | — | — | Opacidad `0.6` y **sin sombra sticker** |
| `success` | Confirmaciones ("Venta guardada") | `#743A59` | `#D79BBB` | = acento, siempre con ícono de check |
| `warning` | Sin uso por ahora (HeroUI lo exige) | `#4C5459` | `#B3BABE` | = texto secundario; si aparece un caso real, se decide antes de usarlo |

**Por qué el error es ladrillo y no rojo.** El acento ciruela tiene un tono de unos 347° en OKLCH. Un rojo puro (unos 25°) se confundiría con él. El ladrillo está cerca de 35° en claro y de 46° en oscuro, más anaranjado y algo más saturado, pero sigue siendo apagado. Igual no alcanza con el color, porque en daltonismo la diferencia baja (en oscuro con tritanopía la distancia OKLab cae de 0,10 a 0,06). Por eso hay una regla fija:

> **Un error nunca se comunica solo con color.** Siempre lleva el ícono `WarningCircle` y un texto que explica qué pasó y cómo arreglarlo. Las acciones de borrar llevan el ícono `Trash` y la palabra "Borrar" o "Eliminar".

### 2.3 Contraste verificado (WCAG 2.x)

Todos calculados con la fórmula de luminancia relativa de WCAG. Para texto se pide al menos 4.5:1 y para bordes, íconos y foco al menos 3:1.

| Par | Claro | Oscuro | Mínimo |
|---|---|---|---|
| Texto / fondo | 14.6 | 15.7 | 4.5 |
| Texto / tarjeta | 13.0 | 13.6 | 4.5 |
| Secundario / fondo | 6.6 | 9.0 | 4.5 |
| Secundario / tarjeta | 5.9 | 7.7 | 4.5 |
| Acento / fondo | 7.2 | 7.8 | 4.5 |
| Acento / tarjeta | 6.4 | 6.7 | 4.5 |
| Texto sobre acento (fondo / acento) | 7.2 | 7.8 | 4.5 |
| **Error / fondo** | **5.9** | **8.0** | 4.5 |
| **Error / tarjeta** | **5.2** | **6.9** | 4.5 |
| **Texto sobre botón de borrar (fondo / error)** | **5.9** | **8.0** | 4.5 |
| **Placeholder / campo** (secundario / fondo) | **6.6** | **9.0** | 4.5 |
| **Borde de campo / fondo** | **6.6** | **9.0** | 3 |
| **Borde de campo / tarjeta** | **5.9** | **7.7** | 3 |
| **Foco (acento) / fondo** | **7.2** | **7.8** | 3 |
| **Foco (acento) / tarjeta** | **6.4** | **6.7** | 3 |
| **Borde sticker / fondo** | **14.6** | **9.0** | 3 |
| **Borde sticker / tarjeta** | **13.0** | **7.7** | 3 |
| Etiqueta de toast de error (`danger-soft-foreground` de HeroUI) / tarjeta | 6.4 | 8.0 | 4.5 |
| Etiqueta de toast de éxito (`accent-soft-foreground`) / tarjeta | 7.5 | 7.9 | 4.5 |

Notas:
- **Deshabilitado:** con opacidad 0.6, el texto de un botón principal deshabilitado queda en 2.9:1 (claro) y 3.6:1 (oscuro). WCAG excluye a los controles deshabilitados, pero justamente por eso la regla es **no deshabilitar el botón principal**: se deja activo y, al tocarlo, se muestran los errores (ver 6.1).
- **Separador:** 2.0:1 (claro) y 2.3:1 (oscuro). Es decorativo: las filas ya se distinguen por su espacio y su contenido.
- **Sombra negra en oscuro:** sobre `#131A1E` se nota poco (1.2:1). Es intencional: en oscuro el efecto sticker lo da sobre todo el borde.
- Las variantes `*-soft` y `*-hover` que HeroUI calcula con `color-mix` **no se usan** fuera de los toasts ya verificados. Si un componente nuevo las necesita, primero se mide su contraste y se agrega a esta tabla.

---

## 3. Tipografía

### 3.1 Familia

**Lexend** (Google Fonts, OFL), en los pesos 400, 500, 600 y 700, cargada desde `@expo-google-fonts/lexend` (ADR-014). Es redonda, ancha y está diseñada para leerse con fluidez, así que no intimida.

### 3.2 Escala

Los tamaños están en puntos (pt en iOS, dp en Android) y **crecen con el tamaño de letra del sistema**.

| Token Tailwind | Uso | Tamaño / alto de línea | Peso (clase) |
|---|---|---|---|
| `text-display` | Monto principal de la pantalla | 44 / 52 | `font-bold` + `tracking-tight` |
| `text-title` | Título de pantalla | 28 / 36 | `font-semibold` |
| `text-heading` | Título de tarjeta o sección | 20 / 28 | `font-semibold` |
| `text-lg` | Montos en listas, nombre de producto destacado | 18 / 26 | `font-bold` (montos) o `font-medium` |
| `text-base` | Texto normal, botones, campos | 16 / 24 | `font-normal`; botones en `font-semibold` |
| `text-sm` | Texto secundario, etiquetas de campo, ayudas y errores | 14 / 20 | `font-normal` o `font-medium` |
| `text-xs` | Fechas, pie de tarjeta, pestañas | 13 / 18 | `font-medium` |

Reglas:
- **Nada por debajo de 13.**
- Solo se usan los cuatro pesos definidos. Con fuentes propias, HeroUI elige la cara de la fuente según la clase `font-*` y no aplica un `fontWeight` numérico. Mezclar ambas cosas en iOS hace que se use la cara más gruesa.
- Las mayúsculas sostenidas no se usan para texto largo.

### 3.3 Cifras y montos

**Lexend no tiene cifras tabulares (`tnum`).** Lo comprobé en los archivos de Google Fonts y en los de `@expo-google-fonts/lexend` 0.4.1: sus dígitos miden entre 500 y 620 unidades de ancho, así que `fontVariant: ['tabular-nums']` no hace nada.

Decisión propuesta (ADR-014, opción A):
- Todo monto se muestra con el componente **`Amount`** de `shared/ui`. Ese componente:
  - formatea en CLP: `$15.000`, sin decimales, con punto de miles;
  - en listas va **alineado a la derecha, en su propia columna** y en `text-lg font-bold`;
  - tiene la etiqueta accesible "15.000 pesos", para que el lector de pantalla no diga "dólares";
  - en el monto principal (`text-display`) se ajusta para caber en una línea (`adjustsFontSizeToFit`, `numberOfLines={1}`, `maxFontSizeMultiplier={1.5}`).
- **No se animan** los montos dígito a dígito (efecto contador), porque el ancho cambia en cada cuadro.
- La diferencia de ancho entre dígitos es de unos 2 px a 17 pt: los puntos de miles pueden desfasarse unos píxeles entre filas. Si al verlo en el teléfono molesta, la alternativa preparada (opción B) es usar **Sora** (que sí tiene `tnum`) solo dentro de `Amount`. Al cambiarla en un solo componente, se cambia en toda la app.

---

## 4. Espaciado, radios, bordes y sombra

### 4.1 Espaciado (escala de 4)

Se usa la escala por defecto de Tailwind (`--spacing: 0.25rem` = 4 pt).

| Clase | Valor | Uso típico |
|---|---|---|
| `1` | 4 | Separación entre ícono y texto pequeño |
| `2` | 8 | Separación dentro de un grupo (chips, etiqueta y campo) |
| `3` | 12 | Relleno de chips y de filas compactas |
| `4` | 16 | **Margen lateral de pantalla**, relleno de tarjetas, separación entre tarjetas |
| `6` | 24 | Separación entre secciones |
| `8` | 32 | Aire antes de una acción principal |
| `12` | 48 | Espacio superior de los estados vacíos |

### 4.2 Radios

Base `--radius: 0.5rem` (8). HeroUI deriva la escala de esa base.

| Elemento | Clase | Valor |
|---|---|---|
| Tarjetas, toasts, hojas inferiores | `rounded-3xl` | 24 |
| Campos de texto | `rounded-field` (`--field-radius`) | 16 |
| Miniaturas de producto | `rounded-xl` | 12 |
| Botones y chips | `rounded-full` | píldora |

### 4.3 Bordes

| Token | Valor | Uso |
|---|---|---|
| `--border-width` | 2px | Borde sticker de tarjetas, botones y toasts (`border-2 border-border`) |
| `--field-border-width` | 2px | Campos de texto (`border-field-width border-field-border`) |
| Separador | 1px (`h-hairline` o `border-b`) | Entre filas de una lista dentro de una tarjeta |

### 4.4 Sombra sticker

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `shadow-sticker` | `3px 3px 0 0 #171D21` | `3px 3px 0 0 #000000` | Tarjetas, botones principal y secundario, toasts, hojas |
| `shadow-sticker-pressed` | `1px 1px 0 0 #171D21` | `1px 1px 0 0 #000000` | Mientras se mantiene presionado (más `translate-x-0.5 translate-y-0.5`) |

- Los **campos de texto, los chips y las filas de una lista no llevan sombra**: así se distingue lo que se toca para escribir o elegir de lo que es un bloque o una acción.
- **Máximo tres elementos con sombra por pantalla** a la vista, más la barra de pestañas. Si hay más, se agrupan en una sola tarjeta.
- **Detalle técnico a verificar al implementar:** la sombra usa `boxShadow` de React Native. Funciona en iOS y en Android 9 o superior, y requiere la Nueva Arquitectura. En Android 7 y 8 no se dibuja, y el sticker queda solo con su borde, que es una degradación aceptable. Además, `Surface`/`Card` de HeroUI usan `overflow: hidden`, así que hay que comprobar en un dispositivo que esa propiedad no recorte la sombra. Si la recorta, la sombra va en una `View` contenedora sin `overflow: hidden`.

---

## 5. Mapeo a HeroUI Native + Uniwind

Lo verifiqué contra el código fuente de `heroui-native` 1.0.11 (`src/styles/variables.css`, `theme.css`, `components/*.css`) y contra la documentación oficial de theming y de inicio rápido (consultadas el 2026-11-13). HeroUI define los colores como variables CSS dentro de `@layer theme { :root { @variant light {…} @variant dark {…} } }`. Las expone a Tailwind en un bloque `@theme inline` como `--color-*`, de modo que `--accent` se usa con la clase `bg-accent`. Las fuentes se definen con `--font-normal/medium/semibold/bold` en `@theme`. Desde la versión 1.0.8 ya no hace falta la línea `@source`.

### 5.1 Correspondencia

| Token Bruma | Variable HeroUI | Claro | Oscuro |
|---|---|---|---|
| Fondo | `--background` | `#E7EFF3` | `#131A1E` |
| Texto | `--foreground` | `#171D21` | `#EDF3F6` |
| Tarjeta | `--surface`, `--overlay`, `--default` | `#D5E3EA` | `#1D272D` |
| Tarjeta anidada | `--surface-secondary`, `--surface-tertiary`, `--segment` | = fondo | = fondo |
| Texto sobre tarjeta, overlay y default | `--*-foreground` | = texto | = texto |
| Texto secundario | `--muted`, `--field-placeholder` | `#4C5459` | `#B3BABE` |
| Acento | `--accent`, `--focus`, `--link`, `--success` | `#743A59` | `#D79BBB` |
| Texto sobre acento | `--accent-foreground`, `--success-foreground` | = fondo | = fondo |
| Error | `--danger` | `#9C3B22` | `#EE9A72` |
| Texto sobre error | `--danger-foreground` | = fondo | = fondo |
| Advertencia (sin uso) | `--warning` / `--warning-foreground` | = secundario / fondo | = secundario / fondo |
| Campo | `--field-background` / `--field-foreground` / `--field-border` | fondo / texto / secundario | fondo / texto / secundario |
| Borde sticker | `--border` | = texto | = secundario |
| Separador | `--separator` | `color-mix(…)` | `color-mix(…)` |
| Sombra sticker | `--surface-shadow`, `--overlay-shadow` | `3px 3px 0 0 #171D21` | `3px 3px 0 0 #000000` |
| Sombra de campo | `--field-shadow` | ninguna | ninguna |
| Velo detrás de diálogos | `--backdrop` | negro al 40 % | negro al 40 % |
| Deshabilitado | `--opacity-disabled` | `0.6` | `0.6` |

### 5.2 Bloque de tema (ejemplo para `global.css`)

Es la configuración que se va a usar. La crea el `code-writer` al montar el proyecto; este documento no crea archivos de código.

```css
@import 'tailwindcss';
@import 'uniwind';
@import 'heroui-native/styles';

@theme {
  --font-normal: 'Lexend_400Regular';
  --font-medium: 'Lexend_500Medium';
  --font-semibold: 'Lexend_600SemiBold';
  --font-bold: 'Lexend_700Bold';

  --border-width: 2px;
  --field-border-width: 2px;
  --radius: 0.5rem;
  --field-radius: 1rem;
  --opacity-disabled: 0.6;

  --text-xs: 0.8125rem;
  --text-xs--line-height: 1.125rem;
  --text-sm: 0.875rem;
  --text-sm--line-height: 1.25rem;
  --text-base: 1rem;
  --text-base--line-height: 1.5rem;
  --text-lg: 1.125rem;
  --text-lg--line-height: 1.625rem;
  --text-heading: 1.25rem;
  --text-heading--line-height: 1.75rem;
  --text-title: 1.75rem;
  --text-title--line-height: 2.25rem;
  --text-display: 2.75rem;
  --text-display--line-height: 3.25rem;
}

@layer theme {
  :root {
    @variant light {
      --background: #E7EFF3;
      --foreground: #171D21;

      --surface: #D5E3EA;
      --surface-foreground: #171D21;
      --surface-secondary: #E7EFF3;
      --surface-secondary-foreground: #171D21;
      --surface-tertiary: #E7EFF3;
      --surface-tertiary-foreground: #171D21;

      --overlay: #D5E3EA;
      --overlay-foreground: #171D21;
      --backdrop: oklch(0% 0 0 / 40%);

      --muted: #4C5459;
      --default: #D5E3EA;
      --default-foreground: #171D21;

      --accent: #743A59;
      --accent-foreground: #E7EFF3;

      --field-background: #E7EFF3;
      --field-foreground: #171D21;
      --field-placeholder: #4C5459;
      --field-border: #4C5459;

      --success: #743A59;
      --success-foreground: #E7EFF3;
      --warning: #4C5459;
      --warning-foreground: #E7EFF3;
      --danger: #9C3B22;
      --danger-foreground: #E7EFF3;

      --segment: #E7EFF3;
      --segment-foreground: #171D21;

      --border: #171D21;
      --separator: color-mix(in oklab, #D5E3EA 70%, #171D21 30%);
      --focus: #743A59;
      --link: #743A59;

      --sticker-shadow-color: #171D21;
      --sticker-shadow: 3px 3px 0 0 #171D21;
      --sticker-shadow-pressed: 1px 1px 0 0 #171D21;
      --surface-shadow: 3px 3px 0 0 #171D21;
      --overlay-shadow: 3px 3px 0 0 #171D21;
      --field-shadow: 0 0 0 0 transparent;
    }

    @variant dark {
      --background: #131A1E;
      --foreground: #EDF3F6;

      --surface: #1D272D;
      --surface-foreground: #EDF3F6;
      --surface-secondary: #131A1E;
      --surface-secondary-foreground: #EDF3F6;
      --surface-tertiary: #131A1E;
      --surface-tertiary-foreground: #EDF3F6;

      --overlay: #1D272D;
      --overlay-foreground: #EDF3F6;
      --backdrop: oklch(0% 0 0 / 40%);

      --muted: #B3BABE;
      --default: #1D272D;
      --default-foreground: #EDF3F6;

      --accent: #D79BBB;
      --accent-foreground: #131A1E;

      --field-background: #131A1E;
      --field-foreground: #EDF3F6;
      --field-placeholder: #B3BABE;
      --field-border: #B3BABE;

      --success: #D79BBB;
      --success-foreground: #131A1E;
      --warning: #B3BABE;
      --warning-foreground: #131A1E;
      --danger: #EE9A72;
      --danger-foreground: #131A1E;

      --segment: #131A1E;
      --segment-foreground: #EDF3F6;

      --border: #B3BABE;
      --separator: color-mix(in oklab, #1D272D 70%, #EDF3F6 30%);
      --focus: #D79BBB;
      --link: #D79BBB;

      --sticker-shadow-color: #000000;
      --sticker-shadow: 3px 3px 0 0 #000000;
      --sticker-shadow-pressed: 1px 1px 0 0 #000000;
      --surface-shadow: 3px 3px 0 0 #000000;
      --overlay-shadow: 3px 3px 0 0 #000000;
      --field-shadow: 0 0 0 0 transparent;
    }
  }
}

@theme inline {
  --color-sticker-shadow: var(--sticker-shadow-color);
  --shadow-sticker: var(--sticker-shadow);
  --shadow-sticker-pressed: var(--sticker-shadow-pressed);
}
```

Puntos a comprobar al implementar (con un test o en un dispositivo, según el caso):
- **Campos de texto en Android.** En la versión 1.0.11, `Input` aplica `android:border-[1.5px] android:border-transparent android:focus:border-accent` (`input.styles.ts`), que tapa `--field-border` cuando el campo no tiene foco. El componente base `TextField` de `shared/ui` tiene que forzar `border-2 border-field-border` y, con foco, `border-accent`, y hay que verificarlo en Android.
- **Fuentes.** Los valores de `--font-*` tienen que coincidir exactamente con las claves de `useFonts` (`Lexend_400Regular`, etc.).
- **Valores literales en sombras.** Las variables de color se escriben como valores literales en las sombras (no `var()`) para no depender de que Uniwind resuelva variables dentro de `box-shadow`.

---

## 6. Componentes

Todos viven en `shared/ui` (ADR-005), se construyen sobre HeroUI Native y tienen tests (TDD, ADR-002). Para todos rige lo siguiente: área táctil mínima de 48 × 48 (cumple los 44 pt de iOS y los 48 dp de Android), `accessibilityRole`, una etiqueta legible y `accessibilityState` cuando corresponda.

### 6.1 Botones

| Tipo | Aspecto | Cuándo |
|---|---|---|
| **Principal** | Fondo `accent`, texto `accent-foreground` en `text-base font-semibold`, borde sticker, `shadow-sticker`, píldora, alto 52 y ancho completo | **Uno por pantalla**: la acción que la persona vino a hacer ("Registrar venta", "Guardar") |
| **Secundario** | Fondo `surface`, texto `foreground`, borde sticker y sin sombra, alto 48 | Alternativas al lado del principal ("Esta semana no vendí") |
| **De texto** | Sin fondo ni borde, texto `accent` en `font-semibold`, alto mínimo 48 | Acciones menores ("Ver todas", "Agregar costo") |
| **Borrar** | Como el secundario, pero con texto `danger` y el ícono `Trash`. En el diálogo de confirmación, el botón final va relleno de `danger` con texto `danger-foreground` | Solo acciones destructivas, siempre con confirmación |

- Al presionar: `translate-x-0.5 translate-y-0.5` y `shadow-sticker-pressed`. Es un cambio inmediato, sin animación, así que no depende de "reducir movimiento".
- **El botón principal no se deshabilita.** Si faltan datos, al tocarlo se marcan los campos con error y el foco del lector de pantalla va al primero. Otros controles pueden deshabilitarse (`--opacity-disabled` 0.6, sin sombra, `accessibilityState={{ disabled: true }}`).
- El botón principal va en la **zona del pulgar**: abajo, fijo sobre la barra de pestañas o al final del formulario, respetando el área segura.
- Un botón que solo tiene ícono necesita `accessibilityLabel` ("Editar producto").

### 6.2 Tarjeta

- Fondo `surface`, borde sticker de 2 px, `rounded-3xl`, `shadow-sticker` y relleno `p-4`.
- Tiene un título en `text-heading` como máximo. Si toda la tarjeta se puede tocar, es un solo botón con una etiqueta que resume su contenido.
- Separación entre tarjetas: `gap-4`. Máximo tres con sombra a la vista (4.4).

### 6.3 Campo de texto

- Etiqueta **siempre visible encima** (`text-sm font-medium`, color `foreground`). El placeholder no reemplaza a la etiqueta.
- Campo: fondo `field-background`, borde de 2 px `field-border`, `rounded-field`, alto mínimo 48, texto `text-base`, sin sombra.
- **Foco:** el borde pasa a `accent`.
- **Error:** el borde pasa a `danger`, y debajo aparece el ícono `WarningCircle` de 16 en `danger` junto al mensaje en `text-sm` `danger` ("Escribe un precio, por ejemplo 15.000"). El mensaje se anuncia al lector de pantalla y el campo se marca como inválido (`isInvalid`).
- Ayuda opcional debajo, en `text-sm` `muted`.
- **Campos de monto:** teclado numérico, prefijo `$` fijo y formato de miles mientras se escribe.
- Los campos opcionales dicen "(opcional)" en la etiqueta. Nada obligatorio se marca con asterisco.

### 6.4 Lista de ventas

- Las filas van dentro de una tarjeta, separadas con `separator` de 1 px.
- Cada fila mide al menos 56 de alto y tiene relleno vertical `py-3`:
  - a la izquierda, la miniatura del producto (40 × 40, `rounded-xl`), si existe;
  - en el centro, el nombre del producto (`text-base font-medium`) y, debajo, versión y fecha (`text-xs` `muted`, "Print A4 · hoy");
  - a la derecha, el monto con `Amount` (`text-lg font-bold`, color `foreground`, **no acento**).
- Si hay muchas filas, se agrupan por día con un encabezado `text-xs font-medium` `muted`.
- Toda la fila es un botón con una etiqueta completa: "Lámina Colibrí, Print A4, 15.000 pesos, hoy".
- Con letra muy grande, el monto pasa debajo del nombre (`flex-wrap`). Nunca se recorta.
- Se implementa con `FlatList` o `FlashList` (`.claude/rules/react-native/performance.md`).

### 6.5 Chip (filtros, "Dónde vendiste", versión elegida)

- Píldora, alto mínimo 48, `px-4`, `text-sm font-medium`.
- **Sin elegir:** sin fondo, borde de 2 px `field-border`, texto `foreground`.
- **Elegido:** fondo `accent`, texto `accent-foreground` y el ícono `Check` delante. Así el estado no depende solo del color.
- Sin sombra. Se marca con `accessibilityState={{ selected }}` (o `checked` si funciona como opción).

### 6.6 Notificación en pantalla (toast)

- Usa el `Toast` de HeroUI: fondo `overlay` (= tarjeta), borde sticker, `shadow-sticker` y `rounded-3xl`.
- Va abajo, sobre la barra de pestañas, al alcance de la vista mientras se usa con una mano.
- **Éxito:** ícono `CheckCircle` (relleno) en `accent` y un texto positivo ("Venta guardada").
- **Error:** ícono `WarningCircle` en `danger` y un texto que dice qué hacer ("No se pudo guardar. Inténtalo de nuevo").
- Dura al menos 4 segundos y se puede cerrar al tacto. Se anuncia al lector de pantalla una sola vez, con `announce()`; el toast mismo queda oculto al lector (ver 7).
- **No se usa para nada que exija una acción**: eso va en un diálogo o en el propio formulario.

### 6.7 Estado vacío

- Centrado, con `pt-12`:
  - ícono de Phosphor en peso `duotone`, tamaño 48, color `muted`;
  - título en `text-heading`;
  - una frase en `text-base` `muted`;
  - el botón principal debajo.
- El tono es siempre positivo y nunca culpa. Ejemplo de inicio sin ventas esta semana: "Aquí vas a ver cuánto vendes", "Cuando vendas algo, regístralo aquí en segundos", botón principal "Registrar venta" y botón secundario "Esta semana no vendí".

### 6.8 Cargando y error de pantalla

- **Cargando:** `Skeleton` de HeroUI con la forma del contenido (filas, tarjetas), en color `surface`. Tiene un texto accesible ("Cargando ventas").
- **Error al cargar:** tarjeta con `WarningCircle` en `danger`, un mensaje claro y un botón secundario "Reintentar".

### 6.9 Pestañas y elementos activos

- La pestaña activa usa el ícono en peso `fill` y la etiqueta en `font-semibold`, ambos en `accent`.
- La inactiva usa el ícono en peso `bold` y la etiqueta en `font-medium`, en `muted`.
- Las etiquetas son `text-xs`, siempre visibles, en **una línea** y con `accessibilityState={{ selected }}`. Crecen con la letra del sistema hasta 1,3× y, si no entran, se achican para caber (`adjustsFontSizeToFit`). La barra calcula su alto con la letra del sistema (`useTabBarStyle`).

### 6.10 Implementación en `shared/ui` (F0.13)

Todo se importa desde `@/shared/ui`. Decisiones tomadas al construirlos:

- **Botones** (`PrimaryButton`, `SecondaryButton`, `TextButton`, `DeleteButton`, `IconButton`): usan el `Button` de HeroUI con su animación de presión apagada (`feedbackVariant="none"`), porque el efecto sticker la reemplaza. `PrimaryButton` no tiene la propiedad para deshabilitarse, y `IconButton` exige `accessibilityLabel` por tipos. Los altos son mínimos (`min-h-13` y `min-h-12`), no fijos.
- **Formularios**: `FormTextField` y `FormAmountField` traducen los códigos de error de los esquemas (`TEXT_ERROR_MESSAGES`, `CLP_INPUT_ERROR_MESSAGES`). `clpTextSchema` convierte el texto del campo de monto en `Clp` con `parseClpInput`. `createSubmitHandler` arma el `onPress` del botón principal: con datos válidos guarda; si no, marca los campos, lleva el foco al primero con error y anuncia "Revisa los campos marcados".
- **Campo de texto**: el error queda asociado al campo como `accessibilityHint` (React Native no tiene un "inválido" accesible) y se anuncia cuando aparece. La ayuda ocupa ese lugar mientras no hay error.
- **Campo de monto**: agrupa los miles al escribir. Si se pega un texto ambiguo (`1.5`, `15,5`), lo deja tal cual para que la validación explique cómo escribirlo, en vez de adivinar.
- **Fecha** (`DateField`): avanza y retrocede de a un día ("Día anterior" / "Día siguiente") y nunca pasa de `maxDate`. La mayoría de las ventas son de hoy o de pocos días atrás, y no hay un selector de calendario nativo entre las dependencias. Si hace falta saltar semanas, se evalúa un calendario en una hoja.
- **Hoja inferior** (`Sheet`): usa el `Modal` de React Native, porque el `BottomSheet` de HeroUI necesita `@gorhom/bottom-sheet`, que no está en el proyecto. Se desliza, salvo si el sistema pide reducir el movimiento.
- **Formularios con teclado** (`FormLayout`): toda pantalla con campos de texto usa `FormLayout`; los campos se hacen visibles solos al recibir el foco.
- **Grupo de chips** (`ChipGroup`): se lee como un grupo de opciones (`radiogroup`), con cada chip como `radio` y el estado `checked`. Un `Chip` suelto es un botón con `selected`.
- **Toast** (`useAppToast`): HeroUI dibuja cada toast dos veces (la visible y una copia transparente para medir el alto). La auditoría F10.1 confirmó que, así, el aviso se podía leer varias veces. Por eso todo el toast se oculta al lector y el aviso llega solo por `announce()` (ver 7).
- **Diálogo de confirmación** (`ConfirmDialog`): desde F10.1 se dibuja sobre el `Modal` de React Native, no sobre el `Dialog` de HeroUI, para que en Android retenga el foco (ver 7).
- **Pantalla de error de arranque** (`BootErrorScreen`): no ofrece ninguna acción que escriba datos. Para `newer_database` pide actualizar la app. La exportación de emergencia aparece solo cuando se conecta `onEmergencyExport` (F8.8).

---

## 7. Accesibilidad

- **Áreas táctiles:** al menos 48 × 48. Si un control se ve más chico, se amplía con `hitSlop`.
- **Contraste:** al menos 4.5:1 para todo texto y 3:1 para bordes de controles, íconos que informan y foco. Se verifica en claro **y** en oscuro. Todo par nuevo se mide y se agrega a la tabla 2.3.
- **Nada solo por color:** lo elegido lleva un check, lo activo cambia el peso del ícono y del texto, y los errores llevan ícono y texto.
- **Tamaño de letra del sistema:**
  - `allowFontScaling` siempre activo;
  - no se fijan altos, solo altos mínimos;
  - todo texto crece sin límite, **salvo las excepciones de la tabla**. Cada excepción tiene que estar en esta tabla con su motivo, y la información completa tiene que poder leerse en otro lugar sin límite (la etiqueta accesible o una pantalla de detalle);
  - se prueba con el tamaño de accesibilidad más grande en iOS y Android.

  | Dónde | Límite | Por qué |
  |---|---|---|
  | Monto principal y total del pie (`Amount`, variantes `display` y `total`) | `maxFontSizeMultiplier={1.5}`, una línea, `adjustsFontSizeToFit` | A 44 pt, un monto más grande no cabe en una línea. La etiqueta "45.000 pesos" no cambia. |
  | Etiquetas de pestañas (`TabBarLabel`) | `maxFontSizeMultiplier={1.3}`, una línea, `adjustsFontSizeToFit` | Con cinco pestañas, cada una tiene entre 62 y 76 de ancho útil (320–392 dp). 'Calendario' mide 72 a 13 pt: con dos líneas Android partía la palabra ('Calendari/o'). En una línea que se achica, nunca se parte ni se corta. Los lectores de pantalla leen el texto completo, y en iOS lo muestra el visor de contenido grande. Reemplaza la decisión F10.1 M8 (regresión E2E, 2026-11-15). |
  | Número del día en el calendario de la pestaña (`CalendarDayCell`) | `maxFontSizeMultiplier={2}` | A 3×, el número no cabe en 1/7 del ancho. La etiqueta accesible lleva la fecha completa y lo vendido, y el detalle del día crece sin límite (`docs/design/tracking-calendar.md`). |
  | Número del día en la hoja de fecha (`DatePickerSheet`) | `maxFontSizeMultiplier={2}`, celdas `flex-1` con alto mínimo de 48 (sin tamaño fijo) | El mismo motivo que el calendario: siete columnas en 328 de ancho útil. La etiqueta accesible dice el día completo ("Hoy, sábado 14 de noviembre"). Corrige el hallazgo M5 de `docs/design/accessibility-audit.md`. |
- **Lector de pantalla:**
  - los montos se leen como "15.000 pesos" (`Amount`);
  - un botón con solo ícono lleva `accessibilityLabel`;
  - las tarjetas que se tocan son un solo elemento;
  - errores y toasts se anuncian, **una sola vez cada uno**;
  - **toast**: todo el toast se oculta al lector de pantalla (`accessibilityElementsHidden` e `importantForAccessibility="no-hide-descendants"`, sin `accessibilityLiveRegion`). El aviso llega solo por `announce()`, con un único anuncio. Así no se lee dos o tres veces (por la región viva y por la copia que HeroUI dibuja para medir el alto), y TalkBack no llega a un botón "Cerrar aviso" invisible. El botón de cerrar sigue disponible al tacto, y el aviso se cierra solo a los 4 segundos. No se parcha HeroUI con `patch-package`. **Decisión del orquestador (F10.1, A1).**
- **Reducir movimiento:** HeroUI Native desactiva sus animaciones automáticamente cuando el sistema lo pide (`useReducedMotion` de Reanimated en su `GlobalAnimationSettingsProvider`). Las animaciones propias hacen lo mismo con `useReducedMotion`. El efecto de presión del sticker es un cambio instantáneo, no una animación.
- **Foco:**
  - el campo con foco cambia su borde a `accent`. Con teclado físico o control por botones, el foco visible es un anillo de 2 px `focus` separado 2 px del elemento;
  - **diálogo de confirmación** (`ConfirmDialog`): se dibuja sobre el `Modal` de React Native, igual que `Sheet`, y no sobre el `Dialog` de HeroUI. En Android, el `Dialog` de HeroUI no es una ventana propia: TalkBack no iba a la pregunta y dejaba recorrer la pantalla de atrás. El `Modal` sí retiene el foco. Al abrir, el foco queda en la pregunta (rol `header`); `onRequestClose` cancela con el botón atrás; al cerrar, el foco vuelve al elemento que abrió el diálogo. El aspecto no cambia: tarjeta `overlay`, borde sticker y fondo `backdrop`. **Decisión del orquestador (F10.1, A2).**
  - **nunca un diálogo sobre una hoja visible**: si una acción de una hoja pide confirmación, primero se cierra la hoja y después se abre el diálogo (hallazgo M11 de `docs/design/accessibility-audit.md`).

---

## 8. Iconografía

- **Set:** Phosphor (`phosphor-react-native`, ADR-014). Cada ícono se importa por separado: `import { HouseIcon } from 'phosphor-react-native/src/icons/House'`.
- **Peso por defecto:** `bold`, que combina con los bordes de 2 px. El estado activo usa `fill` y los estados vacíos `duotone`. Los valores por defecto se fijan con `IconContext` en la raíz.
- **Tamaños:** 24 por defecto (pestañas y botones), 20 dentro de filas y chips, 16 junto a mensajes de error y 48 en estados vacíos.
- **Color:** hereda el del texto que acompaña. Los íconos inactivos van en `muted` y el acento solo se usa en los mismos casos que el texto.
- **Íconos de referencia:**
  - Inicio `House`, Productos `Package`, Ventas `Receipt`, Consejos `Lightbulb`, Calendario `CalendarBlank`, Racha `Fire`;
  - Agregar `Plus`, Volver `CaretLeft`, Editar `PencilSimple`, Archivar `Archive`, Borrar `Trash`, Elegido `Check`;
  - Éxito `CheckCircle`, Error `WarningCircle`, Información `Info`;
  - Dónde vendiste: `Storefront`; Exportar `Export`; Foto `Camera` / `Image`; Ajustes `Gear`; Recordatorio `Bell`.
- **Accesibilidad:** un ícono que acompaña a un texto es decorativo y se oculta al lector de pantalla. Un ícono solo dentro de un botón necesita la etiqueta en el botón.

### 8.1 Marca: el gato de Kofi

- **Figura:** cara frontal de un gato tuxedo, plana y simétrica: cabeza oscura, franja y hocico claros, mirada serena y nariz ciruela. Sin boca ni accesorios: Kofi es un asistente, no una caricatura.
- **Colores:** cabeza y pupilas `#171D21`, hocico y ojos `#E7EFF3`, nariz `#743A59` (único acento), fondo `#D5E3EA` (13:1 con la cabeza).
- **Sobre fondo oscuro:** siempre con contorno sticker `#D5E3EA` (`splash-icon-dark.png`) o dentro de su fondo claro.
- **Un solo color:** `kofi-glyph.svg`, con ojos y hocico calados. Se usa en la notificación y en el ícono temático de Android.
- **Usos prohibidos:** cabeza oscura sobre ciruela o sobre oscuro sin contorno; sonrisa, sombrero, monóculo, monedas u otros accesorios; degradados, brillos o sombras; deformar, inclinar, recortar las orejas o cambiar los colores; usar la versión a color por debajo de 24 dp (ahí va el glifo).
- **Generación:** las fuentes son `assets/brand/kofi-mark.svg` y `assets/brand/kofi-glyph.svg`. `python3 tools/assets/generate-brand-assets.py` (Pillow y Chromium) genera todos los PNG y la capa de `assets/expo.icon`, y comprueba la zona segura adaptable. Los PNG no se editan a mano.

---

## 9. Preguntas abiertas para el usuario

1. **Montos con Lexend o con Sora.** Lexend no tiene cifras de ancho fijo. La propuesta es quedarse solo con Lexend y alinear los montos a la derecha (diferencia de unos 2 px por dígito). Conviene confirmarlo viendo una lista real en el teléfono; si molesta, se usa Sora solo para los montos.
