# ADR-016: Plataformas (sin web) y builds locales de Android

- **Estado**: Aceptado
- **Fecha**: 2026-11-13
- **Relación con otros ADRs**: complementa ADR-001. En la v1 no hay publicación (D-23), así que el "builds y publicación con EAS" de ADR-001 queda para el release futuro (sección "Futuro"), sin cambiar esa decisión. Concreta el build `e2e` de ADR-013 y deja en "Futuro" lo que ADR-006 y ADR-013 mandaban a "ADR-016 (pendiente)".
- **Verificado en el repositorio instalado (2026-11-13)**:
  - React Native 0.88.1, `react-native/gradle/libs.versions.toml`: `minSdk = 24`, `targetSdk = 36`, `compileSdk = 37`, `buildTools = 37.0.0`, `ndkVersion = 27.1.12297006`, `agp = 9.2.1`.
  - `expo-modules-autolinking` (`ExpoRootProjectPlugin.kt`) toma `minSdkVersion` de ese catálogo (con 24 por defecto), y `expo-modules-core` usa `safeExtGet("minSdkVersion", 24)`.
  - Plantilla nativa de `expo` 58.0.25 (`template.tgz`): `newArchEnabled=true`, `hermesEnabled=true`, y la variante `release` firmada con `signingConfigs.debug` (`android/app/debug.keystore`, incluido en la plantilla).
  - `@expo/cli` (`getOrPromptApplicationId.js`): sin `android.package`, `expo run:android` lo pide de forma interactiva; sin terminal interactiva falla con "Project must have a `android.package` set".
  - Las dependencias de cada paquete de la plantilla, revisadas en sus `package.json` (ver la tabla de dependencias).

## Contexto
- La v1 es **solo local**: no se publica, no usa EAS ni servicios en la nube y se verifica solo en Android (D-14, D-23). El código sigue siendo para iOS y Android (`docs/product.md`).
- La plantilla de SDK 58 trae soporte web (`react-native-web`, `web.output: "server"`, el script `web`) y paquetes de ejemplo que la app no usa.
- Los E2E de Maestro (ADR-002, ADR-013) y el E2E de actualización (ADR-006) necesitan builds de Android **reproducibles en este entorno**: uno de desarrollo, uno `release` para el teléfono del usuario y uno `e2e`, y que los APK de cada punto de control se conserven.
- La sombra sticker usa `boxShadow`, que se dibuja en Android 9 o superior (`docs/design-system.md`, 4.4). Por eso importa la `minSdkVersion` efectiva.
- Hoy este entorno no tiene Android SDK, emulador ni Maestro. Los comandos de este ADR se ejecutan cuando el usuario habilite ese entorno (plan, sección 0.3).

## Opciones consideradas

### Web
- **Mantener web** para tener una vista previa en el navegador. Contras: la app es móvil; HeroUI Native, Uniwind, `expo-sqlite` con su driver síncrono, `expo-notifications` y el sistema de archivos se comportan distinto o no existen en web. Habría que mantener y probar una tercera plataforma que nadie usa.
- **Quitar web.** Una plataforma menos que configurar y probar. **Elegida.**

### Builds de Android
- **EAS Build** (en la nube o `eas build --local`). Contras: requiere cuenta de Expo y `eas-cli`, y queda fuera de la v1 (D-23).
- **Android Studio a mano** sobre la carpeta `android/`. Contras: no es reproducible por comandos y empuja a editar archivos nativos generados.
- **`npx expo run:android`** con *Continuous Native Generation* (CNG): `expo prebuild` genera `android/` desde `app.json` y los config plugins, y Gradle compila e instala. Es el camino estándar de Expo, no necesita cuentas y es reproducible. **Elegida.**

### Variante del build `e2e`
- **Un *build type* o *flavor* nativo propio** (por ejemplo, `e2e`). Contras: hay que escribir y mantener un config plugin que modifique Gradle; agrega una pieza nativa propia sin necesidad (YAGNI).
- **La variante `release` estándar con `EXPO_PUBLIC_E2E=1`** en tiempo de bundle (ADR-013). La variable se reemplaza al empaquetar, así que el código y los *fixtures* de E2E desaparecen del bundle normal. **Elegida.**

