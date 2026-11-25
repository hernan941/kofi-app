# Especificación de pantallas — Ajustes y licencias (F9)

- **Tarea**: F9.0 de `docs/plan-v1.md` (parte del designer). La usan F9.1 (implementación), F9.2 (revisión), F9.3 (E2E) y F10.1 (TalkBack y letra grande).
- **Fuentes**: `docs/architecture/settings.md` (fuente principal), ADR-018, `docs/design-system.md` (Bruma), `docs/design/notifications.md` (F7.1), `docs/design/backup.md` (F8.1), `docs/product.md` (D-09, D-22, D-23, D-28, D-44 y D-46) y los componentes de `@/shared/ui`.
- Este documento no define lógica de negocio ni cómo se genera la lista de licencias (eso es ADR-018). Fija lo que la persona ve y oye: estructura, textos exactos, estados, accesibilidad y navegación.
- D-46 ya responde las preguntas 1 a 6 de `docs/architecture/settings.md` (6.1): resumen en cada fila, la copia de seguridad se menciona dentro de "Respaldo y planillas", Acerca de con nombre y versión, detalle de licencia en pantalla aparte, sin enlaces externos y lista alfabética sin destacados. La pregunta 7 (regla de lint) no es de diseño; la nota de privacidad de 3.1 es cierta hoy con o sin esa regla.

---

## 1. Decisiones de diseño

| Id | Decisión | Por qué |
|---|---|---|
| UX-S1 | **Ajustes es una lista corta de filas que llevan a otras pantallas**, en este orden: Recordatorios, Respaldo y planillas, Privacidad y Acerca de. Cada fila que navega muestra debajo un resumen de su estado. | Es lo que pide D-46. Con el resumen, la persona sabe cómo están sus avisos y su respaldo sin entrar. Lo más usado queda arriba, al alcance del pulgar. |
| UX-S2 | **Recordatorios y Respaldo van juntos en una tarjeta sin encabezado**, con una fila cada uno. Privacidad y Acerca de tienen encabezado (`text-heading`, rol `header`). | Un encabezado "Recordatorios" encima de una fila "Recordatorios" repite lo mismo: se ve raro y el lector lo dice dos veces. Así lo hacen también los ajustes de iOS y Android: el primer grupo no lleva título. Privacidad y Acerca de sí lo necesitan, porque su contenido no se explica solo. |
| UX-S3 | **La nota de privacidad va sin tarjeta**, como texto bajo su encabezado. | Es para leer, no para tocar. Sin tarjeta, la pantalla queda con dos tarjetas con sombra (el máximo es tres, sistema de diseño 4.4), y la nota no parece un botón. |
| UX-S4 | **La nota de privacidad dice también cuándo salen los datos y qué pasa al cambiar de teléfono.** | "Tus datos viven en tu teléfono" es tranquilizador, pero tiene una consecuencia: si se borra la app, se van con ella. Decirlo con calma, junto con qué hacer (crear un respaldo), protege más que asustar después. Compartir un respaldo o una planilla es la única forma en que algo sale del teléfono, y la frase lo reconoce para ser exacta. |
| UX-S5 | **La copia de seguridad (D-22) solo se menciona en el resumen de "Respaldo y planillas".** Para restaurarla, se entra a Respaldo, donde está su sección (UX-B11). | Restaurar es el flujo más delicado de la app y ya tiene vista previa, confirmación y progreso en F8. Un segundo camino desde Ajustes sería una segunda implementación de lo mismo. |
| UX-S6 | **Si la versión no se conoce, la fila de Acerca de muestra solo "Kofi"**, sin la línea de versión. | Una palabra técnica como "unknown" no le sirve a nadie. Es un caso que no debería ocurrir en un build real. |
| UX-S7 | **Las licencias van en una lista alfabética que se ve como una sola tarjeta** (igual que la lista de productos), con una frase de introducción arriba. Cada fila abre el texto completo en otra pantalla. | Son unas 80 entradas y textos de hasta 11 KB. Desplegarlos en la lista la haría larguísima e incómoda con TalkBack. La forma de tarjeta única ya la usa Productos, así que la app se ve igual en todas sus listas. |
| UX-S8 | **El orden alfabético ignora la "@" inicial** de los nombres de paquete (`@tanstack/react-query` se ordena en la T). | Para la persona, la "@" no es una letra. Sin esta regla, unas 30 entradas se amontonarían al principio y HeroUI Native quedaría lejos de donde se lo busca. |
| UX-S9 | **En el detalle, el texto legal es seleccionable párrafo por párrafo** y se muestra en `text-sm` `foreground`. No hay botón "Copiar". | Seleccionar sirve para copiar un aviso. Un botón de copiar pide `expo-clipboard`, que no está entre las dependencias, para algo que casi nadie va a usar. El `text-sm` reduce el desplazamiento del texto más largo sin bajar el contraste (14.6:1 y 15.7:1 sobre el fondo, en claro y oscuro). |
| UX-S10 | **Sin enlaces, URLs ni correos** en ninguna de las tres pantallas (D-23, D-46). | La app no lleva a la web. El aviso legal ya incluye el copyright y la licencia. |

