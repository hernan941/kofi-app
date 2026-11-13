# cuantovendi

App móvil con Expo (React Native) + TypeScript. Las decisiones técnicas están en `docs/architecture/` (ADRs): leerlas antes de trabajar.

## Reglas

- **Git**: nunca hacer commit ni push salvo que el usuario lo pida explícitamente. Los commits y PRs van **sin coautor ni líneas de atribución**. Los subagentes no tocan el estado de git.
- **Decisiones**: el tiempo de desarrollo no es un criterio. Se decide por calidad, mantenibilidad, corrección, seguridad y UX.
- **ADRs**: toda decisión técnica nueva se registra como ADR en `docs/architecture/` y se agrega al índice. Este archivo se mantiene mínimo: solo reglas de trabajo y punteros.
- **TDD** obligatorio; los tests E2E/pesados se hacen al cierre de cada feature (ver ADR-002).
- **Comentarios**: solo docstrings TSDoc, nunca inline (ver ADR-003).
- **Idioma**: conversación, docs y commits en español; código en inglés; textos de UI en español.

## Orquestación

- La sesión principal es el orquestador: define cada feature con el usuario, delega en los subagentes de `.claude/agents/` y **se mantiene siempre disponible** (trabajo largo en segundo plano).
- Flujo por feature: usuario + orquestador (criterios de aceptación) → `architect` → `designer` (si hay UI) → `code-writer` (TDD) → `reviewer` → E2E → aprobación del usuario.
- Lo que no esté claro a nivel de producto se le pregunta al usuario, no se inventa.

## Comandos

- `npx expo install <paquete>`: instalar dependencias (versiones compatibles con el SDK).
- `npm start`: servidor de desarrollo (genera `src/uniwind-types.d.ts`).
- `npm test`: Jest (proyectos `node` y `ui`); `npm run test:node`, `npm run test:ui`, `npm run test:watch`.
- `npm run test:tz`: tests de fechas en las tres zonas horarias de ADR-015.
- `npm run typecheck`: `tsc --noEmit`.
- `npm run lint`: ESLint (`expo lint`).
- `npm run format` / `npm run format:check`: Prettier.
- `npm run doctor`: `expo-doctor` + `expo install --check`.
- `npm run db:generate`: migraciones de Drizzle.
- `npm run android` / `npm run android:release` / `npm run e2e:build` / `npm run e2e:android`: builds locales y Maestro (requieren Android SDK).
- Verificación de cada tarea (V-BASE): `typecheck`, `lint`, `format:check` y `test` en verde.
- Tests fuera de `src/app/` (todo archivo en `src/app/` es una ruta de Expo Router).