### `minSdkVersion`
- **Subirla a 28** (Android 9) con `expo-build-properties`, para que la sombra sticker se vea siempre. Contras: agrega una dependencia y deja afuera teléfonos Android 7 y 8, que son justamente los de gama baja de referencia (plan, F10.2).
- **Mantener la que trae el SDK (24, Android 7.0).** Android 7 y 8 muestran el sticker solo con su borde, que es la degradación aceptada en `docs/design-system.md`. **Elegida.**

### Development build
- **Expo Go.** Contras: no refleja la configuración nativa propia (plugins, permisos, `scheme`) y puede no traer las versiones de módulos nativos del proyecto.
- **`expo-dev-client`.** Agrega menú y lanzador de desarrollo. Contras: es una dependencia más que la v1 no necesita.
- **El build `debug` de `npx expo run:android`**, que carga el bundle desde Metro. **Elegido.** Si más adelante hace falta el menú de `expo-dev-client`, se agrega con su justificación.

## Decisión

### 1. Plataformas
- `app.json` declara `"platforms": ["ios", "android"]` y **se elimina el bloque `web`** (`output: "server"` y `favicon`). También se borra `assets/images/favicon.png`.
- Se quita el script `web` de `package.json` y la entrada `web-build/` de `.gitignore`.
- iOS se mantiene en el código y en `app.json` (`ios.icon`), pero en la v1 no se compila ni se verifica (D-23).
- Efecto en los tests (verificado): el preset `jest-expo/node` (proyecto `node` de ADR-013) apunta `react-native` a `react-native-web`. Sin `react-native-web`, un test de `node` que importe React Native **falla al resolver el módulo**. Es la protección que buscan ADR-005 y ADR-013. Un test puro corre igual con el preset `jest-expo/node` sin `react-native-web` ni `react-dom` (probado con un test mínimo que hace fallar cualquier carga de esos módulos).

### 2. Dependencias de la plantilla
Verificado simulando la desinstalación en una copia de `package.json` y `package-lock.json` (`npm uninstall --package-lock-only`): `react-native-web`, `@expo/ui` y `expo-symbols` salen del árbol; `react-dom` y `expo-glass-effect` siguen en el árbol porque los traen otras dependencias.

**`dependencies` que se quitan**

| Paquete | Motivo |
|---|---|
| `react-native-web` | Soporte web, que se quita (sección 1). |
| `@expo/ui` | No se usa. Es dependencia opcional de `expo-router` (se carga con `try/require` en `optional-libraries/expo-ui.js`). La UI es HeroUI Native (ADR-004). |
| `expo-symbols` | No se usa. Es opcional en `expo-router` (`optional-libraries/expo-symbols.js`). Los íconos son de Phosphor (ADR-014). |
| `expo-glass-effect` | La app no lo usa directamente. Sigue instalado como dependencia directa de `expo-router`, que lo necesita en su *native stack*. Quitarlo de `package.json` solo saca una dependencia directa que no usamos; `expo-router` fija su versión. |
| `expo-web-browser` | No se usa: no hay OAuth ni navegador dentro de la app. Si la pantalla de licencias (F9) necesita abrir un enlace, alcanza con `Linking.openURL` de React Native. |
| `expo-device` | No se usa. Sirve sobre todo para los tokens de push, y la v1 no tiene push (ADR-011, DT-19). |

**`dependencies` que se quedan**

