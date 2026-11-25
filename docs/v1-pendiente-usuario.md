# v1: lo que falta verificar en tu entorno

Esta guía junta todo lo que necesita un dispositivo o el emulador para cerrar la v1 (F10.7, CP11 y CP12). La parte local ya está verificada (gate F10.7, 2026-11-14): typecheck, lint, Prettier, Jest (326 suites, 3548 tests), `test:tz` en las tres zonas, `db:generate` sin cambios, licencias al día, `expo-doctor` 20/20 y `npm audit` sin altas ni críticas.

Sigue los pasos en orden. Cada paso dice qué tarea del plan cierra y qué anotar. Al final, pasa los resultados al orquestador para que los registre en `docs/plan-v1.md` (sección 11).

Rutas de este equipo:

```sh
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/build-tools/36.0.0:$ANDROID_HOME/cmdline-tools/latest/bin:$HOME/.maestro/bin:$PATH"
```

El emulador ya creado es `cuantovendi_api34` (Android 14). Para los flujos de notificaciones hace falta Android 13 o superior.

---

## 0. Antes de compilar: el proyecto nativo se regenera solo

`expo run:android` **no vuelve a aplicar los plugins si `android/` ya existe**, y el `android/` que haya en este equipo puede ser anterior a los últimos cambios de `app.json` (F10.4: el manifiesto que quita INTERNET en `release` y las reglas de `dataExtractionRules`). Por eso `npm run android`, `npm run android:release` y `npm run e2e:build` ejecutan primero `npx expo prebuild --clean --platform android` (enmienda de ADR-016, 2026-11-15; un test de `src/__tests__/app-config.test.ts` lo exige). No tienes que hacerlo a mano: cada build parte de un `android/` nuevo, y demora algo más a cambio de no depender de un proyecto desactualizado.

`android/` está en `.gitignore` y se genera entero desde `app.json`, así que no se pierde nada.

Comprobación rápida después de compilar: tiene que existir `android/app/src/release/AndroidManifest.xml`, y `android/app/src/main/AndroidManifest.xml` tiene que mencionar `dataExtractionRules`.

---

## 1. Build `e2e` (F10.5, base de casi todo lo demás)

```sh
emulator -avd cuantovendi_api34 &      # o conecta el teléfono con depuración USB
adb devices                            # tiene que listar un dispositivo
npm run e2e:fixtures                   # genera e2e/fixtures/large.zip (e2e:build también lo corre)
npm run e2e:build                      # compila e instala el APK e2e
```

APK: `android/app/build/outputs/apk/release/app-release.apk`. Guárdalo según ADR-016:

```sh
mkdir -p builds/android
cp android/app/build/outputs/apk/release/app-release.apk builds/android/cuantovendi-cp11-e2e.apk
sha256sum builds/android/cuantovendi-cp11-e2e.apk
```

Anota el `sha256`.

---

## 2. Permisos y manifiesto fusionado (F10.4, F2.9, DT-19)

Sobre el APK `e2e` y, en el paso 5, sobre el `release`:

```sh
aapt dump permissions builds/android/cuantovendi-cp11-e2e.apk
aapt dump xmltree builds/android/cuantovendi-cp11-e2e.apk AndroidManifest.xml | grep -E 'allowBackup|dataExtractionRules|fullBackupContent'
```

Lo esperado:

