# Presupuestos de rendimiento de la v1 (F10.0)

- **Tarea**: F10.0 del plan (`docs/plan-v1.md`). Fija los presupuestos que F10.2 mide y corrige, F8.10 usa para el respaldo y F10.7 exige en el gate local (DT-17).
- **Decisión de producto**: D-23. Todo se mide en local, sin servicios externos (ni Firebase Performance, ni Sentry, ni laboratorios de dispositivos en la nube).
- **ADRs relacionados**: ADR-006 (driver síncrono, `runInTransaction`), ADR-008 (fotos de 1600 px, `expo-image`), ADR-009 (TanStack Query, lecturas acotadas), ADR-012 (respaldo STORED con CRC32 en JS), ADR-016 (builds locales `release` y `e2e`, `minSdkVersion` 24).
- **Fecha**: 2026-11-14.

## 1. Resumen del enfoque

- Cada presupuesto tiene un **evento de inicio**, un **evento de fin**, un **umbral** (mediana de N corridas y máximo) y una **herramienta local** que lo mide.
- Se mide siempre en el **build `e2e`** (es un `release` con Hermes en bytecode y `EXPO_PUBLIC_E2E=1`, ADR-016), con el conjunto **`large`** cargado por la semilla (F8.11). Los builds `debug` no sirven para tiempos absolutos: el JS no está en bytecode, React corre en modo desarrollo y el Perf Monitor y React DevTools agregan carga. En `debug` se **diagnostica** (qué componente o qué función gasta), en `e2e` se **mide contra el presupuesto**.
- Los umbrales son una propuesta del architect para un Android de gama baja. Son límites de UX, no metas de optimización: F10.2 no optimiza lo que ya los cumple (sin memoización manual sin medición, regla de `performance.md`).
- Si un presupuesto no se puede cumplir con el diseño actual, es una **condición de parada** (plan, 7.2): se consulta al usuario y, si hace falta cambiar una decisión, se abre un ADR.

## 2. Entorno de referencia

### 2.1 Dispositivo

| Opción | Perfil | Validez para DT-17 |
|---|---|---|
| **A. Teléfono físico (preferida)** | Android 8.1 a 10, 2 GB de RAM (máximo 3 GB), CPU de 4 a 8 núcleos tipo Cortex-A53 (o equivalente de gama baja), almacenamiento eMMC, pantalla de 720p. | Válida. |
| **B. Emulador limitado (respaldo)** | AVD con imagen API 28 (Android 9) `x86_64` sin Google Play, `-cores 2`, `-memory 2048`, VM heap 256 MB, 720×1280 a 320 dpi, `-gpu swiftshader_indirect`. Una segunda AVD con API 24 solo para la prueba de memoria de fotos (2.3). | Provisional: el CPU del host es mucho más rápido que un A53, así que los tiempos salen optimistas. Ver pregunta 6.1. |

Antes de cada sesión se anotan en el Registro de progreso: modelo (`adb shell getprop ro.product.model`), versión (`ro.build.version.sdk`), ABI (`ro.product.cpu.abi`), RAM total (`adb shell cat /proc/meminfo | head -1`) y el `sha256sum` del APK medido.

### 2.2 Condiciones de cada corrida

- Batería sobre 50 % o conectado, ahorro de energía apagado, pantalla siempre encendida (`adb shell svc power stayon true`), animaciones del sistema en su valor por defecto (no se desactivan: el usuario real las tiene).
- Sin otras apps en primer plano; se espera 30 s después de instalar o de arrancar el teléfono.
- **N = 10** corridas por medición de tiempo (5 para exportar y restaurar). Se informa **mediana y máximo**. La primera corrida después de instalar se descarta (Android compila y cachea en la primera ejecución).
- Datos: instalación limpia del `e2e` → semilla `large` (`cuantovendi://e2e/seed?fixture=large`) → `force-stop` → recién ahí se mide. "Hoy" es el del dispositivo; como los datos de `large` terminan el 2026-10-30, Inicio muestra la semana actual con pocas o ninguna venta y el calendario tiene que retroceder para encontrar meses llenos. Los flujos de medición navegan a **octubre de 2026** y a un mes de 2024 para medir meses con datos.

### 2.3 El conjunto `large` (medido hoy)

`e2e/fixtures/large.zip` (regenerado con `npm run e2e:fixtures`): 50.866.297 bytes, 202 entradas.

| Contenido | Cantidad |
|---|---|
| `products` | 200 (4 archivados) |
| `productVersions` | 240 |
| `productPhotos` | 200 (unos 250 KB cada una; 50.832.079 bytes descomprimidos en total) |
| `saleRecords` | 759 (3 años, 1.096 días) |
| `saleItems` | 1.518 |
| `noSalesWeeks` | 12 |
| `tipViews` | 3 |
| `data.json` | 801.182 bytes |

Las fotos de la semilla son JPEG de unos 250 KB, no fotos reales de 12 a 50 MP: la importación de fotos (presupuesto P6) se mide aparte con fotos de la cámara del teléfono de referencia.

## 3. Presupuestos

