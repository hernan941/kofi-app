# Especificación de pantallas — Respaldo y exportación (F8)

- **Tarea**: F8.1 de `docs/plan-v1.md`. La usan F8.7 (pantalla, hooks y mensajes), F8.8 (exportación de emergencia), F8.10 (E2E) y F9 (integración en Ajustes).
- **Fuentes**: `docs/design-system.md` (Bruma), `docs/architecture/backup.md` (F8.0), `docs/product.md` (D-08, D-09, D-10, D-22, D-28 y D-44), `src/shared/ui/boot-error-screen.tsx` y los componentes de `@/shared/ui`.
- Este documento no define lógica de negocio. Qué se valida, en qué orden, cuánto espacio hace falta y qué error corresponde lo deciden los casos de uso (`prepareRestore`, `confirmRestore`, `exportBackup`, `exportEmergency`). La UI muestra el estado del reducer `restoreFlow` y el progreso que recibe.

---

## 1. Decisiones de diseño

| Id | Decisión | Por qué |
|---|---|---|
| UX-B1 | **Una sola pantalla "Respaldo"** con cuatro secciones, en este orden: crear respaldo, exportar planillas, restaurar y copia de seguridad (esta última solo si existe). | Lo más usado y lo que protege los datos va arriba. Restaurar, que reemplaza todo, queda abajo y lejos del pulgar en reposo. |
| UX-B2 | **Las secciones no van en tarjetas**: título, una frase y su botón, separadas por espacio. El único botón principal es **"Crear respaldo"**. | Cuatro tarjetas con sombra superan el máximo de tres del sistema de diseño (4.4). Sin tarjetas, el único "sticker" de la pantalla es la acción que más importa. |
| UX-B3 | **"Crear respaldo" va dentro de su sección, arriba, y no en un pie fijo.** | Es una pantalla de varias acciones independientes, no un formulario. Un pie fijo separaría el botón de su explicación. Arriba queda en el primer tercio de la pantalla, alcanzable con el pulgar estirado. |
| UX-B4 | **El progreso de crear y exportar se muestra en la propia sección**, en lugar del botón. Las demás acciones quedan deshabilitadas y no se puede salir de la pantalla hasta que se abre el menú de compartir. | La persona ve qué está pasando donde tocó. Salir a la mitad dejaría un menú de compartir abriéndose en otra pantalla. |
| UX-B5 | **Restaurar tiene tres pasos que la persona ve**: vista previa → confirmación en un diálogo → progreso. La vista previa reemplaza el contenido de la pantalla (como la celebración en el registro de venta). | Restaurar reemplaza todo (D-08). Dos toques explícitos y una vista previa con fecha y conteos evitan elegir el archivo equivocado. Escribir una palabra para confirmar sería más fuerte, pero es una barrera innecesaria para quien no está cómodo con el teclado. |
| UX-B6 | **La vista previa dice qué se pierde y qué se guarda**: se reemplaza todo, antes se guarda una copia de seguridad, la copia anterior se reemplaza (D-22) y los recordatorios no cambian (D-28). Si el respaldo está vacío, lo dice. | Una confirmación fuerte es la que no deja dudas, no la que asusta. Restaurar un respaldo vacío por error es el peor caso: se avisa antes. |
| UX-B7 | **El progreso de restaurar es una lista de pasos** con el paso actual destacado y una barra con "n de m" cuando hay conteo (fotos). | Quien tiene muchas fotos espera varios segundos: ver avanzar los pasos tranquiliza más que una rueda que gira. |
| UX-B8 | **Durante la restauración no se puede salir**, y el texto dice la verdad: si la app se cierra antes de terminar, los datos quedan como estaban. | Es lo que garantiza F8.0 (todo se aplica en una sola transacción al final). Decir "no cierres la app" asustaría sin necesidad. |
| UX-B9 | **Cada problema tiene su propio título y una frase que dice qué hacer.** Nunca aparecen palabras técnicas ("ZIP", "CRC", "hash", "JSON", "SQL") ni "error". Si el problema ocurre después de confirmar, se agrega "Tus datos siguen como estaban." | La persona no necesita saber qué falló por dentro, sino si sus datos están a salvo y cuál es el próximo paso. |
| UX-B10 | **Después de restaurar, una pantalla de éxito con "Ir al inicio"** (D-44). | Inicio es donde se nota el cambio: los totales y las últimas ventas del respaldo. |
| UX-B11 | **La copia de seguridad se restaura con el mismo flujo**, desde su sección ("Restaurar esta copia"). Solo se ofrece restaurarla, no compartirla. | D-44. Una sola acción por sección. Para guardar los datos fuera del teléfono ya está "Crear respaldo". |
| UX-B12 | **Exportar planillas no muestra una pantalla de éxito**: se abre el menú de compartir y, al volver, un aviso breve. Exportar sin datos está permitido (D-44). | Es una acción rápida y sin riesgo. |
| UX-B13 | **La exportación de emergencia mantiene la pantalla de arranque tal como está** y solo agrega el estado del botón (preparando, lista o problema) debajo. | Es una pantalla para un mal momento: cuanto menos cambie, mejor. Sigue sin ofrecer nada que escriba en la base. |

---

## 2. Navegación