| Paquete | Motivo |
|---|---|
| `expo` | SDK 58 (ADR-001). |
| `expo-router` | Navegación (ADR-001, ADR-005). |
| `expo-constants`, `expo-linking` | Peers obligatorios de `expo-router`. `expo-linking` también sirve para los deep links (semilla de E2E, notificaciones) y `expo-constants` para la versión de la app en Ajustes (F9). |
| `react-native-screens`, `react-native-safe-area-context` | Peers de `expo-router` y de HeroUI Native. |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`, `react-native-svg`, `tailwind-merge`, `tailwind-variants` | Peers obligatorios de `heroui-native` 1.0.11. `react-native-svg` también lo usa Phosphor (ADR-014). |
| `heroui-native`, `uniwind`, `tailwindcss` | UI y estilos (ADR-004). `tailwindcss` es peer de `uniwind` y se usa al empaquetar; queda en `dependencies`, como indica la instalación de Uniwind. |
| `@expo-google-fonts/lexend`, `expo-font` | Lexend con `useFonts` (ADR-014). |
| `expo-splash-screen` | Splash mientras cargan las fuentes y corren las migraciones (F0.10). |
| `expo-image` | Fotos de producto (ADR-008). |
| `expo-system-ui` | Lo necesita `userInterfaceStyle: "automatic"` en Android, y la v1 tiene tema claro y oscuro (D-12). |
| `expo-status-bar` | Ajusta el estilo de la barra de estado al tema claro u oscuro (D-12). |
| `react`, `react-native` | Base. |
| `react-dom` | **Se queda, aunque la app no tiene web.** Es peer obligatorio de `@radix-ui/react-tabs`, una dependencia directa de `expo-router` que solo importan sus archivos `.web.js`. Si se quita de `package.json`, npm igual lo instala como peer (verificado en el lockfile), pero ya sin fijar su versión a la de `react` (19.3.0). En una instalación limpia podría quedar una versión que no coincide con `react`. Nunca entra en el bundle de Android ni de iOS. *(Se aparta de lo que proponía el plan en F0.2; ver "Consecuencias".)* |

**Se mueven a `devDependencies`**: ninguna. Ya están en `devDependencies` `jest`, `jest-expo`, `@types/jest`, `eslint-config-expo`, `@testing-library/react-native`, `test-renderer`, `eslint`, `eslint-config-prettier`, `eslint-plugin-jsdoc`, `prettier`, `typescript` y `@types/react`, y todas se quedan ahí (ADR-002, ADR-003, ADR-013). En `dependencies` no queda ningún paquete que se use solo en desarrollo.

**Scripts de `package.json`**

| Script | Valor | Motivo |
|---|---|---|
| `web` | se quita | Sin web. |
| `android` | `npx expo prebuild --clean --platform android && expo run:android` (enmienda 2026-11-15; antes `expo start --android`) | Build `debug` de desarrollo (sección 4). |
| `ios` | `expo run:ios` (antes `expo start --ios`) | Se conserva por simetría para el release futuro; en Linux no corre. |
| `android:release` | `npx expo prebuild --clean --platform android && rm -rf android/app/build && expo run:android --variant release` | Build `release` para el teléfono del usuario (sección 4). |
| `e2e:build` | `npm run e2e:fixtures && npx expo prebuild --clean --platform android && rm -rf android/app/build && EXPO_PUBLIC_E2E=1 expo run:android --variant release` | Build `e2e` (ADR-013, sección 4). |
| `start` | `expo start` | Sin cambios. |

Los demás scripts de ADR-013 los agrega F0.5.

### 3. Configuración nativa (CNG)
- `android/` e `ios/` **se generan** (`expo prebuild`, que `expo run:android` ejecuta solo si hace falta) y siguen en `.gitignore`. **No se editan a mano.** Todo cambio nativo va en `app.json` o en un config plugin. Si cambia la configuración nativa, se regenera con `npx expo prebuild --platform android --clean`.
- `android.package` **local y provisional**: `com.cuantovendi.local`. Hace falta porque `expo run:android` no compila sin él en un entorno no interactivo. **No es el identificador de publicación** (ver "Futuro"). Se mantiene igual durante toda la v1, para que el E2E de actualización (V-E2E-UPG) instale un build sobre otro y conserve los datos. Hasta CP1 no hay nada instalado, así que hasta ese momento cambiarlo no tiene costo.
- `ios.bundleIdentifier` no se define en la v1.
- New Architecture y Hermes, como en la plantilla (los necesita `boxShadow`, `docs/design-system.md`).

### 4. Builds locales y comandos exactos
**Requisitos del entorno**, que hoy no existen y habilita el usuario: Android SDK con `platform-tools` (`adb`), *platform* 37, *build-tools* 37.0.0 y NDK 27.1.12297006, todo según el catálogo de React Native 0.88; el JDK que exige AGP 9.2; un emulador o un teléfono conectado con depuración USB; y Maestro CLI (ADR-013). No se necesita ninguna cuenta ni servicio en la nube.

| Build | Comando | Uso |
|---|---|---|
| **Desarrollo** (`debug`) | `npm run android` (`npx expo run:android`); después, `npx expo start` para volver a conectar Metro | V-DEV: probar a mano con recarga rápida. |
| **Release** | `npm run android:release` | El build que se instala en el teléfono del usuario en cada punto de control. No contiene código ni *fixtures* de E2E. |
| **E2E** | `npm run e2e:build` | V-E2E-A y V-E2E-UPG. Es un `release` con `EXPO_PUBLIC_E2E=1`: incluye las rutas ocultas de F0.15 y F8.11. |

- **Por qué se borra `android/app/build`** antes de cada build `release` o `e2e`: las dos variantes comparten la variante nativa `release`, y Gradle no considera `EXPO_PUBLIC_E2E` como entrada de la tarea que empaqueta el JS. Sin borrar, un build podría reutilizar el bundle del otro. El tiempo de compilación no es criterio.
- **Comprobación obligatoria después de cada build** (ADR-013): con el build `e2e`, `smoke.yaml` abre la pantalla de diagnóstico de fechas. Con el build `release`, un flujo comprueba que la ruta oculta **no existe**. Si alguna falla, se borra la caché de Metro (`npx expo start --clear`, una vez) y se vuelve a compilar.
- **Firma**: la variante `release` se firma con el `debug.keystore` de la plantilla. Así **todos los builds de la v1 comparten firma**, que es lo que exige `adb install -r` en el E2E de actualización. Esa clave es pública, y se acepta porque la v1 no se publica (D-23). Si al actualizar el SDK la plantilla cambia la clave, el E2E de actualización falla con `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, y eso se detecta en el momento.
- **APK de salida**: `android/app/build/outputs/apk/release/app-release.apk` (y `.../debug/app-debug.apk` en desarrollo).

