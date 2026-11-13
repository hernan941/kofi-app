# E2E con Maestro

Flujos de extremo a extremo (ADR-002, ADR-013, ADR-016). Corren en Android, en local, contra el build `e2e`. En el entorno de desarrollo actual no hay Android SDK ni Maestro: estos flujos quedan escritos y su ejecución está pendiente de entorno.

## Estructura

- `config.yaml`: espacio de trabajo. Corre `foundations/*` y excluye los flujos con las etiquetas `release-only` y `upgrade`, que necesitan otro build o un procedimiento propio. Cada feature agrega su carpeta a `flows` (hoy `foundations`, `products`, `photos` y `sales`).
- `_shared/`: subflujos reutilizables que los flujos de las features llaman con `runFlow`. `launch-clean.yaml` (instalación limpia y Home visible); `create-product.yaml` (producto de una versión; recibe `PRODUCT_NAME` y `PRODUCT_PRICE` por `env`); `create-two-version-product.yaml` (dos versiones; recibe `PRODUCT_NAME`); `seed-gallery-images.yaml` (precarga `assets/gallery-*.jpg` en la galería del emulador con `addMedia`); `add-photo-from-gallery.yaml` (abre "Galería", elige la primera miniatura del selector del sistema y confirma). `register-sale.yaml` (registra una venta de un producto desde Inicio; recibe `PRODUCT_ROW`, el texto de la fila del producto).
- `assets/`: imágenes JPEG de prueba para la galería del emulador.
- `products/` (F1.8): crear con una versión sin ver el concepto de versión, crear con tres versiones ("a convenir" y con costo), editar el nombre de una versión, archivar y desarchivar.
- `photos/` (F2.8): agregar una foto de la galería, quitarla con confirmación y comprobar el límite de 6. La cámara se verifica a mano en F2.9.
- `sales/` (F3.9): registro más corto (3 toques), venta de feria con tres productos, cambio de fecha a ayer, fecha futura bloqueada, "no vendí" y luego venta, editar y borrar, catálogo vacío. Escritos y sin ejecutar.
- `foundations/`: `smoke.yaml`, `fresh-install.yaml`, `release-has-no-e2e.yaml` y `upgrade-verify.yaml`.

## Flag y rutas ocultas

`EXPO_PUBLIC_E2E=1` solo se lee en `src/core/e2e/e2e-flag.ts`. Con el flag, `cuantovendi://e2e/diagnostics` abre el diagnóstico de fechas (ADR-015). Sin el flag, la ruta redirige a Inicio y `+native-intent` reescribe cualquier `cuantovendi://e2e/**` a `/`. La semilla `cuantovendi://e2e/seed?fixture=<nombre>` se agrega en F8.11.

## Comandos

- Build E2E: `npm run e2e:build`; instalar `android/app/build/outputs/apk/release/app-release.apk`.
- Flujos del build E2E: `npm run e2e:android` (equivale a `maestro test e2e/maestro`).
- Build release: `npm run android:release`; después `maestro test e2e/maestro/foundations/release-has-no-e2e.yaml`, que comprueba que la ruta oculta no existe.
- Verificación del bundle release (`release-has-no-e2e`, no necesita dispositivo): `npx expo export --platform android --output-dir <directorio temporal>` sin `EXPO_PUBLIC_E2E`. Hermes guarda los textos con tildes en UTF-16, así que un `grep` simple de "Diagnóstico de fechas" no los ve ni siquiera en el build E2E. Se buscan dos señales: `grep -rac "Todos los casos coinciden" <directorio temporal>/_expo/static/js/android` (texto ASCII de la pantalla; debe dar `0`) y `python3 -c "import sys,glob; b=open(glob.glob(sys.argv[1]+'/_expo/static/js/android/*.hbc')[0],'rb').read(); print('Diagnóstico de fechas'.encode('utf-16-le') in b)" <directorio temporal>`, que debe imprimir `False`. Con `EXPO_PUBLIC_E2E=1` el `grep` da `1` y el script `True`.

## V-E2E-UPG (actualización)

Se hace al cerrar toda feature que agregue una migración y en F10.5. Necesita el APK `e2e` del punto de control anterior en `builds/android/cuantovendi-<cp anterior>-e2e.apk` (ADR-016, sección 5).

1. `adb uninstall com.cuantovendi.local` (si estaba instalada).
2. `adb install builds/android/cuantovendi-<cp anterior>-e2e.apk`.
3. Crear datos por la UI con los subflujos de `_shared/` (desde F8.11, con la semilla).
4. Instalar el build nuevo encima, sin desinstalar: `adb install -r android/app/build/outputs/apk/release/app-release.apk` (el `e2e` recién compilado). Todos los builds comparten firma; si falla con `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, la clave de la plantilla cambió.
5. `maestro test e2e/maestro/foundations/upgrade-verify.yaml`. Hoy comprueba que la app abre sin la pantalla de error; cada feature con datos agrega aquí la verificación de los suyos.

## Notas de los flujos de fotos

El selector de fotos es de la interfaz del sistema, así que su aspecto cambia con la imagen del emulador. `add-photo-from-gallery.yaml` toca la primera miniatura por posición (`18%,22%`) y confirma con el botón `button_add` si el selector está en modo múltiple. Si el emulador usa otro selector, ese es el único subflujo que se ajusta. Estos flujos de F1.8 y F2.8 están escritos y sin ejecutar: la ejecución está pendiente de entorno (Android SDK y Maestro).