```
Ajustes (F9; en F8, la fila provisional "Respaldo") ─► /settings/backup (BackupScreen)
  ├─ "Crear respaldo" ─► progreso en la sección ─► menú de compartir ─► aviso "Respaldo creado"
  ├─ "Exportar ventas" / "Exportar productos" ─► "Preparando la planilla…" ─► menú de compartir ─► aviso
  ├─ "Elegir un respaldo" ─► selector de archivos del sistema
  │       ├─ cancelar ─► vuelve igual que estaba (sin mensaje)
  │       └─ archivo ─► "Revisando el archivo…" ─┬─► problema (vista de problema)
  │                                               └─► vista previa ─┬─ "Cancelar" / volver ─► pantalla inicial
  │                                                                 └─ "Reemplazar mis datos" ─► diálogo
  │                                                                       ├─ "Cancelar" ─► vista previa
  │                                                                       └─ "Sí, reemplazar" ─► progreso
  │                                                                              ├─► éxito ─ "Ir al inicio" ─► /
  │                                                                              └─► problema
  └─ "Restaurar esta copia" ─► "Revisando la copia…" ─► vista previa (variante copia) ─► igual que arriba

Arranque fallido (MigrationGate) ─► BootErrorScreen ─ "Guardar una copia de mis datos" ─► progreso ─► menú de compartir ─► "Copia lista"
```

- `/settings/backup` es una pantalla apilada del `Stack` raíz, sin pestañas, con `ScreenHeader` propio. La vista previa, el progreso, el éxito y los problemas son **estados de la misma ruta** (reducer `restoreFlow`), no rutas nuevas.
- **Salir de la pantalla** según el estado (con un hook que intercepta volver, el gesto y el atrás de Android, como `useConfirmLeave`):

  | Estado | Volver |
  |---|---|
  | Inicial, éxito, problema | Sale normalmente (en éxito, también "Ir al inicio"). |
  | Vista previa | Equivale a "Cancelar": vuelve a la pantalla inicial (`discardPicked`). |
  | Creando respaldo, exportando planilla, revisando archivo, restaurando | Bloqueado. El `ScreenHeader` no muestra volver, el gesto está desactivado y el atrás de Android solo anuncia **"Espera a que termine."** |

- Mientras el menú de compartir está abierto, la app está detrás: no hay nada que bloquear.
- **"Ir al inicio"** usa `router.dismissTo('/')` (o el equivalente que vacíe la pila hasta Inicio), para que volver desde Inicio no regrese a la pantalla de éxito.

---

## 3. Pantallas

Los textos entre comillas son **exactos** (tabla completa en la sección 5). `{fecha}` es la fecha y hora local de un respaldo (5.6) y `{espacio}` un tamaño legible ("350 MB", "1,2 GB").

### 3.1 Respaldo, estado inicial (`/settings/backup`, `BackupScreen`)

`Screen` con `ScreenHeader` (volver, título **"Respaldo"**) y un `ScrollView` con `px-4`, `pt-4`, `pb-8` y `gap-8`. Cada sección (`BackupActions`) tiene un encabezado `text-heading` con rol `header`, una frase `text-base` `muted` y sus botones, con `gap-3`. Entre secciones, `ListSeparator`.

1. **Crear respaldo**
   - Encabezado **"Respaldo de tus datos"**.
   - Frase **"Guarda en un archivo todo lo que tienes en la app: productos, fotos y ventas. Guárdalo en tu correo, en Drive o donde prefieras."**
   - `PrimaryButton` **"Crear respaldo"** con el ícono `Export`.
   - Nota `text-sm` `muted` con `Info` (`InlineNotice`): **"El archivo no lleva contraseña. Guárdalo en un lugar que solo uses tú."** (D-09: la persona tiene que saberlo.)
2. **Exportar planillas**
   - Encabezado **"Ventas y productos en planillas"**.
   - Frase **"Crea archivos para abrir en Excel o Google Sheets. Sirven para mirar tus datos, no para restaurarlos."**
   - Dos `SecondaryButton` de ancho completo, uno debajo del otro, con el ícono `Export`: **"Exportar ventas"** y **"Exportar productos"**.
3. **Restaurar**
   - Encabezado **"Restaurar un respaldo"**.
   - Frase **"Cambia todo lo que hay en la app por lo que tiene un respaldo que creaste antes. Primero vas a ver qué contiene."**
   - `SecondaryButton` **"Elegir un respaldo"** con el ícono `ClockCounterClockwise`.
4. **Copia de seguridad** (solo si `latestSafety()` no es `null`)
   - Encabezado **"Copia de seguridad"**.
   - Frase **"Es como estaba la app justo antes de tu última restauración. Guardamos solo la más reciente."**
   - Línea `text-base` `foreground`: **"Copia del {fecha}"**.
   - `SecondaryButton` **"Restaurar esta copia"** con el ícono `ClockCounterClockwise`.

- **Sombras**: solo "Crear respaldo".
- La pantalla no tiene estado de carga: `latestSafety()` es síncrono.
- **Sin datos** (instalación nueva): la pantalla es igual. Crear un respaldo vacío y exportar planillas solo con encabezados está permitido (D-44).

### 3.2 Creando el respaldo (en la sección 1)

El botón "Crear respaldo" se reemplaza por `ProgressBlock` (6.2), sin mover el resto:

| Fase (`ExportProgress`) | Texto | Barra |
|---|---|---|
| `reading` | **"Leyendo tus datos…"** | Indeterminada |
| `hashing_photos` | **"Revisando tus fotos: {n} de {m}"** | Determinada |
| `writing` | **"Creando el archivo: {n} de {m}"** | Determinada |
| `sharing` | **"Abriendo el menú para compartir…"** | Indeterminada |

- "Exportar ventas", "Exportar productos", "Elegir un respaldo" y "Restaurar esta copia" quedan deshabilitados (opacidad 0.6, `accessibilityState={{ disabled: true }}`), y salir está bloqueado hasta `sharing`.
- Al cerrarse el menú de compartir (se haya guardado o no el archivo, porque la app no lo sabe): vuelve el botón y aparece el aviso **"Respaldo creado"**.
- **Problema**: vuelve el botón y, debajo, `InlineNotice` con `tone="danger"` (6.2) con el texto de 5.4, que se anuncia. El aviso desaparece al tocar de nuevo cualquier acción.

