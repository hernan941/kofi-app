# ADR-013: Tooling de calidad (lint, formato, tests, typecheck, React Compiler)

- **Estado**: Aceptado
- **Fecha**: 2026-11-12 (revisado 2026-11-13 tras la revisión del reviewer y con los datos del boilerplate instalado)
- **Instalado en el boilerplate**: TypeScript 6.0.3 (con `types: ["jest"]` en `tsconfig.json`, porque TS 6 trae `types` vacío por defecto), ESLint 9.39.5, `eslint-config-expo` 58.0.4 (flat; trae `eslint-plugin-import` 2.32.0 y `eslint-import-resolver-typescript` 3.10.1), `eslint-plugin-jsdoc` 63.3.3, `eslint-config-prettier` 10.1.8, Prettier 3.10.1, Jest 30.5.2, `jest-expo` 58.0.14, RNTL 14.1.0 con `test-renderer` 1.3.1. Los tests existentes están en `src/__tests__/`.
- **Versiones verificadas (npm y docs oficiales, 2026-11-12)**:
  - TypeScript ~6.0.3 (lo fija la plantilla de SDK 58; `typescript-eslint` 8.72.2 soporta `>=4.8.4 <6.1.0`, así que TypeScript 7.0.2 **no** es compatible todavía).
  - `eslint-config-expo` 58.0.4 (incluye `eslint-plugin-react-hooks` 7, `eslint-plugin-import`, `@typescript-eslint` 8 y, desde SDK 55, las reglas del React Compiler), `typescript-eslint` 8.72.2, `eslint-plugin-jsdoc` 65.4.5, `eslint-plugin-testing-library` 7.16.2, `eslint-config-prettier` 10.1.8.
  - Prettier 3.10.1, `prettier-plugin-tailwindcss` 0.8.1.
  - `jest-expo` ~58.0.14 (Jest 29 o 30; incluye los presets `jest-expo`, `jest-expo/ios`, `jest-expo/android` y `jest-expo/node`), `@testing-library/react-native` 14.1.0 (peer `test-renderer` ^1), `better-sqlite3` 13.1.1 (solo dev).
  - Maestro CLI 2.12.1 (2026-11-02).
  - `babel-plugin-react-compiler` 1.0.0 estable. La plantilla de SDK 58 trae `experiments.reactCompiler: true` y `typedRoutes: true`.

## Contexto
ADR-002 exige TDD con Jest + RNTL, Maestro al cierre y `tsc --noEmit` limpio. ADR-003 prohíbe los comentarios inline y pide hacerlo cumplir con ESLint en lo posible. ADR-005 define límites entre capas que deberían fallar en el linter y no depender solo del reviewer.

## Opciones consideradas
- **Límites de capas**: `eslint-plugin-boundaries` (7.4.3, expresivo pero es otro plugin y otra configuración) frente a `import/no-restricted-paths` + `no-restricted-imports`, que ya vienen con `eslint-config-expo`. Alcanza para las reglas de ADR-005, así que se usa lo incluido (YAGNI).
- **Comentarios (ADR-003)**: las reglas estándar (`no-inline-comments`, `line-comment-position`) no detectan `//` sueltos dentro de funciones. Las alternativas son aceptar ese hueco (lo que dice ADR-003 hoy) o escribir **una regla local** de unas pocas líneas, con test, que reporte todo comentario que no sea un docstring `/** */` o una directiva (`eslint-disable`, `@ts-expect-error`).
- **Lint con información de tipos** (`typescript-eslint` *type-checked*) o sin ella. Con tipos detecta promesas no esperadas (críticas con escrituras asíncronas a la base), `switch` no exhaustivos y usos inseguros de `any`.
- **React Compiler**: activado (la plantilla lo trae así y las reglas del proyecto lo contemplan) o desactivado, con memoización manual.
- **Tests de repositorios**: emulador o dispositivo frente a `better-sqlite3` en Node (ADR-006).
- **Ganchos de git** (husky y lint-staged): ver decisiones abiertas.

## Decisión

### TypeScript
`tsconfig.json` extiende `expo/tsconfig.base` con:
- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `noImplicitReturns: true`, `useUnknownInCatchVariables: true` (incluida en `strict`).
- `paths`: `@/*` → `./src/*` y `@/assets/*` → `./assets/*`, como en la plantilla.
- `types: ["jest"]`, como en el boilerplate.