---

## 2. Navegación

```
Pestaña Ajustes (/(tabs)/settings, SettingsScreen)
  ├─ "Recordatorios"        ─► /settings/notifications (F7.7, sin cambios) ─► volver ─► Ajustes
  ├─ "Respaldo y planillas" ─► /settings/backup (F8.7, sin cambios)        ─► volver ─► Ajustes
  └─ "Licencias de terceros" ─► /settings/licenses (LicensesScreen)
                                  └─ una fila ─► /settings/licenses/[id] (LicenseDetailScreen)
                                                   └─ volver ─► lista (en la misma posición)
Id inválido o desconocido en /settings/licenses/[id] ─► NotFoundScreen ("Ir al inicio")
```

- Ajustes es una pestaña: `ScreenHeader` con título y **sin** volver.
- Las tres pantallas de destino son apiladas en el `Stack` raíz (sin pestañas), con `ScreenHeader` propio y volver. El atrás de Android y el gesto de iOS hacen lo mismo que "Volver".
- Al volver del detalle, la lista conserva su posición de desplazamiento (la pantalla sigue montada en la pila).
- Al volver de Recordatorios o de Respaldo, los resúmenes de Ajustes ya están al día por las invalidaciones de sus features (`docs/architecture/settings.md`, 4.1). No hace falta ninguna acción de la pantalla.
- Las rutas son las de la arquitectura (2.2): `src/app/settings/licenses/index.tsx` y `src/app/settings/licenses/[id].tsx`.

---

## 3. Pantallas

Los textos entre comillas son **exactos** (tabla completa en la sección 5).

### 3.1 Ajustes (`/(tabs)/settings`, `SettingsScreen`)

`Screen` con `ScreenHeader` (título **"Ajustes"**, sin volver) y un `ScrollView` con `px-4`, `pt-4`, `pb-8` y `gap-6`:

1. **Tarjeta de navegación** (`Card` sin título; filas separadas por `ListSeparator`):
   1. `ListRow` tocable **"Recordatorios"**, `subtitle` = resumen (5.2), `trailing` `CaretRight` en `muted`, pista **"Cambia el día, la hora o apaga los avisos"**. Llama a `onOpenNotifications`.
   2. `ListRow` tocable **"Respaldo y planillas"**, `subtitle` = resumen (5.3), `trailing` `CaretRight`, pista **"Crea un respaldo, exporta planillas o vuelve a una copia"**. Llama a `onOpenBackup`.
