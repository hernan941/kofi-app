# ADR-022: Kofi en el iPhone con Expo Go y EAS Update (excepción acotada a la v1 local)

- **Estado**: Aceptado (2026-11-26)
- **Relacionados**: ADR-001 (Expo; "builds y publicación con EAS" quedaba para el release), ADR-006 (migraciones y política de EAS Update), ADR-011 (avisos locales), ADR-012 (respaldo), ADR-013 (lint de red, Jest, Maestro), ADR-016 (builds locales de Android, sección "Futuro"), ADR-018 (licencias), ADR-021 (`slug` y `scheme` fijos), D-23 (v1 solo local).
- **Excepción aprobada por el usuario** (2026-11-26): usar EAS Update en el plan gratuito de Expo para publicar el bundle de JS y abrir Kofi en su iPhone con Expo Go, desde un link fijo y con su cuenta. Es la única excepción a D-23. **El resto de la fila "EAS Build y Submit…" de Pendientes sigue pendiente** (EAS Build y Submit, `eas.json`, identificadores definitivos, firma, política de EAS Update y rollback para builds nativos, E2E de iOS).

## Verificación (2026-11-26)
**Verificado en fuentes oficiales de Expo:**
1. *Expo Go en el App Store*: la ficha oficial muestra la versión **58.0.5 (22 de octubre de 2026), "This version adds support for SDK 58"**. Cada Expo Go trae un solo SDK ("The new Expo Go will support only SDK 58", changelog de SDK 58). La página de troubleshooting "Project is incompatible with this version of Expo Go" (3 de septiembre de 2026) todavía dice que el App Store "stops at SDK 54". Esa frase quedó vieja: el App Store volvió a SDK 57 el 3 de septiembre (changelog "Login now required…") y a SDK 58 el 22 de octubre.
2. *Abrir una update en Expo Go*: la referencia de `expo-updates` de SDK 58 dice "To test the content of an update in Expo Go, run `eas update` and then browse to the update in Expo Go", con dos condiciones: casi toda la API de `Updates` no está disponible en Expo Go, y solo se soportan updates que usan bibliotecas compatibles con Expo Go.
3. *Restricción de mayo de 2026* (changelog "Changes to project loading behavior in Expo Go", vigente desde el 12 de mayo de 2026 para todas las versiones de Expo Go): las updates de EAS Update solo se abren en Expo Go si el proyecto es tuyo o de una organización de la que eres miembro. En Expo Go, el bytecode de Hermes solo se acepta si viene de EAS Update.
4. *Inicio de sesión*: en un iPhone físico, Expo Go exige iniciar sesión con la misma cuenta que Expo CLI para abrir un servidor de desarrollo. Esa comprobación no se aplica a las updates publicadas (troubleshooting "You need to be signed in…"). Para las updates publicadas manda la restricción del punto 3.
5. *Link y QR*: `qr.expo.dev/eas-update` genera el QR o el URL. Con `slug` por defecto (`exp`) apunta a Expo Go. Con `projectId` + `branchId` devuelve "the latest update on that branch". El URL que genera, comprobado con IDs de prueba, es `exp://u.expo.dev/<projectId>/branch/<branchId>`. También acepta `projectId` + `runtimeVersion` + `channel`, que produce `exp://u.expo.dev/<projectId>?runtime-version=…&channel-name=…`.
6. *Configuración*: `eas update:configure` escribe `runtimeVersion` y `updates.url` (`https://u.expo.dev/<projectId>`) y agrega `extra.eas.projectId`. `updates.enabled` vale `true` por defecto, y `false` deja la app con el bundle embebido (`Updates.isEnabled`). `checkAutomatically` vale `ON_LOAD` por defecto, o sea que un build nativo con updates habilitadas consulta el servidor en cada arranque.
7. *`exclude` de autolinking* (`package.json` → `expo.autolinking.<plataforma>.exclude`): documentado en "Autolinking". Desde SDK 54 también excluye módulos de React Native.
8. *Plan gratuito* (expo.dev/pricing): updates ilimitadas, 1.000 MAU, 100 GiB de ancho de banda y 20 GiB de almacenamiento, sin cobro por exceso (al llegar al límite se corta). Un MAU es "1 unique installation of an app that downloads at least 1 update" en el ciclo. Un iPhone son 1 o 2 MAU por mes.
9. *Módulos en Expo Go* (referencias de SDK 58): `expo-sqlite`, `expo-file-system`, `expo-image-picker`, `expo-document-picker`, `expo-sharing` y `expo-linking` dicen "Included in Expo Go". `expo-notifications`: los avisos locales siguen disponibles en Expo Go; lo que no funciona es el push en Android. `Linking.createURL` en una update publicada abierta en Expo Go tiene un comportamiento "undefined" que no es estable.