### 5. APK de cada punto de control (para V-E2E-UPG)
- Al cerrar cada punto de control desde CP1, el orquestador copia los APK `release` y `e2e` a `builds/android/cuantovendi-<cp>-<release|e2e>.apk`, por ejemplo `builds/android/cuantovendi-cp1-e2e.apk`.
- `builds/` va en `.gitignore`: son binarios locales y no se versionan. El orquestador anota en el Registro de progreso la ruta y el `sha256sum` de cada APK.
- **Base vigente de V-E2E-UPG**: `builds/android/cuantovendi-b66135a-e2e.apk`, el build `e2e` del commit `b66135a`, en lugar del APK de CP1 (ver la enmienda 2026-11-15, F10.5). Los APK de puntos de control siguientes se nombran como dice esta sección.
- **Procedimiento V-E2E-UPG**:
  1. `adb uninstall com.cuantovendi.local` (si estaba instalada).
  2. `adb install builds/android/cuantovendi-<cp anterior>-e2e.apk`.
  3. Crear datos con los subflujos de Maestro (F0.15) o, desde F8.11, con la semilla.
  4. `adb install -r android/app/build/outputs/apk/release/app-release.apk` (el `e2e` nuevo).
  5. `maestro test e2e/maestro/foundations/upgrade-verify.yaml`, que comprueba que los datos siguen ahí.

### 6. `minSdkVersion` efectiva
- **24 (Android 7.0)**, la que fija React Native 0.88 y aplica el plugin de autolinking de Expo. `targetSdkVersion` es 36 y `compileSdkVersion` 37. No se agrega `expo-build-properties`.
- En Android 7 y 8 (API 24 a 27) la sombra sticker no se dibuja y el sticker queda solo con su borde. Es la degradación aceptada, y F0.17 la comprueba en un emulador con API 24 a 27.
- Cada actualización de SDK revisa el valor en el `android/app/build.gradle` generado. Si sube, se actualiza este dato con un ADR que reemplace a este.

