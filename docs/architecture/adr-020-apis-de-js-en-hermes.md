# ADR-020: Solo APIs de JavaScript disponibles en Hermes

- **Estado**: Aceptado (F10.5, 2026-11-15)
- **Relacionados**: ADR-001 (Expo + TypeScript), ADR-013 (ESLint, Jest en Node), ADR-016 (Hermes, como en la plantilla), ADR-010 y ADR-015 (el mismo criterio con `Intl`: un test verde en Node no garantiza el resultado en Hermes), ADR-019.
- **Versiones**: React Native 0.88.1 con Hermes (`hermesEnabled=true`; `hermes-compiler` 260318099.0.5). TypeScript con `lib: ["DOM", "ESNext"]` y `target: "ESNext"`, heredados de `expo/tsconfig.base`.

## Contexto
En la regresión E2E en el emulador (F10.5), una pantalla falló porque `Array.prototype.toSorted` no existe. Se trata como ausente toda la familia de ES2023 que copia el array: `toSorted`, `toReversed`, `toSpliced` y `with` (el mismo hueco se reporta en otros proyectos de React Native con versiones de Hermes anteriores a esos cambios).

No lo detecta nada antes del dispositivo:
- **TypeScript**: `lib: ESNext` declara esos métodos.
- **Jest**: corre en Node, donde sí existen (ADR-013).

## Opciones consideradas
1. **Convención y revisión.** Ya falló una vez.
2. **Bajar `lib` de `tsconfig.json` a `ES2022`.** Lo detectaría el typecheck. Pero el soporte de Hermes no coincide con ningún año del estándar: tiene partes de ES2023 y le faltan otras. Bloquearía APIs que sí funcionan y dejaría pasar otras que no. Además se aparta de la base de Expo y cambia los tipos de los tests y de las herramientas, que corren en Node.
3. **Quitar los métodos de `Array.prototype` en el setup de Jest**, para que los tests fallen como en Hermes. Atrapa también los usos indirectos, pero cambia el entorno de las dependencias de terceros que corren en los tests (`jest-expo`, Drizzle, Zod), y no hay evidencia de que haga falta.
4. **`no-restricted-properties` en ESLint** para esos nombres de método en el código de la app. Es la regla que ya existe en `eslint.config.js` para la red (ADR-013), sin dependencias nuevas. Es sintáctica: reporta el nombre sobre cualquier objeto, no solo sobre arrays. **Elegida.**

## Decisión
1. **En lugar de los métodos que copian se usa el método mutable sobre una copia**: `[...items].sort(compare)`, `[...items].reverse()`, una copia con `splice`, y asignación por índice sobre una copia en lugar de `with`. Se sigue sin mutar estado de React ni datos recibidos.
2. **Regla de lint** (la implementa el code-writer), en `eslint.config.js`:
   - Constantes `HERMES_MISSING_METHODS = ['toSorted', 'toReversed', 'toSpliced', 'with']` y `HERMES_MESSAGE = 'Hermes no implementa este método (ADR-020): usa la versión mutable sobre una copia, por ejemplo [...items].sort(compare).'`.
   - En el bloque `files: ['src/**/*.{ts,tsx}']`, se agregan a `no-restricted-properties` las entradas `...HERMES_MISSING_METHODS.map((property) => ({ property, message: HERMES_MESSAGE }))`, sin `object`, junto a las de red que ya existen. Las entradas son sin `object` porque el array puede tener cualquier nombre.
   - Quedan como ahora: los archivos de test (`TEST_FILES` apaga `no-restricted-properties`, porque corren en Node) y `tools/`, `plugins/` y la configuración de Jest, que corren en Node.
   - `with` es el único nombre que puede chocar con otra API (por ejemplo, `db.with(...)` de Drizzle para CTE). Hoy no se usa en `src/`. Si algún día hace falta, se usa `// eslint-disable-next-line no-restricted-properties -- <motivo>` (las directivas están permitidas por ADR-003).
3. **APIs más nuevas que ES2022 sin verificar** (`Object.groupBy`, `Map.groupBy`, `Promise.withResolvers`, los métodos nuevos de `Set`, `Array.fromAsync`, `Array.prototype.findLast`, entre otros): no se prohíben por adelantado, porque no hay evidencia sobre este Hermes. Antes de usar una que el código todavía no use, se comprueba en el build `e2e` en el emulador. Si falta, se agrega a la regla con un fixture. Los nombres genéricos (`union`, `intersection`) no se pueden prohibir por nombre sin falsos positivos con Zod y Drizzle. Para esos se prefiere no usarlos en arrays ni en `Set` sin verificación previa.

## Consecuencias
- El caso de F10.5 no puede volver a entrar: el lint falla antes que el teléfono.
- La regla no ve los accesos dinámicos (`items[name]()`) ni el código de las dependencias. Para eso queda el E2E en el emulador, que corre el bundle real de Hermes.
- Si una actualización del SDK trae un Hermes con esos métodos, se puede quitar la regla con un ADR que reemplace a este, después de verificarlo en el build `e2e`.
- Fixtures en `tools/eslint/layer-boundaries.test.js`: un caso que falla por cada uno de los cuatro nombres en `src/`, un caso permitido de `[...items].sort()` y uno permitido de `toSorted` en un archivo `*.test.ts`.
