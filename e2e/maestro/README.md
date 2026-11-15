# E2E con Maestro

Flujos de extremo a extremo (ADR-002, ADR-013, ADR-016). Corren en Android, en local, contra el build `e2e`. Se ejecutaron completos en el emulador `cuantovendi_api34` (Android 14, x86_64, sin ventana) en F10.5; ver "Entorno de ejecución y trampas conocidas" al final.

## Estructura

- `config.yaml`: espacio de trabajo. Corre `foundations/*` y excluye los flujos con las etiquetas `release-only` y `upgrade`, que necesitan otro build o un procedimiento propio. Cada feature agrega su carpeta a `flows` (hoy `foundations`, `products`, `photos`, `sales`, `tracking`, `tips`, `notifications`, `backup` y `settings`).
- `_shared/`: subflujos reutilizables que los flujos de las features llaman con `runFlow`. `launch-clean.yaml` (instalación limpia y Home visible); `create-product.yaml` (producto de una versión; recibe `PRODUCT_NAME` y `PRODUCT_PRICE` por `env`); `create-two-version-product.yaml` (dos versiones; recibe `PRODUCT_NAME`); `seed-gallery-images.yaml` (precarga `assets/gallery-*.jpg` en la galería del emulador con `addMedia`); `add-photo-from-gallery.yaml` (abre "Galería", elige la primera miniatura del selector del sistema y confirma). `register-sale.yaml` (registra una venta de un producto desde Inicio; recibe `PRODUCT_ROW`, el texto de la fila del producto).
- `assets/`: imágenes JPEG de prueba para la galería del emulador.
- `products/` (F1.8): crear con una versión sin ver el concepto de versión, crear con tres versiones ("a convenir" y con costo), editar el nombre de una versión, archivar y desarchivar.
- `photos/` (F2.8): agregar una foto de la galería, quitarla con confirmación y comprobar el límite de 6. La cámara se verifica a mano en F2.9.
- `sales/` (F3.9): registro más corto (3 toques), venta de feria con tres productos, cambio de fecha a ayer, fecha futura bloqueada, "no vendí" y luego venta, editar y borrar, catálogo vacío.
- `tracking/` (F4.6): totales de Inicio con ventas de hoy y de ayer, actualización al registrar una venta, ganancia al cargar un costo (completa y parcial) y resumen mensual con navegación al mes anterior. `home-totals` acepta los dos totales posibles porque "ayer" cae en la semana anterior si hoy es lunes.
- `tracking/` calendario (F5.5): días marcados con su etiqueta y leyenda, detalle del día con su venta, y "no vendí" de la semana actual con la racha en 1 y al desmarcar.
- `tips/` (F6.8): la primera venta sin costos muestra el consejo de costos y se cierra con la X, el consejo queda como "Visto" en la sección "Consejos", Inicio no muestra consejos y un enlace a un consejo que no existe lleva a la lista.
- `notifications/` (F7.10): la primera venta muestra la pantalla explicativa y "Ahora no" vuelve a Inicio, no reaparece en la segunda venta y la opción queda en Ajustes, y cambiar el día y la hora en Recordatorios (con interruptores) y que se conserve. Necesitan un emulador Android 13 o superior: antes, el permiso viene concedido y la pantalla no aparece. Maestro no controla el diálogo del sistema, así que ningún flujo toca "Permitir"; la entrega real se verifica a mano. `_shared/dismiss-notification-intro.yaml` cierra la explicación con "Ahora no" si aparece; los flujos de otras features lo llaman después del primer "Listo".
- `backup/` (F8.10): exportar las dos planillas y crear un respaldo (se abre el menú de compartir; el aviso aparece al cerrarlo con `pressKey: back`), restaurar el _fixture_ `basic` con la semilla (productos, resumen de octubre de 2026 y copia de seguridad) y elegir un archivo que no es un respaldo (mensaje amable). `restore-invalid` necesita el archivo en Descargas: `adb push e2e/maestro/assets/no-es-un-respaldo.txt /sdcard/Download/` antes de correr el flujo. `_shared/open-backup.yaml` abre Ajustes y Respaldo. El selector y el menú de compartir son del sistema: sus textos y posiciones dependen de la imagen del emulador.
- `settings/` (F9.3): navegar a cada sección de Ajustes (Recordatorios, Respaldo y planillas, Privacidad, Acerca de y la versión), abrir las licencias de HeroUI Native, Lexend y Phosphor Icons con su texto, y ver la mención de la copia de seguridad que deja la semilla `basic`. Las filas de Ajustes llevan su resumen en la etiqueta ("Recordatorios, Domingos a las 20:00…"), por eso los flujos los tocan con `'Recordatorios.*'`. El texto de Apache 2.0 empieza con líneas con sangría, así que se busca con `.*Apache License.*`.
- `perf/` (F10.2): flujos de medición de P1 a P4 con la semilla `large` (`p1-startup`, `p2-register-sale`, `p3-calendar`, `p4-products`). No están en `config.yaml` (no son pruebas funcionales). Terminan abriendo `cuantovendi://e2e/perf` y, con `node tools/perf/parse-marks.js`, se resumen contra los umbrales de `docs/architecture/performance-budgets.md`.
- `foundations/`: `smoke.yaml`, `fresh-install.yaml`, `release-has-no-e2e.yaml`, `upgrade-seed.yaml` y `upgrade-verify.yaml`. Los dos últimos llevan la etiqueta `upgrade` y `config.yaml` los excluye: son los dos extremos de V-E2E-UPG (siguiente sección).