### 3.3 Exportando una planilla (en la sección 2)

- El botón tocado se reemplaza por `ProgressBlock` indeterminado con **"Preparando la planilla de ventas…"** o **"Preparando la planilla de productos…"**. El resto se deshabilita como en 3.2.
- Al cerrarse el menú de compartir: aviso **"Planilla de ventas lista"** o **"Planilla de productos lista"**.
- **Problema**: `InlineNotice` `danger` debajo de los dos botones, con el texto de 5.4.

### 3.4 Revisando el archivo (estado `inspecting`)

- Después de elegir un archivo (o de "Restaurar esta copia"), el botón de la sección se reemplaza por `ProgressBlock` indeterminado: **"Revisando el archivo…"** (o **"Revisando la copia…"**). El resto se deshabilita y salir está bloqueado.
- Puede tardar unos segundos con un respaldo grande. Al terminar, pasa a la vista previa (3.5) o a la vista de problema (3.9).
- **Cancelar el selector** no es un problema: la pantalla queda como estaba, sin mensaje.

### 3.5 Vista previa (estado `preview`, `RestorePreview`)

Reemplaza el contenido de la pantalla. `ScreenHeader` con volver (= "Cancelar") y título **"Restaurar"**. `ScrollView` con `px-4`, `pt-4`, `gap-6` y un pie fijo:

1. Título `text-title`, rol `header`: **"¿Restaurar este respaldo?"** (variante copia: **"¿Volver a la copia de seguridad?"**).
2. `Card` con el título **"Respaldo del {fecha}"** (variante copia: **"Copia del {fecha}"**) y tres filas `ListRow` sin toque, separadas por `ListSeparator`, con la cantidad a la derecha en `text-lg font-bold` `foreground` (no es un monto, así que no usa `Amount`):
   - **"Productos"** · `{products}`
   - **"Ventas"** · `{saleRecords}`
   - **"Fotos"** · `{activePhotos}`

   Cada fila se lee como "Productos: 24". La tarjeta es un solo elemento con la etiqueta **"Respaldo del {fecha}: {n} productos, {n} ventas y {n} fotos"** (singular cuando es 1).
3. Si `products` y `saleRecords` son 0: `InlineNotice` con `Info`: **"Este respaldo no tiene productos ni ventas. Si lo restauras, la app queda vacía."**
4. Bloque "qué va a pasar", `gap-3`, cada punto con un ícono de 20 en `muted` (decorativo) y `text-base` `foreground`:
   - `ClockCounterClockwise`: **"Todo lo que hay ahora en la app se cambia por lo que tiene este respaldo: productos, fotos y ventas."**
   - `ShieldCheck`: **"Antes de empezar, guardamos una copia de seguridad de cómo está la app ahora."** Si ya hay una copia, se agrega: **"Reemplaza a la copia del {fecha anterior}."** (D-22). En la variante copia, el texto es **"Antes de empezar, guardamos cómo está la app ahora. Esa pasa a ser tu nueva copia de seguridad."**
   - `Bell`: **"Tus recordatorios se mantienen como están."** (D-28)
5. **Pie fijo** (`gap-2`):
   - `DeleteButton` (tono `danger`, con `Trash`) **"Reemplazar mis datos"**. No es `PrimaryButton`: el acento invita a tocar y esta acción tiene que pensarse.
   - `TextButton` **"Cancelar"**.

Al tocar "Reemplazar mis datos" se abre `ConfirmDialog` con `isDestructive`:
- título **"¿Reemplazar todos tus datos?"**;
- descripción **"Lo que hay ahora en la app se cambia por el respaldo del {fecha}. Antes guardamos una copia de seguridad."** (variante copia: **"Lo que hay ahora en la app se cambia por la copia del {fecha}."**);
- confirmar **"Sí, reemplazar"** (relleno `danger`, con `Trash`); cancelar **"Cancelar"**, que vuelve a la vista previa.

- Al aparecer la vista previa, el foco va al título.
- **Sombras**: la tarjeta. El botón de borrar no lleva sombra.
- "Cancelar" y volver descartan la copia del selector (`discardPicked`) y vuelven a 3.1 sin mensaje.

### 3.6 Restaurando (estado `restoring`, `BackupProgress`)

Reemplaza el contenido. `ScreenHeader` sin volver, título **"Restaurar"**. Contenido con `px-4`, `pt-8`, `gap-6`:

1. Título `text-title`, rol `header`: **"Restaurando tu respaldo"** (variante copia: **"Volviendo a la copia de seguridad"**).
2. Frase `text-base` `muted`: **"Puede tardar un poco si tienes muchas fotos. Si la app se cierra antes de terminar, tus datos se quedan como estaban."**
3. **Lista de pasos** (`RestoreSteps`, 6.3). Cada paso es una fila de al menos 48 de alto con un ícono de 24 y el texto `text-base`:

   | Paso | Fases (`RestoreProgress`) | Texto |
   |---|---|---|
   | 1 | `validating`, `checking_space` | **"Revisar el respaldo"** |
   | 2 | `safety_backup` | **"Guardar la copia de seguridad"** |
   | 3 | `copying_photos` (se omite si `activePhotos` es 0) | **"Copiar las fotos"** |
   | 4 | `applying`, `finishing` | **"Aplicar los cambios"** |

   - **Hecho**: ícono `CheckCircle` (`fill`, `accent`) y texto `foreground`.
   - **En curso**: `Spinner` de HeroUI en `accent`, texto `font-semibold` `foreground` y, debajo, la barra de `ProgressBlock` con su texto: en el paso 2, barra determinada sin números; en el paso 3, **"{n} de {m} fotos"**; en los pasos 1 y 4, barra indeterminada.
   - **Pendiente**: ícono `Circle` en `muted` y texto `muted`.
   - Lo que distingue cada estado es el ícono y el peso del texto, no solo el color.
