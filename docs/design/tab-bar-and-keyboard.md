# Barra de pestañas y teclado (correcciones de la regresión E2E)

- **Origen**: la regresión E2E en el emulador Android (392 dp de ancho, letra al 100 %) encontró dos problemas: la etiqueta "Calendario" se parte en dos líneas ("Calendari/o") y el teclado tapa en parte el campo de precio, sin desplazamiento automático.
- **Para quién**: el code-writer (TDD con Jest/RNTL; esta tarea no lleva E2E).
- **Fuentes**: `docs/design-system.md` (3.2, 6.9, 7), ADR-004, `src/app/(tabs)/_layout.tsx`, `src/shared/ui/tab-bar-item.tsx`, los formularios con `TextField` y el código de la barra de pestañas que trae `expo-router` 58 (`node_modules/expo-router/build/react-navigation/bottom-tabs/views/`).
- **Sin dependencias nuevas.** Todo sale de React Native 0.88 y de lo que ya está instalado.

---

## 1. Etiqueta "Calendario" en la barra de pestañas

### 1.1 Causa

Medí los anchos con las métricas reales de Lexend, a 13 pt (`text-xs`):

| Etiqueta | Medium (inactiva) | SemiBold (activa) | SemiBold a 1,3× |
|---|---|---|---|
| Inicio | 37,2 | 38,2 | 49,7 |
| **Calendario** | **70,4** | **71,6** | **93,1** |
| Productos | 64,8 | 65,8 | 85,5 |
| Consejos | 56,9 | 57,7 | 75,1 |
| Ajustes | 46,1 | 46,6 | 60,6 |

Ancho disponible para el texto. Cada pestaña mide `ancho / 5` y el botón interno de React Navigation tiene `padding: 5`, que no se puede cambiar desde `tabBarItemStyle`:

| Pantalla | Ancho por pestaña | Ancho para el texto |
|---|---|---|
| 392 dp | 78,4 | **68,4** |
| 360 dp | 72 | 62 |
| 320 dp | 64 | 54 |

Por eso "Calendario" (70,4 a 71,6) no entra ni siquiera con la letra al 100 % en 392 dp. Hay tres problemas encadenados:

1. **`numberOfLines={2}` corta en medio de la palabra.** "Calendario" es una sola palabra más ancha que la caja, así que Android la parte en cualquier letra ("Calendari/o"). La regla de la tabla 7 ("hasta dos líneas") no sirve con palabras sueltas. En 320 dp pasaría lo mismo con "Productos".
2. **La barra tiene alto fijo.** `BottomTabBar` usa `height: 49 + inset inferior` si `tabBarStyle` no trae `height`. Lo que necesita una pestaña es 5 + 28 (caja del ícono) + 18 (una línea de etiqueta) + 5 = **56**. Entonces ya hoy sobresale 7 dp hacia el área de la barra de gestos, y una segunda línea queda encima de esa área o se corta. Lo que dice 6.9, "la barra crece un poco en alto", **no pasa**.
3. Con letra grande (1,3×), ninguna etiqueta larga entra en 320–360 dp, ni siquiera en una línea.

### 1.2 Opciones consideradas

| Opción | Resultado | Decisión |
|---|---|---|
| Mantener dos líneas y activar la separación en sílabas (`android_hyphenationFrequency`) | "Calen-/dario": se lee peor, la barra igual necesita crecer y solo funciona en Android | No |
| Una línea con `ellipsizeMode` | "Calend…": se pierde información | No |
| Achicar `text-xs` para todos | Rompe la escala tipográfica y no alcanza a 1,3× | No |
| **Una línea que se achica solo si no entra (`adjustsFontSizeToFit`) + recuperar el relleno lateral + barra con alto según la letra** | Nunca se parte ni se corta; en 392 dp y al 100 % no cambia nada visible | **Sí** |
| Cambiar el texto visible (por ejemplo "Días" o "Mes") | Decisión de producto | Pregunta P1 (sección 3) |

### 1.3 Solución

**`TabBarLabel`** (`src/shared/ui/tab-bar-item.tsx`):