**Verificado en código (no es documentación oficial):**
- *`eas-cli` 27.11.0* (npm, `build/`):
  - `eas update` instala `expo-updates` si falta (`ensureEASUpdateIsConfiguredAsync`). La CLI necesita el paquete, aunque Expo Go no.
  - `--environment` es obligatorio en SDK 55 o superior: sin la opción pregunta, y en modo no interactivo falla. Con la opción carga las variables del servidor, fija `EXPO_NO_DOTENV=1` y limpia la caché de Metro.
  - Si `runtimeVersion` ya está definido para la plataforma pedida, no toca el `app.json`.
  - No lee `updates.enabled`.
  - Solo exige un árbol de git limpio si `eas.json` tiene `cli.requireCommit`. Si lo exige y el árbol está sucio, en modo interactivo **ofrece hacer un commit de todo**.
  - Con `--json`, la salida trae `runtimeVersion`, `group` y el nombre del branch, pero no su id.
  - Por defecto propone `appVersion` con el comentario "Expo Go supports loading appVersion SDK 49 and above".
- *`@expo/config-plugins` instalado*: la política `{ "policy": "sdkVersion" }` se resuelve a `exposdk:<sdkVersion>`, es decir `exposdk:58.0.0`. El resolvedor de `expo-updates` 58.0.22 la acepta solo en el flujo *managed*, que es el de este proyecto porque `android/` está en `.gitignore`. La documentación de SDK 58 ya no menciona esta política: solo lista `appVersion`, `nativeVersion` y `fingerprint`.
- *Expo Go iOS* (`apps/expo-go/ios/.../EXAppLoaderExpoUpdates.m` y `EXExpoGoLauncherSelectionPolicyFilterAware.swift`, rama `main`):
  - Pide la update con `runtimeVersion` `exposdk:<SDK>`.
  - Elige qué update lanzar por la versión de SDK del manifiesto, no por `runtimeVersion`.
  - Fuerza `enabled = YES`, así que no lee el `updates.enabled` de la app.
  - Al arrancar busca una update nueva con una espera máxima de 60 s y **puede lanzar la update guardada**.
  - No es documentación y puede no coincidir exactamente con 58.0.5.
- *Proyecto*: `npx expo-modules-autolinking resolve --platform ios` y `react-native-config` muestran que todos los módulos nativos están en `expo/bundledNativeModules.json` con la versión instalada. Uniwind y HeroUI Native son solo JS. El código no usa `Linking.createURL` ni enlaces con `scheme` fuera del build E2E, y la navegación desde avisos usa `router`.

**No verificado (se comprueba en la primera publicación, sección "Verificación final"):**
- Que Expo Go **abra sin conexión** la última update descargada, y cuánto tarda con una conexión mala (el código sugiere hasta 60 s).
- Dónde guarda Expo Go los datos de Kofi (SQLite y `Paths.document`) y de qué dependen. Se supone que quedan aislados por proyecto (`@owner/slug`), que sobreviven a las updates y a las actualizaciones de Expo Go, y que **se pierden si se borra Expo Go**.
- Si los avisos programados quedan aislados por proyecto en Expo Go, y si tocar un aviso abre Kofi con su respuesta (`getLastNotificationResponse`).
- Si Expo Go acepta una update con `runtimeVersion` distinto de `exposdk:58.0.0` desde el link por branch. Este ADR evita la duda usando `exposdk:58.0.0`.
- Si los datos del sandbox de Expo Go entran en las copias de iCloud o del dispositivo.