4. Sin botones. Salir está bloqueado (2).

- **Lector de pantalla**: al empezar cada paso se anuncia su texto ("Copiar las fotos"). La barra es un `progressbar` con `accessibilityValue` (`now`, `max`, `text: "12 de 40 fotos"`), que el lector lee al enfocarla; no se anuncia cada foto.
- En `applying` la app puede quedar quieta alrededor de un segundo (F8.0, 6.1 punto 6). El paso 4 ya está a la vista antes, gracias a `yieldToUi`.

### 3.7 Éxito (estado `done`)

Reemplaza el contenido. `ScreenHeader` sin volver ni título. Contenido centrado con `pt-12`, `gap-4` y pie fijo:

1. Ícono `CheckCircle` de 48, peso `fill`, en `accent`. Decorativo.
2. Título `text-title`, rol `header`: **"Listo, restauramos tu respaldo"** (variante copia: **"Listo, volviste a la copia de seguridad"**).
3. Frase `text-base` `foreground`: **"Ahora la app tiene los productos y las ventas del respaldo del {fecha}."** (variante copia: **"…de la copia del {fecha}."**).
4. Frase `text-base` `muted`: **"Cómo estaba la app antes quedó guardado en \"Copia de seguridad\", en esta misma pantalla."**
5. Pie fijo: `PrimaryButton` **"Ir al inicio"**.

- Al aparecer, el foco va al título y se anuncia **"Restauramos tu respaldo."**
- Volver (atrás de Android o gesto) sale de la pantalla a Ajustes; ahí "Respaldo" muestra la copia de seguridad nueva.

### 3.8 Restaurar la copia de seguridad

Es el mismo flujo (3.4 a 3.7) con los textos de la variante copia. Antes de prepararla, el hook la copia a la caché (F8.0, 6.2 punto 1); para la persona es parte de "Revisando la copia…".

### 3.9 Vista de problema (estado `failed`)

Reemplaza el contenido. `ScreenHeader` con volver y título **"Restaurar"**. Contenido con `px-4`, `pt-12`, `gap-4` y pie fijo:

1. Ícono `WarningCircle` de 48 en `danger`.
2. Título `text-heading`, rol `header`, y frase `text-base` `foreground`, ambos de la tabla 5.3.
3. Si el problema ocurrió después de confirmar (`restoring` → `failed`): frase `text-base` `muted` **"Tus datos siguen como estaban."**
4. Pie fijo:
   - `PrimaryButton` **"Volver"** → pantalla inicial (3.1).
   - Solo si el problema es del archivo elegido (5.3, columna "Otro archivo") y el origen no es la copia de seguridad: `SecondaryButton` **"Elegir otro archivo"**, que abre el selector de nuevo.

- Al aparecer, el foco va al título y se anuncia el título.

### 3.10 Exportación de emergencia (`BootErrorScreen`)

La pantalla de arranque fallido (F0.10) queda igual: ícono, título, cuerpo y la frase de tranquilidad. F8.8 agrega, antes del botón, una frase `text-base` `foreground` y cambia lo que hay debajo del botón según `emergencyExport.status`:

- Frase (siempre que haya `emergencyExport`): **"Puedes guardar una copia de tus datos y fotos tal como están ahora, para tenerlos a salvo."**
- Botón `SecondaryButton` **"Guardar una copia de mis datos"** con la pista **"Crea un archivo con tus datos para guardarlo fuera de la app"**. Sigue siendo secundario: en esta pantalla, la indicación principal es cerrar y volver a abrir, o actualizar.

| Estado | Qué se ve debajo del botón |
|---|---|
| `idle` | Nada. |
| `working` | El botón se deshabilita y aparece `ProgressBlock` indeterminado con **"Preparando la copia…"**, que se anuncia. |
| `done` | El botón vuelve y aparece `InlineNotice` con `tone="success"`: **"Copia lista. Guárdala en tu correo o en Drive. Esta copia sirve para rescatar tus datos, pero no se puede restaurar desde la app."** |
| `failed` | El botón vuelve y aparece `InlineNotice` con `tone="danger"` con el texto de 5.5. |

- La pantalla sigue sin ofrecer nada que escriba en la base.
- Aparece en `migration_failed`, `foreign_key_violation` y `newer_database`.

---

## 4. Estados

### 4.1 Pantalla de respaldo

| Estado (`restoreFlow` y exportaciones) | Qué se ve |
|---|---|
| Inicial (`idle`) | 3.1. |
| Vacío (sin datos) | 3.1 igual; todo permitido. |
| Sin copia de seguridad | 3.1 sin la sección 4. |
| Creando respaldo | 3.2. |
| Exportando planilla | 3.3. |
| Respaldo o planilla listos | 3.1 + aviso de éxito. |
| Problema al crear o exportar | 3.1 + `InlineNotice` `danger` en la sección. |
| Eligiendo archivo (`picking`) | 3.1 igual, detrás del selector del sistema. |
| Selector cancelado | 3.1, sin mensaje. |
| Revisando (`inspecting`) | 3.4. |
| Vista previa (`preview`) | 3.5. |
| Confirmación | 3.5 con el diálogo. |
| Restaurando (`restoring`) | 3.6. |
| Éxito (`done`) | 3.7. |
| Problema (`failed`) | 3.9. |

### 4.2 Pantalla de arranque

`idle`, `working`, `done` y `failed` de 3.10.

---

## 5. Textos

