# ADR-018: Licencias de terceros generadas desde el bundle real

- **Estado**: Aceptado (F9.0, 2026-11-14)
- **Versiones verificadas (2026-11-14, en el proyecto instalado)**: `expo` ~58.0.25 (`npx expo export --platform <p> --source-maps --output-dir <dir>` escribe `metadata.json` y el `.hbc.map` del bundle de release), `expo-modules-autolinking` 58.1.0 (`resolve --platform <p> --json` y `react-native-config --platform <p> --json`), Prettier 3.10.1 (API `format` y `resolveConfig`), Node ≥22 (`node:crypto`, `node:child_process`).
- **Medición de referencia** (export de Android de hoy): 74 paquetes de `node_modules` en el bundle de JS, más 6 módulos nativos autoenlazados sin JS en el bundle (`expo-system-ui`, `expo-keep-awake`, `expo-image-loader`, `@expo/dom-webview`, `@expo/log-box` y `expo-document-picker`, que entra al bundle cuando F8.7 lo use). El cierre transitivo de `dependencies` en `package-lock.json` tiene 605 paquetes, la mayoría de compilación (`lightningcss` MPL-2.0, `terser`, `xcode`, `node-forge`, `caniuse-lite` CC-BY-4.0).
- **Relacionados**: ADR-004 (aviso Apache 2.0 de HeroUI Native), ADR-014 (OFL 1.1 de Lexend, MIT de Phosphor), ADR-013 (tooling, proyectos de Jest), ADR-016 (builds locales, sin `expo-web-browser`), D-23.

## Contexto
La app distribuye código de terceros. Las licencias permisivas que usa (MIT, ISC, BSD, Apache 2.0, OFL 1.1) exigen conservar el aviso de copyright y el texto de la licencia. F9 muestra esa lista en Ajustes. La lista tiene que ser completa, mantenerse sola cuando cambian las dependencias y no mostrar como "incluido en la app" lo que solo se usa al compilar.

## Opciones consideradas
1. **Lista escrita a mano.** Se desactualiza en la primera actualización de dependencias y nada lo detecta.
2. **Cierre transitivo de `dependencies` leído de `package-lock.json`.** Es determinista y no compila nada, pero incluye unos 530 paquetes que no viajan en la app. Además arrastra licencias que no aplican al binario (MPL-2.0, CC-BY-4.0, Python-2.0), que habría que excluir a mano con una lista frágil.
3. **Librería de terceros** (`license-checker-rseidelsohn`, `generate-license-file`, `react-native-legal`). Todas recorren el árbol de `node_modules` (mismo problema que la opción 2) o agregan un módulo nativo y un plugin de configuración. Suman una dependencia sin resolver el problema de fondo.
4. **Generador propio que lee el bundle de release real**: las fuentes del *source map* de `expo export` dicen exactamente qué paquetes de `node_modules` quedaron en el JS que se distribuye, y `expo-modules-autolinking` dice qué paquetes aportan código nativo. Esa unión es lo que la app distribuye desde npm.

## Decisión
**Opción 4, sin dependencias nuevas.**

- `tools/licenses/` contiene un generador en Node (CommonJS, como `tools/eslint/`). Ejecuta `expo export` para **Android e iOS** sin `EXPO_PUBLIC_E2E`, lee los `.map`, suma los paquetes autoenlazados de las dos plataformas y lee de cada paquete su `package.json` y sus archivos de licencia.
- El resultado es un **módulo TypeScript generado y versionado**: `src/features/settings/domain/third-party-notices.generated.ts`, formateado con la API de Prettier. La app lo importa como datos puros y no hay lectura de archivos en tiempo de ejecución.
- **Política de licencias**: una lista blanca en `tools/licenses/policy.js` (`MIT`, `ISC`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `0BSD`, `BlueOak-1.0.0`, `OFL-1.1`, `CC0-1.0`, `Unlicense`). Una licencia fuera de la lista **detiene** la generación: se consulta al usuario antes de sumar esa dependencia.
- **Excepciones explícitas** en `tools/licenses/license-overrides.js`, cada una con su razón: paquetes sin archivo de licencia (texto tomado del repositorio padre o de una plantilla con el copyright verificado), expresiones compuestas (`MIT AND OFL-1.1` de Lexend: un texto por parte) y dependencias directas que no se distribuyen (`react-dom`, `tailwindcss`).
- **Frescura**: el generador anota en `tools/licenses/generated-from.json` una huella (`sha256`) de las entradas de producción de `package-lock.json`. Un test de Jest del proyecto `node` falla si la huella cambió, si una dependencia directa de producción no tiene aviso ni excepción o si una excepción quedó obsoleta. Corre en cada `npm test` (V-BASE) sin compilar nada.
- **Verificación completa**: `npm run licenses:check` regenera en memoria y compara con lo versionado. Detecta además los cambios de imports que no tocan el lockfile. Corre en F9.1, en cada punto de control que cambie dependencias o imports de paquetes y en el gate de F10.7.

## Consecuencias
- La lista coincide con lo que se distribuye. Cualquier cambio de dependencias de producción obliga a regenerarla, porque el test falla.
- El generador depende de dos interfaces de Expo: la salida de `expo export` (`metadata.json` + `.map`) y el JSON de `expo-modules-autolinking`. Si cambian con un SDK nuevo, el generador falla con un mensaje claro (no genera una lista vacía) y se actualiza junto con el SDK.
- Regenerar tarda lo que dos exports de release. Solo se hace al cambiar dependencias.
- Unos 100 KB de texto entran al bundle. Los textos repetidos se guardan una sola vez.
- **Fuera de alcance en la v1**: las bibliotecas nativas que no vienen de npm (artefactos de Gradle y CocoaPods como AndroidX, Kotlin o Glide, y lo que trae `react-native` dentro de sus binarios: Hermes, folly, fmt, SQLite dentro de `expo-sqlite`). La v1 no se publica (D-23). El ADR de release pendiente decide cómo cubrirlas (por ejemplo, `oss-licenses-plugin` de Google en Android).