2. **Privacidad** (`SettingsSection` sin tarjeta, `gap-3`):
   - Encabezado `text-heading` `foreground`, rol `header`: **"Privacidad"**.
   - `PrivacyNote`: dos párrafos, `gap-2`, que se leen como **un solo elemento**:
     - `text-base` `foreground`: **"Tus datos viven en tu teléfono. Kofi no tiene cuentas y no envía nada a internet. Tus datos solo salen del teléfono cuando tú compartes un respaldo o una planilla."**
     - `text-base` `muted`: **"Si borras la app o cambias de teléfono, tus datos no se pasan solos. Para llevarlos contigo, crea un respaldo."**
3. **Acerca de** (`SettingsSection` con tarjeta, `gap-3`):
   - Encabezado `text-heading`, rol `header`: **"Acerca de"**.
   - `Card` sin título, con:
     1. `ListRow` **sin toque** **"Kofi"**, `subtitle` **"Versión {versión}"** ("Versión 1.0.0"). Sin la línea si la versión es `'unknown'` o está vacía (UX-S6).
     2. `ListSeparator`.
     3. `ListRow` tocable **"Licencias de terceros"**, `subtitle` **"Bibliotecas de código abierto que usa la app"**, `trailing` `CaretRight`, pista **"Abre la lista de licencias"**. Llama a `onOpenLicenses`.

- **Sin íconos al inicio de las filas**, igual que en Recordatorios y Respaldo. Los títulos se entienden solos.
- **Sombras a la vista**: las dos tarjetas.
- **Botones**: exactamente tres (las tres filas que navegan). No hay cuentas, tiendas, "califica la app", contacto ni enlaces (D-23).
- **Una mano**: todo cabe en una pantalla de 360 × 640 con letra normal. Las dos filas más usadas están en el primer tercio.
- **Letra grande**: los subtítulos se acomodan en varias líneas; la pantalla se desplaza. Nada se recorta.

### 3.2 Licencias de terceros (`/settings/licenses`, `LicensesScreen`)

`Screen` con `ScreenHeader` (volver, título **"Licencias de terceros"**). Debajo, una `FlatList` con `px-4` y `pb-8`:

1. **Introducción** (`ListHeaderComponent`, `pb-4`), `text-base` `muted`: **"Kofi usa bibliotecas de código abierto. Aquí están sus licencias, en orden alfabético. Toca una para leer el texto completo."**
2. **Filas** (`LicenseRow`), en el orden de `sortNotices` (UX-S8). Se ven como una sola tarjeta: fondo `surface`, bordes laterales de 2 px `border`, la primera fila con `rounded-t-3xl border-t-2` y la última con `rounded-b-3xl border-b-2`, separadas por `ListSeparator` dentro de la tarjeta (el mismo recurso de `product-list.tsx`, ver 6.2). Sin sombra, porque la tarjeta es más alta que la pantalla.
   - `title`: `displayName` ("HeroUI Native", "Lexend", "Phosphor Icons", "@tanstack/react-query").
   - `subtitle`: **"Versión {versión} · {licencia}"** ("Versión 1.0.11 · Apache 2.0"). `{licencia}` son los nombres legibles de 5.5 de cada texto del aviso, unidos con " y " ("MIT y SIL Open Font License 1.1" en Lexend).
   - `trailing`: `CaretRight` en `muted`.
   - `accessibilityLabel`: **"{nombre}, versión {versión}, {licencia}"** ("HeroUI Native, versión 1.0.11, Apache 2.0"); pista **"Abre el texto completo de la licencia"**.
   - Al tocar, llama a `onOpenNotice(id)`.

- **Sin buscador ni índice de letras**: con unas 80 filas alfabéticas, desplazar alcanza. Si la lista crece mucho, se evalúa.
- **Nombres largos** (`@react-native-async-storage/async-storage`): el título se acomoda en dos líneas; no se recorta con "…".
- **Rendimiento**: `keyExtractor = id`, `renderItem` fuera del JSX, sin `getItemLayout` (con letra grande la altura cambia).

### 3.3 Detalle de una licencia (`/settings/licenses/[id]`, `LicenseDetailScreen`)