Leyenda de herramientas (todas locales):
- **marcas**: marcas de tiempo del build `e2e` (sección 4.1, decisión abierta 6.2);
- **`am start -W`**: `adb shell am start -S -W -n com.cuantovendi.local/.MainActivity`;
- **gfxinfo**: `adb shell dumpsys gfxinfo com.cuantovendi.local reset` antes y `... gfxinfo com.cuantovendi.local` después ("Janky frames", percentiles 90/95);
- **meminfo**: `adb shell dumpsys meminfo com.cuantovendi.local` en un bucle cada 500 ms durante el flujo, del que se toma el máximo de `TOTAL PSS` (y se separan `Native Heap`, `Java Heap`, `Graphics`);
- **Maestro**: flujo de `e2e/maestro/perf/` cronometrado desde afuera (sección 4.3);
- **Hermes profiler**: perfil de muestreo (React Native DevTools, pestaña Performance) en el build `debug`, solo para diagnosticar;
- **React Profiler**: React DevTools en `debug`, para contar renders, no para tiempos absolutos;
- **Perf Monitor**: menú de desarrollo en `debug` (FPS de JS y de UI), diagnóstico.

### P1. Arranque en frío hasta Inicio interactivo

| Métrica | Inicio → fin | Umbral (mediana / máx.) | Cómo se mide |
|---|---|---|---|
| P1.a Primer cuadro (TTID) | `am start` → primer cuadro de la actividad (el splash) | ≤ 1,2 s / ≤ 1,8 s | `TotalTime` de `am start -W` y la línea `ActivityTaskManager: Displayed` de `adb logcat` |
| P1.b **Inicio interactivo** | `am start` → Inicio pintado con los datos (monto de la semana y últimas 5 ventas) **y** un toque en "Registrar venta" responde | ≤ 3,5 s / ≤ 4,5 s | marcas (`rnStartupTiming.startTime` → marca `home:ready`); verificación cruzada con Maestro (`launchApp` → `assertVisible` del monto → `tapOn "Registrar venta"`) |
| P1.c Trabajo de JS antes de Inicio | ejecución del bundle → `home:ready` | ≤ 2,0 s | marcas (`rnStartupTiming.executeJavaScriptBundleEntryPointStart` → `home:ready`) |
| P1.d `configureAndMigrate` sin migraciones pendientes | entrada → salida | ≤ 150 ms | marcas `boot:migrate:start` / `boot:migrate:end` |
| P1.e Tarea larga de JS después de `home:ready` | recolección de huérfanos (ADR-008), reconciliación de notificaciones (ADR-011) | ninguna tarea > 100 ms en los 5 s siguientes | Hermes profiler (`debug`) y, en `e2e`, un `tapOn` inmediato que tiene que responder dentro de P2.a |

Referencia externa: Android vitals considera excesivo un arranque en frío de 5 s o más. El presupuesto deja margen debajo de eso en el peor caso.

### P2. Abrir el registro de venta y guardar

| Métrica | Inicio → fin | Umbral | Cómo se mide |
|---|---|---|---|
| P2.a Abrir el formulario | toque en "Registrar venta" (Inicio) → formulario pintado con el selector de productos (con `large`: lista en línea de hasta 20 y buscador) y listo para recibir toques | ≤ 600 ms / ≤ 1,0 s | marcas (`sale-form:press` en el botón, `sale-form:ready` en el primer `onLayout` con datos); Maestro como verificación gruesa |
| P2.b Buscar en el selector | cada tecla → lista filtrada | ≤ 100 ms por tecla (máx. 150 ms) | marcas o Hermes profiler; sin cuadros perdidos visibles |
| P2.c Hoja virtualizada del selector (240 versiones) | abrir → primeras filas visibles | ≤ 500 ms / ≤ 800 ms | marcas |
| P2.d Scroll de la hoja del selector (con miniaturas) | scroll de punta a punta | `Janky frames` ≤ 10 %; percentil 95 ≤ 50 ms | gfxinfo + Maestro (`scrollUntilVisible` hasta el último producto) |
| P2.e **Guardar** | toque en "Guardar" → celebración visible | ≤ 500 ms / ≤ 800 ms | marcas (`sale:save:press` → `sale:celebration:visible`) |
| P2.f Bloqueo de la transacción | `runInTransaction` de la venta (síncrono, ADR-006) | ≤ 50 ms | marcas alrededor de la llamada o Hermes profiler |
| P2.g Re-render tras invalidar | consultas de Inicio, calendario y resumen que se recargan por `DataChanges` | ≤ 200 ms de JS en total, sin bloquear la celebración | Hermes profiler; React Profiler para comprobar que solo se re-renderizan los consumidores de `['sales']` |

### P3. Cambiar de mes en el calendario

| Métrica | Inicio → fin | Umbral | Cómo se mide |
|---|---|---|---|
| P3.a Abrir la pestaña Calendario (primera vez) | toque en la pestaña → mes actual con intensidad y racha | ≤ 600 ms / ≤ 900 ms | marcas (`calendar:ready`) |
| P3.b **Cambiar de mes** | toque en "mes anterior" o "mes siguiente" → grilla del mes nuevo con la intensidad pintada | ≤ 300 ms / ≤ 500 ms, en un mes **con** datos (octubre de 2026) y en uno de 2024 | marcas (`calendar:month:press` → `calendar:month:ready`, con el mes en la marca) |
| P3.c Diez cambios seguidos | diez toques rápidos hacia atrás | ningún cuadro de UI > 100 ms; el último mes correcto | gfxinfo + Maestro |
| P3.d Consulta del rango del mes y racha | `listBetween` del mes + cálculo de intensidad y racha | ≤ 50 ms juntos | Hermes profiler (`debug`); test de plan de consulta en Jest (sección 5) |
| P3.e Detalle del día y resumen mensual | toque en un día con ventas → detalle; abrir `/tracking/monthly` de un mes lleno | ≤ 500 ms / ≤ 800 ms | marcas |

El plan pide el "scroll del historial con `large`". En la v1 no hay una lista de historial completo: Inicio muestra las últimas 5 ventas sin "ver todas" (D-39) y el historial se recorre por el calendario, el detalle del día y el resumen mensual (F5). P3 cubre ese recorrido. Si en el futuro se agrega una pantalla de historial con `useInfiniteQuery` (ADR-009), se le agrega un presupuesto como P2.d.

