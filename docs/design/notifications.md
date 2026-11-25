# Especificación de pantallas — Notificaciones (F7)

- **Tarea**: F7.1 de `docs/plan-v1.md`. La usan F7.2 (catálogo de textos y test de tono), F7.4 (ícono y canal de Android), F7.7 (preferencias), F7.8 (pantalla explicativa) y F7.10 (E2E y verificación manual).
- **Fuentes**: `docs/design-system.md` (Bruma), `docs/architecture/notifications.md` (F7.0), `docs/design/sales.md` (3.7, celebración y "Listo"), `docs/design/tips.md` (UX-T3, orden con el consejo), `docs/product.md` (D-01, D-06, D-07, D-13, D-28, D-29, D-36 y D-43) y los componentes de `@/shared/ui`.
- Este documento no define lógica de negocio. Cuándo se ofrece el permiso (`shouldOfferPermission`), qué texto lleva cada aviso (estados A/B) y cuándo se reprograma lo deciden el dominio y la reconciliación. La UI solo lo muestra.

---

## 1. Decisiones de diseño

| Id | Decisión | Por qué |
|---|---|---|
| UX-N1 | **La pantalla explicativa aparece una sola vez**, después de "Listo" en la primera venta y solo con el permiso sin decidir. Tiene dos salidas: "Activar recordatorios" y "Ahora no". Volver, el gesto y el botón atrás equivalen a "Ahora no". | D-06 y D-43: se pide en el momento en que la persona acaba de ver el valor de anotar, y nunca se insiste. Un solo pedido, con calma. |
| UX-N2 | **La pantalla explicativa dice exactamente qué va a llegar**: un aviso por semana con el día y la hora reales de las preferencias, y el resumen del día 1. | Quien sabe qué va a recibir, y cuántas veces, acepta con más confianza. "Nunca más de uno por semana" responde a la duda de "¿me van a llenar de avisos?". |
| UX-N3 | **Después de "Ahora no" o de un "No permitir" del sistema, se vuelve a Inicio sin ningún mensaje.** Con "Permitir", un aviso breve confirma el día y la hora. | Un mensaje después de un "no" se siente como insistencia. La opción queda en Ajustes (D-43). |
| UX-N4 | **En Ajustes, el estado del permiso va arriba** y cambia según el caso: sin decidir, "Activar recordatorios" (pide el permiso directo, sin la pantalla explicativa); denegado, "Abrir ajustes" del teléfono; concedido, una línea tranquila. | Quien entra a Recordatorios ya decidió que le interesan: no hace falta explicarle otra vez. Con el permiso denegado, la app no puede volver a preguntar; solo puede llevar al lugar correcto. |
| UX-N5 | **Las preferencias se pueden cambiar aunque el permiso no esté concedido.** Una nota explica que se aplican cuando se activen los avisos. | D-43. Esconderlas obligaría a activar el permiso para ver qué se puede configurar. |
| UX-N6 | **Los interruptores guardan al instante.** El día y la hora se eligen en una hoja con "Guardar". | Un interruptor es un cambio de un toque: pedir "Guardar" sería raro. El día y la hora son tres decisiones juntas (día, hora, minutos): guardarlas de una vez evita reprogramar con un valor a medio elegir. |
| UX-N7 | **El día se elige con chips con el nombre completo** ("Lunes" … "Domingo", de lunes a domingo por D-01). La hora, con el contador de `QuantityStepper` (0 a 23, se puede escribir) y los minutos con cuatro chips (00, 15, 30 y 45). | No hay un selector de hora nativo entre las dependencias, y agregar uno pide un ADR. Con componentes que ya existen, todo es accesible y grande. Siete chips abreviados ("Lu", "Ma") no entran en una fila de 360 con áreas de 48 y se leerían mal en voz alta. |
| UX-N8 | **Si el semanal está apagado, la fila "Día y hora" se esconde.** La preferencia guardada se mantiene. | Un control que no hace nada confunde. Al volver a encender, aparece con el día y la hora que tenía. |
| UX-N9 | **Ajustes explica D-13 en una línea**: si la persona no abre la app, el aviso sigue llegando con un mensaje general, y nunca llega más de uno por semana. | Así nadie se sorprende con un aviso "genérico" ni cree que la app falla. |
| UX-N10 | **Los textos de los avisos son cortos**: título de 40 caracteres o menos y cuerpo de 60 o menos. El título se entiende solo. | Android muestra el aviso plegado: el título y una línea del cuerpo (unos 40 a 45 caracteres en un teléfono de 360). Lo importante tiene que estar en el título. |
| UX-N11 | **El ícono monocromo que había no servía** para la barra de estado. Hacía falta un `notification-icon.png` propio (sección 3.6). | `android-icon-monochrome.png` era el logo de la plantilla de Expo, no el de la app, y su figura ocupaba solo el 45 % del lienzo: a 24 dp se habría visto de unos 11 dp. |