Español neutro con tuteo y sin culpa. No se usan "todavía no", "deberías", "debes", "tienes que", "olvidaste", "otra vez", "llevas", "fallaste", "perdiste", "error" ni "mal" (`GUILT_PATTERNS`), ni palabras técnicas ("ZIP", "CRC", "hash", "JSON", "SQL", "base de datos", "formato").

### 5.1 Títulos, secciones y botones

| Clave sugerida | Texto |
|---|---|
| Fila provisional en Ajustes | "Respaldo" |
| Título de la pantalla | "Respaldo" |
| Crear | "Respaldo de tus datos" · "Guarda en un archivo todo lo que tienes en la app: productos, fotos y ventas. Guárdalo en tu correo, en Drive o donde prefieras." · "Crear respaldo" |
| Nota sin contraseña | "El archivo no lleva contraseña. Guárdalo en un lugar que solo uses tú." |
| Planillas | "Ventas y productos en planillas" · "Crea archivos para abrir en Excel o Google Sheets. Sirven para mirar tus datos, no para restaurarlos." · "Exportar ventas" · "Exportar productos" |
| Restaurar | "Restaurar un respaldo" · "Cambia todo lo que hay en la app por lo que tiene un respaldo que creaste antes. Primero vas a ver qué contiene." · "Elegir un respaldo" |
| Copia de seguridad | "Copia de seguridad" · "Es como estaba la app justo antes de tu última restauración. Guardamos solo la más reciente." · "Copia del {fecha}" · "Restaurar esta copia" |
| Progreso al crear | "Leyendo tus datos…" · "Revisando tus fotos: {n} de {m}" · "Creando el archivo: {n} de {m}" · "Abriendo el menú para compartir…" |
| Progreso de planillas | "Preparando la planilla de ventas…" · "Preparando la planilla de productos…" |
| Revisando | "Revisando el archivo…" · "Revisando la copia…" |
| Título de los estados de restaurar | "Restaurar" |
| Vista previa | "¿Restaurar este respaldo?" · "Respaldo del {fecha}" · "Productos" · "Ventas" · "Fotos" |
| Vista previa (copia) | "¿Volver a la copia de seguridad?" · "Copia del {fecha}" |
| Etiqueta de la tarjeta | "Respaldo del {fecha}: {n} productos, {n} ventas y {n} fotos" (singular: "1 producto", "1 venta", "1 foto") |
| Respaldo vacío | "Este respaldo no tiene productos ni ventas. Si lo restauras, la app queda vacía." |
| Qué va a pasar | "Todo lo que hay ahora en la app se cambia por lo que tiene este respaldo: productos, fotos y ventas." · "Antes de empezar, guardamos una copia de seguridad de cómo está la app ahora." · "Reemplaza a la copia del {fecha anterior}." · "Tus recordatorios se mantienen como están." |
| Qué va a pasar (copia) | "Antes de empezar, guardamos cómo está la app ahora. Esa pasa a ser tu nueva copia de seguridad." |
| Botones de la vista previa | "Reemplazar mis datos" · "Cancelar" |
| Diálogo | "¿Reemplazar todos tus datos?" · "Lo que hay ahora en la app se cambia por el respaldo del {fecha}. Antes guardamos una copia de seguridad." · copia: "Lo que hay ahora en la app se cambia por la copia del {fecha}." · "Sí, reemplazar" · "Cancelar" |
| Restaurando | "Restaurando tu respaldo" · copia: "Volviendo a la copia de seguridad" · "Puede tardar un poco si tienes muchas fotos. Si la app se cierra antes de terminar, tus datos se quedan como estaban." |
| Pasos | "Revisar el respaldo" · "Guardar la copia de seguridad" · "Copiar las fotos" · "Aplicar los cambios" · "{n} de {m} fotos" |
| Éxito | "Listo, restauramos tu respaldo" · copia: "Listo, volviste a la copia de seguridad" · "Ahora la app tiene los productos y las ventas del respaldo del {fecha}." · copia: "Ahora la app tiene los productos y las ventas de la copia del {fecha}." · "Cómo estaba la app antes quedó guardado en \"Copia de seguridad\", en esta misma pantalla." · "Ir al inicio" |
| Problema | "Tus datos siguen como estaban." · "Volver" · "Elegir otro archivo" |
| Salida bloqueada | "Espera a que termine." |

### 5.2 Avisos (toasts)

| Situación | Tipo | Texto |
|---|---|---|
| Respaldo compartido | éxito | "Respaldo creado" |
| Planilla compartida | éxito | "Planilla de ventas lista" / "Planilla de productos lista" |

Los problemas de crear y exportar no van en un aviso que desaparece, sino en la sección (3.2), porque piden una acción (liberar espacio).

### 5.3 Problemas al restaurar (`RESTORE_ERROR_MESSAGES`, uno por `RestoreError['code']`)

"Otro archivo" indica si la vista de problema ofrece "Elegir otro archivo".

