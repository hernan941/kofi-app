# Diseño técnico — Ajustes (F9)

- **Tarea**: F9.0 de `docs/plan-v1.md`. Rige F9.1 a F9.3 y lo que F10 revise de Ajustes (TalkBack y letra grande en F10.1, presupuestos de F10.0 y gate de F10.7).
- **ADRs**: ADR-005 (`settings` compone `notifications` y `backup`; rutas delgadas), ADR-009 (TanStack Query, sin store global), ADR-010 (validación de parámetros de ruta), ADR-013 (tooling y proyectos de Jest), ADR-014 (Lexend y Phosphor), ADR-004 (HeroUI Native) y **ADR-018 (nuevo: licencias de terceros)**. **Decisiones**: D-09, D-13, D-22, D-23, D-28, D-43 y D-44.
- **Base revisada** (2026-11-14): `features/settings/screens/settings-screen.tsx` (provisional, solo la fila "Recordatorios"), `src/app/(tabs)/settings.tsx`, `src/app/settings/notifications.tsx`, `features/notifications/{index.ts,domain/preferences.ts,hooks/use-notification-permission.ts,hooks/use-notification-preferences.ts,components/notification-texts.ts}`, `features/backup/{index.ts,domain/ports.ts}` (`BackupFiles.latestSafety()`, `SafetyBackupInfo`), `core/providers/app-dependencies.ts` (`appVersion` ya existe y sale de `Constants.expoConfig.version`), `shared/ui/list-row.tsx` (`subtitle`, `trailing`), `jest.config.js`, `eslint.config.js`, `package.json`, `app.json`, `docs/design/{notifications,backup}.md` y `docs/architecture/{notifications,backup}.md`.
- **En curso**: un code-writer está haciendo la UI de respaldo (F8.7: `BackupScreen`, `src/app/settings/backup.tsx` y la fila provisional "Respaldo"). Este diseño no cambia F8.7: lo integra. F9.1 empieza cuando F8.7 esté cerrada.
- **Verificado en el proyecto** (exports de prueba en un directorio temporal, sin tocar el repositorio): `npx expo export --platform android|ios --source-maps` funciona en Linux (unos 45 s cada uno) y deja 74 paquetes de `node_modules` en el bundle. `expo-modules-autolinking` lista los módulos nativos de cada plataforma.

---

## 1. Resumen del enfoque

- **Ajustes es una pantalla índice, sin datos propios.** No agrega tablas, preferencias ni estado global. Tiene cuatro bloques:
  1. **Recordatorios**: fila con un resumen del estado. Lleva a `/settings/notifications` (F7.7, sin cambios).
  2. **Respaldo y planillas**: fila que lleva a `/settings/backup` (F8.7). Si hay copia de seguridad (D-22), el resumen la menciona. La copia se restaura desde esa pantalla con el flujo de F8 (UX-B11, D-44). Ajustes no duplica ese flujo.
  3. **Privacidad**: una nota fija ("tus datos viven en tu teléfono").
  4. **Acerca de**: nombre de la app, versión (`appVersion`) y la fila "Licencias de terceros", que lleva a `/settings/licenses`.
- **Composición**: `settings` usa el índice público de `notifications` y de `backup` (dirección prevista en ADR-005). Cada feature da su resumen como un tipo de dominio y un texto. `settings` solo lo presenta.
- **Licencias (ADR-018)**: un generador en `tools/licenses/` lee el bundle de release real de Android e iOS (source maps de `expo export`) y los módulos nativos autoenlazados. Con eso escribe un módulo TS versionado con un aviso por paquete y los textos sin repetir. Un test del proyecto `node` falla si cambian las dependencias de producción y la lista no se regeneró, si falta una dependencia directa, si una excepción quedó obsoleta o si aparece una licencia fuera de la lista blanca. **No hace falta ninguna dependencia nueva.**
- **Pantallas de licencias**: una lista virtualizada (`FlatList`) y un detalle por paquete con su texto completo, en una ruta con id validado.

---

## 2. Archivos a crear o modificar

### 2.1 Feature `settings` (`src/features/settings/`)