## Contexto
- La v1 es solo local (D-23) y nunca se compiló ni se probó en iOS (ADR-016). El usuario tiene un iPhone y esta computadora es Linux: no hay Mac ni builds de iOS. No quiere firmar la app ni depender de `npm start`.
- Expo Go del App Store ya está firmado por Expo y trae SDK 58. Las updates de EAS Update se abren desde un link fijo, con la cuenta del dueño.
- Lo que se sube es el bundle de JS y sus assets (fuentes, imágenes y el módulo de licencias). **Los datos del usuario no salen del teléfono**: la base y las fotos viven en el sandbox de Expo Go, y el código de Kofi sigue sin hacer pedidos de red (regla de ADR-013).
- Agregar `expo-updates` a un build nativo cambia su arranque (con `ON_LOAD` busca updates al abrir). Los builds `debug`, `release` y `e2e` de Android (ADR-016) no deben consultar EAS ni recibir updates. Además, deben seguir siendo los mismos binarios que pasaron la regresión E2E.

## Opciones consideradas

### Cómo llegar al iPhone
1. **`eas build` para iOS** (*ad hoc* o TestFlight). Requiere el Apple Developer Program, firma y el ADR de release pendiente. El usuario lo descartó.
2. **`eas go`**: un Expo Go propio por TestFlight. Requiere el Apple Developer Program y no hace falta, porque el App Store ya tiene Expo Go para SDK 58.
3. **sign.expo.dev o firma gratuita**: el certificado vence a los 7 días, son 3 apps por dispositivo, y al hacerlo desde el navegador hay que darle el Apple ID a un intermediario. Es firmar, que el usuario no quiere.
4. **Servidor de updates propio** (protocolo Expo Updates, por ejemplo en un hosting estático). Desde mayo de 2026 Expo Go exige JS plano y no bytecode; además hay que mantener un servidor y publicarlo en internet. Es peor en seguridad y mantenimiento que EAS.
5. **Expo Go del App Store + EAS Update, plan gratuito.** Sin firma, sin Mac y sin servidor propio, con un link fijo que solo abre el dueño. **Elegida.**

### Cómo evitar que los builds de Android consulten EAS
1. **No instalar `expo-updates`.** No es posible: `eas update` lo instala solo si falta.
2. **Instalarlo y dejarlo enlazado, con `updates.enabled: false`.** El build nativo no consulta, pero el APK suma código nativo nuevo (`expo-updates`, `expo-manifests`, `expo-eas-client`, …) y el arranque pasa por el controlador de updates deshabilitado. Los binarios ya no son los que pasaron la regresión E2E.
3. **`runtimeVersion` solo para iOS.** Sin `runtimeVersion` para Android, `expo-updates` queda deshabilitado en Android. Funciona, pero de forma implícita: depende de un efecto lateral de la configuración, y el módulo nativo igual se enlaza.
4. **App config dinámica (`app.config.ts`)** que agrega `updates` solo al publicar. Hay dos fuentes de configuración, `eas update` y `expo prebuild` ven configuraciones distintas, y el test de `app.json` pierde valor. Es una capa que no hace falta.
5. **Instalar `expo-updates` como dependencia y excluirlo, junto con sus módulos nativos transitivos, del autolinking en Android e iOS, más `updates.enabled: false` explícito y `runtimeVersion` solo en `ios`.** Ningún build nativo enlaza el módulo, así que los APK quedan como hoy y nada puede consultar EAS. `updates.enabled: false` lo deja escrito en la configuración (y en el manifiesto generado). Si un día se quita la exclusión, sigue sin consultar. La tercera capa ya existe: el `release` y el `e2e` no tienen permiso INTERNET (ADR-016, F10.4). Expo Go no lee nada de esto, porque trae sus propios módulos y fuerza `enabled`. **Elegida.**