### P4. Abrir la lista de productos

| Métrica | Inicio → fin | Umbral | Cómo se mide |
|---|---|---|---|
| P4.a **Abrir la pestaña Productos** | toque en la pestaña → primera pantalla de filas pintada (200 productos, `FlatList`) | ≤ 600 ms / ≤ 900 ms | marcas (`products:ready`) |
| P4.b Scroll de la lista | punta a punta y vuelta | `Janky frames` ≤ 10 %; percentil 95 ≤ 50 ms; sin filas en blanco perceptibles | gfxinfo + Maestro; Perf Monitor en `debug` (FPS de JS ≥ 45 durante el scroll) |
| P4.c Abrir un producto con 6 fotos | toque en la fila → detalle con la galería decodificada | ≤ 700 ms / ≤ 1,0 s; fotos visibles ≤ 1,2 s | marcas + Maestro |

Hoy las filas de la pestaña no muestran miniaturas (UX-F7 quedó para F4/F10, registro de F2.5); las del selector de ventas sí. Si se agregan miniaturas a la lista, P4.b aplica igual.

### P5. Importar una foto

| Métrica | Inicio → fin | Umbral | Cómo se mide |
|---|---|---|---|
| P5.a **Foto de 12 MP** (galería o cámara) | vuelta del selector del sistema → miniatura visible en el formulario (redimensionada a 1600 px, JPEG 0,8, sha256, temporales borrados) | ≤ 2,5 s / ≤ 4,0 s | marcas (`photo:import:start` → `photo:import:ready`); Maestro con `addMedia` para la galería |
| P5.b **Foto más grande del teléfono** (hasta 50 MP) | ídem | ≤ 8 s, y **sin cierre por memoria** (requisito de corrección, no de tiempo) | marcas + `adb logcat` (`OutOfMemoryError`, `lowmemorykiller`) |
| P5.c Memoria durante la importación | pico de `TOTAL PSS` respecto del valor antes de abrir el selector | 12 MP: ≤ +150 MB; 50 MP: se registra y no puede producir cierre | meminfo |
| P5.d Android 7 (API 24 a 25) | P5.b en la AVD de API 24 | sin cierre | meminfo + logcat |

Por qué P5.d: hasta Android 7.1 los bitmaps viven en el heap de Java, que en gama baja suele estar limitado a 192–256 MB. Un 50 MP decodificado a ARGB_8888 pesa unos 200 MB, así que en esos teléfonos el riesgo de `OutOfMemoryError` es real (ver `product-photos.md`, riesgo 5). Desde Android 8 los píxeles van al heap nativo y el límite es la RAM del sistema.

### P6. Exportar y restaurar `large.zip`

| Métrica | Inicio → fin | Umbral | Cómo se mide |
|---|---|---|---|
| P6.a **Exportar el respaldo** de `large` | toque en "Crear respaldo" → menú de compartir abierto | ≤ 20 s / ≤ 30 s | marcas (`backup:export:start` → `backup:export:shared`) y Maestro |
| P6.b Progreso visible durante la exportación | intervalo máximo entre actualizaciones de progreso | ≤ 2 s | marcas por fase |
| P6.c Exportar los dos CSV | toque → menú de compartir | ≤ 3 s | marcas |
| P6.d **Restaurar `large`** sobre una instalación con pocos datos | confirmar → mensaje de éxito | ≤ 30 s / ≤ 45 s | marcas por fase (validar, respaldo de seguridad, copiar fotos, aplicar, finalizar) |
| P6.e Restaurar `large` sobre `large` (peor caso: el respaldo de seguridad previo, D-22, exporta otros 50 MB) | ídem | ≤ 50 s / ≤ 75 s | ídem |
| P6.f Commit de la restauración (`replaceAll`, síncrono) | entrada → salida del bloque | ≤ 1,5 s, con "Aplicando" ya pintado antes (`yieldToUi`) | marcas alrededor del commit |
| P6.g Tarea larga de JS fuera del commit | cualquier bloque síncrono durante exportar o restaurar (CRC32 de un bloque, códec UTF-8, parseo de `data.json`) | ≤ 250 ms | Hermes profiler (`debug`) para encontrar el bloque; en `e2e`, gfxinfo muestra si la animación de progreso sigue fluida |

Notas:
- **La semilla no sirve para medir P6.d tal cual**: antes de restaurar copia `large.zip` del APK a la caché con `expo-asset` (unos 50 MB). Las marcas separan esa copia de la restauración. Para la medición de referencia se restaura un `large.zip` generado por la propia app (P6.a) elegido con el selector de documentos.
- Pase lo que pase, la exportación y la restauración no pueden cerrar la app por memoria (P7.c).

### P7. Memoria

| Métrica | Escenario | Umbral | Cómo se mide |
|---|---|---|---|
| P7.a Pico en navegación normal | 5 vueltas de: Inicio → Calendario (12 meses atrás) → Productos (scroll completo) → detalle de un producto con fotos → Registrar venta (abrir la hoja) → volver a Inicio | `TOTAL PSS` ≤ 220 MB | meminfo + Maestro |
| P7.b Fuga al navegar | `TOTAL PSS` al final de la vuelta 5 contra el final de la vuelta 1 | crecimiento ≤ 10 % | meminfo |
| P7.c Pico al exportar o restaurar `large` | P6.a, P6.d y P6.e | `TOTAL PSS` ≤ 300 MB | meminfo |
| P7.d Heap de Hermes | después de P7.a | `usedJSHeapSize` ≤ 64 MB | marca que registra `performance.memory` (sección 4.1); en `debug`, el *heap snapshot* de React Native DevTools para diagnosticar |
| P7.e Importación de fotos | P5.c | ver P5 | meminfo |

