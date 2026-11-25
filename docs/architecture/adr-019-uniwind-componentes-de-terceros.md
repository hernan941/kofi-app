# ADR-019: `className` en componentes de terceros (`withUniwind`) y `StyledSafeAreaView`

- **Estado**: Aceptado (F10.5, 2026-11-15)
- **Relacionados**: ADR-004 (HeroUI Native + Uniwind), ADR-005 (`shared/ui`), ADR-013 (límites por lint), ADR-020 (otro hallazgo de la misma regresión).
- **Versiones**: `uniwind` ^1.13.2, `react-native-safe-area-context` ~5.11.1, `heroui-native` ^1.0.11, React Native 0.88.1.

## Contexto
En la regresión E2E en el emulador (F10.5), varias pantallas de Android se veían en blanco o reducidas a su encabezado. La causa: Uniwind solo aplica `className` por su cuenta a los componentes core de React Native (y HeroUI Native, que está hecho para Uniwind). `SafeAreaView` de `react-native-safe-area-context` recibía `className="flex-1 bg-background"` y lo ignoraba, así que el contenedor no se expandía.

Ni TypeScript ni Jest lo detectaron. Las props de `SafeAreaView` extienden `ViewProps`, que Uniwind amplía con `className`, así que el código compila. En Jest, además, un test de RNTL no mide el layout.

El arreglo ya está en el código: `src/shared/ui/styled-safe-area-view.tsx` exporta `StyledSafeAreaView = withUniwind(SafeAreaView)`, y todas las pantallas lo usan. Lo mismo pasaba con `Image` de `expo-image`, que `src/features/products/components/product-photo.tsx` envuelve con `withUniwind`.

## Opciones consideradas
1. **Dejarlo como convención y que lo revise el reviewer.** Es el mismo error que ya pasó y que no se ve hasta correr en el dispositivo.
2. **`style` en lugar de `className` en los componentes de terceros.** Rompe ADR-004, porque los colores y espaciados salen de los tokens del tema a través de las clases.
3. **Envolver con `withUniwind` y prohibir por lint el import directo del componente sin envolver.** La regla usa la `@typescript-eslint/no-restricted-imports` que ya existe. **Elegida.**
4. **Una regla local con tipos que detecte `className` en cualquier componente que no sea core ni de HeroUI.** Cubriría todos los casos, pero necesita saber qué componentes envolvió Uniwind, y eso no se ve en los tipos. Hoy son dos casos conocidos: no se justifica (YAGNI).

## Decisión
1. **Regla general**: todo componente de terceros (fuera de React Native core y de HeroUI Native) que reciba `className` se envuelve con `withUniwind`. Si el componente sin envolver aparece en más de una feature, el envoltorio va en `src/shared/ui/` con el nombre `Styled<Componente>`. Si solo lo usa un componente, el envoltorio puede quedar en ese archivo (como `StyledImage` en `product-photo.tsx`).
2. **`SafeAreaView`**: siempre `StyledSafeAreaView` de `@/shared/ui`. Esto incluye el `SafeAreaView` de `react-native`, que además está deprecado en RN 0.88. `SafeAreaProvider`, `useSafeAreaInsets` y el resto de `react-native-safe-area-context` se siguen importando normalmente.
3. **Regla de lint** (la implementa el code-writer). Va en `tools/eslint/layer-boundaries.js`, porque `@typescript-eslint/no-restricted-imports` se reemplaza por bloque y una regla aparte borraría la lista de cada capa (ver ADR-013, enmienda F10.4):
   - Una constante `UNSTYLED_COMPONENT_PATTERNS` con dos patrones: `{ group: ['react-native-safe-area-context'], importNames: ['SafeAreaView'], message }` y `{ group: ['react-native'], importNames: ['SafeAreaView'], message }`. El mensaje es: `Usa StyledSafeAreaView de @/shared/ui (ADR-019): Uniwind ignora className en SafeAreaView sin withUniwind.`
   - `restrictedImports` la agrega siempre, salvo que reciba la opción nueva `allowSafeAreaView: true`.
   - Un bloque nuevo, ubicado después del de `src/shared/ui/**`, para `src/shared/ui/styled-safe-area-view.tsx` y `src/shared/ui/styled-safe-area-view.test.tsx`, con las mismas categorías que `shared/ui` (`packages: PERSISTENCE_PACKAGES`, `allowIcons: true`) más `allowSafeAreaView: true`.
   - ESLint también reporta `import * as X from 'react-native-safe-area-context'` cuando el patrón tiene `importNames`, y así se cubre el acceso `X.SafeAreaView`.
   - Por la misma razón, la regla también prohíbe `import * as X from 'react-native'` en `src/`: con `importNames` ESLint reporta cualquier importación de espacio de nombres del paquete, no solo el acceso a `SafeAreaView`. En `src/` se importa por nombre (`import { View } from 'react-native'`). Un fixture lo fija.
4. Cuando aparezca otro componente de terceros que necesite envoltorio y se use en varias features, se suma a `UNSTYLED_COMPONENT_PATTERNS` junto con su envoltorio en `shared/ui`.

## Consecuencias
- El error de F10.5 no puede volver a entrar por `SafeAreaView`: el lint falla en lugar de la pantalla.
- Para otros componentes de terceros la protección sigue siendo la convención más el E2E en el emulador. Por eso conviene correr V-E2E-A al cerrar cualquier feature que sume uno.
- Un test de la configuración de lint (`tools/eslint/layer-boundaries.test.js`) fija el comportamiento: casos que fallan y casos permitidos.