## Flag y rutas ocultas

`EXPO_PUBLIC_E2E=1` solo se lee en `src/core/e2e/e2e-flag.ts`. Con el flag, `cuantovendi://e2e/diagnostics` abre el diagnóstico de fechas (ADR-015). Sin el flag, la ruta redirige a Inicio y `+native-intent` reescribe cualquier `cuantovendi://e2e/**` a `/`. La semilla `cuantovendi://e2e/seed?fixture=basic|large` (F8.11) restaura un respaldo _fixture_ por el camino real de restauración; el subflujo `_shared/seed.yaml` la abre con `FIXTURE` y espera "Datos de prueba cargados: <nombre>". `basic.zip` está versionado; `large.zip` se genera con `npm run e2e:fixtures` (que `e2e:build` ejecuta antes de compilar) y está en `.gitignore`. La semilla y los datos grandes (`large`) existen **solo en el build `e2e`**: el build `release` no los incluye, así que cualquier prueba con datos grandes (rendimiento, TalkBack con letra grande) se hace con el build `e2e`.

## Comandos

- Build E2E: `npm run e2e:build` (regenera `android/` con `npx expo prebuild --clean --platform android` antes de compilar, igual que `npm run android` y `npm run android:release`, ADR-016); instalar `android/app/build/outputs/apk/release/app-release.apk`.
- Flujos del build E2E: `npm run e2e:android` (equivale a `maestro test e2e/maestro`).
- Build release: `npm run android:release`; después `maestro test e2e/maestro/foundations/release-has-no-e2e.yaml`, que comprueba que la ruta oculta no existe.
- Verificación del bundle release (`release-has-no-e2e`, no necesita dispositivo): `npx expo export --platform android --output-dir <directorio temporal>` sin `EXPO_PUBLIC_E2E`. Hermes guarda los textos con tildes en UTF-16, así que un `grep` simple de "Diagnóstico de fechas" no los ve ni siquiera en el build E2E. Se buscan dos señales: `grep -rac "Todos los casos coinciden" <directorio temporal>/_expo/static/js/android` (texto ASCII de la pantalla; debe dar `0`) y `python3 -c "import sys,glob; b=open(glob.glob(sys.argv[1]+'/_expo/static/js/android/*.hbc')[0],'rb').read(); print('Diagnóstico de fechas'.encode('utf-16-le') in b)" <directorio temporal>`, que debe imprimir `False`. Con `EXPO_PUBLIC_E2E=1` el `grep` da `1` y el script `True`.

## V-E2E-UPG (actualización)