---

## 2. Navegación

### 2.1 Después de la primera venta (D-06)

```
/sales/new "Guardar venta" ─► celebración + consejo (F3, F6) ─► "Listo" / Volver / gesto / atrás
   onFinished(outcome)
     ├─ shouldOfferPermission({ isFirstSale, permission }) ─► router.replace('/notifications/intro')
     │      PermissionIntroScreen
     │        ├─ "Activar recordatorios" ─► diálogo del sistema
     │        │      ├─ Permitir    ─► aviso "Listo, te avisamos…" ─► Inicio
     │        │      └─ No permitir ─► Inicio (sin mensaje)
     │        └─ "Ahora no" / atrás de Android / gesto de cerrar ─► Inicio (sin mensaje)
     └─ si no ─► vuelve a donde se abrió el registro
```

- `/notifications/intro` es una pantalla del `Stack` raíz con `presentation: 'modal'`: entra desde abajo, como una pausa antes de volver a Inicio. No tiene `ScreenHeader` (ni título ni volver): las dos salidas son los botones del pie.
- Como la ruta reemplaza al registro, al salir queda Inicio (`goBackOrHome`).
- Mientras el diálogo del sistema está abierto, la pantalla ignora un segundo toque en "Activar recordatorios" (el botón principal no se deshabilita, sección 6.1 del sistema de diseño).

### 2.2 Preferencias

```
Ajustes (F9; en F7, la fila provisional "Recordatorios") ─► /settings/notifications (NotificationSettingsScreen)
   ├─ "Activar recordatorios" (sin decidir) ─► diálogo del sistema ─► la pantalla se actualiza
   ├─ "Abrir ajustes" (denegado) ─► Linking.openSettings() ─► al volver, se relee el permiso
   ├─ "Día y hora" ─► hoja "Día y hora del recordatorio" ─► "Guardar" ─► cierra + aviso
   └─ Volver ─► Ajustes
```

- `/settings/notifications` es una pantalla apilada del `Stack` raíz, sin pestañas, con `ScreenHeader` propio y volver.
- Al volver de los ajustes del sistema (`AppState` → `active`), `useNotificationPermission` se relee. Si pasó a concedido, se anuncia "Recordatorios activados".

### 2.3 Al tocar un aviso

Lo define F7.0 (4.3): el recordatorio semanal abre `/sales/new` y el resumen mensual abre `/tracking/monthly?month=AAAA-MM`. Un aviso con datos ilegibles abre Inicio. No hay pantalla intermedia.

---

## 3. Pantallas

Los textos entre comillas son **exactos** (tabla completa en la sección 5). `{días}` es el día en plural con artículo ("los domingos") y `{hora}` la hora en formato de 24 horas sin cero inicial ("20:00", "8:30"), ambos de las preferencias guardadas.

### 3.1 Pantalla explicativa (`/notifications/intro`, `PermissionIntroScreen`)

`Screen` con un `ScrollView` (`px-4`, `pt-12`, `gap-6`) y un pie fijo.

1. Ícono `Bell` de Phosphor, peso `duotone`, tamaño 48, en `muted`. Decorativo.
2. Título en `text-title`, rol `header`: **"¿Te recordamos anotar tus ventas?"**
3. Frase en `text-base` `foreground`: **"Anotar una vez por semana es la forma más simple de saber cuánto vendes."**
4. Lista de lo que va a llegar, `gap-4`. Cada punto es una fila con un ícono de 24 en `muted` (decorativo) y el texto en `text-base` `foreground`; cada fila se lee como un solo elemento:
   - `Bell`: **"Un aviso por semana, {días} a las {hora}."**
   - `CalendarBlank`: **"El día 1 de cada mes, tu resumen del mes anterior."**
   - `Gear`: **"Puedes cambiar el día y la hora, o apagarlos, en Ajustes."**