`Screen` con `ScreenHeader` (volver, título = **`displayName`**, que se acomoda en varias líneas). Debajo, un `ScrollView` con `px-4`, `pt-2`, `pb-8` y `gap-6`:

1. **Datos del paquete** (`gap-1`), un solo elemento para el lector:
   - `text-base` `foreground`: **"Versión {versión}"**.
   - Solo si `packageName` es distinto de `displayName`, `text-sm` `muted`: **"Paquete: {packageName}"** ("Paquete: heroui-native").
   - `text-sm` `muted`: **"Licencia: {licencia}"**, con los mismos nombres de 5.5 unidos con " y ".
2. **Textos** (`LicenseText`, uno por cada texto del aviso, en el orden de `noticeTexts`: primero el código y después la fuente), `gap-3`:
   - Solo si el aviso tiene más de un texto (`part` no es `null`), encabezado `text-heading`, rol `header`: **"Licencia del código: {licencia}"** o **"Licencia de la fuente: {licencia}"**.
   - Un `Text` por párrafo de `toReadableParagraphs`, `text-sm` `foreground`, con `selectable`, `gap-3` entre párrafos. Las líneas de lista y con sangría se ven como las entrega `toReadableParagraphs`, sin viñetas agregadas.

- **Sin botones** aparte de volver. Sin enlaces (las URLs que aparezcan dentro del texto legal se muestran como texto, sin detectar enlaces: no se pasa `dataDetectorType`, y `Text` de React Native no los detecta por defecto).
- **Sombras**: ninguna. Es una pantalla para leer.
- **Letra grande**: el texto crece sin límite (`allowFontScaling`, sin `maxFontSizeMultiplier`). Al ser un `Text` por párrafo, ningún bloque queda demasiado alto para dibujarse.

---

## 4. Estados

### 4.1 Ajustes

Ajustes **nunca muestra un estado de carga ni de problema de pantalla completa**: es un índice y la navegación no depende de nada que cargue.

| Situación | Qué se ve |
|---|---|
| Recordatorios cargando (`loading`) | La fila sin subtítulo. Sin spinner. |
| Lectura del permiso o de las preferencias con problema | La fila sin subtítulo; se puede tocar igual. El problema queda en el `logger`. |
| Respaldo cargando o lectura de la copia con problema | La fila con la frase sin copia (5.3), que siempre es cierta. Se puede tocar igual. |
| Hay copia de seguridad | La frase con la fecha (5.3). |
| Instalación nueva (sin datos, sin permiso decidido) | Recordatorios: "Los avisos están sin activar". Respaldo: la frase sin copia. Todo lo demás igual. |
| Volviendo de Recordatorios o de Respaldo con cambios | Los subtítulos ya muestran el estado nuevo. |
| Versión desconocida | "Kofi" sin la línea de versión. |

### 4.2 Licencias

| Situación | Qué se ve |
|---|---|
| Normal | 3.2. Los datos son constantes: no hay carga ni vacío. |
| Lista vacía | No ocurre (un test del dominio exige HeroUI Native, Lexend y Phosphor). Si ocurriera, se ve solo la introducción, sin pantalla de problema. |

### 4.3 Detalle

| Situación | Qué se ve |
|---|---|
| Normal, una licencia | 3.3 sin encabezado de parte. |
| Normal, licencia compuesta (Lexend) | 3.3 con dos encabezados, código y fuente. |
| Id con forma inválida o desconocido | `NotFoundScreen` ("No encontramos esa pantalla", "Ir al inicio"), sin lanzar. |

---

## 5. Textos

Español neutro con tuteo y sin culpa: ninguno coincide con `GUILT_PATTERNS` (verificado con las mismas expresiones de `src/shared/lib/testing/guilt-patterns.ts`). Sin palabras técnicas para la persona ("SPDX", "npm", "bundle", "unknown").

### 5.1 Ajustes