| Código | Título | Frase | Otro archivo |
|---|---|---|---|
| `not_a_backup` | "Este archivo no es un respaldo de cuantovendi" | "Elige el archivo que creaste con \"Crear respaldo\". Su nombre empieza con cuantovendi-respaldo." | Sí |
| `invalid_archive` | "No pudimos leer este respaldo" | "El archivo parece dañado o incompleto. Si lo bajaste de tu correo o de Drive, descárgalo de nuevo y vuelve a elegirlo." | Sí |
| `invalid_archive` con `reason.code = 'too_large'` | "Este archivo es demasiado grande" | "Es más grande que cualquier respaldo de cuantovendi. Revisa que sea el archivo correcto." | Sí |
| `newer_format` | "Este respaldo es de una versión más nueva de la app" | "Actualiza cuantovendi y vuelve a intentarlo." | No |
| `entries_mismatch` | "Este respaldo está incompleto" | "Le faltan partes o tiene archivos que no son suyos. Prueba con otra copia del respaldo." | Sí |
| `checksum_mismatch` | "Este respaldo cambió desde que se creó" | "Algunos datos no coinciden con los originales. Para cuidar tu información, no lo usamos. Prueba con otra copia del respaldo." | Sí |
| `invalid_data` | "Este respaldo tiene datos que la app no reconoce" | "Prueba con otro respaldo. Si abriste el archivo en el computador y lo cambiaste, usa la copia original." | Sí |
| `broken_references` | "Este respaldo está incompleto" | "Hay ventas o fotos que no coinciden con sus productos. Prueba con otra copia del respaldo." | Sí |
| `photo_conflict` | "No pudimos copiar las fotos del respaldo" | "Una foto del respaldo no coincide con una que ya está en la app. Cierra la app, ábrela de nuevo y vuelve a intentarlo." | No |
| `not_enough_space` | "No hay espacio suficiente en tu teléfono" | "Para restaurar necesitas al menos {espacio} libres. Borra fotos o apps que no uses y vuelve a intentarlo." | No |
| Inesperado (excepción) | "No pudimos terminar" | "Vuelve a intentarlo en un momento." | No |

- `{espacio}` sale de `requiredBytes` (5.6).
- **Copia de emergencia elegida para restaurar** (el nombre del archivo elegido empieza con `cuantovendi-emergencia`): en lugar del mensaje de `not_a_backup` o `invalid_archive`, título **"Esta es una copia de emergencia"** y frase **"Guarda tus datos tal como estaban, pero la app no puede restaurarla. Guárdala en un lugar seguro."** (pregunta 9.2).
- "Tus datos siguen como estaban." se agrega en la vista cuando el problema llega después de confirmar (3.9), así que no forma parte de cada mensaje.

### 5.4 Problemas al crear un respaldo o una planilla (`EXPORT_ERROR_MESSAGES`, por `ExportError['code']`)

| Código | Respaldo | Planilla |
|---|---|---|
| `not_enough_space` | "No hay espacio suficiente para crear el respaldo. Libera al menos {espacio} y vuelve a intentarlo." | "No hay espacio suficiente para crear la planilla. Libera al menos {espacio} y vuelve a intentarlo." |
| `too_large` | "Tu respaldo tiene más fotos de las que caben en un solo archivo. Puedes guardar tus ventas y productos con \"Exportar ventas\" y \"Exportar productos\"." | — (no ocurre) |
| `sharing_unavailable` | "Tu teléfono no permite compartir archivos desde la app. Revisa que tengas una app para guardarlos, como Drive o Correo." | igual |
| Inesperado | "No se pudo crear el respaldo. Inténtalo de nuevo." | "No se pudo crear la planilla. Inténtalo de nuevo." |

### 5.5 Exportación de emergencia (`EmergencyExportError['code']`)

| Situación | Texto |
|---|---|
| Frase | "Puedes guardar una copia de tus datos y fotos tal como están ahora, para tenerlos a salvo." |
| Botón | "Guardar una copia de mis datos" |
| Pista del botón | "Crea un archivo con tus datos para guardarlo fuera de la app" |
| Preparando | "Preparando la copia…" |
| Lista | "Copia lista. Guárdala en tu correo o en Drive. Esta copia sirve para rescatar tus datos, pero no se puede restaurar desde la app." |
| `not_enough_space` | "No hay espacio suficiente para la copia. Libera al menos {espacio} y vuelve a intentarlo." |
| `sharing_unavailable` | "Tu teléfono no permite compartir archivos desde la app. Revisa que tengas una app para guardarlos, como Drive o Correo." |
| `database_unavailable` | "No pudimos copiar tus datos. Cierra la app y vuelve a intentarlo. No la desinstales: así tus datos se quedan en el teléfono." |
| Inesperado | "No pudimos crear la copia. Vuelve a intentarlo en un momento." |

### 5.6 Formatos

- **`{fecha}`** de un respaldo o de la copia (`createdAt`, hora local con `LocalCalendar`): **"13 de noviembre de 2026, 15:42"**. Si es de hoy: **"hoy, 15:42"**; de ayer: **"ayer, 15:42"**. La hora en 24 horas sin cero inicial. Dentro de "Respaldo del {fecha}" se lee "Respaldo del hoy…", así que con hoy y ayer la frase cambia a **"Respaldo de hoy, 15:42"** / **"Copia de ayer, 15:42"** (y "por el respaldo de hoy, 15:42" en el diálogo).
- **`{espacio}`** (`formatStorageSize(bytes)`): unidades decimales, como las muestra el teléfono, redondeando hacia arriba. Menos de 1.000 MB → **"350 MB"** (entero); desde 1.000 MB → **"1,2 GB"** (un decimal, coma decimal). Nunca menos de "1 MB".
- **Conteos**: enteros con punto de miles ("1.250").

### 5.7 Anuncios del lector de pantalla

| Situación | Texto |
|---|---|
| Empieza una exportación | el texto de la primera fase ("Leyendo tus datos…", "Preparando la planilla de ventas…") |
| Cambia la fase al crear | el texto de la fase, sin números |
| Empieza un paso de restaurar | el texto del paso ("Copiar las fotos") |
| Éxito al restaurar | "Restauramos tu respaldo." |
| Problema | el título del problema (o el texto del `InlineNotice`) |
| Atrás bloqueado | "Espera a que termine." |
| Emergencia preparando | "Preparando la copia…" |

---

## 6. Componentes

### 6.1 Se usan de `@/shared/ui` sin cambios