### P8. Tamaño del bundle y del APK

| Métrica | Umbral | Cómo se mide | Medido hoy |
|---|---|---|---|
| P8.a Bundle Hermes del `release` (`.hbc`) | ≤ 9.000.000 bytes | `npx expo export --platform android --output-dir <tmp>`; tamaño de `_expo/static/js/android/*.hbc` | **7.879.806 bytes** (margen 12,4 %) |
| P8.b Ese bundle comprimido (aproxima lo que ocupa dentro del APK) | ≤ 3.500.000 bytes | `gzip -9 -c <hbc> \| wc -c` | **3.070.456 bytes** |
| P8.c Assets del `release` (fuentes, imágenes de `expo-router`) | ≤ 1.000.000 bytes | `du -sb <tmp>/assets` | **729.914 bytes** |
| P8.d Diferencia de código entre `e2e` y `release` | ≤ 100 KB de `.hbc` (los *fixtures* aparte) | dos `expo export`, con y sin `EXPO_PUBLIC_E2E=1` | **+17.653 bytes** (7.897.459 contra 7.879.806) |
| P8.e Ningún *fixture* ni código de E2E en el `release` | 0 | verificación de `e2e/maestro/README.md` | (ya verificado en F0.16 y F8.11) |
| P8.f Crecimiento por tarea | toda tarea que sume más de 200 KB al `.hbc` lo justifica en el Registro de progreso | `expo export` antes y después | — |
| P8.g APK `release` universal | ≤ 100 MB (techo); el valor del primer build pasa a ser la línea base y el presupuesto queda en línea base + 10 % | `ls -l android/app/build/outputs/apk/release/app-release.apk`; `unzip -l` para separar `lib/<abi>/` y `assets/index.android.bundle` | pendiente de entorno |
| P8.h Huella para la ABI del teléfono de referencia (APK sin las otras ABIs) | ≤ 40 MB | `unzip -l` sumando solo `lib/<abi de referencia>/` + el resto; o `apkanalyzer apk file-size` / `download-size` (cmdline-tools del SDK) | pendiente de entorno |
| P8.i Tamaño instalado | se registra (sin umbral propio) | Ajustes → Apps → Almacenamiento, o `adb shell dumpsys diskstats` | pendiente de entorno |

El APK `e2e` incluye `basic.zip` y `large.zip` (unos 51 MB más); P8.g y P8.h aplican solo al `release`.

## 4. Cómo se mide

### 4.1 Marcas de tiempo en el build `e2e` (recomendado, requiere decisión 6.2)

`adb` y Maestro no ven cuándo una pantalla de React Native está **lista con datos**: `am start -W` termina en el primer cuadro (el splash) y Maestro sondea la jerarquía cada varios cientos de milisegundos. Para P1.b, P2, P3, P4, P5 y P6 la medición fiable es una marca dentro de la app.

React Native 0.88 trae lo necesario sin dependencias nuevas (verificado en `node_modules/react-native/src/private/webapis/performance/Performance.js`):
- `performance.mark` / `performance.now()`;
- `performance.rnStartupTiming` (`startTime`, `initializeRuntimeStart`, `executeJavaScriptBundleEntryPointStart`, `endTime`), que da el origen del arranque en el lado nativo;
- `performance.memory` (`usedJSHeapSize` y `totalJSHeapSize` de Hermes).

Esqueleto propuesto (solo tipos; la implementación es de F10.2):

```ts
/** Nombre de una marca de rendimiento; el sufijo opcional distingue el caso (por ejemplo, el mes). */
export type PerfMarkName =
  | 'boot:migrate:start' | 'boot:migrate:end' | 'home:ready'
  | 'sale-form:press' | 'sale-form:ready' | 'sale:save:press' | 'sale:celebration:visible'
  | 'calendar:ready' | 'calendar:month:press' | 'calendar:month:ready'
  | 'products:ready' | 'photo:import:start' | 'photo:import:ready'
  | 'backup:export:start' | 'backup:export:shared'
  | 'restore:phase' | 'restore:commit:start' | 'restore:commit:end';

/** Registro de marcas. En el build normal es un no-op que el bundler elimina. */
export interface PerfProbe {
  mark(name: PerfMarkName, detail?: string): void;
  /** Marcas desde el arranque, con `startTime` de `rnStartupTiming` como origen. */
  snapshot(): readonly { readonly name: PerfMarkName; readonly detail?: string; readonly atMs: number }[];
}
```

- Vive en `src/core/e2e/` (junto al *flag*, F0.15) y se inyecta por `core/dependencies`; con `EXPO_PUBLIC_E2E` en falso es un objeto vacío, igual que la semilla.
- Las marcas se leen con una ruta oculta más, `cuantovendi://e2e/perf`, que muestra el `snapshot` como texto. Maestro la abre al final del flujo y la guarda con `copyTextFrom`, o se lee con `adb shell uiautomator dump`. No hace falta `console` (el `logger` no escribe en `release`, ADR-005) ni red.
- Los tests de las marcas son unitarios: el doble de `PerfProbe` registra llamadas; con el *flag* apagado no se empaqueta (mismo patrón de verificación del bundle que la semilla).

### 4.2 Herramientas de `adb` (no tocan el código)