### `runtimeVersion` para iOS
1. **`appVersion`** (`"1.0.0"`), que es lo que propone `eas-cli`. Según el código, Expo Go la acepta. Pero no coincide con el `runtimeVersion` con que Expo Go pide la update (`exposdk:58.0.0`), y eso no está documentado.
2. **Texto fijo `"exposdk:58.0.0"`.** Coincide, pero hay que acordarse de cambiarlo en cada actualización de SDK.
3. **`{ "policy": "sdkVersion" }`**, que se resuelve a `exposdk:58.0.0` y sigue sola al SDK. **Elegida.** Es una política vieja que la documentación de SDK 58 ya no lista. Si una versión futura la quita, el script de publicación falla antes de subir nada (comprueba el `runtimeVersion` resultante) y se pasa a la opción 2.

## Decisión

### 1. Alcance de la excepción
- Se usa EAS Update solo para **publicar el bundle de iOS en un branch `ios-go`** y abrirlo en Expo Go. No se usan EAS Build, Submit, Workflows, `eas.json`, canales ni variables de entorno en el servidor.
- Cuenta personal del usuario, plan gratuito. `owner` (lo escribe `eas init`), `slug` `cuantovendi` y `extra.eas.projectId` quedan fijos. Si cambia `owner` o `slug`, Expo Go puede tratarlo como otro proyecto y la base guardada dejaría de verse (no verificado).
- Android sigue como en ADR-016: sin EAS y con los mismos módulos nativos.

### 2. Configuración
- `npx expo install expo-updates` (versión de SDK 58, hoy `~58.0.22`) en `dependencies`. Si `expo install` agrega el plugin `expo-updates` a `app.json`, se conserva y se avisa (CLAUDE.md).
- `app.json`:
  - `updates`: `{ "enabled": false, "url": "https://u.expo.dev/<projectId>" }`.
  - `ios.runtimeVersion`: `{ "policy": "sdkVersion" }`. Sin `runtimeVersion` de primer nivel ni en `android`.
  - `owner` y `extra.eas.projectId`, que escribe `eas init`.
- `package.json` → `expo.autolinking.android.exclude` y `expo.autolinking.ios.exclude` con `expo-updates` y **cada módulo nativo que aparezca por él**. La lista exacta sale de comparar `npx expo-modules-autolinking resolve --platform <p> --json` antes y después de instalar (esperables: `expo-manifests`, `expo-eas-client`, `expo-structured-headers`, `expo-updates-interface`, `expo-json-utils`). El criterio es que **las dos listas de módulos queden idénticas a las de hoy**.
- `src/**` no importa `expo-updates`. Como no está enlazado, importarlo rompería los builds nativos. Lo prohíbe el lint (sección 5).

### 3. Publicación (`npm run publish:ios-go`)
`tools/publish/publish-ios-go.js` (CommonJS, como `tools/licenses/`) hace, en orden:
1. **Comprobaciones de solo lectura**:
   - `git status --porcelain` vacío: lo publicado corresponde a un commit. El script **nunca hace commits** y `eas.json` no existe, así que `eas-cli` no ofrece hacerlos.
   - Si existe `builds/ios-go/last-published.json` (en `.gitignore` por `builds/`), el commit anterior es ancestro de `HEAD` (`git merge-base --is-ancestor`). Así no se publica código más viejo que el que ya corrió migraciones en el teléfono.
   - `HEAD` se lee una sola vez, al principio, y es el commit que se registra.
   - Si existe, `last-published.json` se valida: `commit` es un SHA de 40 caracteres, `journalEntries` es un entero no negativo, y están `group` y `publishedAt`. Si no tiene esa forma, el script aborta.
   - Si el journal de Drizzle **creció** desde la última publicación, exige `--with-migration` e indica que primero hay que **exportar un respaldo en el iPhone**. Expo Go aplica la update al abrir, así que después ya no queda una versión anterior desde donde hacerlo.
   - Si el journal **tiene menos entradas** que en la última publicación (`migration-removed`), bloquea siempre, también con `--with-migration`: ese código no podría abrir la base del teléfono.
   - El `runtimeVersion` de iOS se resuelve **antes de subir**, con `Updates.getRuntimeVersionNullableAsync` de `@expo/config-plugins`. Si no es `exposdk:<major de expo>.0.0`, el script aborta.