`exactOptionalPropertyTypes` **no** se activa: genera fricción con los tipos de RN, HeroUI y Drizzle sin un beneficio proporcional en este dominio. Las ausencias se modelan con `| null` explícito (ADR-007).

La versión de TypeScript es la que fija `npx expo install`. TypeScript 7 se adopta cuando lo adopten la plantilla de Expo y `typescript-eslint`.

### ESLint (flat config, `npx expo lint`)
`eslint.config.js` compone:
1. `eslint-config-expo/flat`, que ya trae React, hooks, import y React Compiler.
2. `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked` con `parserOptions.projectService: true`. Reglas destacadas: `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`, `consistent-type-imports` y `no-explicit-any`, que exige una justificación con `eslint-disable` documentado.
3. **Comentarios (ADR-003)**:
   - `no-inline-comments: error` y `line-comment-position: ['error', 'above']`.
   - Regla local `local/docstring-only-comments` (en `tools/eslint/`, con tests de `RuleTester`): reporta cualquier comentario que no sea `/** ... */` ni directiva. Cierra el hueco que ADR-003 deja al reviewer, sin cambiar la decisión de ADR-003.
   - `eslint-plugin-jsdoc` (`flat/recommended-typescript-error`) con `jsdoc/require-jsdoc` en `publicOnly` para funciones, clases, interfaces, alias de tipos y constantes exportadas. Además `jsdoc/no-types`, `jsdoc/check-tag-names` y `jsdoc/require-param` / `jsdoc/require-returns` en modo no estricto (solo cuando aportan, como dice ADR-003).
4. **Límites de capas (ADR-005)** con `import/no-restricted-paths` (zonas por carpeta) y `no-restricted-imports`. Para que `import/no-restricted-paths` resuelva el alias `@/`, se configura `settings['import/resolver'] = { typescript: { project: './tsconfig.json' } }` (el resolver ya está instalado). Un test de la configuración de lint comprueba que una importación prohibida escrita con `@/` sí se reporta.
   - Prohibidos `react`, `react-native`, `expo-*`, `drizzle-orm` y `@/core/**` en `**/domain/**` y `shared/domain/**`.
   - Prohibidos `drizzle-orm`, `expo-sqlite` y `**/data/drizzle-*` fuera de `core/` y `features/*/data/`.
   - Prohibido importar `@/features/*/*` salvo `@/features/*/domain`.
   - Prohibido usar `@/features/<f>` desde dentro de la misma feature (ahí se usan imports relativos).
   - Prohibido importar módulos `expo-*` en `features/*/data/`; van en `features/*/adapters/`.
   - Prohibido importar `@/core/dependencies` fuera de `src/app/_layout.tsx`.
   - **Solo rutas en `src/app/`**: una regla local (`local/routes-only-in-app`, en `tools/eslint/`) reporta cualquier archivo de `src/app/` que no exporte por defecto un componente de ruta o layout (`_layout`, `+not-found`, `+native-intent`), y cualquier `*.test.*` dentro de `src/app/`.
5. `no-console: error` (solo el `logger` de `shared/lib` puede usarlo, con excepción por archivo).
6. Archivos de test: `eslint-plugin-testing-library` (`flat/react`) y `jest` como globales.
7. `eslint-config-prettier` al final, para desactivar reglas de estilo que choquen con Prettier.

### Prettier
- `.prettierrc` mínimo: `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`.
- `prettier-plugin-tailwindcss` con `tailwindStylesheet` apuntando al CSS de Uniwind, para ordenar las clases de forma estable (menos ruido en los diffs). Su adopción depende de que el designer confirme el archivo de tokens (ADR-004).