- **Sí**: `android.permission.CAMERA`, `android.permission.POST_NOTIFICATIONS` y `android.permission.RECEIVE_BOOT_COMPLETED` (los recordatorios vuelven a programarse tras reiniciar el teléfono). Puede aparecer `com.cuantovendi.local.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`: es un permiso propio de AndroidX y no da acceso a nada.
- **No**: `INTERNET`, `ACCESS_NETWORK_STATE`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM` ni `com.google.android.c2dm.permission.RECEIVE`.
- `allowBackup` en `false` (0x0), y `dataExtractionRules` y `fullBackupContent` presentes.
- **`WAKE_LOCK`**: puede llegar desde una dependencia de `expo-notifications`. Es un permiso normal (no le pregunta nada a la persona). No se bloqueó porque quitarlo puede producir un `SecurityException` al entregar un aviso. **Decide** (punto 10.4): aceptarlo o pedir que se bloquee y probar de nuevo las notificaciones del paso 8.

Si aparece cualquier otro permiso, anótalo con el nombre exacto: es un hallazgo.

---

## 3. Suite completa de Maestro (F10.5, DT-12)

```sh
adb push e2e/maestro/assets/no-es-un-respaldo.txt /sdcard/Download/
npm run e2e:android -- --format junit --output builds/maestro-cp11.xml
```

`npm run e2e:android` es `maestro test e2e/maestro`: corre todas las carpetas de `config.yaml` (fundaciones, productos, fotos, ventas, seguimiento, consejos, notificaciones, respaldo y ajustes) e incluye `foundations/fresh-install.yaml`. Excluye `release-only`, `upgrade` y `perf`, que tienen su propio paso.

Si un flujo falla, repítelo solo para ver el detalle:

```sh
maestro test e2e/maestro/sales/edit-delete.yaml --debug-output builds/maestro-debug
```

Notas: el selector de fotos y el menú de compartir son del sistema; si fallan solo esos pasos, el ajuste está en `e2e/maestro/_shared/add-photo-from-gallery.yaml`. En el registro de progreso hay tests de Jest que fueron inestables bajo carga (`products-routes`, `sale-form`): no aplican a Maestro, pero si ves algo intermitente, anótalo.

Anota: flujos pasados / total y los que fallaron.

---

## 4. Actualización desde una versión anterior (V-E2E-UPG, DT-12)

No hay APK guardado de CP1. La base más cercana es el último commit (`ef90f82`), que tiene solo la migración `0000`; el código actual agrega la `0001`.

```sh
git worktree add ../cuantovendi-base ef90f82
cd ../cuantovendi-base
npm ci
npx expo prebuild --clean --platform android   # el package.json de la base aún no lo hace solo
npm run e2e:build
cp android/app/build/outputs/apk/release/app-release.apk ../cuantovendi/builds/android/cuantovendi-base-e2e.apk
cd ../cuantovendi
```

Después:

```sh
adb uninstall com.cuantovendi.local
adb install builds/android/cuantovendi-base-e2e.apk
```

1. Con el build base instalado, carga los datos de prueba (crea por la UI un producto "Lámina Colibrí" de $15.000, una venta de hoy, la marca "no vendí" de la semana pasada y el recordatorio de los viernes a las 20:15, que no es el valor por defecto):

   ```sh
   maestro test e2e/maestro/foundations/upgrade-seed.yaml
   ```

   Si el build base no tiene alguna de esas pantallas, haz a mano lo que falte con esos mismos datos. No borres los datos de la app.
2. Instala encima, sin desinstalar, y verifica **el mismo día** (la venta es de hoy):

   ```sh
   adb install -r builds/android/cuantovendi-cp11-e2e.apk
   maestro test e2e/maestro/foundations/upgrade-verify.yaml
   ```

3. `upgrade-verify.yaml` comprueba que la app abre sin la pantalla de error y que siguen el producto, la venta de hoy, la marca "no vendí" con la racha de 2 semanas y el recordatorio en "Viernes a las 20:15". Si prefieres además un producto con dos versiones, el costo, una nota y un canal en las ventas, revísalos a mano.

Si falla con `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, las dos carpetas tienen claves de firma distintas: copia `android/app/debug.keystore` de este proyecto a `../cuantovendi-base/android/app/` y vuelve a compilar la base. Al terminar: `git worktree remove ../cuantovendi-base`.

---

## 5. Build `release` (F0.15, F10.4)