5. Nota en `text-sm` `muted`: **"Nunca te llega más de un recordatorio por semana."**
6. **Pie fijo** (`gap-2`, `pb` del área segura):
   - `PrimaryButton` **"Activar recordatorios"**;
   - `TextButton` **"Ahora no"**, ancho completo.

- Al aparecer, el foco del lector va al título.
- **Sombras**: solo el botón principal.
- **Una mano**: las dos salidas están abajo, en la zona del pulgar.
- **Mientras se leen las preferencias** (consulta pendiente, normalmente instantánea): el primer punto dice **"Un aviso por semana, el día y a la hora que elijas."**, para no mostrar un día que después cambia. Lo mismo si la lectura falla.

### 3.2 Recordatorios (`/settings/notifications`, `NotificationSettingsScreen`)

`Screen` con `ScreenHeader` (volver, título **"Recordatorios"**) y un `ScrollView` con `px-4`, `pt-4`, `gap-6`:

1. **Estado del permiso** (`PermissionStatus`, 3.3).
2. **Tarjeta de preferencias** (`Card` sin título, `p-0` horizontal en las filas, separadas por `ListSeparator`):
   1. `SwitchRow` **"Recordatorio semanal"**, descripción **"Un aviso por semana para anotar tus ventas."**
   2. Solo si el semanal está encendido: `ListRow` tocable con `title` **"Día y hora"**, `subtitle` **"{Días} a las {hora}"** ("Domingos a las 20:00") e ícono `CaretRight` al final. Abre la hoja de 3.4.
   3. `SwitchRow` **"Resumen del mes"**, descripción **"El día 1 a las 10:00, te avisamos que está listo el resumen del mes anterior."**
3. Ayuda en `text-sm` `muted`, debajo de la tarjeta: **"Si pasas un tiempo sin abrir la app, el recordatorio sigue llegando con un mensaje general. Nunca recibes más de uno por semana."**
4. Solo con el permiso sin conceder (sin decidir o denegado), una `InlineNotice` con `Info` debajo de la ayuda: **"Lo que elijas aquí se guarda y empieza a funcionar cuando actives los avisos."**
5. Solo en desarrollo y en el build `e2e`: el panel de prueba (3.5), al final.

- **Sombras a la vista**: la tarjeta del permiso y su botón (cuando aparece) y la tarjeta de preferencias. Son tres como máximo (sistema de diseño 4.4).
- **Interruptores**: al tocar, el cambio se ve de inmediato y se guarda (`useSaveNotificationPreferences`). Si el guardado falla, el interruptor vuelve a su valor anterior y aparece el aviso de error (5.4). La reconciliación la dispara `DataChanges`: la UI no hace nada más.
- **El estado "encendido" no depende solo del color**: el interruptor mueve su círculo de lado y el lector dice "activado" o "desactivado".

### 3.3 Estado del permiso (`PermissionStatus`)

| Permiso | Qué se ve |
|---|---|
| Leyendo (`undefined`) | Nada. Evita que una tarjeta aparezca y desaparezca en el primer instante. |
| Sin decidir (`undetermined`) | `Card` con título **"Activa los avisos"** y el texto **"Para que te lleguen los recordatorios, Kofi necesita tu permiso para enviarte avisos."** Debajo, `PrimaryButton` **"Activar recordatorios"**, que pide el permiso directo (diálogo del sistema). |
| Denegado (`denied`) | `Card` con título **"Los avisos están apagados"** y el texto **"Están desactivados en los ajustes de tu teléfono. Si quieres recibirlos, actívalos ahí."** Debajo, `PrimaryButton` **"Abrir ajustes"** con la pista **"Abre los ajustes de Kofi en tu teléfono"** (`Linking.openSettings()`). La app no vuelve a pedir el permiso. |
| Concedido (`granted`) | `InlineNotice` con `CheckCircle`: **"Los avisos están activados en tu teléfono."** Sin tarjeta ni botón. |