Se hace al cerrar toda feature que agregue una migración y en F10.5. Necesita el APK `e2e` del punto de control anterior en `builds/android/cuantovendi-<cp anterior>-e2e.apk` (ADR-016, sección 5).

1. `adb uninstall com.cuantovendi.local` (si estaba instalada).
2. `adb install builds/android/cuantovendi-<cp anterior>-e2e.apk`.
3. Cargar los datos con el build anterior instalado: `maestro test e2e/maestro/foundations/upgrade-seed.yaml`. Crea por la UI (la semilla puede no existir en el build anterior) el producto "Lámina Colibrí" ($15.000), una venta de hoy, la marca "no vendí" de la semana pasada y el recordatorio en "Viernes a las 20:15" (distinto del valor por defecto). No borres los datos de la app después.
4. Instalar el build nuevo encima, sin desinstalar: `adb install -r android/app/build/outputs/apk/release/app-release.apk` (el `e2e` recién compilado). Todos los builds comparten firma; si falla con `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, la clave de la plantilla cambió.
5. `maestro test e2e/maestro/foundations/upgrade-verify.yaml` el mismo día. Comprueba que la app abre sin la pantalla de error y que siguen el producto, la venta de hoy, la marca "no vendí" con la racha de 2 semanas y el recordatorio de los viernes a las 20:15. Cada feature con datos agrega aquí la verificación de los suyos, y su parte de carga en `upgrade-seed.yaml`.

## Notas de los flujos de fotos

El selector de fotos es de la interfaz del sistema, así que su aspecto cambia con la imagen del emulador. `add-photo-from-gallery.yaml` toca la primera miniatura por posición (`16%,34%`, medido en el selector de Android 14 del emulador de 1080x2400) y confirma con el botón `button_add` si el selector está en modo múltiple. Si el emulador usa otro selector, ese es el único subflujo que se ajusta.

- Verificación de que el bundle release no incluye los fixtures (F8.11): con el mismo `expo export` sin `EXPO_PUBLIC_E2E`, `grep -c '"ext":"zip"' <directorio temporal>/metadata.json` debe dar `0` (con el flag da `2`) y `grep -ac "Datos de prueba cargados" <directorio temporal>/_expo/static/js/android/*.hbc` debe dar `0` (con el flag, `1`).

## Entorno de ejecución y trampas conocidas

Resultado de F10.5: `maestro test e2e/maestro` pasa 38/38 flujos en `cuantovendi_api34` (Android 14, x86_64, headless), unos 30 minutos. `release-has-no-e2e.yaml` se corre aparte contra un build release hecho sin `EXPO_PUBLIC_E2E` y con `app/build` borrado (un `assembleRelease` incremental reutiliza el bundle con el flag y el flujo falla).

- Animaciones del sistema en 0 (`adb shell settings put global window_animation_scale 0`, igual para `transition_animation_scale` y `animator_duration_scale`).
- Maestro concede todos los permisos al lanzar; `launch-clean.yaml` declara `permissions: notifications: unset` para que aparezca la pantalla explicativa de avisos.
- Los campos de formulario: el texto de la etiqueta es un `TextView` (índice 0) que no enfoca; el `EditText` es el índice 1 y solo es visible con el teclado cerrado. Por eso se usa `hideKeyboard` tras el nombre y `index: 1` para el precio.
- `hideKeyboard` con el teclado cerrado envía Atrás y puede abrir "¿Salir sin guardar?"; donde ocurre se usa `pressKey: Enter`.
- Los formularios largos necesitan `scrollUntilVisible` antes de tocar campos o botones inferiores (versiones, "Agregar otro producto", "Copia de seguridad").
- `home-monthly.yaml` usa la semilla `basic`: la navegación a meses anteriores se limita al mes de la primera venta.
- Los avisos (toasts) duran 4 s; las aserciones sobre ellos deben ir justo después de la acción.
- Un lanzamiento aislado (`register-shortest`) terminó una vez en el escritorio de Android sin error fatal; pasó al repetirlo.
- Maestro no puede verificar diálogos de permisos del sistema, entrega real de notificaciones, cámara ni TalkBack: eso queda para el teléfono (F10.6).