| Clave sugerida | Texto |
|---|---|
| Título | "Ajustes" |
| Fila de recordatorios | "Recordatorios" · pista "Cambia el día, la hora o apaga los avisos" |
| Fila de respaldo | "Respaldo y planillas" · pista "Crea un respaldo, exporta planillas o vuelve a una copia" |
| Encabezado de privacidad | "Privacidad" |
| Nota de privacidad, párrafo 1 | "Tus datos viven en tu teléfono. Kofi no tiene cuentas y no envía nada a internet. Tus datos solo salen del teléfono cuando tú compartes un respaldo o una planilla." |
| Nota de privacidad, párrafo 2 | "Si borras la app o cambias de teléfono, tus datos no se pasan solos. Para llevarlos contigo, crea un respaldo." |
| Encabezado de Acerca de | "Acerca de" |
| Nombre | "Kofi" |
| Versión | "Versión {versión}" ("Versión 1.0.0") |
| Fila de licencias | "Licencias de terceros" · "Bibliotecas de código abierto que usa la app" · pista "Abre la lista de licencias" |

- **"Kofi" se escribe siempre con mayúscula inicial** (ADR-021); reemplaza la regla anterior de escribir "cuantovendi" en minúscula.
- **D-09** (respaldo sin contraseña) no se repite en la nota: ya está junto a "Crear respaldo" (F8.1, 3.1), que es donde la persona decide dónde guardarlo.

### 5.2 Resumen de Recordatorios (`reminderSummaryText`, en `features/notifications`)

| `ReminderSummary` | Subtítulo |
|---|---|
| `loading` | ninguno (`null`) |
| `permission_off` (denegado en el teléfono) | "Los avisos están apagados en tu teléfono" |
| `permission_pending` (sin decidir) | "Los avisos están sin activar" |
| `all_off` | "Apagados" |
| `on`, semanal y mensual | "{Días} a las {hora} y resumen del mes" ("Domingos a las 20:00 y resumen del mes") |
| `on`, solo semanal | "{Días} a las {hora}" ("Domingos a las 20:00") |
| `on`, solo mensual | "Solo el resumen del mes" |

- `{Días}` y `{hora}` son los mismos de F7.1 (5.3): `weekdayPlural(weekday, { capitalized: true })` y `formatReminderTime(minuteOfDay)`. Así la fila de Ajustes y la fila "Día y hora" de Recordatorios dicen lo mismo con las mismas palabras. (La arquitectura pone de ejemplo "Domingo a las 20:00"; vale el plural.)
- **Precedencia (pedido al code-writer, sin cambiar la lógica de notificaciones)**: si la persona apagó el semanal y el mensual, el resumen es **"Apagados"** aunque el permiso esté sin decidir o denegado. `summarizeReminders` revisa primero `all_off` y después el permiso. Así no se le sugiere activar avisos a quien eligió no recibirlos.
- Sin culpa ni insistencia: "sin activar" describe, no pide. No se usa "todavía".

### 5.3 Resumen de Respaldo y planillas

| Situación | Subtítulo |
|---|---|
| Sin copia de seguridad, cargando o con problema al leer | "Guarda tus datos o expórtalos en planillas" |
| Con copia de seguridad | "Tienes una copia de seguridad {de/del fecha}" |

- La fecha sale de `formatBackupDate(createdAt, now, calendar)` y el artículo de `backupDateOf` (F8, 5.6): **"Tienes una copia de seguridad de hoy, 15:42"**, **"…de ayer, 9:05"** o **"…del 13 de noviembre de 2026, 15:42"**.
- El hook `useLatestSafetyBackup` es el de la arquitectura (2.3), o el de F8.7 si ya existe.

### 5.4 Licencias