- Resultado de "Activar recordatorios" en esta pantalla: concedido → se anuncia **"Recordatorios activados"** y la tarjeta pasa a la línea de "concedido"; denegado → la tarjeta pasa a "Los avisos están apagados", sin mensaje extra.
- Al volver de los ajustes del sistema con el permiso concedido, también se anuncia "Recordatorios activados".
- En Android 12 o anterior el permiso viene concedido de fábrica: se ve directo la línea de "concedido".

### 3.4 Hoja "Día y hora del recordatorio" (`WeeklyReminderSheet`)

`Sheet` con título **"Día y hora del recordatorio"**. El contenido se desplaza si no cabe (letra grande). `gap-6`:

1. `ChipGroup` **"Día"** (radio), siete chips en orden de lunes a domingo: **"Lunes"**, **"Martes"**, **"Miércoles"**, **"Jueves"**, **"Viernes"**, **"Sábado"**, **"Domingo"**. Se acomodan en varias filas.
2. `QuantityStepper` **"Hora"**, de 0 a 23, que se puede escribir.
3. `ChipGroup` **"Minutos"** (radio): **"00"**, **"15"**, **"30"**, **"45"**. Si la preferencia guardada tiene otro minuto (no debería pasar desde la UI), ningún chip aparece elegido y el resumen muestra el minuto real hasta que se elija uno.
4. Resumen en `text-base` `foreground`, que se actualiza al cambiar cualquier valor y se anuncia con una región viva educada: **"Te avisamos {días} a las {hora}."**
5. `PrimaryButton` **"Guardar"**.

- Abre con los valores guardados. Cerrar la hoja (deslizar, tocar fuera, atrás de Android) descarta los cambios sin preguntar: son tres valores a la vista y se vuelven a elegir en segundos.
- "Guardar" guarda día y minuto del día juntos (`minuteOfDay = hora × 60 + minutos`), cierra la hoja y muestra el aviso **"Listo, te avisamos {días} a las {hora}."** Si falla, la hoja queda abierta con los valores elegidos y aparece el aviso de error.
- **Sombras**: la hoja y "Guardar".

### 3.5 Panel de prueba (`TestReminderPanel`, solo desarrollo y `e2e`)

Al final de la pantalla, con un encabezado `text-heading` **"Pruebas de avisos"** y la nota `text-sm` `muted` **"Solo aparece en las versiones de prueba."** Dos `SecondaryButton`: **"Aviso en 1 minuto"** y **"Secuencia del estado B"**. Al programar, aviso de éxito **"Aviso de prueba programado"** o **"Secuencia de prueba programada"**. Sin permiso concedido, los botones muestran el aviso de error **"Activa los avisos para probarlos."**

### 3.6 Ícono de la notificación en Android (respuesta a F7.0, 6.1 punto 7)

**`assets/images/android-icon-monochrome.png` no servía** (era el de la plantilla; hoy es el gato de Kofi). Lo revisé:
- era el **logo de la plantilla de Expo** (la "A"), igual que `icon.png`; no era un ícono de la app;
- medía 432 × 432 y su figura ocupaba solo unos 196 × 176 px (el 45 % del lienzo), porque estaba pensado para la zona segura del ícono adaptable del lanzador. Como ícono de notificación (24 dp), la figura habría quedado de unos 11 dp;
- era gris (`#7D7D7D`) sobre transparente. Android solo usa el canal alfa de los íconos de notificación, así que el gris no es el problema, pero la guía pide blanco.

**Qué hace falta**: un archivo nuevo, `assets/images/notification-icon.png`, que F7.4 pasa al plugin como `"icon"`:

| Requisito | Valor |
|---|---|
| Tamaño del lienzo | 96 × 96 px (24 dp en xxxhdpi; el plugin genera las demás densidades) |
| Zona de la figura | Centrada, dentro de 88 × 88 px (22 dp), con al menos 4 px libres en cada borde |
| Color | Blanco puro `#FFFFFF` con transparencia; sin degradados, sombras ni grises intermedios salvo el suavizado del borde |
| Trazo mínimo | 8 px a 96 px (2 dp), para que se lea en la barra de estado |
| Forma | Silueta plana, sin texto ni detalles finos |