`Screen`, `ScreenHeader`, `Card`, `ListRow`/`ListSeparator`, `PrimaryButton`, `SecondaryButton`, `TextButton`, `DeleteButton`, `ConfirmDialog`, `Icon`, `useAppToast`, `announce`, `useAnnounceWhen`, `BootErrorScreen` (con el cambio de F8.8 que ya prevé F8.0).

### 6.2 Nuevos o cambiados en `shared/ui` (con sus tests, TDD)

| Componente | Necesidad | Especificación |
|---|---|---|
| **`ProgressBlock`** (nuevo, **necesario**) | Progreso de crear, exportar, revisar, cada paso de restaurar y la copia de emergencia. | Props: `label: string`, `progress?: { done: number; total: number }`, `valueText?: string`. Texto `text-base` `foreground` arriba y, debajo, una barra de 8 de alto, `rounded-full`, pista `background` con borde de 2 px `field-border` y relleno `accent` (pares ya medidos: acento/fondo 7.2 y 7.8; borde/tarjeta 5.9 y 7.7). Sin `progress`, barra indeterminada: un tramo que recorre la pista en 1,2 s; con "reducir movimiento", el tramo queda quieto en el centro. Rol `progressbar` con `accessibilityLabel = label` y `accessibilityValue` (`min: 0`, `max: total`, `now: done`, `text: valueText ?? "{done} de {total}"`); indeterminado, `accessibilityState={{ busy: true }}`. No anuncia por sí mismo (lo decide quien lo usa). Tests: rol y valor accesible; ancho del relleno proporcional; `total` 0 no divide por cero (barra vacía); indeterminado con `busy`; con movimiento reducido no hay animación. |
| **`InlineNotice`: `tone`** (cambio, **necesario**) | Problemas al crear o exportar (3.2, 3.3) y los estados `done` y `failed` de la copia de emergencia (3.10). Hoy el componente dice que los errores no lo usan, y no hay otro aviso de error dentro de una pantalla. | `tone?: 'info' \| 'success' \| 'danger'` (por defecto `info`, que no cambia nada). `success`: ícono `CheckCircle` `fill` en `accent`, texto `text-sm` `foreground`. `danger`: ícono `WarningCircle` en `danger`, texto `text-sm` `foreground` (el ícono y el texto comunican; el color acompaña). Con `success` y `danger`, se anuncia al aparecer y al cambiar el mensaje (`useAnnounceWhen`). Pares ya medidos (texto sobre fondo y tarjeta; acento y error sobre fondo). Tests: ícono por tono; `info` igual que hoy y sin anuncio; `danger` y `success` anuncian una vez por mensaje. |
| **`usePreventLeave`** en `shared/lib` (nuevo, **necesario**) | Bloquear la salida mientras se crea, se revisa o se restaura (2). | `usePreventLeave(active: boolean, onBlocked: () => void)`: mientras `active`, intercepta volver, el gesto y el atrás de Android (`beforeRemove` y `BackHandler`) y llama a `onBlocked`. Si `useConfirmLeave` ya tiene ese mecanismo, se generaliza ese. Tests: con `active` no sale y llama a `onBlocked`; sin `active` sale normalmente; limpia sus listeners. |
| **`icons.ts`** (necesario) | Íconos de esta especificación. | `ExportIcon`, `ClockCounterClockwiseIcon`, `ShieldCheckIcon`, `CircleIcon` y `BellIcon` (si F7 no lo agregó). |

### 6.3 Componentes de la feature (`src/features/backup/components/`)

Los de `docs/architecture/backup.md` (2.1), con estas precisiones:
- `backup-actions.tsx`: las cuatro secciones de 3.1, con el `ProgressBlock` y el `InlineNotice` de cada una. Recibe el estado de los tres hooks y la copia de seguridad (`SafetyBackupInfo | null`).
- `restore-preview.tsx`: 3.5, con la variante `source: 'file' | 'safety'`, la fecha de la copia anterior (o `null`) y los callbacks de confirmar y cancelar. Incluye el `ConfirmDialog`.
- `backup-progress.tsx` (o `restore-steps.tsx`): 3.6. Función pura asociada `restoreStepStates(progress, hasPhotos)` → estado de cada paso (`done`, `current`, `pending`), con sus tests.
- `restore-result.tsx`: 3.7 y 3.9.
- `backup-messages.ts`: las tablas 5.3, 5.4 y 5.5, más `formatBackupDate` y `formatStorageSize` (5.6). Si `formatStorageSize` se necesita en otra feature, pasa a `shared/lib`.

---

## 7. Accesibilidad

- **Orden de lectura** de la pantalla inicial: título → cada sección (encabezado → frase → botones → nota). Los encabezados tienen rol `header`, así que se puede saltar de sección en sección.
- **Botones deshabilitados** mientras algo trabaja: `accessibilityState={{ disabled: true }}`, y el lector los anuncia como no disponibles.
- **Vista previa**: la tarjeta es un solo elemento con todos los números; el bloque "qué va a pasar" se lee punto por punto; "Reemplazar mis datos" lleva la palabra y el ícono `Trash`, no solo el color.
- **Progreso**: `progressbar` con valor accesible; anuncios solo al cambiar de fase o de paso (5.7), nunca en cada foto; los pasos muestran su estado con ícono y peso de texto.
- **Foco**: en la vista previa, el éxito y el problema, el foco va al título al aparecer. Al cerrar el diálogo con "Cancelar", vuelve a "Reemplazar mis datos".
- **Letra grande**: todo crece sin límite y nada se recorta; las secciones, la vista previa y la lista de pasos se desplazan; en la tarjeta de la vista previa, el número pasa debajo de la etiqueta si no entra (como en `ListRow`). Se prueba con el tamaño más grande en Android.
- **Contraste**: no se agrega ningún par nuevo (6.2).
- **Áreas táctiles**: botones de 48 o más; las filas de la vista previa no se tocan.
- **Reducir movimiento**: la barra indeterminada queda quieta; el `Spinner` de HeroUI respeta la preferencia.
- **Una mano**: los botones de la vista previa, del éxito y del problema van en el pie fijo. "Crear respaldo" queda en el primer tercio (UX-B3).