| Archivo | Responsabilidad |
|---|---|
| `domain/third-party-notices.ts` (nuevo) | Tipos (`ThirdPartyNotice`, `NoticeText`, `NoticeId`, `LicensePart`) y funciones puras: `sortNotices`, `findNotice`, `noticeTexts` y `LICENSE_LABELS` (de SPDX a nombre legible: `'Apache-2.0'` → "Apache 2.0", `'OFL-1.1'` → "SIL Open Font License 1.1"). |
| `domain/third-party-notices.generated.ts` (**generado**, versionado) | `THIRD_PARTY_NOTICES` y `LICENSE_TEXTS`. Lo escribe solo `npm run licenses:generate`. Tiene un docstring de cabecera que dice que no se edita a mano. |
| `domain/readable-paragraphs.ts` (nuevo) | `toReadableParagraphs(text)`: une las líneas cortadas a mano dentro de cada párrafo, para que el texto se lea bien en un teléfono. Respeta los párrafos, las listas y las líneas con sangría. El texto guardado no cambia: la unión es solo para mostrar. |
| `domain/index.ts` (nuevo) | API pública del dominio. |
| `hooks/use-app-version.ts` (nuevo) | `useAppVersion(): string`, que lee `appVersion` de `useDependencies()`. |
| `components/settings-section.tsx` (nuevo) | Encabezado de sección (rol `header`) + `Card` con filas. Es presentacional. |
| `components/privacy-note.tsx` (nuevo) | La nota de privacidad (texto del designer). |
| `components/license-row.tsx` (nuevo) | Fila de la lista: nombre visible, versión y licencia legible. |
| `components/license-text.tsx` (nuevo) | Encabezado de la parte (si hay más de una: "Código", "Fuente") + párrafos de `toReadableParagraphs`, con `selectable`. |
| `screens/settings-screen.tsx` (modificar) | Pantalla real: cuatro bloques. Usa `useReminderSummary` (notifications), `useLatestSafetyBackup` (backup) y `useAppVersion`. Recibe `onOpenNotifications`, `onOpenBackup` y `onOpenLicenses`. |
| `screens/licenses-screen.tsx` (nuevo) | `FlatList` sobre `sortNotices(THIRD_PARTY_NOTICES)` con una introducción breve. Recibe `onBack` y `onOpenNotice(id)`. |
| `screens/license-detail-screen.tsx` (nuevo) | Recibe un `ThirdPartyNotice` ya resuelto y muestra nombre, versión, expresión de licencia y cada texto. Recibe `onBack`. |
| `index.ts` (modificar) | Exporta `SettingsScreen`, `LicensesScreen`, `LicenseDetailScreen`, `findNotice` y `noticeIdSchema`. |

Cada archivo nuevo tiene su test al lado (sección 5).

### 2.2 Rutas (`src/app/`)

| Archivo | Responsabilidad |
|---|---|
| `src/app/(tabs)/settings.tsx` (modificar) | Pasa `onOpenNotifications`, `onOpenBackup` y `onOpenLicenses` con `router.push`. |
| `src/app/settings/licenses/index.tsx` (nuevo) | `/settings/licenses` → `LicensesScreen`, con `onOpenNotice` → `/settings/licenses/[id]`. |
| `src/app/settings/licenses/[id].tsx` (nuevo) | Valida `id` con `parseRouteParams` + `noticeIdSchema` y resuelve con `findNotice`. Si el id es inválido o desconocido, muestra `NotFoundScreen` y no lanza. |
| `src/app/settings/notifications.tsx`, `src/app/settings/backup.tsx` | Sin cambios. |

El plan nombra `src/app/settings/licenses.tsx`. La carpeta `licenses/` con `index.tsx` y `[id].tsx` da la misma URL `/settings/licenses` y suma el detalle. Si el designer elige mostrar el texto en la misma pantalla (sección 6, pregunta 4), queda solo `licenses.tsx`.

### 2.3 Aportes a otras features (aditivos, por su índice público)

| Archivo | Cambio |
|---|---|
| `features/notifications/domain/reminder-summary.ts` (nuevo) | `ReminderSummary` y `summarizeReminders(preferences, permission)` puro. |
| `features/notifications/components/notification-texts.ts` (modificar) | `reminderSummaryText(summary)`: usa `weekdayName` y `formatReminderTime`, que ya existen. |
| `features/notifications/hooks/use-reminder-summary.ts` (nuevo) | Combina `useNotificationPreferences` y `useNotificationPermission`, que ya existen y ya invalidan al volver a primer plano y al guardar. |
| `features/notifications/index.ts` | Exporta `useReminderSummary`, `reminderSummaryText` y el tipo `ReminderSummary`. |
| `features/backup/hooks/use-latest-safety-backup.ts` | `useLatestSafetyBackup()`: consulta `backupFiles.latestSafety()` con la clave `backupKeys.latestSafety()`. **Si F8.7 ya creó un hook equivalente para la sección "Copia de seguridad", se reutiliza ese y no se crea otro.** Se invalida al terminar `confirmRestore` y `cleanupBackupTemporaries`, que son los únicos que cambian `safety/`. |
| `features/backup/index.ts` | Exporta `useLatestSafetyBackup`, `formatBackupDate` (de `backup-messages.ts`, F8.7) y el tipo `SafetyBackupInfo`. |

### 2.4 Tooling de licencias (`tools/licenses/`, ADR-018)