- **Arranque**: `adb shell am force-stop com.cuantovendi.local && adb shell am start -S -W -n com.cuantovendi.local/.MainActivity` (P1.a). Se repite N veces con un `for` de shell.
- **Cuadros**: `adb shell dumpsys gfxinfo com.cuantovendi.local reset`, correr el flujo, y `adb shell dumpsys gfxinfo com.cuantovendi.local` (P2.d, P3.c, P4.b). Con `framestats` se obtiene el detalle por cuadro.
- **Memoria**: `while true; do adb shell dumpsys meminfo com.cuantovendi.local | grep -E 'TOTAL PSS|Native Heap|Java Heap|Graphics'; sleep 0.5; done > meminfo.log` en paralelo con el flujo (P5.c, P7).
- **Cierres**: `adb logcat -b crash,main | grep -E 'OutOfMemoryError|lowmemorykiller|FATAL'`.
- **Grabación** (verificación visual opcional): `adb shell screenrecord --bit-rate 8000000 /sdcard/p.mp4` y contar cuadros con un reproductor que avance cuadro a cuadro.

### 4.3 Maestro con tiempos

- Flujos nuevos en `e2e/maestro/perf/`, con la etiqueta `perf` y **excluidos** de `config.yaml` (no son pruebas funcionales y tardan).
- Cada flujo: semilla `large` → escenario → abrir `cuantovendi://e2e/perf` → guardar las marcas.
- El cronometraje externo (`date +%s%3N` antes y después de `maestro test`, o el atributo `time` del reporte `--format junit` si lo trae) solo sirve como verificación gruesa: incluye el sondeo de Maestro. Los umbrales se comparan contra las marcas.

### 4.4 Diagnóstico en `debug`

- **Hermes profiler**: React Native DevTools (tecla `j` en Metro) → Performance → grabar el escenario. Se usa para encontrar el bloque síncrono que viola P1.e, P2.f, P3.d o P6.g.
- **React Profiler**: contar renders tras guardar una venta o cambiar de mes (P2.g, P3.b).
- **Perf Monitor**: FPS de JS y de UI durante el scroll (P4.b).
- Los tiempos de `debug` no se comparan contra los umbrales.

### 4.5 Bundle (corre en este entorno)

```sh
npx expo export --platform android --output-dir <tmp>/release
EXPO_PUBLIC_E2E=1 npx expo export --platform android --output-dir <tmp>/e2e
npx expo export --platform android --no-bytecode --source-maps --output-dir <tmp>/js
```

El tercero permite atribuir bytes por paquete con el *source map* (`source-map-js`, que ya está en `node_modules`), con un script fuera del repositorio. El `.hbc` es lo que va dentro del APK; el `.js` minificado sirve solo para atribuir.

## 5. Qué se puede verificar ya, qué medí hoy y qué queda pendiente

### 5.1 Mediciones de hoy (2026-11-14, este entorno, sin Android SDK)

**Bundle `release` de Android** (`npx expo export --platform android`, SDK 58, React Compiler activo, 3.221 módulos):

| Medida | Valor |
|---|---|
| `.hbc` | 7.879.806 bytes (7,5 MiB) |
| `.hbc` con `gzip -9` | 3.070.456 bytes |
| Assets | 729.914 bytes (35 archivos) |
| Bundle `e2e` | 7.897.459 bytes (+17.653) y además `basic.zip` (259 KB) y `large.zip` (51 MB) como assets |
| JS minificado sin bytecode | 5.378.574 bytes |

Atribución del JS minificado por paquete (top 15, del *source map*): `react-native-reanimated` 644 KB (12,8 %), `react-native` 598 KB (11,9 %), `heroui-native` 500 KB (10,0 %), `zod` 494 KB (9,8 %), `expo-router` 460 KB (9,2 %), `src/global.css` (estilos de Uniwind) 233 KB (4,6 %), `react-native-gesture-handler` 173 KB, `drizzle-orm` 147 KB, `react-native-svg` 108 KB, `culori` 108 KB, `react-native-worklets` 97 KB, `react-hook-form` 96 KB, `phosphor-react-native` 95 KB, `expo` 90 KB; el código propio (`src/features/*`, `src/shared`, `src/core`) suma unos 490 KB.

Hallazgos del bundle para F10.2 (no se cambian ahora):
1. **Se empaquetan las 9 variantes de Lexend y se usan 4.** `src/core/providers/migration-gate.tsx` importa desde el índice de `@expo-google-fonts/lexend`, que hace `require` de los 9 `.ttf` (unos 78 KB cada uno). Importar desde las subrutas (`@expo-google-fonts/lexend/400Regular`, etc., que existen en el paquete) ahorraría unos 390 KB de assets. Medir antes y después con 4.5.
2. `zod` ocupa casi el 10 % del JS. No se propone cambiarlo (ADR-010); se anota por si P8.a se acerca al umbral (por ejemplo, con el módulo de licencias de F9, ADR-018). `zod/mini` sería la alternativa, con su ADR.

**CRC32 y UTF-8 en JS** (las funciones reales de `src/features/backup/domain/{zip/crc32,utf8}.ts`, copiadas y transpiladas en el *scratchpad*, sin tocar el repositorio; Node 24 en x86_64 de escritorio, bloques de 256 KiB):

| Operación | Node con JIT | Node `--jitless` |
|---|---|---|
| CRC32 de `large.zip` completo (48,5 MiB) | 840–930 ms (≈ 55 MB/s) | 4.930–5.100 ms (≈ 9,7 MB/s) |
| `decodeUtf8Strict` de `data.json` (782 KiB) | 24–29 ms | 153–190 ms |
| `encodeUtf8` del mismo texto | 9–10 ms | 104–124 ms |
| `JSON.parse` | 4 ms | 3–4 ms |