2. **V-BASE**: `typecheck`, `lint`, `format:check` y `test`. Si algo falla, se aborta.
3. **`eas update`** con un entorno sin `EXPO_PUBLIC_E2E`, de modo que el bundle nunca lleve las rutas ni los fixtures de E2E:
   `npx --yes eas-cli@<EAS_CLI_VERSION> update --platform ios --branch ios-go --environment production --message "<sha corto> <asunto del commit>" --non-interactive --json`.
   - `EAS_CLI_VERSION` es una constante con una versión exacta (hoy `27.11.0`). Se cambia a propósito, y no como dependencia de desarrollo, para no sumar al lockfile un paquete enorme que Expo pide mantener al día.
   - `--environment production` no carga nada, porque no hay variables en el servidor. Se pasa porque es obligatorio desde SDK 55 y porque limpia la caché de Metro y desactiva `.env`.
   Justo antes, se vuelve a comprobar que `git status --porcelain` siga vacío y que `HEAD` no haya cambiado durante V-BASE. Si algo cambió, el script aborta sin subir. Después de `eas update`, se repite el chequeo de `porcelain` y, si `eas-cli` tocó archivos, se avisa.
4. **Registro y comprobación de la salida**: si `eas update` terminó con 0 y su salida trae un `group`, se escribe `builds/ios-go/last-published.json` (`commit`, `group`, `journalEntries`, `publishedAt`) **antes** de validar el resto, porque la update ya está en el branch y los guardias del paso 1 tienen que compararse contra ella. Después se valida que haya una sola update, con `platform` `ios` y `runtimeVersion` `exposdk:<major de expo>.0.0`. Si algo falla, el error empieza con "ATENCIÓN: se publicó el grupo …".
5. **Link**: con `eas-cli branch:view ios-go --json`, que es de solo lectura, toma el `id` del branch (se exige que sea un UUID; `eas-cli` puede devolver `N/A`) e imprime el link fijo `exp://u.expo.dev/<projectId>/branch/<branchId>` y el URL de su QR, `https://qr.expo.dev/eas-update?projectId=<projectId>&branchId=<branchId>`.

Esqueleto (firmas; la implementación es del code-writer):

```js
/**
 * Opciones de una publicación a Expo Go en iOS (ADR-022).
 *
 * @typedef {object} PublishOptions
 * @property {boolean} withMigration - El usuario confirmó que exportó un respaldo antes de publicar una migración nueva.
 */

/**
 * Registro local de la última publicación, en `builds/ios-go/last-published.json`.
 *
 * @typedef {object} LastPublished
 * @property {string} commit - SHA completo publicado.
 * @property {string} group - Id del grupo de updates de EAS.
 * @property {number} journalEntries - Cantidad de migraciones del journal publicado.
 * @property {string} publishedAt - Fecha ISO 8601 en UTC.
 */

/**
 * Decide si se puede publicar a partir de datos ya leídos de git y del registro local; no lee nada.
 *
 * @param {{ porcelain: string, isAncestor: boolean | null, journalEntries: number, last: LastPublished | null, options: PublishOptions }} input - Estado leído.
 * @returns {{ ok: true } | { ok: false, reason: 'dirty-tree' | 'not-descendant' | 'migration-needs-confirmation' }} Resultado.
 */
function checkPublishable(input) {}

/**
 * Argumentos exactos de `eas update` para el branch `ios-go`.
 *
 * @param {{ shortSha: string, subject: string }} commit - Commit publicado.
 * @returns {string[]} Argumentos, sin el ejecutable.
 */
function buildEasUpdateArgs(commit) {}

/**
 * Copia del entorno del proceso sin `EXPO_PUBLIC_E2E`.
 *
 * @param {NodeJS.ProcessEnv} env - Entorno actual.
 * @returns {NodeJS.ProcessEnv} Entorno para `eas update`.
 */
function buildChildEnv(env) {}

/**
 * Valida la salida `--json` de `eas update`.
 *
 * @param {unknown} output - JSON leído.
 * @param {string} expoSdkVersion - Versión de `expo` instalada, por ejemplo `58.0.0`.
 * @returns {{ group: string, runtimeVersion: string }} Datos de la update de iOS.
 */
function parsePublishOutput(output, expoSdkVersion) {}

/**
 * Link fijo de Expo Go y URL del QR.
 *
 * @param {string} projectId - `extra.eas.projectId`.
 * @param {string} branchId - Id del branch `ios-go`.
 * @returns {{ expoGoUrl: string, qrUrl: string }} Links.
 */
function buildExpoGoLinks(projectId, branchId) {}
```