| Clave sugerida | Texto |
|---|---|
| Título de la lista | "Licencias de terceros" |
| Introducción | "Kofi usa bibliotecas de código abierto. Aquí están sus licencias, en orden alfabético. Toca una para leer el texto completo." |
| Subtítulo de una fila | "Versión {versión} · {licencia}" |
| Etiqueta de una fila | "{nombre}, versión {versión}, {licencia}" |
| Pista de una fila | "Abre el texto completo de la licencia" |
| Detalle: versión | "Versión {versión}" |
| Detalle: paquete | "Paquete: {packageName}" (solo si difiere del nombre) |
| Detalle: licencia | "Licencia: {licencia}" |
| Detalle: encabezados de parte | "Licencia del código: {licencia}" · "Licencia de la fuente: {licencia}" |

- La introducción **no promete que la lista sea completa** a nivel nativo (riesgo de alcance de ADR-018): dice "usa bibliotecas de código abierto" y "aquí están sus licencias", no "todas".
- `{licencia}` en una fila y en el detalle: los nombres de 5.5 de cada `spdxId` del aviso, sin repetir, en el orden de `noticeTexts`, unidos con " y ".

### 5.5 Nombres legibles de las licencias (`LICENSE_LABELS`)

Un nombre por cada licencia de `ALLOWED_LICENSES` (ADR-018). El test de la arquitectura exige las mismas claves.

| SPDX | Nombre |
|---|---|
| `MIT` | "MIT" |
| `ISC` | "ISC" |
| `Apache-2.0` | "Apache 2.0" |
| `BSD-2-Clause` | "BSD de 2 cláusulas" |
| `BSD-3-Clause` | "BSD de 3 cláusulas" |
| `0BSD` | "BSD de cero cláusulas" |
| `BlueOak-1.0.0` | "Blue Oak 1.0.0" |
| `OFL-1.1` | "SIL Open Font License 1.1" |
| `CC0-1.0` | "CC0 1.0" |
| `Unlicense` | "Unlicense" |

Los nombres son para orientarse. El valor legal está en el texto completo del detalle, que se muestra tal como lo publica cada paquete (en inglés).

### 5.6 Anuncios del lector de pantalla

Ninguno. Estas pantallas no cambian solas mientras se miran: el lector lee lo que hay al enfocarlo.

---

## 6. Componentes

### 6.1 Se usan de `@/shared/ui` sin cambios

`Screen`, `ScreenHeader`, `Card`, `ListRow`/`ListSeparator`, `Icon`, `CaretRightIcon`, `NotFoundScreen`. No hace falta ningún ícono nuevo.

### 6.2 Nuevos en `shared/ui` (con sus tests, TDD)

| Componente | Necesidad | Especificación |
|---|---|---|
| **`CardListItem`** y **`CardListSeparator`** (nuevos, **recomendados**) | La lista de licencias necesita el aspecto de "una sola tarjeta" dentro de una `FlatList`. Hoy ese recurso vive dentro de `features/products/components/product-list.tsx`, y `settings` no puede importar de `products` (ADR-005). | Se extrae tal cual de `product-list.tsx`: `CardListItem({ isFirst, isLast, children })` envuelve la fila con `border-x-2 border-border bg-surface px-4`, más `rounded-t-3xl border-t-2` si es la primera y `rounded-b-3xl border-b-2` si es la última. `CardListSeparator` es el `ListSeparator` dentro de los bordes laterales. Son decorativos: no agregan rol ni etiqueta. Tests: clases de primera, intermedia, última y única (primera y última a la vez); el separador queda dentro de los bordes. Después, `product-list.tsx` los usa (cambio de forma, sin cambio visual; sus tests no cambian). Si el orquestador prefiere no tocar Productos en F9, se duplica el recurso en `settings` y se extrae después; no recomiendo esa opción, porque la tercera lista que lo necesite lo copiaría otra vez. |

### 6.3 Componentes de la feature (`src/features/settings/components/`)

Los de `docs/architecture/settings.md` (2.1), con estas precisiones:

- `settings-section.tsx`: encabezado `text-heading` con rol `header` y su contenido debajo, con `gap-3`. El contenido puede ir en `Card` o no (`PrivacyNote` va sin tarjeta). La primera tarjeta de Ajustes no usa este componente, porque no tiene encabezado (UX-S2).
- `privacy-note.tsx`: los dos párrafos de 3.1. Un solo elemento accesible con los dos textos como etiqueta.
- `license-row.tsx`: 3.2. Recibe el aviso y `onPress`; arma subtítulo, etiqueta y pista.
- `license-text.tsx`: 3.3, punto 2. Recibe `{ spdxId, part, text }` y si debe mostrar el encabezado.
- `settings-texts.ts` (**nuevo**): los textos de 5.1 y 5.4, y `licenseNames(notice): string` (5.4, nombres sin repetir unidos con " y "). Junto a los textos para que un solo test recorra todos con `GUILT_PATTERNS`.

### 6.4 Pedidos a otras features (por su índice público)

- `features/notifications`: `reminderSummaryText` con los textos y la precedencia de 5.2.
- `features/settings/domain`: `sortNotices` compara sin la "@" inicial (UX-S8), después sin distinguir mayúsculas y después por versión.

---

## 7. Accesibilidad

- **Orden de lectura de Ajustes**: "Ajustes" (encabezado) → "Recordatorios, {resumen}" → "Respaldo y planillas, {resumen}" → "Privacidad" (encabezado) → la nota → "Acerca de" (encabezado) → "Kofi, Versión 1.0.0" → "Licencias de terceros, Bibliotecas de código abierto que usa la app". Las filas tocables tienen rol `button` y su pista. Con la navegación por encabezados, se salta a Privacidad y a Acerca de.
- **Orden de lectura de la lista**: título → introducción → las filas, cada una un solo botón con su etiqueta de 5.4.
- **Orden de lectura del detalle**: título (el nombre) → datos del paquete (un elemento) → encabezado de parte (si hay) → cada párrafo. Los encabezados de parte permiten saltar del código a la fuente en Lexend.
- **Texto seleccionable**: `selectable` en cada párrafo del detalle. TalkBack y VoiceOver siguen leyéndolos como texto normal.
- **Áreas táctiles**: filas de 56 de alto como mínimo (`ListRow`), a todo el ancho; volver de 48 × 48.
- **Letra grande**: nada tiene alto fijo ni `maxFontSizeMultiplier`; títulos, subtítulos y párrafos se acomodan en varias líneas; las tres pantallas se desplazan. Se prueba con el tamaño más grande en Android (F10.1).
- **Contraste**: no hay pares nuevos. Texto y secundario sobre fondo y tarjeta, y bordes sticker, ya están en la tabla 2.3.
- **Sin color como única señal**: no hay estados que dependan del color; "Apagados" o "sin activar" se dicen con palabras.
- **Reducir movimiento**: no hay animaciones propias; las transiciones de la pila las maneja `react-native-screens` según el sistema.
- **Una mano**: las filas más usadas están arriba de Ajustes; en la lista se desplaza con el pulgar y volver también está en el gesto o el atrás del sistema.

---

## 8. Pruebas sugeridas (además de las de `docs/architecture/settings.md`, sección 5)

**Textos (`settings-texts.test.ts` y `notification-texts.test.ts`)**
- Ningún texto de 5.1 a 5.5, ni los resúmenes de 5.2 y 5.3 con fechas de hoy, ayer y otro día, coincide con `GUILT_PATTERNS` (`findGuiltPattern` devuelve `null`).
- `reminderSummaryText`: cada fila de la tabla 5.2, incluidos "Domingos a las 20:00 y resumen del mes", "Martes a las 8:30" y "Solo el resumen del mes"; `loading` → `null`.
- `summarizeReminders` con los dos interruptores apagados y el permiso `denied` o sin decidir → `all_off` (precedencia de 5.2).
- `licenseNames`: HeroUI Native → "Apache 2.0"; Lexend → "MIT y SIL Open Font License 1.1"; un aviso con dos textos de la misma licencia no la repite.
- `LICENSE_LABELS` tiene exactamente los nombres de 5.5.