Cómo leerlo: Hermes no tiene JIT, así que `--jitless` es una cota más cercana que Node normal, pero **no es Hermes**, y un núcleo Cortex-A53 es varias veces más lento que el del escritorio. Es razonable esperar que solo el CRC32 de la exportación de `large` tarde **entre 15 y 30 s** en el teléfono de referencia, y la restauración lo vuelve a calcular. Con eso **P6.a y P6.d están en riesgo**: F8.10 y F10.2 lo miden en el dispositivo antes de decidir nada.

Experimento de la misma sesión (solo en el *scratchpad*), para orientar a F10.2: el bucle original usaba `for…of` sobre el `Uint8Array` y `TABLE[...] ?? 0`. Un bucle por índice con el mismo resultado tardó 3.274 ms `--jitless` (−28 %) y 137 ms con JIT (−88 %); *slicing-by-8* no mejoró sin JIT (3.754 ms). Los CRC dieron idénticos (`a9896dd3`). **Aplicado en F8.9** (`crc32.ts`: bucle por índice desenrollado de a cuatro bytes, sin `!` ni `as`, que el lint prohíbe): sobre 48,5 MiB pseudoaleatorios y bloques de 1 MiB, `node --jitless` pasó de 4.270–4.380 ms a 2.950–3.280 ms (≈ −30 %), el bloque más lento de unos 100 ms a unos 75 ms, y con JIT de 604–616 ms a 114–116 ms. Los CRC dieron idénticos (`e553ce0a`) y los vectores conocidos, el modo incremental y la comparación con `zlib` siguen en verde. Con el mismo método, `encodeUtf8` calcula ahora el tamaño en una primera pasada y escribe en la segunda (ya no reserva `length × 3` ni copia al final): 78–80 ms pasaron a 85–100 ms `--jitless` sobre 670.000 caracteres, un costo aceptado a cambio de no reservar el triple de memoria.

Bloques: desde F8.9, el CRC32 de una entrada que ya está en memoria (`data.json` al leer en `readVerifiedEntry`, y cualquier entrada de hasta 16 MiB al escribir) se calcula en bloques de 1 MiB (`COPY_BLOCK_BYTES` en `domain/zip/archive.ts`) y cede el hilo de JS (`setTimeout` de 0 ms) entre un bloque y el siguiente; la base de emergencia, que se lee en bloques, cede tras cada bloque de su primera pasada. Una entrada de un solo bloque (el `data.json` típico, menos de 1 MiB) no cede. Con unos 75 ms por bloque `--jitless` en el escritorio, en el teléfono un bloque puede pasar los 250 ms de P6.g: si pasa, la corrección es bajar el tamaño del bloque, sin cambiar el formato. F8.10 y F10.2 lo miden en el dispositivo.

### 5.2 Lo que se puede verificar en este entorno (sin dispositivo)

- P8.a a P8.f: `expo export` (sección 4.5), en cada tarea que agregue dependencias o pantallas.
- Plan de consultas: tests de integración del proyecto `node` con `better-sqlite3`, la semilla `large` restaurada por el camino real (como `restore-basic-fixture.test.ts`) y `EXPLAIN QUERY PLAN` de las consultas de Inicio, del mes del calendario, del detalle del día, de la racha y de la lista de productos: ninguna hace `SCAN` de `sale_records` ni de `sale_items` sin índice. Son tests deterministas (no miden tiempo), así que pueden ir a la suite normal.
- Cotas de trabajo de dominio: las funciones puras de agregados (intensidad, racha, resumen mensual, `SaleRecordView`) se ejecutan sobre los datos de `large` en un script de `tools/perf/` con `node --jitless`, solo como señal (sin aserciones de tiempo en Jest, que serían inestables).
- Revisión estática (reviewer): listas virtualizadas, nada de `.map()` grande dentro de `ScrollView`, `expo-image` con `recyclingKey`, trabajo diferido después del primer render.

### 5.3 Pendiente de entorno (Android SDK, `adb`, emulador o teléfono, Maestro)

- Todo P1 a P7, y P8.g a P8.i.
- La decodificación de fotos de 12 a 50 MP (P5.b, P5.d), en el teléfono de referencia y en API 24.
- El CRC32 y el UTF-8 en Hermes real (P6), el commit síncrono de la restauración (P6.f, estimado en alrededor de 1 s en `backup.md` 6.1.6) y la tarea más larga (P6.g).
- El scroll del selector virtualizado con miniaturas (P2.d): decodifica JPEG de 1600 px para mostrarlos a unos 40 dp.

## 6. Tests y verificaciones que F10.2 escribe o corre

Primero (Jest, antes de cualquier optimización):
1. Plan de consultas con `large` (5.2): un test por consulta caliente; falla si aparece `SCAN` sobre las tablas de ventas.
2. `PerfProbe` (si se aprueba 6.2): no-op con el *flag* apagado; registra en orden con el *flag*; la ruta `e2e/perf` no existe en `release` (mismo patrón que la semilla).
3. Para cada optimización: el test funcional que ya cubre la función sigue en verde (por ejemplo, los vectores del CRC32), y se anota la medición antes y después en el Registro de progreso (aceptación de F10.2).

Al final (en el dispositivo): los flujos de `e2e/maestro/perf/` para P1 a P7, gfxinfo y meminfo según la sección 4, y `expo export` para P8. Los resultados se anotan con el formato de la sección 7.

## 7. Formato de registro de resultados

Una tabla por sesión en el Registro de progreso (o en un anexo que F10.2 decida), con: dispositivo y Android, `sha256` del APK, y por presupuesto `Pn.x | mediana | máx. | umbral | ok/no`. Así F10.7 verifica DT-17 leyendo una sola tabla.