### 4. Migraciones (ADR-006 en este canal)
En Expo Go no hay build nativo. Todas las updates corren sobre el mismo runtime (`exposdk:58.0.0`), así que la regla de ADR-006 ("las migraciones viajan solo en builds nativos", con el esquema dentro de `runtimeVersion`) **no se puede aplicar**: acá las migraciones viajan en la update. La reemplazan para este canal:
- solo se publica hacia adelante (ancestro);
- `--with-migration` exige confirmar un respaldo previo;
- V-BASE antes de publicar, con los tests N-1 → N de ADR-006;
- **no se usan `eas update:republish` ni el rollback del dashboard**. Si hay que volver atrás, se hace un commit nuevo que revierte y se publica hacia adelante.

Si igual llegara un bundle más viejo que la base, sigue protegiendo la pantalla "base más nueva que el código" de ADR-006 (no escribe y ofrece la exportación de emergencia). La regla de ADR-006 para builds nativos sigue vigente para el release pendiente.

### 5. Lint y licencias
- `tools/eslint/layer-boundaries.js`: `expo-updates` va a la lista de imports prohibidos en `src/**`, con el mensaje "No está enlazado en ningún build nativo (ADR-022)". Lleva fixtures en `layer-boundaries.test.js`.
- ADR-018: `expo-updates` no entra al bundle (nadie lo importa) ni al autolinking (está excluido), así que va a `tools/licenses/license-overrides.js` como dependencia directa que no se distribuye, igual que `react-dom` y `tailwindcss`. Motivo: "Solo lo usa `eas update` al publicar a Expo Go; está excluido del autolinking (ADR-022)". Después se corre `npm run licenses:generate`, y `licenses:check` no debe mostrar avisos nuevos.

### 6. Uso en el iPhone
- Kofi se abre desde Expo Go (sesión iniciada con la cuenta del dueño), con el link fijo o desde la lista de proyectos recientes. El link se puede guardar como atajo en la pantalla de inicio con la app Atajos (opcional).
- Cada vez que Expo Go abre Kofi con conexión, busca la última update del branch y la aplica.
- La nota de privacidad, los textos y el comportamiento de la app no cambian en esta decisión (ver "Preguntas abiertas").

## Plan de implementación (code-writer, TDD según ADR-002)
Antes de empezar, el usuario tiene que haber hecho los pasos 1 a 4 de la sección siguiente (hace falta `extra.eas.projectId`).

**Tests primero** (proyecto de Jest entre paréntesis):
1. `src/__tests__/app-config.test.ts` (`ui`):
   - `updates.enabled === false`.
   - `updates.url` es `https://u.expo.dev/` seguido de `expo.extra.eas.projectId`, con un `projectId` con formato UUID.
   - `expo.ios.runtimeVersion` igual a `{ policy: 'sdkVersion' }`.
   - No existen `expo.runtimeVersion` ni `expo.android.runtimeVersion`.
   - `owner` definido.
   - `package.json`: `expo-updates` en `dependencies`; `expo.autolinking.android.exclude` y `expo.autolinking.ios.exclude` contienen la lista de la sección 2; el script `publish:ios-go` es `node tools/publish/publish-ios-go.js`.
   - Los tests actuales de `slug`, `scheme`, identificadores y scripts de Android siguen igual.
2. `tools/publish/publish-ios-go.test.js` (`node`; se agrega `'<rootDir>/tools/publish/**/*.test.[jt]s?(x)'` al `testMatch` del proyecto `node` en `jest.config.js`):
   - `checkPublishable`: falla con árbol sucio; falla si no es descendiente; falla si el journal cambió sin `withMigration`; pasa con `withMigration`; pasa sin registro previo (primera publicación).
   - `buildEasUpdateArgs`: argumentos exactos, incluidos `--platform ios`, `--branch ios-go`, `--environment production`, `--non-interactive` y `--json`.
   - `buildChildEnv`: quita `EXPO_PUBLIC_E2E` y no modifica el objeto recibido.
   - `parsePublishOutput`: acepta una sola update `ios` con `exposdk:58.0.0`; rechaza un `runtimeVersion` distinto, una update de `android` y una salida vacía.
   - `buildExpoGoLinks`: formato exacto de los dos URL.
   - `EAS_CLI_VERSION` es una versión semver exacta, no `latest` ni un rango.
