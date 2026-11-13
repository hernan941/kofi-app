# ADR-014: Tipografía (Lexend, sin fuente de números aparte) e íconos (Phosphor)

- **Estado**: Aceptado
- **Fecha**: 2026-11-13
- **Versiones verificadas (npm y archivos de fuente, 2026-11-13)**: `@expo-google-fonts/lexend` 0.4.1 (Lexend 1.007, OFL 1.1), `phosphor-react-native` 3.0.6 (MIT, peer `react-native-svg`), `lucide-react-native` 1.72.0 (ISC), `@expo/vector-icons` 15.1.1, `heroui-native` 1.0.11, `react-native-svg` 15.16.1.

## Contexto
El usuario eligió la propuesta visual **Bruma**, que usa la fuente **Lexend** (`docs/design-system.md`). En cuantovendi lo más importante son los montos (`$15.000`), y lo habitual para que los montos queden alineados en una lista es usar **cifras tabulares**: todos los dígitos con el mismo ancho, activadas con `fontVariant: ['tabular-nums']` o la función OpenType `tnum`.

Revisé los archivos de Lexend con fontTools. **Lexend no tiene `tnum`**: ni la versión de Google Fonts ni la de `@expo-google-fonts/lexend` (funciones disponibles: `aalt, case, ccmp, dlig, dnom, frac, liga, locl, numr, ordn, sinf, ss01, subs, sups, zero`). Sus dígitos son proporcionales: en Regular miden entre 500 ("1") y 620 ("4") unidades de 1000, y en Bold entre 548 y 675. Por eso `fontVariant: ['tabular-nums']` no tendría ningún efecto.

También hay que elegir un set de íconos que funcione con Expo, que combine con el estilo "sticker" (bordes de 2 px) y que permita marcar el estado activo sin depender solo del color.

## Opciones consideradas

### Alineación de montos
- **A. Solo Lexend, con los montos alineados a la derecha en su propia columna.** Pros: una sola familia y una sola personalidad tipográfica, y Lexend está diseñada para leerse con fluidez. En pesos chilenos no hay decimales y el borde derecho queda siempre alineado. La diferencia entre dígitos es de unos 0,12 em (cerca de 2 px por dígito a 17 pt), así que el desfase de los puntos de miles entre filas es de pocos píxeles. Contras: las columnas de dígitos no quedan perfectas (se nota en filas como `$111.111`), y un monto que cambia en vivo (un total mientras se escribe) varía levemente de ancho.
- **B. Lexend para el texto y una segunda fuente con `tnum` solo para los montos.** De las candidatas revisadas, **Sora** es la más parecida a Lexend (geométrica y ancha, con `tnum`). Pros: alineación perfecta. Contras: dos familias en la misma línea ("Print A4 · $15.000"), más archivos de fuente y una regla extra que mantener. Además, Sora y Lexend no son iguales, y la diferencia se nota justo en lo más visible de la app.
- **C. Simular cifras tabulares** con una caja de ancho fijo por dígito. Se descarta: es frágil con el tamaño de fuente del sistema y empeora la accesibilidad, porque el lector de pantalla lee caracteres sueltos.

### Carga de la fuente
- **`useFonts` de `@expo-google-fonts/lexend` mientras se muestra el splash.** El nombre de la familia es la clave (`Lexend_400Regular`) y es el mismo en iOS y Android, que es lo que la documentación de HeroUI Native pide usar en `--font-*`.
- **Plugin de `expo-font` (fuentes incrustadas en el binario).** No hay carga al iniciar, pero el nombre cambia según la plataforma: en iOS se usa el nombre PostScript (`Lexend-Regular`) y en Android el nombre del archivo (`Lexend_400Regular`). Eso obliga a duplicar las variables con `@variant ios` / `@variant android`, y un error ahí no lo detecta ningún test.

### Íconos
- **Phosphor (`phosphor-react-native`)**: más de 1.500 íconos y 6 pesos (`thin`, `light`, `regular`, `bold`, `fill`, `duotone`). El peso `bold` (unos 2,25 px a 24 pt) combina con los bordes de 2 px, y `fill` sirve para el estado activo de la barra de pestañas sin depender del color. Permite importar cada ícono por separado (`phosphor-react-native/src/icons/*`) y tiene `IconContext` para fijar los valores por defecto. Están todos los íconos que se necesitan (`House`, `Package`, `Receipt`, `Lightbulb`, `Fire`, `CalendarBlank`, `WarningCircle`, `CheckCircle`, `Trash`, `Archive`, `Storefront`, `Export`, etc.). Contra: publica versiones con menos frecuencia (última: abril de 2026).
- **Lucide (`lucide-react-native`)**: muy activo y con grosor de trazo ajustable, pero solo tiene contorno, sin variante rellena para el estado activo.
- **`@expo/vector-icons`**: ya viene con Expo, pero son fuentes de íconos de varios estilos (Ionicons, Material) que no combinan entre sí ni con el estilo sticker.

## Decisión
- **Opción A**: solo Lexend, en los pesos 400, 500, 600 y 700, cargada con `useFonts` de `@expo-google-fonts/lexend` mientras se muestra el splash. Las variables de HeroUI Native `--font-normal`, `--font-medium`, `--font-semibold` y `--font-bold` apuntan a `Lexend_400Regular`, `Lexend_500Medium`, `Lexend_600SemiBold` y `Lexend_700Bold`.
- Todo monto se muestra con **un único componente `Amount`** en `shared/ui`. Ese componente formatea en CLP, alinea a la derecha cuando va en una lista y entrega una etiqueta accesible ("15.000 pesos"). Si más adelante se quiere la opción B, se cambia en un solo lugar.
- **Íconos: Phosphor**, importados uno por uno desde `phosphor-react-native/src/icons/<Nombre>`. El peso por defecto es `bold` y el estado activo usa `fill`. Los valores por defecto los fija el componente `Icon` de `shared/ui` (enmienda 2026-11-13, F0.16: `IconContext` no tiene efecto con imports por ícono, porque `src/icons/*` usa una instancia del contexto distinta de la que exporta el paquete). Un lint prohíbe importar `phosphor-react-native` fuera de `shared/ui`.

## Consecuencias
- La alineación de los montos se logra con el diseño (columna derecha, `Amount`) y no con la fuente. Hay que evitar animaciones de "contador" en los montos, porque el ancho variaría en cada cuadro.
- Si el usuario, después de verlo en un dispositivo, prefiere la alineación perfecta, se crea un ADR que reemplace a este, con la opción B (Sora solo para `Amount`).
- La licencia OFL de Lexend y la licencia MIT de Phosphor se agregan a la pantalla de licencias de terceros.
- `react-native-svg` ya es dependencia de HeroUI Native, así que Phosphor no suma dependencias nativas.
- Los íconos que transmiten información necesitan contraste de 3:1 y, si están solos, un `accessibilityLabel` en el elemento que los contiene. Los decorativos se ocultan al lector de pantalla.