## 8. Riesgos y decisiones abiertas para el orquestador

### 8.1 Preguntas al usuario

1. **¿El emulador limitado vale para cerrar DT-17?** El plan admite "un teléfono de gama baja conectado o un emulador con recursos limitados", pero el CPU del emulador en este equipo es mucho más rápido que un teléfono de gama baja. **Recomendación**: un teléfono físico de 2 GB para la medición final; si no hay, se acepta el emulador y se anota la limitación (como prevé la sección 8 del plan). Necesita respuesta del usuario.
2. **¿Los umbrales le parecen bien como límites de UX?** En particular los de exportar (≤ 20 s) y restaurar (≤ 30 s, y ≤ 50 s sobre datos grandes). Son operaciones raras y con progreso visible; podrían aflojarse si el usuario lo prefiere, o endurecerse.
3. **Fotos de 50 MP en Android 7**: si P5.d falla (cierre por memoria), ¿se acepta limitar la v1 en Android 7 (por ejemplo, avisar que la foto es demasiado grande) o hay que buscar una decodificación reducida (una dependencia nueva o un cambio de ADR-008)?

### 8.2 Decisiones técnicas

4. **Instrumentación con marcas (4.1).** Es código nuevo en rutas de varias features (llamadas a `perf.mark`) y una ruta oculta más. **Recomendación**: aprobarla como enmienda de ADR-013 (que ya regula el *flag* y las rutas ocultas de E2E), sin dependencias nuevas. Sin ella, P1.b a P6 solo se pueden medir con Maestro y grabación de pantalla, con un error de varios cientos de milisegundos que deja P2, P3 y P4 sin verificar con precisión.
5. **CRC32 en Hermes.** Si P6.a o P6.d no se cumplen, el orden propuesto es: (a) bucle por índice dentro de `crc32` (mismo contrato y tests); (b) bloques más chicos o ceder entre bloques para P6.g; (c) si aun así no alcanza, el plan B de ADR-012: calcular y guardar el CRC32 de cada foto al importarla (columna nueva, migración y V-E2E-UPG), con un ADR. La restauración sigue verificando el CRC32 de todo lo que lee.
6. **Fuentes de Lexend** (5.1, hallazgo 1): cambio de imports sin decisión de ADR; se registra como optimización de F10.2 con su medición.
7. **Umbral de P8.g y P8.h**: no hay build todavía; el techo de 100 MB y los 40 MB por ABI son una cota amplia. Al primer build, el orquestador fija la línea base y el presupuesto queda en línea base + 10 %.
8. **Escala de `large`**: 200 productos y 759 registros en 3 años equivalen a un uso intenso. Los presupuestos asumen ese volumen; si el usuario espera más (por ejemplo, varias ventas por día durante años), hace falta un conjunto `xlarge` y revisar P3 y P6.

## 9. F10.2, parte local (2026-11-14, sin Android SDK)

### 9.1 Fuentes de Lexend (hallazgo 1 de 5.1)

`src/core/providers/migration-gate.tsx` importa ahora solo `@expo-google-fonts/lexend/400Regular`, `500Medium`, `600SemiBold`, `700Bold` y `useFonts`, y `src/core/providers/lexend-imports.test.ts` falla si algún archivo de `src` vuelve a importar el índice del paquete. Los tests de pantallas ya no simulan el paquete entero: `jest.setup.ts` simula esas cinco subrutas.

Medición con `npx expo export --platform android` (mismo árbol, antes y después del cambio de imports):

| Medida | Antes | Después | Diferencia |
|---|---|---|---|
| Assets (P8.c) | 729.914 bytes (35 archivos) | 337.166 bytes (30 archivos) | -392.748 bytes (-53,8 %) |
| `.hbc` (P8.a) | 8.003.151 bytes | 7.999.877 bytes | -3.274 bytes |
| `.hbc` final, con todo el trabajo de F10.2 | | 8.004.770 bytes | +1.619 contra el "antes" |
| `.hbc` con `gzip -9` (P8.b) | 3.106.663 bytes | 3.107.070 bytes (final) | +407 bytes |

El `.hbc` de "antes" ya es mayor que los 7.879.806 bytes de 5.1 porque el árbol creció entre F10.0 y hoy (F9 y los ajustes de diseño), no por este cambio. P8.a (≤ 9.000.000), P8.b (≤ 3.500.000) y P8.c (≤ 1.000.000) se cumplen.

### 9.2 Plan de consultas con `large`

`src/core/dependencies/query-plans.integration.test.ts` carga `createLargeFixture` por `replaceAll` en una base `better-sqlite3` migrada, ejecuta los repositorios reales mientras captura cada sentencia con sus parámetros y corre `EXPLAIN QUERY PLAN` sobre cada una. Falla ante un `SCAN` de `sale_records` o `sale_items` que no use un índice (un `SCAN ... USING INDEX` con `LIMIT`, como "últimas ventas" y la fecha más antigua, se detiene en las primeras filas). Un séptimo test comprueba que el detector sí marca un `SCAN sale_items` real. Cubre Inicio (`listRecent` y la semana), el mes del calendario (`listBetween`, `activeWeekStartsBetween`, `earliestSoldOn`), el detalle del día (`listBetween` de un día, `findById`), el resumen mensual (mismo `listBetween` del mes), la lista de productos (activos y archivados) y `versionIdsWithSales`.