### Jest
Un `jest.config.js` con **dos proyectos**:
- **`node`** (`preset: 'jest-expo/node'`, `testEnvironment: 'node'`): `**/domain/**`, `shared/domain/**`, `**/use-cases/**`, `**/data/**` (repositorios sobre `better-sqlite3` en memoria con las migraciones reales) y `tools/eslint/**`. Es rápido y no carga React Native: como el mapper de `jest-expo/node` queda tapado por uno anterior, el proyecto mapea `^react-native($|/.*)` a un stub que lanza (enmienda 2026-11-13, F0.5/F0.16). **No incluye adaptadores de `expo-*`**: `jest-expo/node` resuelve las variantes `.web` de los módulos, así que esos tests no reflejarían iOS ni Android.
- **`ui`** (`preset: 'jest-expo'`): `**/hooks/**`, `**/components/**`, `**/screens/**`, `**/adapters/**`, `shared/ui/**` y `src/__tests__/**`. Usa RNTL 14 con sus matchers incluidos.
- **Zona horaria fija**: un `globalSetup` fija `process.env.TZ = 'America/Santiago'` para todos los proyectos. Los tests de calendario (ADR-015) se corren además con `Pacific/Easter` y `America/Punta_Arenas` mediante el script `test:tz`, que ejecuta el subconjunto `**/calendar/**` con `TZ=<zona> jest --selectProjects node` por cada zona.
- **Node ≥22**, porque lo exige `better-sqlite3` 13. Se declara en `engines` y en `.nvmrc`.

Configuración común:
- `setupFilesAfterEnv` con helpers de test (`renderWithProviders`, que monta `QueryClientProvider` con un cliente nuevo y `DependenciesProvider` con dobles).
- `clearMocks: true` y `restoreMocks: true`.
- Los módulos `expo-*` no se mockean globalmente. Se reemplazan los **puertos** (`NotificationScheduler`, `PhotoStorage`, `ArchiveIo`, `Clock`, `IdGenerator`). Solo los adaptadores tienen tests con `jest.mock` del módulo de Expo.
- Sin umbral de cobertura (ADR-002). La cobertura se reporta como referencia.

### Maestro (E2E al cierre de cada feature)
- Flujos en `e2e/maestro/<feature>/*.yaml` que seleccionan por texto y etiqueta accesible, y `testID` solo cuando no hay alternativa.
- **v1: todo local, sin servicios externos.** Los E2E corren en un emulador Android local en Linux, contra un **build de release generado localmente** con `EXPO_PUBLIC_E2E=1 npx expo run:android --variant release`, sin EAS.
- **Semillas de datos**: solo cuando `EXPO_PUBLIC_E2E === '1'`, una ruta oculta `cuantovendi://e2e/seed?fixture=<nombre>` **restaura un respaldo fixture** incluido en el bundle, por el camino real de restauración (ADR-012). Así también se prueba la restauración. La condición se reemplaza en tiempo de compilación, y el código y los fixtures desaparecen del build normal. Una prueba de humo verifica que en un build sin la variable la ruta no exista.
- El estado inicial se controla con `clearState` + semilla.
- **Futuro, fuera de la v1 (para cuando haya un release)**: perfiles de `eas.json` (`development`, `preview`, `e2e` y `production`), E2E de iOS con Maestro en EAS Workflows o en un Mac, quitar la plataforma web e identificadores de app. Todo eso va en ADR-016 (pendiente). En la v1, iOS se verifica a mano cuando haya un dispositivo o un Mac disponible.

### React Compiler
**Activado** (`experiments.reactCompiler: true`, el valor de la plantilla). Consecuencias:
- No se agregan `React.memo`, `useMemo` ni `useCallback` a mano salvo que una medición lo justifique (regla de rendimiento del proyecto).
- Las reglas del compilador vienen en `eslint-config-expo` y se tratan como `error`.
- Con React Hook Form se usa `useWatch` y `useFormState` en lugar de `watch()` (ADR-009).
- Si una librería de terceros resulta incompatible, se excluye el componente con la directiva `'use no memo'` documentada en su docstring, nunca desactivando el compilador entero.

### Scripts (`package.json`)
`typecheck` (`tsc --noEmit`), `lint` (`expo lint`), `format` / `format:check`, `test`, `test:watch`, `test:node`, `test:ui`, `doctor` (`expo-doctor` + `expo install --check`), `test:tz`, `e2e:build` (build local de release con `EXPO_PUBLIC_E2E=1`), `e2e:android` (`maestro test e2e/maestro`), `db:generate` (`drizzle-kit generate`). Los comandos se agregan a la sección "Comandos" de `CLAUDE.md` al crear el proyecto.

## Consecuencias
- ADR-003 y ADR-005 se cumplen en el linter, y el reviewer se concentra en el diseño.
- El lint con tipos es más lento que el sintáctico. Se acepta: el tiempo no es criterio y las promesas no esperadas son una clase de bug real con escrituras asíncronas.
- La regla local de comentarios es código propio que hay que mantener; es chica y tiene tests.
- TypeScript queda atado a la versión que soporta `typescript-eslint`. Al actualizar el SDK se revisan ambas.
- En la v1 no hay E2E de iOS automatizados. Se agregan con ADR-016 cuando haya un release.