- **`"color"` del plugin**: `#743A59` (el acento claro). Android lo usa para teñir el ícono y el nombre de la app en el aviso. Sobre el fondo blanco de la cortina de avisos tiene más de 9:1 de contraste.
- **Figura**: la silueta del gato tuxedo de Kofi, con ojos y hocico calados (`assets/brand/kofi-glyph.svg`). Reemplaza al recibo de Phosphor que se usó antes de tener marca. La genera `tools/assets/generate-brand-assets.py`, junto con el ícono monocromo del lanzador (`docs/design-system.md` 8.1).
- El ícono del lanzador ya es el de Kofi. Lo dicho arriba sobre `android-icon-monochrome.png` describe el archivo de la plantilla, que ya se reemplazó; sigue sin servir para la barra de estado, porque respeta la zona segura adaptable y su figura quedaría pequeña.

---

## 4. Estados

### 4.1 Pantalla explicativa

| Estado | Qué se ve |
|---|---|
| Preferencias cargando o con falla al leer | Todo igual, con el primer punto genérico (3.1). |
| Normal | 3.1 con `{días}` y `{hora}` reales. |
| Diálogo del sistema abierto | La pantalla queda igual detrás; un segundo toque en "Activar recordatorios" no hace nada. |
| Permiso concedido | Vuelve a Inicio y aparece el aviso de éxito (5.4). |
| Permiso denegado | Vuelve a Inicio sin mensaje (UX-N3). |
| Falla al pedir el permiso (excepción) | Vuelve a Inicio sin mensaje; queda en el logger. La opción sigue en Ajustes. |

### 4.2 Recordatorios

| Estado | Qué se ve |
|---|---|
| Cargando preferencias | `ScreenHeader` y `LoadingState` **"Cargando tus recordatorios"**, `shape="rows"`, `count={3}`. |
| Falla al cargar preferencias | `ErrorState` **"No se pudieron cargar tus recordatorios."** con **"Reintentar"**. |
| Vacío | No existe: sin fila guardada, el repositorio devuelve los valores por defecto (domingo, 20:00, mensual encendido). |
| Normal | 3.2 con el estado del permiso de 3.3. |
| Guardando un interruptor | El interruptor ya muestra el valor nuevo; no hay indicador (el guardado es local e inmediato). |
| Guardado con éxito (interruptor) | Sin aviso visual; el lector anuncia **"Recordatorio semanal activado"**, **"Recordatorio semanal desactivado"**, **"Resumen del mes activado"** o **"Resumen del mes desactivado"**. |
| Guardado con éxito (hoja) | Aviso de éxito "Listo, te avisamos…". |
| Falla al guardar | El control vuelve al valor anterior (o la hoja queda abierta) y aparece el aviso de error. |

---

## 5. Textos

Español neutro con tuteo y sin culpa. No se usan "todavía no", "deberías", "debes", "tienes que", "olvidaste", "otra vez", "llevas", "fallaste", "perdiste", "error" ni "mal" en lo que lee la persona (`GUILT_PATTERNS`).

### 5.1 Los avisos (catálogo de `domain/texts.ts`)

| Aviso | Título | Cuerpo | Largo (título / cuerpo) |
|---|---|---|---|
| Semanal `neutral` | "¿Anotamos tus ventas de la semana?" | "Si esta semana no vendiste, también puedes marcarlo." | 34 / 52 |
| Semanal `already_registered` (adaptado) | "Tu semana ya está anotada" | "Si hubo alguna venta nueva, puedes sumarla en un momento." | 25 / 56 |
| Resumen mensual | "Tu resumen de {mes} está listo" | "Toca para ver cómo fue tu mes." | 34 como máximo ("septiembre") / 30 |

- **`neutral`** no tiene datos de la semana (D-13): ni montos, ni cantidades, ni días. Funciona igual para quien vendió, para quien no vendió y para quien no abre la app hace meses. Nombra "marcar que no vendiste", porque ese registro también cuenta.
- **`already_registered`** sirve tanto si la semana tiene ventas como si tiene la marca de "no vendí": "alguna venta nueva" no supone ninguna de las dos.
- **Resumen mensual**: `{mes}` es el **mes que se resume**, en minúscula y sin año ("Tu resumen de noviembre está listo" llega el 1 de diciembre; "Tu resumen de diciembre está listo" llega el 1 de enero). El cuerpo no promete ventas: el resumen de un mes sin ventas llega igual (D-43).
- Al tocar: el semanal abre el registro de venta y el mensual abre el resumen de ese mes (F7.0, 4.3).
- El test de tono de F7.2 recorre los dos semanales y los doce títulos mensuales.