- `numberOfLines={1}` (antes 2).
- `adjustsFontSizeToFit`: el texto se achica **solo cuando no entra** en una línea. Funciona en iOS y en Android.
- Se mantiene `maxFontSizeMultiplier={1.3}`.
- Clases: `self-stretch -mx-1 text-center text-xs`, más las de estado activo o inactivo, que no cambian.
  - `self-stretch` le da a la etiqueta todo el ancho de la pestaña. Sin eso, `adjustsFontSizeToFit` no sabe cuánto lugar tiene.
  - `-mx-1` recupera 8 dp del `padding: 5` del botón (queda 1 dp por lado). Las etiquetas vecinas no se tocan, porque el texto va centrado y ninguna llena su caja, salvo cuando se achica.
- No se agrega `minimumFontScale`, que solo existe en iOS: el texto tiene que entrar siempre.

Tamaño que se ve en el peor caso ("Calendario", activa):

| Pantalla | Letra 100 % | Letra 130 % (tope) |
|---|---|---|
| 392 dp (76,4 útil) | 13 pt, sin achicar | ≈ 13,9 pt (crece de 16,9 y se ajusta al ancho) |
| 360 dp (70 útil) | ≈ 12,7 pt | ≈ 12,7 pt |
| 320 dp (62 útil) | ≈ 11,3 pt | ≈ 11,3 pt |

En pantallas angostas, el tamaño que se ve lo pone el ancho y no la letra del sistema. El peor caso es 11,3 pt, que se sigue leyendo. Es una concesión aceptable porque la etiqueta completa se puede leer en otro lado, que es lo que pide la regla de excepciones de 7:

- TalkBack y VoiceOver leen el texto completo.
- En iOS, React Navigation activa el visor de contenido grande al mantener presionada la pestaña (`accessibilityShowsLargeContentViewer`).
- El ícono acompaña siempre a la etiqueta.

**Alto de la barra**, un helper nuevo en `src/shared/ui/tab-bar-item.tsx`, exportado desde `@/shared/ui`:

- La función pura `tabBarHeight(fontScale: number, bottomInset: number): number` devuelve `Math.ceil(5 + 28 + 18 × s + 5) + bottomInset`, con `s = min(max(fontScale, 1), 1.3)`. El resultado va de 56 a 62 más el inset.
  - El TSDoc explica de dónde sale cada número: el relleno y la caja del ícono de `BottomTabItem`/`TabBarIcon` de `expo-router` 58, y el alto de línea de `text-xs`.
  - Los números van en constantes con nombre, no sueltos.
- El hook `useTabBarStyle()` devuelve `{ backgroundColor: surface, borderTopColor: border, height }`. Lee `useWindowDimensions().fontScale` y `useSafeAreaInsets().bottom`.
- `src/app/(tabs)/_layout.tsx` usa `tabBarStyle: useTabBarStyle()` en vez del objeto que arma hoy. No hay otros cambios en el layout: los textos de las pestañas siguen iguales.

### 1.4 Cambios en `docs/design-system.md`

Los aplica el code-writer en la misma tarea:

- **6.9**: el tercer punto pasa a decir: "Las etiquetas son `text-xs`, siempre visibles, en **una línea** y con `accessibilityState={{ selected }}`. Crecen con la letra del sistema hasta 1,3× y, si no entran, se achican para caber (`adjustsFontSizeToFit`). La barra calcula su alto con la letra del sistema (`useTabBarStyle`)."
- **Tabla de excepciones de 7**, fila `TabBarLabel`:
  - **Límite**: "`maxFontSizeMultiplier={1.3}`, una línea, `adjustsFontSizeToFit`".
  - **Por qué**: "Con cinco pestañas, cada una tiene entre 62 y 76 de ancho útil (320–392 dp). 'Calendario' mide 72 a 13 pt: con dos líneas Android partía la palabra ('Calendari/o'). En una línea que se achica, nunca se parte ni se corta. Los lectores de pantalla leen el texto completo, y en iOS lo muestra el visor de contenido grande. Reemplaza la decisión F10.1 M8 (regresión E2E, 2026-11-15)."

### 1.5 Criterios de aceptación (Jest/RNTL)

En `src/shared/ui/tab-bar-item.test.tsx`:

1. `TabBarLabel` tiene `numberOfLines` 1 (reemplaza el test "wraps onto two lines").
2. `TabBarLabel` tiene `adjustsFontSizeToFit` en `true`.
3. `TabBarLabel` sigue con `maxFontSizeMultiplier` 1.3 (el test actual no cambia).
4. `className` de `TabBarLabel` contiene `self-stretch` y `-mx-1`.
5. Los tests de activa e inactiva (peso y color) siguen pasando sin cambios.
6. `tabBarHeight` (proyecto `node`):
   - `tabBarHeight(1, 0)` → 56;
   - `tabBarHeight(0.85, 0)` → 56 (nunca baja del alto de una línea al 100 %);
   - `tabBarHeight(1.3, 0)` → 62;
   - `tabBarHeight(2, 0)` → 62 (tope 1,3×);
   - `tabBarHeight(1, 24)` → 80.
7. `useTabBarStyle` (con `renderHook` dentro de `renderUi`, o con el mismo envoltorio de proveedores):
   - devuelve `height` = `tabBarHeight(fontScale, inset)`, con `useWindowDimensions` simulado en `fontScale` 1,3 y el inset de `TEST_WINDOW_METRICS`;
   - devuelve `backgroundColor` y `borderTopColor` del tema.

Queda para el cierre con E2E o en el teléfono (no en esta tarea): ver "Calendario" en una línea en 320, 360 y 392 dp, con letra al 100 % y al máximo, en claro y en oscuro.

---

## 2. Teclado en los formularios

### 2.1 Causa