**Orden (`third-party-notices.test.ts`)**
- `sortNotices` pone `@tanstack/react-query` entre nombres con "t" (después de "react…" y antes de "zod", por ejemplo) y no al principio.

**Ajustes (`settings-screen.test.tsx`)** (reemplaza el caso "encabezados de las cuatro secciones" de la arquitectura)
- Hay exactamente tres encabezados: "Ajustes", "Privacidad" y "Acerca de".
- La primera tarjeta tiene "Recordatorios" y luego "Respaldo y planillas", en ese orden.
- Con permiso `undetermined` y valores por defecto, "Recordatorios" se lee "Recordatorios, Los avisos están sin activar"; con `granted`, "Recordatorios, Domingos a las 20:00 y resumen del mes"; mientras carga, la etiqueta es solo "Recordatorios".
- Sin copia, "Respaldo y planillas" muestra "Guarda tus datos o expórtalos en planillas"; con `FakeBackupFiles` con una copia de hoy a las 15:42 (con `FakeClock`), "Tienes una copia de seguridad de hoy, 15:42".
- Si la lectura de la copia falla, se ve la frase sin copia y la fila se puede tocar.
- Se ven los dos párrafos de la nota de privacidad, como un solo elemento accesible.
- "Kofi" con "Versión 1.0.0-test"; con `appVersion: 'unknown'`, "Kofi" sin ninguna línea que empiece con "Versión" y sin "unknown" en pantalla.
- Hay exactamente tres `button` y cada uno llama a su callback; cada uno tiene la pista de 5.1.

**Lista (`licenses-screen.test.tsx`)**
- Muestra la introducción exacta.
- La fila de HeroUI Native tiene la etiqueta "HeroUI Native, versión {versión real}, Apache 2.0" y la pista "Abre el texto completo de la licencia"; la de Lexend termina en "MIT y SIL Open Font License 1.1".
- Las filas están en el orden de `sortNotices`.

**Detalle (`license-detail-screen.test.tsx`)**
- HeroUI Native: título "HeroUI Native", "Versión …", "Paquete: heroui-native", "Licencia: Apache 2.0", sin encabezado de parte, y algún párrafo contiene "Apache License".
- Lexend: encabezados "Licencia del código: MIT" y "Licencia de la fuente: SIL Open Font License 1.1", en ese orden.
- Un aviso cuyo `packageName` es igual a `displayName` no muestra "Paquete:".
- Todos los párrafos tienen `selectable`.

**Componentes nuevos**: los tests de `CardListItem` y `CardListSeparator` (6.2); los de `product-list` siguen en verde sin cambios.

**E2E (F9.3)**: los de la arquitectura (5.5), buscando "Ajustes", "Recordatorios", "Respaldo y planillas", "Privacidad", "Versión 1.0.0", "Licencias de terceros", "HeroUI Native", "Lexend", "Phosphor Icons", "Apache License", "SIL Open Font License" y "MIT License". En `safety-copy.yaml`, Ajustes muestra un texto que empieza con "Tienes una copia de seguridad".

**Manual (F10.1)**: con TalkBack, el orden de 7 en las tres pantallas; con la letra más grande, ningún título de licencia ni subtítulo de Ajustes se recorta y el texto de Apache 2.0 se desplaza completo hasta el final.

---

## 9. Preguntas abiertas

1. **Extraer el aspecto de "una sola tarjeta" a `shared/ui` (para el orquestador).** Recomiendo hacerlo en F9.1 (6.2), tocando `product-list.tsx` solo para usar el componente nuevo. La alternativa es duplicarlo en `settings`. **Por defecto**: se extrae.
2. **Precedencia de "Apagados" (para el orquestador).** 5.2 pide que `summarizeReminders` revise primero si todo está apagado. Es un cambio de orden en una función nueva de F9, no en la lógica de F7. **Por defecto**: se aplica.