| Archivo | Responsabilidad |
|---|---|
| `tools/licenses/collect.js` | Funciones puras: `packagesFromSourceMap(sources)` (de rutas a directorios de paquete, con *scopes* y `node_modules` anidados; ignora `src/`) y `packagesFromAutolinking(json)`. |
| `tools/licenses/resolve.js` | Funciones puras sobre un lector de archivos inyectado (`ProjectReader`): `readPackageLicense(dir)` (busca `LICENSE*`, `LICENCE*` y `COPYING*`, sin distinguir mayúsculas), aplica las excepciones, interpreta la expresión SPDX (`A AND B` exige un texto por parte; `A OR B` elige según la excepción o, si no hay, la primera permitida) y aplica la política. Los errores nombran el paquete. |
| `tools/licenses/render.js` | `buildNotices(packages)` (orden estable, ids únicos, textos normalizados a LF y sin espacios al final, sin repetir: clave = 12 primeros hex del `sha256`), `renderModule(notices)` (fuente TS) y `lockFingerprint(lockJson)` (`sha256` de `path@version#integrity` de las entradas sin `dev: true`, ordenadas). |
| `tools/licenses/policy.js` | `ALLOWED_LICENSES`: la lista blanca de ADR-018. |
| `tools/licenses/license-overrides.js` | Excepciones documentadas (sección 3.4). |
| `tools/licenses/texts/MIT.txt`, `texts/Apache-2.0.txt` | Plantillas canónicas SPDX para los paquetes sin archivo (`drizzle-orm`, `standard-navigation`). |
| `tools/licenses/generate-licenses.js` | CLI (`--check`). Hace dos `expo export` (Android e iOS) en un `mkdtemp` del sistema, sin `EXPO_PUBLIC_E2E` y con `NODE_ENV=production`, y localiza el `.map` desde `metadata.json`. Ejecuta `expo-modules-autolinking resolve` y `react-native-config` por plataforma y une todo. Después resuelve, renderiza, formatea con `prettier.format` + `resolveConfig`, escribe el módulo y `generated-from.json`, y borra el temporal. Con `--check` no escribe: sale con código 1 y un diff resumido (paquetes que sobran, faltan o cambian). Falla si un `.map` no existe o si el bundle tiene menos de 10 paquetes (protege contra una salida vacía si cambia el formato). |
| `tools/licenses/generated-from.json` (generado, versionado) | `{ lockFingerprint, platforms: ['android', 'ios'], expoVersion }`. |
| `tools/licenses/*.test.js` | Sección 5.1. |

### 2.5 Configuración

| Archivo | Cambio |
|---|---|
| `package.json` | Scripts `licenses:generate` (`node tools/licenses/generate-licenses.js`) y `licenses:check` (`… --check`). **Sin dependencias nuevas.** |
| `jest.config.js` | El proyecto `node` suma `'<rootDir>/tools/licenses/**/*.test.[jt]s?(x)'`. |
| `CLAUDE.md` (orquestador) | Comandos `npm run licenses:generate` y `licenses:check`, y la regla "después de `npx expo install` o de quitar una dependencia, regenerar las licencias". |
| `eslint.config.js` (opcional, sección 6, pregunta 7) | `no-restricted-globals` para `fetch`, `XMLHttpRequest` y `WebSocket` en `src/**`. Protege que la nota de privacidad siga siendo cierta. Sería una enmienda de ADR-013. |

---

## 3. Tipos e interfaces principales

### 3.1 Dominio de `settings`

```ts
/** Identificador estable de un aviso: slug de `name@version` (`heroui-native-1-0-11`). */
export type NoticeId = string & { readonly __brand: 'NoticeId' };

/** Parte del paquete a la que aplica un texto cuando la licencia es compuesta (`MIT AND OFL-1.1`). */
export type LicensePart = 'code' | 'font';

/** Un texto de licencia de un aviso. */
export interface NoticeText {
  /** Identificador SPDX permitido por la política (ADR-018). */
  readonly spdxId: string;
  /** `null` si el paquete tiene una sola licencia. */
  readonly part: LicensePart | null;
  /** Clave en `LICENSE_TEXTS`. */
  readonly textKey: string;
}

/** Aviso de un paquete de terceros incluido en la app. */
export interface ThirdPartyNotice {
  readonly id: NoticeId;
  readonly packageName: string;
  /** Nombre para la persona ("HeroUI Native", "Lexend", "Phosphor Icons"); si no hay excepción, `packageName`. */
  readonly displayName: string;
  readonly version: string;
  /** Expresión SPDX tal como la publica el paquete. */
  readonly license: string;
  readonly texts: readonly NoticeText[];
}

/** Generado: un aviso por paquete distribuido, ordenado por `packageName` y `version`. */
export declare const THIRD_PARTY_NOTICES: readonly ThirdPartyNotice[];
/** Generado: textos sin repetir, indexados por `textKey`. */
export declare const LICENSE_TEXTS: Readonly<Record<string, string>>;

/** Nombre legible de cada licencia permitida; un test exige las mismas claves que `ALLOWED_LICENSES`. */
export declare const LICENSE_LABELS: Readonly<Record<string, string>>;

export declare const noticeIdSchema: z.ZodType<NoticeId>;
export declare function findNotice(notices: readonly ThirdPartyNotice[], id: NoticeId): ThirdPartyNotice | null;
/** Por `displayName` sin distinguir mayúsculas (comparación por código, sin `Intl`, ADR-015) y después por versión. */
export declare function sortNotices(notices: readonly ThirdPartyNotice[]): readonly ThirdPartyNotice[];
/** Textos de un aviso, ya resueltos. */
export declare function noticeTexts(
  notice: ThirdPartyNotice,
  texts: Readonly<Record<string, string>>,
): readonly { readonly spdxId: string; readonly part: LicensePart | null; readonly text: string }[];
/** Párrafos para mostrar; no cambia el texto legal, solo une las líneas cortadas a mano. */
export declare function toReadableParagraphs(text: string): readonly string[];
```