### 5.2 Canal de Android (lo ve la persona en los ajustes del sistema)

| Campo | Texto |
|---|---|
| Nombre | "Recordatorios" |
| Descripción | "Recordatorio semanal y resumen del mes" |

### 5.3 Pantallas

| Clave sugerida | Texto |
|---|---|
| Intro: título | "¿Te recordamos anotar tus ventas?" |
| Intro: frase | "Anotar una vez por semana es la forma más simple de saber cuánto vendes." |
| Intro: punto semanal | "Un aviso por semana, {días} a las {hora}." / sin preferencias: "Un aviso por semana, el día y a la hora que elijas." |
| Intro: punto mensual | "El día 1 de cada mes, tu resumen del mes anterior." |
| Intro: punto Ajustes | "Puedes cambiar el día y la hora, o apagarlos, en Ajustes." |
| Intro: nota | "Nunca te llega más de un recordatorio por semana." |
| Intro: botones | "Activar recordatorios" · "Ahora no" |
| Título de la pantalla | "Recordatorios" |
| Permiso sin decidir | "Activa los avisos" · "Para que te lleguen los recordatorios, Kofi necesita tu permiso para enviarte avisos." · "Activar recordatorios" |
| Permiso denegado | "Los avisos están apagados" · "Están desactivados en los ajustes de tu teléfono. Si quieres recibirlos, actívalos ahí." · "Abrir ajustes" |
| Pista de "Abrir ajustes" | "Abre los ajustes de Kofi en tu teléfono" |
| Permiso concedido | "Los avisos están activados en tu teléfono." |
| Nota sin permiso | "Lo que elijas aquí se guarda y empieza a funcionar cuando actives los avisos." |
| Semanal | "Recordatorio semanal" · "Un aviso por semana para anotar tus ventas." |
| Fila de día y hora | "Día y hora" · "{Días} a las {hora}" ("Domingos a las 20:00") |
| Pista de la fila | "Cambia cuándo llega el recordatorio" |
| Mensual | "Resumen del mes" · "El día 1 a las 10:00, te avisamos que está listo el resumen del mes anterior." |
| Ayuda D-13 | "Si pasas un tiempo sin abrir la app, el recordatorio sigue llegando con un mensaje general. Nunca recibes más de uno por semana." |
| Hoja: título | "Día y hora del recordatorio" |
| Hoja: grupos | "Día" · "Hora" · "Minutos" |
| Hoja: días | "Lunes" · "Martes" · "Miércoles" · "Jueves" · "Viernes" · "Sábado" · "Domingo" |
| Hoja: minutos | "00" · "15" · "30" · "45" |
| Hoja: resumen | "Te avisamos {días} a las {hora}." |
| Hoja: botón | "Guardar" |
| Cargando | "Cargando tus recordatorios" |
| Falla al cargar | "No se pudieron cargar tus recordatorios." · "Reintentar" |
| Panel de prueba | "Pruebas de avisos" · "Solo aparece en las versiones de prueba." · "Aviso en 1 minuto" · "Secuencia del estado B" |

- **`{días}`**: "los lunes", "los martes", "los miércoles", "los jueves", "los viernes", "los sábados", "los domingos". **`{Días}`** (al empezar la línea): "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábados", "Domingos". Se arman con `weekdayName` de `shared/domain/calendar` más la "s" final si el nombre no termina en "s".
- **`{hora}`**: "H:MM" en 24 horas, sin cero inicial en la hora ("8:00", "20:00", "0:15").

### 5.4 Avisos (toasts)

| Situación | Tipo | Texto |
|---|---|---|
| Permiso concedido desde la intro | éxito | "Listo, te avisamos {días} a las {hora}." |
| Día y hora guardados | éxito | "Listo, te avisamos {días} a las {hora}." |
| Falla al guardar una preferencia | error | "No se pudo guardar el cambio. Inténtalo de nuevo." |
| Prueba programada | éxito | "Aviso de prueba programado" / "Secuencia de prueba programada" |
| Prueba sin permiso | error | "Activa los avisos para probarlos." |

### 5.5 Anuncios del lector de pantalla