- `product-form.tsx` y `sale-form.tsx` usan `KeyboardAvoidingView` con `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`. En Android no hacen nada y confían en `adjustResize`.
- El proyecto tiene `edgeToEdgeEnabled=true` (`android/gradle.properties`), y en Android 15 o superior el modo de borde a borde es obligatorio. En ese modo, **`adjustResize` ya no achica la ventana** de forma confiable: el teclado se dibuja encima del contenido. `softwareKeyboardLayoutMode` de `app.json` no lo arregla, y cambiarlo a `pan` empujaría la pantalla entera, cabecera incluida.
- React Native 0.88 ya incluye el arreglo de `KeyboardAvoidingView` para el modo de borde a borde en Android (facebook/react-native#55855, unido en abril de 2026). Con `behavior="padding"`, el componente calcula cuánto lo tapa el teclado y agrega ese relleno abajo. Si la ventana igual se achicara, la superposición calculada es 0 y no pasa nada, así que es seguro en los dos casos.
- Además, ningún formulario lleva el campo con foco a la parte visible. iOS nunca lo hace con `KeyboardAvoidingView`, y en Android depende de que la ventana se achique, que es justo lo que ya no pasa. El campo de precio está casi al final del formulario y es el que más se tapa.
- El pie fijo (`StyledSafeAreaView edges={['bottom']}`) deja el relleno de la barra de gestos aunque el teclado esté abierto. Con el teclado arriba, ese espacio queda vacío y le quita lugar al formulario.

### 2.2 Opciones consideradas

| Opción | Qué hace | Decisión |
|---|---|---|
| `automaticallyAdjustKeyboardInsets` en el `ScrollView` | Solo iOS. Si se combina con `KeyboardAvoidingView` cuenta el teclado dos veces, y sin él el pie fijo queda tapado | No |
| `softwareKeyboardLayoutMode: "pan"` | Desplaza toda la ventana, y la cabecera con "Volver" se sale de la pantalla | No |
| `react-native-keyboard-controller` (`KeyboardAwareScrollView` + `KeyboardStickyView`) | Lo resuelve muy bien y sigue al teclado cuadro a cuadro, pero suma una dependencia nativa, su licencia y otra cosa que actualizar con cada SDK | **Alternativa** si la opción elegida no alcanza en el teléfono (sección 3, P2) |
| **`KeyboardAvoidingView` con `padding` en las dos plataformas + desplazamiento al campo con foco, propio y compartido** | Resuelve los tres problemas sin dependencias | **Sí** |

### 2.3 Solución: el patrón para toda la app

Hay un solo componente para pantallas con formulario, y todos los campos de texto se suman a él solos.

#### `FormLayout` (nuevo, `src/shared/ui/form-layout.tsx`)

Reemplaza la estructura que hoy repiten los dos formularios (`KeyboardAvoidingView` > `ScrollView` + pie fijo).

Props:

- `children`: el contenido que se desplaza.
- `footer`: lo que va fijo abajo, por ejemplo el total y el botón principal.
- `contentContainerClassName`: el `gap-*`/`px-*`/`pb-*` de cada formulario.
- `overlays?`: los `ConfirmDialog` y las `Sheet`, que van fuera del `ScrollView`.

Estructura:

```
KeyboardAvoidingView  behavior="padding" (las dos plataformas), className="flex-1", testID="form-layout"
├─ ScrollView  keyboardShouldPersistTaps="handled", testID="form-layout-scroll"
│              onLayout / onScroll (scrollEventThrottle={16}) para conocer el alto visible y el desplazamiento
│  └─ FocusedFieldContext.Provider → children
├─ StyledSafeAreaView  edges={teclado abierto ? [] : ['bottom']}, className="px-4 pt-2 pb-4", testID="form-layout-footer"
│  └─ footer
└─ overlays
```

Reglas:

- **El `KeyboardAvoidingView` tiene que empezar arriba de todo en la ventana**, y así es con `Screen`, porque la cabecera nativa está oculta. React Native compara la parte de abajo del componente con el borde superior del teclado. Si algún día `FormLayout` va debajo de una cabecera nativa, hace falta `keyboardVerticalOffset`. El TSDoc lo avisa.
- **Pie con el teclado abierto**: sin relleno de área segura abajo, porque el teclado ya cubre la barra de gestos. Mantiene `pb-4`.

#### Desplazamiento al campo con foco

`FocusedFieldContext` expone `onFieldFocus(target)` y `onFieldBlur(target)`. `target` es la referencia al `View` que envuelve **todo el campo**: etiqueta, caja, error y ayuda. Así, el mensaje de error también queda a la vista.

El campo se hace visible (`ensureVisible`) en dos momentos:

1. **Al recibir el foco**, si el teclado ya está abierto (`Keyboard.isVisible()`).
2. **Cuando el `ScrollView` se achica** (`onLayout` con menos alto que antes) mientras hay un campo con foco. Este es el caso de abrir el teclado: `KeyboardAvoidingView` agrega su relleno, el `ScrollView` pierde alto y recién ahí se sabe cuánto lugar queda. Así no hacen falta temporizadores, y también cubre el teclado que cambia de alto (por ejemplo, cuando aparece la barra de sugerencias).

`ensureVisible`:

- Mide el campo respecto del contenido del `ScrollView`: `target.measureLayout(scrollRef.getInnerViewRef(), …)`, con la medición en una función chica que se pueda simular en los tests.
- Calcula el destino con una función pura `scrollTargetForField({ fieldTop, fieldHeight, scrollY, viewportHeight, margin })`, que devuelve `number | null`:
  - si el campo entero ya se ve (con `margin` arriba y abajo), devuelve `null` y no se mueve nada;
  - si se sale por abajo, devuelve `fieldTop + fieldHeight + margin - viewportHeight`, para que el campo quede justo arriba del pie;
  - si se sale por arriba, o es más alto que lo visible, devuelve `max(fieldTop - margin, 0)`, para alinear el comienzo del campo, que es donde está la etiqueta;
  - `margin` = 16 (`space-4`), en una constante con nombre.
- Llama a `scrollTo({ y, animated: !isReducedMotion })`, con `useReducedMotion` de Reanimated, como en el resto de la app.

Fuera de un `FormLayout` (por ejemplo, dentro de una `Sheet`), el contexto no existe y los campos no hacen nada extra.

#### Campos que se suman solos

- **`TextField`** (`src/shared/ui/text-field.tsx`): envuelve `HeroTextField` en un `View` con `ref` y `collapsable={false}`. En `onFocus` y `onBlur` avisa al contexto, además de lo que ya hace. Así quedan cubiertos `MoneyField`, `FormTextField`, `FormAmountField` y el buscador de la hoja de productos.
- **`QuantityStepper`** (`src/shared/ui/quantity-stepper.tsx`): lo mismo con su `View` exterior (etiqueta + fila), en el `onFocus` y `onBlur` del `TextInput`.
- Cuando `createSubmitHandler` lleva el foco al primer campo con error, ese campo también se hace visible, porque pasa por `onFocus`. Hoy, si ese campo está tapado, la persona no ve el error.

#### Hook `useIsKeyboardVisible` (nuevo, `src/shared/ui/use-is-keyboard-visible.ts`)

- Empieza con `Keyboard.isVisible()`.
- Escucha `keyboardWillShow`/`keyboardWillHide` en iOS y `keyboardDidShow`/`keyboardDidHide` en Android, porque Android no emite los "will".
- Se desuscribe al desmontar (ver la sección de fugas de memoria en `.claude/rules/react-native/`).
- Lo usa el pie de `FormLayout`.

#### Hojas inferiores (`Sheet`, `src/shared/ui/sheet.tsx`)

Dentro de un `Modal`, el teclado también tapa la hoja, que está pegada abajo. Por ejemplo, la hoja de productos tiene el buscador arriba y la lista debajo.

- Envolver el contenido del `Modal` (hoy `View className="flex-1 justify-end"`) en `KeyboardAvoidingView behavior="padding" className="flex-1 justify-end"`, con `testID="sheet-keyboard"`. Así la hoja sube con el teclado, y su `max-h-[90%]` se calcula sobre el alto que queda, de modo que el título y "Cerrar" nunca se salen por arriba.
- Con el teclado abierto, el `StyledSafeAreaView` de la hoja también deja de reservar el borde inferior (`useIsKeyboardVisible`).
- La lista de productos (`FlatList className="max-h-96"` en `product-picker.tsx`) suma `shrink`, para que se achique antes que el buscador cuando falta lugar.

### 2.4 Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/shared/ui/form-layout.tsx` + test | Nuevo: `FormLayout`, `FocusedFieldContext`, `scrollTargetForField` |
| `src/shared/ui/use-is-keyboard-visible.ts` + test | Nuevo |
| `src/shared/ui/text-field.tsx` + test | `View` con `ref`; avisa foco y salida al contexto |
| `src/shared/ui/quantity-stepper.tsx` + test | Lo mismo |
| `src/shared/ui/sheet.tsx` + test | `KeyboardAvoidingView` y borde inferior según el teclado |
| `src/shared/ui/index.ts` | Exporta `FormLayout`, `useIsKeyboardVisible`, `tabBarHeight` y `useTabBarStyle` |
| `src/features/products/components/product-form.tsx` | Usa `FormLayout` (contenido, pie "Guardar", diálogos en `overlays`); quita `KeyboardAvoidingView`, `Platform` y `ScrollView` |
| `src/features/sales/components/sale-form.tsx` | Usa `FormLayout` (pie con total + "Guardar venta"; hojas y diálogos en `overlays`) |
| `src/features/sales/components/product-picker.tsx` | `shrink` en la `FlatList` |
| `docs/design/products.md` (3.5, "Teclado y botón fijo") y `docs/design/sales.md` (pie fijo) | Reemplazar "en Android con el `adjustResize` por defecto" por "con `FormLayout` (ver `docs/design/tab-bar-and-keyboard.md`)" |
| `docs/design-system.md` 6.10 | Agregar el punto "**Formularios con teclado** (`FormLayout`): toda pantalla con campos de texto usa `FormLayout`; los campos se hacen visibles solos al recibir el foco" |

No cambian `app.json` (`softwareKeyboardLayoutMode` se queda en el valor por defecto, `resize`), la lógica de los formularios, la validación ni el orden de los campos.

### 2.5 Criterios de aceptación (Jest/RNTL)

Para simular el teclado: `jest.spyOn(Keyboard, 'addListener')`, guardando las funciones registradas para llamarlas, y `jest.spyOn(Keyboard, 'isVisible')`. Las mediciones van con la función de medición simulada, o con `jest.spyOn` sobre `measureLayout` de la instancia.

**`scrollTargetForField`** (proyecto `node`), con `viewportHeight` 400 y `margin` 16:

1. Campo en 100–160 con `scrollY` 0 → `null`.
2. Campo en 380–440 con `scrollY` 0 → 56 (440 + 16 − 400).
3. Campo en 50–110 con `scrollY` 200 → 34 (50 − 16).
4. Campo de 500 de alto que empieza en 600 → 584 (alinea el comienzo).
5. Campo en 8–40 con `scrollY` 100 → 0 (nunca negativo).

**`FormLayout`**:

6. El `KeyboardAvoidingView` (`form-layout`) tiene `behavior` `'padding'` con `Platform.OS` en `'android'` y en `'ios'`.
7. El `ScrollView` (`form-layout-scroll`) tiene `keyboardShouldPersistTaps` `'handled'`.
8. El pie tiene `edges` `['bottom']` con el teclado cerrado y `[]` después de emitir el evento de teclado visible. Vuelve a `['bottom']` al emitir el de oculto.
9. Con un `TextField` dentro, el teclado ya visible y la medición simulada fuera de la vista, enfocar el campo (`fireEvent(input, 'focus')`) llama a `scrollTo` con el `y` que da `scrollTargetForField` y `animated: true`.
10. Con el teclado cerrado, enfocar el campo **no** desplaza. Al emitir `layout` en el `ScrollView` con un alto menor que el anterior, desplaza al campo con foco.
11. Si el campo ya se ve, no llama a `scrollTo`.
12. Después de `blur`, un `layout` más chico no desplaza.
13. Con "reducir movimiento" activo (`useReducedMotion` simulado en `true`), `scrollTo` recibe `animated: false`.
14. `footer` y `overlays` se dibujan fuera del `ScrollView` (no son descendientes de `form-layout-scroll`).

**`TextField` y `QuantityStepper`**:

15. Fuera de un `FormLayout`, enfocar y salir funciona igual que hoy, sin errores, y se sigue llamando al `onFocus`/`onBlur` del que lo usa (los tests actuales no cambian).
16. Dentro de un `FormLayout`, el foco del `TextInput` de `QuantityStepper` provoca el mismo desplazamiento del criterio 9.

**`useIsKeyboardVisible`**:

17. Empieza con el valor de `Keyboard.isVisible()`.
18. En iOS cambia con `keyboardWillShow`/`keyboardWillHide`; en Android con `keyboardDidShow`/`keyboardDidHide`.
19. Al desmontar llama a `remove()` en cada suscripción.

**`Sheet`**:

20. Dentro del `Modal` hay un `KeyboardAvoidingView` (`sheet-keyboard`) con `behavior` `'padding'`.
21. Los tests actuales de la hoja (título, cerrar, scroll con `keyboardShouldPersistTaps`) siguen pasando.

**Formularios**:

22. `ProductForm` y `SaleForm` se dibujan dentro de `FormLayout` (existe `form-layout`), y ninguno importa `KeyboardAvoidingView` directamente. Basta con un test de cada formulario que busque el `testID`. La segunda parte la puede cubrir la revisión.
23. Los tests de comportamiento actuales de `ProductForm` y `SaleForm` siguen pasando: guardar, "Salir sin guardar", foco en el primer error.
24. En `SaleForm`, el total y "Guardar venta" están en el pie (dentro de `form-layout-footer`).

Queda para el cierre con E2E o en el teléfono (no en esta tarea): en el emulador o el teléfono Android, enfocar "¿A cuánto lo vendes?" y el precio "a convenir" de una venta, y comprobar que el campo, su error y el botón fijo se ven enteros sobre el teclado, con la letra al 100 % y al máximo.

---

## 3. Preguntas para el usuario (producto)

- **P1. ¿Se mantiene el texto "Calendario" en la pestaña?** Recomiendo **sí**. Es la palabra que mejor explica qué hay ahí, coincide con el ícono y con la solución de la sección 1 entra siempre en una línea. Solo se achica un poco en teléfonos angostos con letra grande. Si se prefiere un texto más corto, "Días" o "Mes" caben siempre sin achicarse, pero dicen menos.
- **P2 (la decide el orquestador, no es de producto). ¿Se acepta `react-native-keyboard-controller` si la solución propia no alcanza en el teléfono?** Recomiendo no agregarla ahora: la solución de la sección 2 resuelve el problema sin dependencias. Si en la prueba en el teléfono el salto del pie al abrir el teclado molesta, porque `KeyboardAvoidingView` no sigue la animación del teclado cuadro a cuadro, esa librería es la alternativa justificada. En ese caso va un ADR, se regeneran las licencias y `FormLayout` cambia por dentro sin tocar los formularios.