`noticeIdSchema` solo valida la forma (`/^[a-z0-9-]{1,214}$/`). La existencia se comprueba con `findNotice`, para que la ruta no dependa de un `enum` de 80 valores.

### 3.2 Aportes de `notifications` y `backup`

```ts
/** Estado de los recordatorios para el resumen de Ajustes. */
export type ReminderSummary =
  | { readonly kind: 'loading' }
  | { readonly kind: 'permission_off' }
  | { readonly kind: 'permission_pending' }
  | { readonly kind: 'all_off' }
  | {
      readonly kind: 'on';
      readonly weekly: { readonly weekday: IsoWeekday; readonly minuteOfDay: number } | null;
      readonly monthly: boolean;
    };

/** Puro. `permission === undefined` o `preferences === undefined` → `loading`; `denied` → `permission_off`. */
export declare function summarizeReminders(
  preferences: NotificationPreferences | undefined,
  permission: NotificationPermission | undefined,
): ReminderSummary;
/** Texto en español (por ejemplo "Domingo a las 20:00 y resumen del mes"); el designer fija las frases. */
export declare function reminderSummaryText(summary: ReminderSummary): string | null;
export declare function useReminderSummary(): ReminderSummary;

/** `null` si no hay copia de seguridad. */
export declare function useLatestSafetyBackup(): UseQueryResult<SafetyBackupInfo | null>;
```

### 3.3 Pantallas

```ts
export interface SettingsScreenProps {
  readonly onOpenNotifications: () => void;
  readonly onOpenBackup: () => void;
  readonly onOpenLicenses: () => void;
}
export interface LicensesScreenProps {
  readonly onBack: () => void;
  readonly onOpenNotice: (id: NoticeId) => void;
}
export interface LicenseDetailScreenProps {
  readonly notice: ThirdPartyNotice;
  readonly onBack: () => void;
}
```

`LicensesScreen` y `LicenseDetailScreen` leen `THIRD_PARTY_NOTICES` y `LICENSE_TEXTS` del dominio. Son datos constantes, así que no pasan por TanStack Query ni por `AppDependencies`. Los tests usan los datos reales, porque lo que se prueba es justamente su contenido.

### 3.4 Tooling (JS con tipos en TSDoc)

```js
/** @typedef {{ readFile(path: string): string | null; listDir(path: string): string[] }} ProjectReader */
/** @typedef {{ dir: string; name: string; version: string; license: string }} BundledPackage */

/**
 * Excepciones; cada una lleva `reason`.
 * @type {{
 *   notShipped: Record<string, string>,
 *   displayNames: Record<string, string>,
 *   texts: Record<string, { reason: string, parts: { spdxId: string, part: 'code' | 'font' | null,
 *     from: { file: string } | { packageFile: { package: string, file: string } } |
 *           { template: 'MIT' | 'Apache-2.0', copyright: string | null } }[] }>,
 *   choices: Record<string, { reason: string, spdxId: string }>,
 * }}
 */
module.exports = { /* … */ };
```

Contenido inicial de las excepciones (verificado hoy en `node_modules` y en los repositorios):