---

## 8. Pruebas sugeridas (además de las de F8.0, sección 5.6)

**Mensajes (`backup-messages.ts`)**
- Cada `RestoreError['code']`, cada `ExportError['code']`, cada `EmergencyExportError['code']` y el caso inesperado tienen título y frase (un test que recorre las uniones: si se agrega un código, falla).
- Ningún texto de la sección 5 coincide con `GUILT_PATTERNS` ni contiene "ZIP", "CRC", "hash", "JSON", "SQL" ni "error" (sin distinguir mayúsculas).
- `not_enough_space` con 350.000.000 bytes dice "350 MB"; con 1.200.000.001, "1,3 GB" (redondeo hacia arriba); con 10, "1 MB".
- `formatBackupDate` con `FakeClock` en las tres zonas de ADR-015: hoy → "hoy, 15:42"; ayer → "ayer, 9:05"; otro día → "13 de noviembre de 2026, 15:42", incluido un respaldo creado a las 23:59 locales.
- Un archivo elegido con nombre `cuantovendi-emergencia-2026-11-13.zip` que da `invalid_archive` muestra "Esta es una copia de emergencia".

**Pantalla de respaldo (F8.7)**
- Sin copia de seguridad no aparece la sección "Copia de seguridad"; con una, muestra "Copia del {fecha}" y "Restaurar esta copia".
- "Crear respaldo" muestra cada fase con su texto ("Revisando tus fotos: 3 de 10"), deshabilita las demás acciones, bloquea volver (anuncia "Espera a que termine.") y, al terminar de compartir, muestra "Respaldo creado".
- `not_enough_space` al crear muestra el aviso `danger` en la sección con el espacio, y se anuncia.
- "Exportar ventas" sin ventas igual abre el menú de compartir (D-44).
- Cancelar el selector no muestra nada.
- Vista previa: muestra la fecha y los tres conteos; la etiqueta de la tarjeta es "Respaldo del …: 24 productos, 312 ventas y 40 fotos" y usa el singular con 1; con 0 productos y 0 ventas aparece "Este respaldo no tiene productos ni ventas…"; con copia previa aparece "Reemplaza a la copia del …"; siempre aparece "Tus recordatorios se mantienen como están."
- "Reemplazar mis datos" abre el diálogo; "Cancelar" del diálogo no restaura y vuelve a la vista previa; volver en la vista previa descarta el archivo.
- Restaurando: los pasos pasan de pendiente a en curso y a hecho; con `activePhotos` 0 no aparece "Copiar las fotos"; se anuncia cada paso una vez; la barra del paso 3 tiene `accessibilityValue.text` "12 de 40 fotos"; volver está bloqueado.
- Éxito: "Listo, restauramos tu respaldo"; "Ir al inicio" deja Inicio en la raíz de la pila.
- Problema antes de confirmar: sin "Tus datos siguen como estaban."; después de confirmar, con esa frase. "Elegir otro archivo" aparece según la tabla 5.3 y nunca en la variante copia.
- Variante copia: títulos "¿Volver a la copia de seguridad?", "Volviendo a la copia de seguridad" y "Listo, volviste a la copia de seguridad".

**Componentes nuevos**: los tests de 6.2 (`ProgressBlock`, `InlineNotice` con `tone`, `usePreventLeave`) y `restoreStepStates` para cada fase.

**Arranque (F8.8)**: en los tres motivos aparece la frase y el botón; `working` deshabilita el botón y muestra "Preparando la copia…"; `done` y `failed` muestran su `InlineNotice` y se anuncian; no hay ningún otro botón.

**E2E (F8.10)**: los de F8.0 (5.7), buscando "Exportar ventas", "Exportar productos", "Crear respaldo", "Elegir un respaldo", "¿Restaurar este respaldo?", "Sí, reemplazar", "Listo, restauramos tu respaldo" y "Este archivo no es un respaldo de cuantovendi".

**Manual**: con `large`, el progreso avanza sin saltos raros y la pantalla no queda congelada más de un par de segundos en "Aplicar los cambios"; con TalkBack, los anuncios no se superponen.

---

## 9. Preguntas abiertas

1. **Mostrar también lo que hay ahora (para el usuario).** La vista previa podría decir "Hoy tienes 30 productos y 350 ventas" al lado de lo que trae el respaldo. Ayuda mucho a no restaurar un respaldo viejo por error. Recomiendo agregarlo, pero necesita que el architect sume los conteos actuales al `RestorePlan` (o una consulta aparte). **Por defecto**: no se muestra y la vista previa queda como en 3.5.
2. **Reconocer la copia de emergencia (para el architect).** La UI distingue una copia de emergencia por el nombre del archivo elegido (5.3). Es simple, pero depende de que la persona no lo renombre. La alternativa es que `prepareRestore` detecte `info.json` con `kind: "cuantovendi-emergency"` y devuelva un código propio. **Por defecto**: el nombre del archivo, que hay que guardar en el estado `inspecting` del reducer.
3. **Pantalla encendida durante la restauración (para el architect).** Con muchas fotos, el teléfono puede apagar la pantalla a mitad de camino; la restauración sigue, pero la persona pierde de vista el progreso. Mantenerla encendida necesita `expo-keep-awake`, que no está entre las dependencias. **Por defecto**: no se agrega.