## Futuro (fuera de la v1; requiere un ADR nuevo antes del release)
Nada de esto se hace en la v1 (D-23, plan, sección 10):
- **EAS**: EAS Build y Submit, perfiles de `eas.json` (`development`, `preview`, `e2e`, `production`) y si se adopta `expo-dev-client`.
- **EAS Update / OTA**: política de updates y rollback. Las migraciones viajan solo en builds nativos: el `runtimeVersion` incluye la versión de esquema (cantidad de entradas del journal, calculada en `app.config.ts`), según ADR-006.
- **Identificadores definitivos**: `android.package` e `ios.bundleIdentifier` de publicación, nombre visible, ícono y splash de release. Si el definitivo es distinto de `com.cuantovendi.local`, la app publicada es otra instalación: los datos de la v1 se pasan con respaldo y restauración (ADR-012).
- **Firma de release**: un *keystore* propio y custodiado en lugar del de depuración; política de `versionCode` y `version`.
- **iOS**: builds, verificación en dispositivo, VoiceOver y E2E de iOS (EAS Workflows o un Mac), según ADR-013.

## Consecuencias
- Una plataforma menos: sin web no hay que probar ni mantener una tercera variante.
- Los builds se generan en este entorno sin cuentas ni servicios en la nube, con comandos de Expo estándar, y `android/` nunca se edita a mano.
- **Diferencia con el plan**: F0.2 proponía quitar `react-dom`; se queda por la razón de la tabla. El objetivo de "quitar web" se cumple igual: no hay plataforma web ni `react-native-web`, y `react-dom` nunca entra en un bundle móvil.
- El `android.package` provisional evita depender de una decisión de publicación. A cambio, si el identificador definitivo es otro, la migración de datos de la v1 al release se hace con el respaldo.
- La firma con la clave de depuración solo es aceptable mientras no se publique.
- Borrar `android/app/build` antes de cada build `release` o `e2e` hace los builds más lentos, a cambio de no mezclar bundles. La comprobación posterior detecta el error si igual ocurriera.
- Hasta que el usuario habilite Android SDK, emulador y Maestro, los comandos de la sección 4 no se pueden ejecutar aquí: las tareas que los necesitan quedan "pendientes de entorno" (plan, sección 0.4).

## Enmienda 2026-11-13 (F8.0)
Se agrega `expo-asset` (~58.0.21, ya incluido por `expo`) solo para leer el respaldo *fixture* empaquetado en el build `e2e` (F8.11). Se usa únicamente dentro de la rama del flag de E2E, que el bundle release elimina.

## Enmienda 2026-11-14 (F9.2)
`android.allowBackup` pasa a `false` en `app.json`. Expo lo deja en `true` por defecto, y entonces Auto Backup copia la base de datos y las fotos a Google Drive: la nota de privacidad de Ajustes ("no envía nada a internet", "si cambias de teléfono tus datos no se pasan solos") sería falsa en Android (D-23, D-28). El respaldo propio de ADR-012 es el único camino para llevar los datos a otro teléfono. Un test (`src/__tests__/app-config.test.ts`) exige `allowBackup: false`, `enableRemoteNotifications: false` y la lista de `blockedPermissions`, y `npx expo config --type introspect` muestra `android:allowBackup="false"` en el manifiesto.

Para el futuro (iOS): el contenido de `Documents` y `Library` se incluye en los respaldos de iCloud y del dispositivo por defecto. Cuando se prepare el build de iOS hay que decidir si se excluyen la base y las fotos (por ejemplo con el atributo `NSURLIsExcludedFromBackupKey`), con el mismo criterio de esta enmienda, y revisar que la nota de privacidad siga siendo cierta.

## Enmienda 2026-11-14 (F10.4)
Auditoría de permisos y secretos. Dos plugins de configuración locales en `plugins/` (CommonJS, con su test) y registrados en `app.json`:
1. `with-release-without-internet`: escribe `android/app/src/release/AndroidManifest.xml` con `<uses-permission android:name="android.permission.INTERNET" tools:node="remove"/>`. Los builds `release` y `e2e` (que también es `release`) salen sin INTERNET (D-23, DT-19). El build `debug` lo conserva porque Metro lo necesita. El código de la app no usa red (lo garantiza la regla de ADR-013), y Maestro habla con el dispositivo por `adb`, así que no hace falta.
2. `with-no-device-transfer`: agrega `android:dataExtractionRules="@xml/data_extraction_rules"` (Android 12 o posterior) y `android:fullBackupContent="@xml/full_backup_content"` (Android 11 o anterior). Ambos XML excluyen `root`, `file`, `database`, `sharedpref` y `external`; el primero lo hace en `<cloud-backup>` y en `<device-transfer>`. Complementa `allowBackup: false` y mantiene cierta la frase "Si borras la app o cambias de teléfono, tus datos no se pasan solos".