| Paquete | Excepción |
|---|---|
| `@expo-google-fonts/lexend` | `MIT AND OFL-1.1`: `LICENSE` (código, MIT) y `LICENSE_FONT` (fuente, OFL 1.1, "Copyright 2018 The Lexend Project Authors…"). Nombre visible: "Lexend". |
| `heroui-native` | Nombre visible "HeroUI Native". `LICENSE` (Apache 2.0); no hay `NOTICE`. |
| `phosphor-react-native` | Nombre visible "Phosphor Icons". `LICENSE` (MIT, "Copyright (c) 2020 Dustin Do"). |
| `@react-native/asset-utils`, `@react-native/js-polyfills`, `@react-native/normalize-colors`, `@react-native/virtualized-lists` | Sin archivo propio. Usan `react-native/LICENSE` (mismo monorepo, "Copyright (c) Meta Platforms, Inc. and affiliates."). |
| `expo-router` | Sin archivo propio. Usa `expo/LICENSE` (monorepo de Expo, "650 Industries, Inc."). |
| `metro-runtime` | Sin archivo propio. Usa `metro/LICENSE`. |
| `drizzle-orm` | Sin archivo en el paquete. El repositorio tiene el texto Apache 2.0 estándar, con el apéndice sin completar y sin `NOTICE`: plantilla `Apache-2.0` con `copyright: null`. |
| `standard-navigation` | Sin archivo en el paquete. Plantilla `MIT` con "Copyright (c) 2026 React Navigation Contributors" (según el `LICENSE` del repositorio). |
| `react-dom` | `notShipped`: es peer de `expo-router` y no entra en el bundle nativo (ADR-016). |
| `tailwindcss` | `notShipped`: Uniwind lo usa al compilar. |

Si el generador encuentra un paquete sin archivo y sin excepción, se detiene. El code-writer agrega la excepción después de verificar la licencia en el repositorio del paquete. Nunca la inventa.

---

## 4. Flujo de datos y estado

### 4.1 Ajustes

```
SettingsRoute ((tabs)/settings.tsx) ── callbacks de navegación ──► SettingsScreen
  ├─ useReminderSummary()   ← useNotificationPreferences + useNotificationPermission (TanStack Query, F7)
  ├─ useLatestSafetyBackup() ← backupFiles.latestSafety() (TanStack Query, clave de backup)
  └─ useAppVersion()        ← useDependencies().appVersion (constante del proceso)
```

- **No hay estado propio.** Lo que cambia (preferencias, permiso, copia de seguridad) ya vive en el caché de sus features:
  - las preferencias se invalidan al guardar en `/settings/notifications`;
  - el permiso se relee al volver a primer plano (F7);
  - la copia de seguridad se invalida al terminar una restauración y la limpieza.

  Al volver a Ajustes con atrás, la pestaña sigue montada y se actualiza sola por esas invalidaciones, sin `useFocusEffect`.
- **Estados de las filas**:
  - mientras algo carga, la fila se muestra sin subtítulo (nunca un spinner en Ajustes);
  - si una lectura falla, la fila se muestra igual, sin subtítulo, y el error queda en el `logger`.

  La navegación nunca depende de que el resumen cargue.
- **Versión**: `Constants.expoConfig.version` (hoy `1.0.0`, de `app.json`). Si falta, `create-app-dependencies` deja `'unknown'` y la pantalla muestra el texto que defina el designer para ese caso (pregunta 3), nunca "unknown".
- **Respaldo y la copia de seguridad**: Ajustes solo informa ("Tienes una copia de seguridad del {fecha}") y navega a `/settings/backup`. Ahí la sección "Copia de seguridad" de F8.7 hace todo el flujo (vista previa, confirmación y progreso). Con un solo camino no hay dos implementaciones del flujo más delicado de la app.
- **Sin enlaces externos**: no hay tiendas, cuentas, "califica la app" ni enlaces web (D-23). Los avisos de licencia no muestran URLs tocables (pregunta 5).

### 4.2 Licencias: generación (desarrollo)

```
npm run licenses:generate
  expo export android + ios (source maps, sin EXPO_PUBLIC_E2E) ─► sources[] ─► packagesFromSourceMap
  expo-modules-autolinking resolve / react-native-config ───────► packagesFromAutolinking
  ∪ (por dir) ─► resolve (package.json + LICENSE* + excepciones + política) ─► buildNotices
  ─► renderModule ─► prettier.format ─► src/features/settings/domain/third-party-notices.generated.ts
  ─► lockFingerprint(package-lock.json) ─► tools/licenses/generated-from.json
```

### 4.3 Licencias: control (cada `npm test`, sin compilar)

```
freshness.test.js
  lockFingerprint(package-lock.json actual) === generated-from.json.lockFingerprint
  ∀ dependencia directa de package.json: tiene aviso ∨ está en notShipped
  ∀ notShipped: sigue siendo dependencia directa y no tiene aviso
  ∀ aviso: spdxId ∈ ALLOWED_LICENSES, texto no vacío, textKey existe
  claves(LICENSE_LABELS) === ALLOWED_LICENSES
```

El mensaje de error dice qué hacer: "Las dependencias de producción cambiaron: ejecuta `npm run licenses:generate`".