```sh
npm run android:release
cp android/app/build/outputs/apk/release/app-release.apk builds/android/cuantovendi-cp11-release.apk
sha256sum builds/android/cuantovendi-cp11-release.apk
ls -l builds/android/cuantovendi-cp11-release.apk           # P8.g
maestro test e2e/maestro/foundations/release-has-no-e2e.yaml
aapt dump permissions builds/android/cuantovendi-cp11-release.apk
```

Repite la revisión del paso 2 sobre este APK: aquí es donde más importa que no esté `INTERNET`.

---

## 6. Comprobaciones visuales de CP1 (F0.17)

Con el build `e2e` instalado:

1. Borde del campo de texto: se ve sin foco y cambia a ciruela con foco.
2. Sombra "sticker" en las tarjetas (Android 9 o superior). En Android 7 u 8 basta el borde.
3. Las tarjetas no recortan su sombra.
4. Lexend en sus cuatro pesos (normal, medio, seminegrita y negrita).
5. **P-23**: mira una lista real de montos (Inicio, resumen mensual, detalle de una venta con varios ítems). Decide si te basta Lexend o si prefieres Sora solo en los montos (punto 10.1).
6. Tema claro y oscuro.
7. La app abre sin error (migración en el dispositivo).
8. Diagnóstico de fechas con el teléfono en hora de Santiago:

   ```sh
   adb shell am start -W -a android.intent.action.VIEW -d 'cuantovendi://e2e/diagnostics' com.cuantovendi.local
   ```

   Tiene que decir "Todos los casos coinciden".
9. Miniaturas en Productos y Archivados (UX-F7): con al menos un producto con foto, la lista muestra una miniatura de 40 × 40 en cada fila (recuadro neutro con el ícono de caja en los que no tienen) y los nombres quedan alineados; sin ninguna foto, la lista no muestra miniaturas.

---

## 7. Fotos en el teléfono (F2.9, DT-02)

Necesita el build **debug** (`run-as` solo funciona en builds depurables) y la cámara de un teléfono físico:

```sh
npm run android
```

1. Con la ubicación de la cámara activada, crea un producto con una foto tomada desde "Cámara" y guárdalo.
2. Copia el archivo guardado (el `<id>` sale del `ls`):

   ```sh
   adb exec-out run-as com.cuantovendi.local sh -c 'ls -l files/photos'
   adb exec-out run-as com.cuantovendi.local cat files/photos/<id>.jpg > /tmp/foto.jpg
   ```

   Si `files/photos` no existe, busca con `adb exec-out run-as com.cuantovendi.local find . -name '*.jpg'`.
3. Comprueba que no tiene metadatos con el script del repositorio, que recorre los segmentos del JPEG y busca APP1 Exif, XMP, IPTC (APP13) y GPS:

   ```sh
   node tools/photos/check-jpeg-metadata.mjs /tmp/foto.jpg
   ```

   Tiene que imprimir `sin metadatos` y terminar con código 0 (con metadatos termina con 1 y los lista; con un archivo que no es JPEG, con 2). Como segunda opinión, si tienes `exiftool`: `exiftool -a -G1 -gps:all /tmp/foto.jpg` no tiene que listar grupos `EXIF`, `XMP`, `IPTC` ni `GPS`.
4. Peso entre 150 y 400 KB (`ls -l`) y orientación correcta en la app y en un visor.
5. Repite con una foto de la galería que tenga GPS.
6. En un teléfono de 2 GB: abre la cámara desde la app, cambia a otras apps pesadas y vuelve. Si la app se reinicia y la foto se pierde, anótalo (el código no recupera ese caso, `getPendingResultAsync`).

---

## 8. Notificaciones reales (F7.10, DT-07)

Con el build `e2e` (la acción de prueba aparece en Ajustes → Recordatorios). El detalle está en `docs/architecture/notifications.md` 5.6.