3. `tools/eslint/layer-boundaries.test.js` (`node`): falla `import * as Updates from 'expo-updates'` en `src/`; un archivo de `tools/` no se ve afectado.
4. `tools/licenses` (`node`): el test de frescura pasa después de `licenses:generate` con la excepción nueva.

**Archivos**

| Archivo | Cambio |
|---|---|
| `package.json` | `expo-updates` (con `npx expo install`), `expo.autolinking.{android,ios}.exclude` y el script `publish:ios-go`. |
| `app.json` | `updates` e `ios.runtimeVersion`. `owner` y `extra.eas.projectId` ya los dejó `eas init`. |
| `tools/publish/publish-ios-go.js` | Script de la sección 3: funciones puras exportadas más un `main` que lee git, corre V-BASE, `eas update` y `branch:view`. |
| `tools/publish/publish-ios-go.test.js` | Tests del punto 2. |
| `jest.config.js` | `testMatch` de `tools/publish/**`. |
| `tools/eslint/layer-boundaries.js` y su test | Prohibición de `expo-updates`. |
| `tools/licenses/license-overrides.js`, `generated-from.json` y el módulo generado | Excepción y regeneración (ADR-018). |
| `src/__tests__/app-config.test.ts` | Tests del punto 1. |
| `README.md` | Sección "Kofi en el iPhone (Expo Go)": requisitos, `npm run publish:ios-go`, el link, que los datos viven en Expo Go (si se borra Expo Go, se pierden) y la recomendación de exportar respaldos. |

**Verificación** (en un agente aparte, como siempre):
- V-BASE.
- `npm run licenses:check`.
- `npm run doctor`.
- `npx expo-modules-autolinking resolve --platform android --json` y `--platform ios`: mismas listas que antes del cambio.
- `npx expo config --type introspect`: manifiesto de Android con `expo.modules.updates.ENABLED` en `false`, y sin `EXPO_RUNTIME_VERSION`.

**E2E al cierre**:
- Android: `npm run android:release` más `release-has-no-e2e`, y `npm run e2e:build` más la regresión de Maestro. Confirman que nada cambió en Android. No hay migración nueva, así que V-E2E-UPG no es obligatorio.
- iOS: no hay Maestro en este entorno. El E2E es la verificación manual del usuario (sección siguiente).

## Pasos del usuario
Los marcados con **[remoto]** crean o cambian estado fuera de esta computadora.

1. **[remoto]** Crear una cuenta gratuita en `expo.dev/signup`.
2. En el iPhone: instalar o actualizar **Expo Go** desde el App Store y comprobar en su ficha que la versión sea 58.x ("adds support for SDK 58"). **[remoto]** Iniciar sesión en Expo Go con esa cuenta: ícono de cuenta, arriba a la derecha.
3. **[remoto]** En la computadora: `npx eas-cli@27.11.0 login`, que deja una sesión en `~/.expo/`. Para comprobarla: `npx eas-cli@27.11.0 whoami`.
4. **[remoto]** En el repo: `npx eas-cli@27.11.0 init`. Crea el proyecto `cuantovendi` en tu cuenta y escribe `owner` y `extra.eas.projectId` en `app.json`. Elegir la cuenta personal, no una organización, y aceptar el slug `cuantovendi`.
5. Avisar al orquestador: el code-writer implementa el plan, y después vienen el reviewer y el E2E de Android.
6. Cuando quieras, pedir el commit. El script solo publica un árbol limpio.
7. **[remoto]** `npm run publish:ios-go`. La primera vez crea el branch `ios-go` y sube el bundle y los assets (no tus datos). Al final imprime el link fijo y el URL del QR.
8. Abrir el QR con la cámara del iPhone, o pegar el link en Expo Go, y guardar el link.
9. Verificación final en el iPhone, que es el E2E de iOS:
   - abre Kofi;
   - crear un producto con foto de la cámara y con foto de la galería;
   - registrar una venta;
   - ver Inicio y el calendario;
   - permitir avisos y comprobar que llega uno programado, y que al tocarlo abre la pantalla correcta;
   - exportar un respaldo y compartirlo a Archivos;
   - restaurarlo con el selector de documentos;
   - exportar el CSV;
   - modo oscuro;
   - cerrar Expo Go, ponerlo en **modo avión** y volver a abrir Kofi (¿abre sin conexión y con los datos?);
   - publicar una segunda update y comprobar que los datos siguen.