### 4.4 Licencias: pantalla (ejecución)

`LicensesScreen` → `sortNotices(THIRD_PARTY_NOTICES)` → `FlatList` (`keyExtractor = id`, `renderItem` definido fuera del JSX). Al tocar una fila, `onOpenNotice(id)` → la ruta `[id]` valida, resuelve y entrega `notice` a `LicenseDetailScreen` → `noticeTexts` → `toReadableParagraphs` por texto. El texto más largo (Apache 2.0, unos 11 KB) se muestra en un `ScrollView` con un `Text` por párrafo, para que la letra grande no corte nada.

---

## 5. Tests que el code-writer escribe primero

### 5.1 Tooling (proyecto `node`)

**`collect.test.js`**
- `packagesFromSourceMap`:
  - devuelve un paquete normal, uno con *scope* (`@tanstack/react-query`) y uno anidado (`react-native-reanimated/node_modules/semver`) como directorios distintos;
  - ignora `src/…` y las rutas sin `node_modules/`;
  - no repite paquetes;
  - acepta rutas absolutas y relativas (`/node_modules/…`, como sale hoy).
- `packagesFromAutolinking` lee `modules[].packageName` (Expo) y `dependencies` (RN) y falla con un mensaje claro si falta la forma esperada.

**`resolve.test.js`** (con un `ProjectReader` en memoria)
- Encuentra `LICENSE`, `LICENSE.md`, `LICENCE` y `COPYING` sin distinguir mayúsculas.
- Sin archivo y sin excepción → error con el nombre del paquete. Con excepción `packageFile` o `template`, usa ese texto y la plantilla MIT incluye el copyright.
- `MIT AND OFL-1.1` sin una parte por cada licencia → error. Con las partes, devuelve dos textos con `part`.
- `MIT OR Apache-2.0` sin elección → toma la primera permitida. `(BSD-3-Clause OR GPL-2.0)` → `BSD-3-Clause`.
- `GPL-3.0`, `MPL-2.0`, `UNLICENSED` o una licencia ausente → error de política con el nombre del paquete.
- Una excepción `texts` para un paquete que ya tiene archivo → error (excepción innecesaria).

**`render.test.js`**
- `buildNotices` da el mismo resultado con la entrada en cualquier orden.
- Ids únicos: dos versiones del mismo paquete dan ids distintos y un choque lanza.
- Textos iguales (después de normalizar CRLF y los espacios finales) se guardan una sola vez.
- `renderModule` produce TS válido: se compila con `typescript.transpileModule` sin diagnósticos y exporta lo esperado.
- `lockFingerprint` no cambia con una entrada `dev: true` nueva o modificada, y cambia con la versión o el `integrity` de una entrada de producción.

**`generate-licenses.test.js`**
- Con los pasos externos inyectados (export, autolinking y escritura):
  - `--check` devuelve 1 y lista lo que falta, lo que sobra y lo que cambió;
  - con todo igual devuelve 0 y no escribe;
  - un `.map` ausente o con menos de 10 paquetes falla;
  - el entorno de los exports no tiene `EXPO_PUBLIC_E2E`.

**`freshness.test.js`** (sobre los archivos reales del repositorio): las cinco condiciones de 4.3. Este es el test que pide F9.1 ("falla si una dependencia de producción no tiene su licencia en la lista generada"). Para probar que falla, un caso sobre un `package.json` en memoria con una dependencia inventada y otro con una huella distinta.

### 5.2 Dominio (proyecto `node`)

**`third-party-notices.test.ts`**
- `THIRD_PARTY_NOTICES` incluye:
  - "HeroUI Native" con `Apache-2.0` y un texto que contiene "Apache License" y "Version 2.0";
  - "Lexend" con dos textos: `code` MIT y `font` OFL-1.1, que contiene "SIL Open Font License";
  - "Phosphor Icons" con MIT y "Dustin Do".
- Todos los `textKey` existen en `LICENSE_TEXTS`, no hay ids repetidos y cada `spdxId` tiene `LICENSE_LABELS`.
- `sortNotices` no distingue mayúsculas, es estable y desempata por versión. `findNotice` devuelve `null` con un id desconocido.
- `noticeIdSchema` rechaza `../x`, mayúsculas, el texto vacío y 215 caracteres.

**`readable-paragraphs.test.ts`**
- El texto MIT de 80 columnas da 3 párrafos sin saltos internos.
- Las líneas de lista (`-`, `*`, `1.`, `(a)`) y las que tienen sangría no se unen con la anterior.
- CRLF se trata igual que LF.
- Al unir todos los párrafos con espacios queda la misma secuencia de palabras del original, así que no se pierde texto.