| Situación | Texto |
|---|---|
| Permiso concedido en Ajustes (o al volver del sistema) | "Recordatorios activados" |
| Interruptor semanal | "Recordatorio semanal activado" / "Recordatorio semanal desactivado" |
| Interruptor mensual | "Resumen del mes activado" / "Resumen del mes desactivado" |
| Resumen de la hoja | el texto del resumen, por región viva |

---

## 6. Componentes

### 6.1 Se usan de `@/shared/ui` sin cambios

`Screen`, `ScreenHeader`, `Card`, `ListRow`/`ListSeparator`, `PrimaryButton`, `SecondaryButton`, `TextButton`, `ChipGroup`, `QuantityStepper`, `Sheet`, `InlineNotice`, `LoadingState`, `ErrorState`, `Icon`, `useAppToast`, `announce`, `useAnnounceWhen`.

### 6.2 Nuevos o cambiados en `shared/ui` (con sus tests, TDD)

| Componente | Necesidad | Especificación |
|---|---|---|
| **`SwitchRow`** (nuevo, **necesario**) | Encender y apagar el semanal y el mensual (3.2). Lo va a usar también Ajustes (F9). | Props: `title`, `description?`, `value: boolean`, `onChange(value)`, `isDisabled?`. Fila de al menos 56 de alto, `px-4 py-3`, título `text-base font-medium`, descripción `text-sm` `muted`, interruptor a la derecha (sobre el `Switch` de HeroUI Native). **Toda la fila** cambia el valor (área grande). Para el lector es un solo elemento: rol `switch`, etiqueta = título, pista = descripción, `accessibilityState={{ checked }}`. Colores: encendido, pista `accent` y círculo `accent-foreground`; apagado, pista `background` con borde de 2 px `field-border` y círculo `muted`. Todos son pares ya medidos (2.3). Sin sombra. Con "reducir movimiento", el círculo salta sin animación. Tests: tocar la fila y tocar el interruptor llaman a `onChange(!value)`; rol, etiqueta, pista y `checked`; deshabilitado no llama. |
| **`icons.ts`** (necesario) | Íconos de esta especificación. | `BellIcon`. `CalendarBlankIcon`, `GearIcon`, `CheckCircleIcon` y `CaretRightIcon` ya existen. |

### 6.3 Componentes de la feature (`src/features/notifications/components/`)

Los de `docs/architecture/notifications.md` (2.1), con estas precisiones:
- `permission-status.tsx`: 3.3. Recibe `permission`, `onRequest` y `onOpenSettings`.
- `weekly-reminder-fields.tsx`: el contenido de la hoja de 3.4 (día, hora, minutos y resumen), controlado. `weekly-reminder-sheet.tsx` lo envuelve en `Sheet` con "Guardar".
- `notification-texts.ts` (de la UI, distinto del catálogo de avisos del dominio): `weekdayPlural(weekday, { capitalized })` y `formatReminderTime(minuteOfDay)`, con sus tests. Si el dominio ya los necesita para algo, van en `domain/texts.ts`.
- `test-reminder-panel.tsx`: 3.5.
- `screens/permission-intro-screen.tsx`: 3.1. Recibe `onFinished()`; la ruta navega.

---

## 7. Accesibilidad

- **Orden de lectura** de la intro: título → frase → los tres puntos → nota → "Activar recordatorios" → "Ahora no". Al aparecer, el foco va al título.
- **Orden de lectura** de Recordatorios: título → estado del permiso (título, texto, botón) → "Recordatorio semanal" → "Día y hora" → "Resumen del mes" → ayuda → nota sin permiso.
- **Interruptores**: rol `switch`, estado `checked`, y anuncio del resultado (5.5). El estado se ve sin color por la posición del círculo.
- **Hoja**: los dos `ChipGroup` son grupos de radio con su etiqueta ("Día", "Minutos"); la hora es `adjustable` y se puede escribir; el resumen es una región viva educada, así que el lector confirma la combinación sin mover el foco.
- **"Abrir ajustes"** tiene pista, porque saca a la persona de la app.
- **Letra grande**: los textos crecen sin límite y no se recortan; la intro y la hoja se desplazan; los chips de días se acomodan en más filas; el pie de la intro crece en alto. Se prueba con el tamaño más grande en Android.
- **Contraste**: no se agrega ningún par nuevo (los del interruptor ya están en la tabla 2.3).
- **Áreas táctiles**: filas de 56, chips y botones de 48.
- **Reducir movimiento**: la intro entra sin deslizarse (lo maneja `react-native-screens` según el sistema); el interruptor salta sin animación.
- **Una mano**: los botones de la intro y "Guardar" de la hoja van abajo. Los interruptores están en la mitad de la pantalla, alcanzables con el pulgar.