Resultado: **ninguna consulta caliente hace `SCAN` completo; no hizo falta una migración 0002**. Planes observados: `listBetween` usa `sale_records_listing_idx (sold_on>? AND sold_on<?)`; las líneas, `sale_items_sale_record_id_idx`; `versionIdsWithSales`, `product_versions_product_id_idx` y `sale_items_product_version_id_idx`. `products` se recorre entero con `SCAN products` (200 filas, una tabla chica; no está en la lista que el presupuesto protege).

### 9.3 Marcas de rendimiento (aprobadas por la enmienda de ADR-013)

- `src/shared/lib/perf-marks.ts`: `perfMark(name, detail?)` llama a `performance.mark` y guarda el registro, y `readPerfMarks()` / `clearPerfMarks()`. Solo actúa con `process.env.EXPO_PUBLIC_E2E === '1'`. Está en `shared` y no en `core/e2e` porque lo usan varias features y `shared/lib` es la única capa que todas pueden importar sin cargar `features/e2e`.
- Cada punto de llamada repite la condición en línea (`if (process.env.EXPO_PUBLIC_E2E === '1') { perfMark(...) }`), para que Metro pliegue la rama y los nombres de las marcas tampoco queden en el bundle `release`.
- Marcas: `boot:migrate:start/end` (`migration-gate.tsx`, P1.d), `home:ready` (`HomeScreen`, P1.b/P1.c), `sale-form:press` (ruta de Inicio) y `sale-form:ready` (`NewSaleScreen`, P2.a), `sale:save:press` (`SaleForm`) y `sale:celebration:visible` (P2.e), `tab:press` con el nombre de la pestaña como detalle (layout de pestañas; inicio de P3.a y P4.a), `calendar:ready`, `calendar:month:press` y `calendar:month:ready` con el mes como detalle (P3.a/P3.b), `products:ready` (P4.a).
- **No tienen marca**: P1.e, P2.b a P2.d, P2.f y P2.g, P3.c a P3.e y P4.b/P4.c (siguen con Maestro, gfxinfo o el profiler); P5 a P7 salvo P7.d. P3.e (detalle del día y resumen mensual) y P2.f (bloqueo de la transacción) quedan sin marca a propósito: necesitan tocar la vista interna y el caso de uso, y se miden con el profiler de Hermes en `debug`.
- Ruta oculta `cuantovendi://e2e/perf` (`src/app/e2e/perf.tsx`, `PerfMarksScreen`): muestra en un solo texto (`testID="perf-marks"`) una línea `mark <nombre> <detalle|-> <ms>` por marca, `startup ...` con `performance.rnStartupTiming` y `heap used=... total=...` con `performance.memory`. Sin el flag redirige a Inicio (test en `navigation.test.tsx`) y `+native-intent` ya reescribe `e2e/**`.
- Verificación del bundle (`expo export --platform android --no-bytecode`): con `EXPO_PUBLIC_E2E=1` aparecen una vez cada uno de `sale-form:press`, `products:ready`, `boot:migrate:start`, `calendar:month:press`, `tab:press`, `sale:celebration:visible`, `home:ready` y "Marcas de rendimiento"; **sin el flag, 0 de los 9** (también 0 en el `.hbc` para `sale-form:press`). Lo que queda en el `release` son los efectos vacíos de las pantallas y una función `perfMark` sin cuerpo útil.

### 9.4 Flujos de medición y script

- `e2e/maestro/perf/` (etiqueta `perf`, fuera de `config.yaml`, escritos y sin ejecutar): `p1-startup`, `p2-register-sale`, `p3-calendar` (variables `MONTHS_BACK_TO_OCT_2026` = 1 y `MONTHS_BACK_TO_2024` = 25, válidas si "hoy" es noviembre de 2026; se ajustan con `-e`) y `p4-products`. Cada uno parte de `_seed-large.yaml` (instalación limpia, semilla `large`, `stopApp`, `launchApp`) y termina con `_dump-marks.yaml`, que abre `e2e/perf`, copia el texto y lo imprime entre `PERFMARKS_BEGIN <flujo>` y `PERFMARKS_END` (más una captura de pantalla).
- `node tools/perf/parse-marks.js <log de Maestro>...` (o por la entrada estándar) arma las métricas de cada bloque, agrupa las corridas y escribe la tabla de la sección 7 (`Pn.x | corridas | mediana | máx. | umbral | ok/no`) con los umbrales de la sección 3. Tests en `tools/perf/parse-marks.test.js`. Una corrida = un bloque; para N = 10 se repite el flujo y se pasan todos los logs. La primera corrida después de instalar se descarta a mano.
- Cómo correr cada flujo en el dispositivo: `maestro test e2e/maestro/perf/p3-calendar.yaml --debug-output <dir>` (el `console.log` queda en `maestro.log`), y `node tools/perf/parse-marks.js <dir>/maestro.log`. Las rutas de la salida de depuración dependen de la versión de Maestro: no se pudo comprobar aquí.

### 9.5 Pendiente de entorno tras esta parte

Todo lo que exige un dispositivo (la lista de 5.3 sigue vigente): ejecutar los cuatro flujos con N = 10 en el teléfono de referencia o el emulador limitado y anotar la tabla; gfxinfo y meminfo (P2.d, P3.c, P4.b, P7); P5 y P6 (incluidas las marcas de fotos y respaldo, que no se agregaron); P8.g a P8.i; P1.a (`am start -W`); y confirmar en Hermes real que `performance.getEntriesByType`, `rnStartupTiming` y `memory` devuelven lo esperado (la pantalla degrada a omitir `startup` y `heap` si no vienen). Optimizaciones: ninguna del lado de JS, porque no hay medición en dispositivo que las justifique; la única aplicada es la de las fuentes.