1. Semana sin registro: "Aviso en 1 minuto" → llega el texto neutro; tocarlo abre el registro de venta.
2. Registra una venta y repite → llega el texto de "ya registraste".
3. "Secuencia del estado B" con la app cerrada (deslizada fuera de recientes) → llegan los tres, en orden.
4. `WEEKLY` real (D-13): pon el recordatorio para dentro de 2 minutos y cierra la app → llega. Con la app cerrada, adelanta la fecha del sistema 7 días, dos veces → llega uno por semana. Registra una venta en una semana y vuelve a adelantar → nunca llegan dos en la misma semana.
5. El resumen mensual abre el mes correcto.
6. Con el permiso denegado, la app no vuelve a pedirlo.
7. Lee todos los textos que llegan: ninguno culpa.

---

## 9. Respaldo, planillas y prueba completa en tu teléfono (F8.10, F10.6)

1. Exporta `ventas.csv` y `productos.csv` y ábrelos en Excel y en Google Sheets: tildes correctas, columnas separadas y montos que se pueden sumar.
2. Crea un respaldo, guárdalo en Drive o en el correo, borra los datos de la app (`adb shell pm clear com.cuantovendi.local`) y restáuralo: tienen que volver los productos, las fotos y las ventas.
3. Recorre en tu teléfono todos los flujos críticos con datos reales: crear producto con fotos, registrar venta, "no vendí", editar y borrar, Inicio, calendario, resumen mensual, consejos, recordatorios, respaldo y restauración, y Ajustes con licencias.

---

## 10. TalkBack y letra grande (F10.1, DT-15)

Sigue el recorrido de `docs/design/accessibility-audit.md`, **sección 6** (6.1 a 6.7): registrar venta, "no vendí", crear producto, ver el resumen y respaldar, primero con TalkBack y después sin TalkBack con la letra y el zoom de pantalla al máximo; al final "reducir movimiento" y modo oscuro.

La sección 6 dice "modo release con los datos grandes", pero la semilla y los datos grandes solo existen en el build `e2e`: el `release` no los incluye. Haz el recorrido en el build `e2e` con la semilla `large`:

```sh
adb shell am start -W -a android.intent.action.VIEW -d 'cuantovendi://e2e/seed?fixture=large' com.cuantovendi.local
```

Espera "Datos de prueba cargados: large". Después repite al menos "registrar venta" en el build `release`.

Fíjate en particular en:

- **Pestañas en dos líneas** (decisión M8): con la letra al máximo, las etiquetas pasan a dos líneas y no se cortan. Decide si te gusta cómo se ve (punto 10.2).
- Avisos: cada uno se lee una sola vez.
- El error de un campo puede leerse dos veces (B8): anota si molesta.
- Al cerrar un diálogo, el foco no vuelve al botón que lo abrió (limitación conocida): anota si molesta.

Anota cada paso como bien o mal, con una frase.

---

## 11. Mediciones de rendimiento (F10.2, DT-17)

Presupuestos y método: `docs/architecture/performance-budgets.md` (secciones 2 a 4, y 9.4 para los flujos). Usa idealmente un teléfono físico de gama baja (2 GB); si usas el emulador, anótalo, porque los tiempos salen optimistas.

1. Anota el dispositivo:

   ```sh
   adb shell getprop ro.product.model; adb shell getprop ro.build.version.sdk
   adb shell getprop ro.product.cpu.abi; adb shell cat /proc/meminfo | head -1
   adb shell svc power stayon true
   ```

2. Con el build `e2e` instalado, corre cada flujo de medición 11 veces (la primera se descarta) y guarda cada salida:

   ```sh
   for n in $(seq 1 11); do
     maestro test e2e/maestro/perf/p1-startup.yaml --debug-output builds/perf/p1-$n
   done
   ```

   Lo mismo con `p2-register-sale.yaml`, `p3-calendar.yaml` y `p4-products.yaml`. `p3-calendar` asume que hoy es noviembre de 2026: en otro mes, ajusta los pasos hacia atrás, por ejemplo `-e MONTHS_BACK_TO_OCT_2026=2 -e MONTHS_BACK_TO_2024=26` en diciembre.