---

## 8. Pruebas sugeridas (además de las de F7.0, sección 5)

**Catálogo (F7.2)**
- Los textos de 5.1 son exactamente esos, en las dos variantes y en los doce meses.
- Ningún título pasa de 40 caracteres ni ningún cuerpo de 60 (contados con `[...texto].length`), incluido "Tu resumen de septiembre está listo".
- El mensual del 2027-01-01 dice "diciembre" y no lleva año.
- `neutral` no contiene dígitos, "$" ni "semana pasada" (además de las reglas de F7.0).
- Ningún texto de 5.1, 5.2, 5.3, 5.4 y 5.5 coincide con `GUILT_PATTERNS` (los de UI se prueban en la feature, en un test de `components/`).

**Formato**
- `weekdayPlural`: 1 → "los lunes", 6 → "los sábados", 7 → "los domingos"; con mayúscula, "Sábados".
- `formatReminderTime`: 0 → "0:00", 15 → "0:15", 510 → "8:30", 1200 → "20:00", 1439 → "23:59".

**Intro (F7.8, `renderRouter`)**
- Muestra "Un aviso por semana, los domingos a las 20:00." con los valores por defecto, y "los martes a las 8:30" con esas preferencias.
- Mientras las preferencias cargan, muestra el punto genérico.
- "Ahora no", el botón atrás de Android y cerrar el modal vuelven a Inicio sin pedir el permiso y sin aviso.
- "Activar recordatorios" con resultado `granted` muestra "Listo, te avisamos los domingos a las 20:00." y reconcilia; con `denied`, vuelve sin aviso.
- Dos toques seguidos en "Activar recordatorios" piden el permiso una sola vez.

**Recordatorios (F7.7)**
- Cada estado del permiso muestra su bloque de 3.3; con `undefined`, ninguno.
- Con `denied`, "Abrir ajustes" llama a `Linking.openSettings` y nunca a `requestPermission`.
- Con `undetermined`, "Activar recordatorios" llama a `requestPermission` y, si concede, anuncia "Recordatorios activados".
- Apagar el semanal esconde "Día y hora", guarda y anuncia "Recordatorio semanal desactivado"; encenderlo la muestra con el día y la hora anteriores.
- La hoja abre con los valores guardados; cambiar el día a martes, la hora a 8 y los minutos a 30 muestra "Te avisamos los martes a las 8:30."; "Guardar" guarda `{ weekday: 2, minuteOfDay: 510 }`, cierra y muestra el aviso.
- Cerrar la hoja sin "Guardar" no guarda nada.
- Una falla al guardar vuelve el interruptor a su valor anterior y muestra "No se pudo guardar el cambio. Inténtalo de nuevo."
- Con permiso `denied`, cambiar el día y la hora igual guarda (D-43) y se ve la nota "Lo que elijas aquí se guarda…".

**`SwitchRow`**: los tests de 6.2.

**E2E (F7.10)**: los de F7.0 (5.6), buscando "¿Te recordamos anotar tus ventas?", "Ahora no", "Recordatorios", "Día y hora" y "Guardar".

**Manual (F7.10)**: el ícono `notification-icon.png` se ve nítido y blanco en la barra de estado y teñido con el acento en la cortina, en tema claro y oscuro; los textos de 5.1 se leen completos en el aviso plegado de un teléfono de 360 de ancho.

---

## 9. Preguntas abiertas

1. **Figura del ícono de notificación.** Resuelta: se usa la silueta del gato de Kofi (sección 3.6).
2. **Quién dibuja el PNG.** Resuelta: lo genera `tools/assets/generate-brand-assets.py` desde el SVG, sin dependencias nuevas en la app.
3. **Minutos de a 15 (para el usuario).** Recomiendo ofrecer solo 00, 15, 30 y 45: alcanza para un recordatorio y la hoja queda simple. Si alguien necesita, por ejemplo, 20:10, la alternativa es un campo de minutos libre como el de la hora, con un control más que escribir.