**`notifications/domain/reminder-summary.test.ts`**
- `undefined` → `loading`; `denied` → `permission_off`; sin decidir → `permission_pending`.
- Semanal y mensual apagados con permiso → `all_off`. Solo el semanal → `on` con `monthly: false`. Solo el mensual → `weekly: null`.

### 5.3 UI (proyecto `ui`)

**`settings-screen.test.tsx`** (con `renderWithProviders` y los dobles de `core/testing`)
- Título "Ajustes" y los encabezados de las cuatro secciones, con rol `header`.
- "Recordatorios" muestra el resumen de cada caso de `ReminderSummary` (textos del designer) y no muestra nada mientras carga. Al tocarla, llama a `onOpenNotifications`.
- "Respaldo y planillas" sin copia no la menciona; con `FakeBackupFiles` con copia, muestra la fecha con `formatBackupDate`. Al tocarla, llama a `onOpenBackup`.
- La nota de privacidad está visible y no coincide con `GUILT_PATTERNS`.
- "Versión 1.0.0-test" (la `appVersion` de los dobles) y la frase de respaldo cuando la versión es `'unknown'`.
- "Licencias de terceros" llama a `onOpenLicenses`.
- No hay botones de cuentas, tiendas ni enlaces externos. Se verifica que todos los `button` sean los tres de navegación.
- Si falla la lectura del permiso o de la copia, las filas siguen visibles y se pueden tocar.

**`licenses-screen.test.tsx`**
- Muestra la introducción. Las filas de HeroUI Native, Lexend y Phosphor Icons tienen su versión y su licencia legible.
- Al tocar una fila llama a `onOpenNotice` con su id. Es una `FlatList` (no un `.map` en `ScrollView`). Volver llama a `onBack`.

**`license-detail-screen.test.tsx`**
- HeroUI Native muestra "Apache License".
- Lexend muestra dos bloques con encabezado (código y fuente) en ese orden.
- Un aviso de una sola licencia no muestra encabezado de parte.
- El texto se puede seleccionar.

**`notifications/hooks/use-reminder-summary.test.tsx`** y **`backup/hooks/use-latest-safety-backup.test.tsx`**
- Reflejan los cambios: guardar preferencias, cambiar el permiso y volver a primer plano, y la invalidación después de `confirmRestore`.

**Rutas** (`src/__tests__/settings/settings-routes.test.tsx`, con `renderRouter`)
- Desde la pestaña Ajustes se llega a `/settings/notifications`, a `/settings/backup` y a `/settings/licenses`. Desde la lista, a `/settings/licenses/<id de heroui-native>`. Volver regresa a cada paso.
- `/settings/licenses/no-existe` y `/settings/licenses/..%2F` muestran `NotFoundScreen` sin lanzar.

### 5.4 Verificación

- **F9.1**: V-UI, V-BASE y además `npm run licenses:check` en verde.
- **F9.2 (reviewer)**:
  - revisa cada excepción de `license-overrides.js` contra el repositorio del paquete;
  - revisa que el módulo generado no se haya editado a mano (`licenses:check`).

### 5.5 E2E (F9.3, `e2e/maestro/settings/`)

- `sections.yaml`: pestaña Ajustes → ve los cuatro bloques → "Recordatorios" abre su pantalla (título) → volver → "Respaldo y planillas" abre la suya → volver → ve "Versión 1.0.0".
- `licenses.yaml`: Ajustes → "Licencias de terceros" → `scrollUntilVisible` hasta "HeroUI Native" → abre y ve "Apache License" → volver → lo mismo con "Lexend" ("SIL Open Font License") y "Phosphor Icons" ("MIT License") → volver dos veces y queda en Ajustes.
- `safety-copy.yaml`: `_shared/seed.yaml` con `basic` (la semilla restaura, así que crea una copia de seguridad) → Ajustes muestra la mención de la copia → "Respaldo y planillas" muestra "Restaurar esta copia". No restaura: eso ya lo cubre F8.10.
- **F10**:
  - F10.1 recorre Ajustes y un detalle de licencia con TalkBack y con la letra más grande;
  - F10.0 puede fijar un presupuesto para abrir la lista de licencias en el Android de referencia (unas 80 filas; no se espera que sea un problema);
  - F10.7 incluye `npm run licenses:check` en el gate.

---

## 6. Riesgos y decisiones abiertas

### 6.1 Preguntas para el usuario (con valor por defecto)

1. **¿Qué resumen muestra cada fila de Ajustes?**
   - **Por defecto**: "Recordatorios" muestra el estado ("Domingo a las 20:00 y resumen del mes", "Apagados" o "Los avisos están apagados en tu teléfono").
   - "Respaldo y planillas" muestra "Tienes una copia de seguridad del {fecha}" solo si existe; si no, una frase fija del designer.
   - El designer fija los textos.