## Enmienda 2026-11-14 (F9.0)
Regla `no-restricted-globals` para `fetch`, `XMLHttpRequest` y `WebSocket` en `src/**`, que protege la nota de privacidad (la app no envía datos a internet, D-23). Scripts `licenses:generate` y `licenses:check` (ADR-018).

## Enmienda 2026-11-14 (F10.0)
Marcas de rendimiento internas (`performance.mark`, `rnStartupTiming`, `performance.memory`) solo en el build `e2e`, leídas por la ruta oculta `cuantovendi://e2e/perf`, con el mismo patrón de eliminación del bundle release que el resto del código E2E. Ver `docs/architecture/performance-budgets.md`.

## Enmienda 2026-11-14 (F9.2)
La regla de red de `src/**` (fuera de los tests) se endurece: además de `no-restricted-globals`, `no-restricted-properties` prohíbe `fetch`, `XMLHttpRequest` y `WebSocket` como propiedad de `globalThis`, `global`, `window` y `self`, y `Linking.openURL`; `no-restricted-syntax` prohíbe el acceso con corchetes, la desestructuración y el alias de esos objetos, los literales `http(s)://` y `ws(s)://` y el identificador `openURL`. `Linking.openSettings` sigue permitido. Se agrega `import/no-extraneous-dependencies` con `devDependencies: false` para el código de la app (los tests y los directorios `testing/` quedan fuera). El generador de licencias (ADR-018) ahora falla con expresiones SPDX mal formadas y con excepciones obsoletas.

## Enmienda 2026-11-14 (F10.4)
La regla de red de `src/**` suma, en `@typescript-eslint/no-restricted-imports` (dentro de `tools/eslint/layer-boundaries.js`, para todas las capas porque esa regla se reemplaza por bloque): `expo/fetch`, `expo-network`, `expo-web-browser`, `expo-file-system/legacy` y los nombres `UploadTask` y `DownloadTask` de `expo-file-system`. `no-restricted-properties` prohíbe `File.downloadFileAsync`, y `no-restricted-syntax` los métodos de instancia `upload`, `createUploadTask` y `createDownloadTask` (no se pueden distinguir por tipo). Cada caso tiene su fixture en `tools/eslint/layer-boundaries.test.js`. Los tests de los plugins de `plugins/` corren en el proyecto `node` de Jest.

## Enmienda 2026-11-15 (F10.5)
1. **Reglas de lint nuevas** por hallazgos de la regresión E2E, que ni el typecheck ni Jest detectaban:
   - Import directo de `SafeAreaView` (de `react-native-safe-area-context` o de `react-native`) prohibido fuera de `src/shared/ui/styled-safe-area-view.tsx` y su test, en `tools/eslint/layer-boundaries.js` ([ADR-019](adr-019-uniwind-componentes-de-terceros.md)).
   - `toSorted`, `toReversed`, `toSpliced` y `with` prohibidos con `no-restricted-properties` en `src/**` fuera de los tests ([ADR-020](adr-020-apis-de-js-en-hermes.md)).
2. **Entorno de Maestro** (el detalle operativo está en [`e2e/maestro/README.md`](../../e2e/maestro/README.md), sección "Entorno de ejecución y trampas conocidas"):
   - El emulador de referencia es el AVD `cuantovendi_api34` (Android 14, x86_64), que puede correr sin ventana.
   - Antes de correr la suite, las animaciones del sistema van en 0 (`window_animation_scale`, `transition_animation_scale` y `animator_duration_scale`).
   - Maestro concede todos los permisos al lanzar la app. Para que aparezca la pantalla explicativa de avisos, el subflujo compartido `e2e/maestro/_shared/launch-clean.yaml` (y todo flujo de notificaciones que lance la app por su cuenta) declara `permissions: { notifications: unset }` en `launchApp`.
   - `release-has-no-e2e.yaml` se corre aparte, solo contra un build `release` limpio ([ADR-016](adr-016-plataformas-y-builds-locales.md), enmienda 2026-11-15). En el build `e2e` falla por diseño.