10. Para cada actualización: commit, `npm run publish:ios-go` y volver a abrir Kofi en Expo Go con conexión.

## Riesgos
- **iOS nunca se probó** (D-23, ADR-016). La primera ejecución en iPhone puede mostrar fallas propias de iOS (teclado, áreas seguras, barra de pestañas, HeroUI, fechas en Hermes de iOS). Se tratan como bugs normales, con su test.
- **Los datos viven dentro de Expo Go.** Si se borra Expo Go, se pierden. Si cambian `owner` o `slug`, o si una versión de Expo Go cambia dónde guarda los datos, pueden dejar de verse (no verificado). El respaldo (ADR-012) exportado fuera de Expo Go es la única protección.
- **Actualizaciones de SDK.** Expo Go del App Store soporta un solo SDK y iOS lo actualiza solo. Cuando salga Expo Go para SDK 59, Kofi no abrirá hasta actualizar el proyecto a SDK 59 y volver a publicar. Antes de esa actualización conviene tener un respaldo exportado.
- **Sin conexión**: no está verificado que abra; con mala conexión, el arranque puede esperar hasta 60 s (según el código de Expo Go).
- **Dependencia de Expo**: la cuenta, el plan gratuito y las reglas de Expo Go pueden cambiar, como ya pasó en mayo de 2026. Si Expo Go deja de abrir updates publicadas, la alternativa es el ADR de release pendiente (EAS Build más la cuenta de Apple).
- **Comportamiento de Expo Go en los avisos**:
  - el pedido de permiso y los avisos aparecen como "Expo Go", con su ícono;
  - `Linking.openSettings()` abre los ajustes de Expo Go;
  - los textos de permisos de `app.json` (cámara) no se usan, se ven los de Expo Go;
  - el aislamiento de los avisos programados y la respuesta al tocar un aviso no están verificados (paso 9).
- **Política de migraciones distinta** de la de ADR-006 en este canal (sección 4). La protegen el script y la pantalla "base más nueva".

## Preguntas abiertas (para el usuario)
1. **Nota de privacidad en el iPhone.** Ajustes dice "Kofi no tiene cuentas y no envía nada a internet" y que los datos no se pasan solos a otro teléfono. En Expo Go, Kofi sigue sin enviar tus datos, pero se abre con una cuenta de Expo, descarga el código de internet y su sandbox podría entrar en la copia de iCloud (no verificado). ¿Se deja el texto como está (vale para la app), se agrega una aclaración solo cuando corre en Expo Go, o se cambia?
2. **Respaldo antes de actualizar el SDK.** ¿Quieres que en cada actualización de SDK se recuerde exportar un respaldo, o alcanza con lo que se documente en el README?
3. ¿Te sirve el atajo en la pantalla de inicio (app Atajos), o te alcanza con abrir Kofi desde Expo Go?

## Consecuencias
- Kofi corre en el iPhone sin firma, sin Mac y sin `npm start`. Cada actualización es un commit más `npm run publish:ios-go`.
- Los builds de Android no cambian: mismos módulos nativos, sin consultas a EAS y sin INTERNET en `release` y `e2e`.
- Hay una cuenta externa y estado remoto (proyecto, branch y updates en expo.dev). No contienen datos del usuario.
- `expo-updates` queda instalado solo como herramienta de publicación; importarlo desde la app lo prohíbe el lint.
- El ADR de release pendiente tendrá que decidir si mantiene este canal o lo reemplaza, y si quita la exclusión del autolinking (con la política de ADR-006 para builds nativos).