2. **¿La copia de seguridad (D-22) tiene una fila propia en Ajustes o se ve dentro de Respaldo?** **Por defecto**: dentro de Respaldo, como ya diseñó F8.1 (UX-B11). Ajustes solo la menciona en el resumen. Alternativa: una fila "Copia de seguridad" que abra `/settings/backup` en esa sección.
3. **¿Qué dice "Acerca de"?**
   - **Por defecto**: nombre "Kofi" y "Versión 1.0.0". Si la versión no está disponible, se omite la línea.
   - Sin número de build ni versión del esquema o del formato de respaldo, que no le dicen nada a la persona.
   - Sin contacto, correo ni formulario de comentarios (D-23).
4. **¿El texto de cada licencia en una pantalla aparte o desplegado en la lista?** **Por defecto**: pantalla aparte (`/settings/licenses/[id]`). Con 80 entradas y textos de hasta 11 KB, desplegarlos hace la lista larga e incómoda con TalkBack. El designer puede elegir otra cosa: este diseño la soporta cambiando solo las pantallas.
5. **¿Los avisos muestran el enlace del repositorio de cada paquete?** **Por defecto**: no. Ni como enlace ni como texto. El copyright y la licencia van en el propio texto, y la app no lleva a la web (D-23). Si se quiere, se agrega `repository` al módulo generado como texto no tocable.
6. **¿La lista destaca HeroUI Native, Lexend y Phosphor arriba?** **Por defecto**: no. Una sola lista alfabética, con una frase de introducción. Los tres se encuentran por nombre y se verifican en los tests y en el E2E.
7. **Nota de privacidad: ¿se protege con una regla de lint?** La nota dice que los datos viven en el teléfono. Hoy no hay ningún `fetch`, `XMLHttpRequest`, `WebSocket` ni `Linking.openURL` en `src/` (verificado).
   - **Por defecto**: sí. `no-restricted-globals` para esos tres en `src/**`, como enmienda de ADR-013, para que un cambio futuro no deje la nota en falso sin que nadie lo note.
   - Texto de la nota, **por defecto**: "Tus datos viven en tu teléfono. Kofi no tiene cuentas ni envía tus datos a internet. Para guardarlos en otro lugar, crea un respaldo." (D-09: el respaldo no tiene contraseña. El designer decide si lo dice ahí o solo en Respaldo).

### 6.2 Riesgos técnicos

- **Alcance de los avisos**: ADR-018 cubre todo lo que viene de npm (JS del bundle y módulos nativos autoenlazados). No cubre los artefactos de Gradle y CocoaPods ni las bibliotecas que trae `react-native` en sus binarios. Es aceptable en la v1, que no se publica (D-23), y queda en el índice como ADR pendiente para el release. **Para el usuario**: confirmar que la pantalla puede decir "Bibliotecas de código abierto incluidas en la app" sin prometer que la lista es exhaustiva a nivel nativo. **Por defecto**: sí, con esa frase.
- **Interfaces de Expo de las que depende el generador** (`metadata.json`, el `.map` y el JSON de autolinking): si cambian con el SDK, el generador falla en voz alta. No genera una lista vacía, porque exige 10 o más paquetes y la forma esperada.
- **Imports nuevos sin cambio de lockfile**: si se empieza a importar un paquete ya instalado que antes no estaba en el bundle, el test de frescura no lo detecta. Lo detectan `licenses:check` (F9.1, CPs, F10.7) y la verificación de dependencias directas. Ejemplo real hoy: `expo-document-picker` entra al bundle de JS cuando F8.7 lo use, pero ya está cubierto como módulo autoenlazado.
- **Regenerar es lento** (dos exports, unos 90 s) y **usa Metro**. Si el code-writer de F8.7 tiene `expo start` abierto, no hay conflicto: el export usa su propio directorio de salida. El generador no toca `.expo/` más allá de lo que hace `expo export`.
- **Tamaño**: unos 100 KB de texto en el bundle. Es aceptable. Si F10.0 lo objeta, el módulo se puede mover a un asset JSON cargado solo en la pantalla de licencias, sin cambiar los tipos.
- **`appVersion` y la versión nativa**: `Constants.expoConfig.version` sale de `app.json` y coincide con `versionName` porque los builds son locales con prebuild. La política de `version` y `versionCode` queda para el ADR de release (ADR-016, "Futuro").
- **Coordinación con F8.7**: `settings-screen.tsx` y `(tabs)/settings.tsx` los está tocando ahora el code-writer de respaldo (fila provisional "Respaldo"). F9.1 parte de ese estado. El hook de la copia de seguridad se reutiliza si F8.7 lo creó (2.3).
- **ADR-018 queda "Propuesto"**: el orquestador lo acepta o pide cambios antes de F9.1.