Menores en `app.json`: `ios.bundleIdentifier` `com.cuantovendi.local` y `ios.infoPlist.NSAppTransportSecurity` con `NSAllowsArbitraryLoads: false` y `NSAllowsLocalNetworking: true`. `src/__tests__/app-config.test.ts` exige los dos plugins y estos valores. `npx expo config --type introspect` muestra `dataExtractionRules` y `fullBackupContent` en el manifiesto; el manifiesto de la variante `release` y los XML solo se generan en `prebuild`, y se verifican con los tests de los plugins.

## Enmienda 2026-11-15 (gate F10.7, hallazgo I1)
`expo run:android` solo ejecuta `expo prebuild` si `android/` no existe, y no vuelve a aplicar los config plugins sobre uno existente. El `android/` local quedó anterior a los cambios de `app.json` de F10.4 (sin el manifiesto de `release` que quita INTERNET y sin `dataExtractionRules`), de modo que un build habría salido con permisos y copias de seguridad distintos de los auditados. La sección 3 decía que `expo run:android` regenera "si hace falta", y ese criterio no detecta cambios de `app.json`.

Decisión: los tres scripts que compilan (`android`, `android:release` y `e2e:build`) ejecutan antes `npx expo prebuild --clean --platform android &&`, de modo que cada build parte de un proyecto nativo generado desde el `app.json` y los plugins actuales. En `e2e:build` va después de generar los fixtures. `rm -rf android/app/build` se conserva por claridad aunque `--clean` ya borra `android/`. El costo es compilar todo desde cero en cada build, y el tiempo no es criterio. `src/__tests__/app-config.test.ts` exige el prebuild delante de `expo run:android` en los tres scripts. En un worktree de un commit anterior (V-E2E-UPG) el `package.json` no lo tiene, así que ahí se ejecuta a mano.

## Enmienda 2026-11-15 (F10.5)
Hallazgos de la regresión E2E en el emulador. El detalle operativo está en [`e2e/maestro/README.md`](../../e2e/maestro/README.md), sección "Entorno de ejecución y trampas conocidas"; el entorno de Maestro está en ADR-013, enmienda 2026-11-15.

1. **`release-has-no-e2e` solo contra un `release` limpio.** Gradle no ve `EXPO_PUBLIC_E2E` como entrada de la tarea que empaqueta el JS (sección 4), así que un `./gradlew assembleRelease` incremental hecho a mano después de un build `e2e` reutiliza el bundle con el flag, y el flujo falla aunque el código esté bien. Para esa comprobación se usa siempre `npm run android:release`, que regenera `android/` y borra `android/app/build`. Nunca se usa un `assembleRelease` incremental. Lo mismo vale al revés: el APK `e2e` sale solo de `npm run e2e:build`.
2. **Base de V-E2E-UPG.** La sección 5 pedía instalar el APK del punto de control anterior. No existe un APK de CP1, y el build del commit `ef90f82`, el candidato más antiguo, no sirve como base: tiene el error de `SafeAreaView` ([ADR-019](adr-019-uniwind-componentes-de-terceros.md)), Productos se ve en blanco y no se pueden cargar datos por la UI (paso 3 del procedimiento). La app nunca se instaló en el teléfono del usuario, así que no hay datos reales creados con versiones anteriores que proteger.

   Decisión: la base pasa a ser el build `e2e` del commit `b66135a`, guardado en `builds/android/cuantovendi-b66135a-e2e.apk` (con su `sha256sum` en el Registro de progreso, como dice la sección 5). Se usa en el V-E2E-UPG de la próxima feature que agregue una migración. La migración `0001` (F7) ya está incluida en ese build, así que su paso desde el esquema `0000` no queda cubierto por un E2E de actualización. Lo cubren su test de datos previos en Jest (ADR-006) y la ausencia de instalaciones reales anteriores. Desde la base nueva vuelve a regir la regla general: cada punto de control que se instale guarda sus APK según la sección 5, y el siguiente V-E2E-UPG parte del último.