3. Arma la tabla contra los umbrales, sin la primera corrida de cada flujo:

   ```sh
   node tools/perf/parse-marks.js builds/perf/p1-{2..11}/**/maestro.log
   ```

   La ruta exacta del `maestro.log` depende de la versión de Maestro: búscala con `find builds/perf/p1-2 -name maestro.log`.
4. Lo que no tiene marcas se mide a mano según la sección 4.2: arranque con `adb shell am start -S -W -n com.cuantovendi.local/.MainActivity` (P1.a), fluidez con `dumpsys gfxinfo` (P2.d, P3.c, P4.b), memoria con `dumpsys meminfo` en bucle (P5, P7), exportar y restaurar `large` con cronómetro (P6) y fotos de 12 MP y de la cámara más grande (P5). Busca cierres con `adb logcat -b crash,main | grep -E 'OutOfMemoryError|lowmemorykiller|FATAL'`.
5. Tamaño del APK `release` (P8.g, P8.h): `ls -l` del paso 5 y `apkanalyzer apk file-size builds/android/cuantovendi-cp11-release.apk`.

Registra los resultados con el formato de la sección 7 del documento.

---

## 12. Decisiones y confirmaciones que te tocan

1. **P-23, montos**: solo Lexend (lo que hay hoy) o Sora dentro de `Amount` (paso 6.5).
2. **Pestañas en dos líneas** con letra grande (paso 10).
3. **Umbrales de rendimiento** (`performance-budgets.md` 8.1): si el emulador vale para cerrar DT-17 o hace falta un teléfono de 2 GB; si te parecen bien los tiempos, sobre todo exportar en 20 s o menos, restaurar en 30 s o menos y 50 s o menos sobre datos grandes; y qué hacer si una foto de 50 MP cierra la app en Android 7.
4. **WAKE_LOCK** (paso 2): aceptarlo o bloquearlo.
5. **Textos y decisiones de diseño que el orquestador tomó por defecto y que conviene que veas en el teléfono**:
   - "Agregar otra opción" cuando el producto tiene una sola versión, con su ejemplo debajo (`docs/design/products.md`, UX-P4);
   - la intensidad del calendario con 1 a 3 puntos (`docs/design/tracking-calendar.md` 9.1);
   - minutos del recordatorio de a 15 y el ícono de las notificaciones, ahora el gato de Kofi (D-45);
   - largo máximo de los consejos: 50 caracteres de título y 240 de cuerpo (`docs/design/tips.md` 9.1);
   - la vista previa de la restauración muestra también los datos actuales, y la pantalla no se mantiene encendida mientras restaura (D-45);
   - el identificador `com.cuantovendi.local` (provisional hasta una publicación, sección 10 del plan). El ícono y el splash ya son el gato de Kofi (`docs/design-system.md` 8.1).
6. **Contenido de los consejos (CP7a)**: lee los 30 consejos y sus fuentes en `docs/content/consejos.md`. Una fuente (un PDF de BancoEstado) no se pudo abrir; cada consejo que la cita tiene otra fuente. Aprueba el contenido o marca qué cambiar.

---

## 13. Qué devolverle al orquestador

- `sha256` de los APK `e2e`, `release` y base.
- Salida de `aapt dump permissions` de los APK `e2e` y `release`.
- Resultado de Maestro (flujos pasados / total) y de la actualización.
- Las 8 comprobaciones de CP1, las de fotos, notificaciones, respaldo y la prueba en el teléfono.
- El recorrido con TalkBack y con letra grande (bien o mal por paso).
- La tabla de rendimiento y el tamaño del APK.
- Tus respuestas a los puntos de la sección 12.

Con eso se cierran F0.15, F0.17, F1.8, F2.8, F2.9, F3.9, F4.6, F5.5, F6.8, F7.10, F8.10, F9.3, F10.1, F10.2, F10.4, F10.5 y F10.6, y se pasa a CP11 y a tu aprobación final en CP12 (DT-20).
