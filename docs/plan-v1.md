# Plan de implementación — cuantovendi v1

- **Estado**: Listo para revisión del usuario (punto de control CP0).
- **Fecha**: 2026-11-13
- **Autor**: architect
- **Fuentes**: `CLAUDE.md`, `docs/product.md`, `docs/design-system.md` ("Bruma"), `docs/architecture/adr-001` a `adr-015`, `.claude/rules/react-native/*.md`, `.claude/agents/*.md`.
- **Estado del repositorio al escribir el plan**: el boilerplate de Expo SDK 58 ya está instalado (Expo Router en `src/app`, HeroUI Native + Uniwind, Jest + RNTL, ESLint + Prettier); `typecheck`, `lint`, `test` y `expo-doctor` pasan; existen `metro.config.js`, `src/global.css`, `jest.config.js` (solo el preset `jest-expo`), `eslint.config.js` (parcial respecto de ADR-013), `.prettierrc.json`, un test de humo en `src/__tests__/` y la sección "Comandos" de `CLAUDE.md`.
- **ADRs**: los ADR-001 a ADR-015 están **aceptados**. El plan incorpora los requisitos que salieron de su revisión (sección 2.1), y la tarea F0.1 contrasta el plan con su texto final.

El plan está pensado para ejecutarse de forma autónoma, feature por feature, por el orquestador y los subagentes. Cada tarea tiene un id estable, un agente responsable, los tests que se escriben primero (TDD, ADR-002), criterios de aceptación verificables, comandos de verificación y dependencias. Los puntos de control se **registran** en el Registro de progreso y la ejecución sigue; solo se detiene ante una condición de parada (sección 7.2).

---

## Resumen ejecutivo

**Alcance**: la v1 **no se publica y nada sale de este entorno de desarrollo**. Es una app local primero, con código multiplataforma, que en la v1 se verifica solo en Android (emulador o el teléfono del usuario conectado). Sirve para registrar ventas en pocos toques, ver el propio ritmo, recibir recordatorios amables, aprender con consejos y respaldar los datos. Las tiendas, EAS, los servicios en la nube y la verificación en iOS quedan para un release futuro (sección 10).

**Cómo se trabaja**: 103 tareas activas (F0.1 agregó F8.11), cada una con id y casilla, hechas con TDD. Cada tarea se verifica en local con `npm run typecheck`, `npm run lint` y `npm test`; los E2E de Maestro en Android quedan **pendientes de entorno** hasta que el usuario habilite Android SDK, emulador y Maestro, sin bloquear nada. Cada fase se cierra con V-BASE y la revisión del reviewer. Los puntos de control se registran en el log para que el usuario pruebe después, y la ejecución sigue. No se hace ningún commit sin pedido del usuario.

| Fase | Qué entrega | Punto de control |
|---|---|---|
| F0 Fundaciones | Tooling, dominio compartido (CLP, fechas de Chile, ids), SQLite con migraciones seguras, providers, tema "Bruma" claro y oscuro, componentes base (`Amount`, `TextField`), pestañas, builds locales y E2E | **CP0** (aprobar el plan) y **CP1** (Bruma, Lexend y HeroUI en Android) |
| F1 Productos | Versiones, precio fijo o a convenir, costo opcional y archivado | **CP2** |
| F2 Fotos | Hasta 6 fotos de galería o cámara, la primera como portada, reordenables y sin EXIF | **CP3** |
| F3 Ventas | Registro rápido, "no vendí" (semana actual y anterior), editar y borrar, sin fechas futuras | **CP4** |
| F4 Inicio y resumen | Totales, comparación con el mismo tramo, últimas ventas, resumen mensual por monto y ganancia aproximada | **CP5** |
| F5 Calendario y racha | Calendario por intensidad, detalle del día y racha semanal | **CP6** |
| F6 Consejos | 20 a 30 consejos con fuentes, sin temas tributarios, después de guardar y en la sección "Consejos" | **CP7a** (contenido) y **CP7** |
| F7 Notificaciones | Recordatorio semanal adaptado con respaldo neutro, resumen mensual y permiso después de la primera venta | **CP8** |
| F8 Respaldo y exportación | Dos CSV, respaldo ZIP propio y restauración validada con el último respaldo de seguridad | **CP9** |
| F9 Ajustes | Notificaciones, respaldo y licencias de terceros | **CP10** |
| F10 Cierre local | Accesibilidad (TalkBack), rendimiento en Android de gama baja, permisos y gate local | **CP11** (gate local) y **CP12** (aprobación final, sin publicación) |

**Pendiente con el usuario**: solo **P-23** (Lexend o Sora para los montos), que se decide en CP1.

---

## 0. Cómo leer y ejecutar este plan

### 0.1 Convenciones
- **Ids**: `F<fase>.<n>` (por ejemplo, `F3.4`). Una vez aprobado el plan en CP0, los ids no se renumeran: una tarea que se elimina queda como "anulada" y una nueva recibe el siguiente número libre de su fase.
- **Puntos de control**: `CP<n>` (sección 7). Se registran en el Registro de progreso y la ejecución sigue.
- **Casillas**: `- [ ]` pendiente; `- [x]` terminada; `- [~]` **pendiente de entorno**: la parte de código está hecha, pero falta correr algo que requiere un entorno Android (SDK, emulador o teléfono y Maestro) que hoy no existe. Una tarea `- [~]` no bloquea a las que dependen de ella, salvo a otros E2E.
- **Decisiones**: `D-<nn>` son decisiones de producto ya tomadas; `P-<nn>` son **decisiones pendientes** con el usuario (sección 3). Una tarea marcada con `P-nn` no se cierra sin la respuesta. Si la decisión bloquea el diseño, se pregunta antes de empezar la tarea. Cuando una `P-nn` se resuelve, conserva su id y se marca "resuelta → D-nn".
- **ADRs**: la línea "ADRs" de cada tarea indica qué decisiones la rigen y hay que leer antes de empezar.
- **Agentes** (flujo de `CLAUDE.md`): `orquestador`, `architect`, `designer`, `code-writer` y `reviewer`, más el `usuario` en los puntos de control.

### 0.2 Flujo de cada feature (F1 a F9)
1. `Fx.0` **architect**: diseño en `docs/architecture/<feature>.md`, con los seis apartados de su entregable. Si surgen preguntas de producto que bloquean, el orquestador las consulta antes de seguir.
2. `Fx.1` **designer**: especificación de pantallas y estados (vacío, cargando, error y éxito) en `docs/design/<feature>.md`, o donde el designer lo indique dentro de `docs/design-system.md`. Solo si la feature tiene UI.
3. **code-writer**, en TDD y por capas: `domain` → `data` → `use-cases` (si hacen falta) → `hooks` → `components` → `screens` → rutas en `src/app/`.
4. **reviewer**: revisa la feature completa. Los hallazgos críticos e importantes vuelven al code-writer antes de seguir.
5. **E2E** con Maestro al cierre. El code-writer escribe los flujos (`e2e/maestro/<feature>/*.yaml`) cuando el orquestador lo pide en esa tarea (ADR-002). Correrlos requiere el entorno Android; mientras no exista, la tarea queda `- [~]` **pendiente de entorno** y la fase se cierra con V-BASE y el reviewer. Si la feature agregó una migración, el cierre incluye además el E2E de actualización (F0.15).
6. **Punto de control**: el orquestador lo registra en el Registro de progreso, con lo que el usuario debe probar, y la ejecución sigue.

### 0.3 Comandos de verificación
Hoy existen `npm test`, `npm run typecheck`, `npm run lint` y `npm run format`. F0.5 agrega el resto de los scripts de ADR-013 y el orquestador los anota en `CLAUDE.md`.

| Alias | Comandos | Cuándo |
|---|---|---|
| **V-BASE** | `npm run typecheck` (`tsc --noEmit`) · `npm run lint` (`npx expo lint`) · `npm run format:check` · `npm test` | Al terminar **cada** tarea de código. Todo en verde y sin warnings nuevos. Hasta F0.5 se usa `npx prettier --check .` en lugar de `format:check`. |
| **V-NODE** | `npm run test:node -- <ruta>` | Ciclo TDD de `domain`, `data` y `use-cases` (desde F0.5). |
| **V-UI** | `npm run test:ui -- <ruta>` | Ciclo TDD de `hooks`, `components`, `screens` y `shared/ui` (desde F0.5). |
| **V-DB** | `npm run db:generate` responde que no hay cambios de esquema pendientes | Toda tarea que toque `src/core/db/schema/`. |
| **V-DEPS** | `npx expo-doctor` · `npx expo install --check` | Toda tarea que agregue o cambie dependencias, y al cierre de cada fase. |
| **V-DEV** | `npx expo start` (dev server) o, si un módulo nativo lo exige, `npx expo run:android` en el emulador o en el teléfono conectado | Para probar a mano y en los puntos de control. |
| **V-E2E-A** (requiere entorno Android; hoy, pendiente de entorno) | Build **`e2e`** de Android generado **localmente** con el comando de ADR-016, instalado en el emulador o en el teléfono conectado · `maestro test e2e/maestro/<feature>` | Solo en la tarea E2E de cierre de cada feature (D-14). |
| **V-E2E-UPG** (requiere entorno Android; hoy, pendiente de entorno) | E2E de **actualización**: instalar el build del último punto de control aprobado, cargar datos, instalar encima el build nuevo y verificar que los datos siguen ahí | Cierre de toda feature que agregue una migración, y en F10.5. |
| **V-AUDIT** | `npm audit` | Al cierre de cada fase y en el gate final. |

**Entorno disponible hoy**: Node, Jest, typecheck, lint y el Expo dev server. **No hay** Android SDK, emulador ni Maestro, y no se instalan sin autorización del usuario. Todo lo que los necesita queda pendiente de entorno y no bloquea.

Un test nuevo tiene que **fallar por la razón correcta** antes de escribir el código (rojo → verde → refactor). El reviewer comprueba que los tests prueban comportamiento y no implementación.

### 0.4 Protocolo de ejecución autónoma
1. Leer `docs/plan-v1.md`, `CLAUDE.md` y los ADRs que cita la tarea.
2. Elegir la siguiente tarea con casilla `- [ ]` cuyas dependencias estén todas marcadas `- [x]` y cuyo punto de control previo esté aprobado.
3. Si la tarea depende de una `P-nn` sin respuesta, o necesita cambiar un ADR aceptado, **detenerse y preguntar** al usuario.
4. Delegar en el agente indicado, que ejecuta la tarea con TDD y corre su verificación.
5. Marcar la casilla `- [x]` solo si todos los criterios de aceptación se cumplen y la verificación terminó con exit 0. Anotar la tarea en el **Registro de progreso** (sección 11) con la salida resumida de su verificación.
6. Nunca debilitar, saltar ni borrar tests para que pasen, ni saltarse la tarea del reviewer.
7. Al llegar a un punto de control (`CP<n>`, al cierre de cada fase), registrarlo en el Registro de progreso con qué probar y cómo, y **seguir**. Si el usuario después reporta problemas, se abren tareas nuevas con el siguiente id libre de la fase.
8. Si una verificación necesita el entorno Android (V-DEV en dispositivo, V-E2E-A, V-E2E-UPG o una verificación manual), marcar la parte afectada `- [~]` pendiente de entorno, anotarla en el registro y seguir.

### 0.5 Reglas permanentes durante la ejecución
- **Git**: ningún agente hace commits, push ni operaciones que cambien el estado de git. Solo el usuario puede pedir un commit; el orquestador lo hace sin líneas de coautor ni de atribución (`CLAUDE.md`).
- **Dependencias**: siempre con `npx expo install`, salvo las de solo desarrollo que un ADR justifique (como `better-sqlite3`). Una dependencia que no esté en un ADR es una condición de parada.
- **Comentarios**: solo docstrings TSDoc (ADR-003). El lint lo controla desde F0.5.
- **UI**: solo tokens y componentes de `docs/design-system.md`. Todo monto se muestra con `Amount` y todo ícono es de Phosphor (ADR-014). Textos en español neutro, con tuteo y sin culpa.
- **Fechas**: "hoy" y "esta semana" se obtienen siempre con `Clock` en el dominio y con `useToday` / `useCurrentWeek` en la UI (ADR-015), nunca con `new Date()` suelto.
- **Sin estimaciones de tiempo**: el orden lo dan las dependencias, no la duración.

---

## 1. Objetivo y definición de terminado de la v1

### 1.1 Objetivo
Entregar una app con código para iOS y Android, verificada en la v1 solo en Android y en local (D-23), local primero y preparada para una sincronización futura, que permita a un artista o pequeño emprendedor **registrar sus ventas en pocos toques**, ver su ritmo (inicio, calendario, racha, resumen mensual y ganancia aproximada), recibir recordatorios amables, aprender con consejos breves y respaldar o exportar sus datos. Todo según `docs/product.md` y las decisiones de la sección 3.

### 1.2 Definición de terminado (criterios verificables)

**Funcionalidad (trazabilidad con `docs/product.md`)**
- [~] DT-01 **Productos**: crear, editar, archivar y desarchivar; versiones con precio fijo o "a convenir"; costo opcional detrás de "agregar costo"; con una sola versión la UI no muestra el concepto. Lo cubren F1 y su E2E.
- [~] DT-02 **Fotos**: hasta 6 por producto, desde la galería o la cámara, guardadas como JPEG de 1600 px y sin EXIF. Lo cubren F2, su E2E y la verificación manual F2.9.
- [~] DT-03 **Ventas**: registrar con fecha (hoy por defecto, sin fechas futuras), ítems, y canal y nota opcionales; editar y borrar con confirmación; "Esta semana no vendí"; una venta en una semana marcada quita la marca. Lo cubren F3 y su E2E.
- [~] DT-04 **Inicio y resumen mensual**: totales, comparación suave, últimas ventas, producto más vendido, canal principal y ganancia aproximada solo con costos cargados. Inicio no muestra consejos (D-11). Lo cubre F4.
- [~] DT-05 **Calendario** por intensidad con el detalle del día, y **racha** semanal. Lo cubre F5.
- [~] DT-06 **Consejos**: catálogo de 20 a 30 consejos con fuentes, mostrados de a uno después de guardar una venta, contextuales, y sección "Consejos" con los vistos marcados. Lo cubre F6.
- [~] DT-07 **Notificaciones locales**: recordatorio semanal (domingo 20:00 por defecto, configurable o desactivable, con texto adaptado) que sigue llegando con un texto neutro aunque la app no se abra (D-13), y resumen mensual (día 1 a las 10:00, desactivable). Nunca llegan dos recordatorios semanales en la misma semana. El permiso se pide después de la primera venta y ningún texto culpa. Lo cubren F7 y la verificación manual en el dispositivo.
- [~] DT-08 **Respaldo y exportación**: CSV de ventas y de productos (dos archivos); respaldo ZIP completo sin contraseña; restauración que reemplaza todo, con un respaldo de seguridad previo, y que rechaza archivos manipulados (rutas peligrosas, entradas comprimidas o duplicadas, tamaños fuera de límite, falta de espacio). Lo cubre F8.
- [~] DT-09 **Ajustes**: reúnen notificaciones, respaldo y exportación, y las licencias de terceros (Apache 2.0 de HeroUI Native, OFL de Lexend, MIT de Phosphor y el resto). Lo cubre F9.

**Calidad**
- [x] DT-10 V-BASE en verde sobre todo el repo: `tsc --noEmit` y `npx expo lint` sin errores, Prettier sin diferencias, y todos los tests de Jest (proyectos `node` y `ui`) en verde.
- [x] DT-11 V-DEPS sano y V-AUDIT sin vulnerabilidades altas o críticas sin justificar.
- [~] DT-12 (requiere entorno Android) Toda la suite de Maestro (`e2e/maestro/**`) pasa en el build `e2e` local de Android, incluidos los E2E de instalación nueva y de actualización.
- [x] DT-13 Cada migración tiene su test con datos previos y pasa por `configureAndMigrate`, con `foreign_key_check` limpio (ADR-006). El formato de respaldo v1 tiene *fixtures* válidos y adversariales en el repo (ADR-012).
- [x] DT-14 El reviewer no tiene hallazgos críticos ni importantes abiertos en ninguna feature.

**Accesibilidad y rendimiento**
- [~] DT-15 Los flujos críticos (registrar venta, "no vendí", crear producto, ver resumen, respaldar) se recorren completos con TalkBack en el teléfono Android del usuario, y con el tamaño de fuente máximo del sistema sin texto cortado (F10.1).
- [x] DT-16 Todos los pares de tokens de texto y fondo cumplen WCAG AA en tema claro y oscuro, con un test automático (F0.12). La intensidad del calendario, lo elegido y los errores no dependen solo del color.
- [~] DT-17 Se cumplen los presupuestos de rendimiento que fija F10.0, en un Android de gama baja de referencia y con el conjunto grande de datos de prueba.

**Cierre local**
- [~] DT-18 Se completa el gate de cierre local de la v1 (F10.7).
- [~] DT-19 La app declara solo los permisos necesarios: cámara y notificaciones. Sin push remoto (`enableRemoteNotifications: false`), sin `SCHEDULE_EXACT_ALARM` y sin acceso a la galería completa.
- [~] DT-20 El usuario aprobó la v1 en el punto de control final (CP12). La v1 no se publica (D-23).

---

## 2. ADRs

### 2.1 Requisitos que salieron de la revisión de los ADRs
El plan los trata como **requisitos** de las tareas indicadas:

| Tema | Cambio | Tareas |
|---|---|---|
| ADR-012 ZIP | No se usa `fflate` en streaming. Hay un **lector y escritor ZIP propio, solo STORED** (sin compresión), con un **parser puro** testeado con *fixtures* adversariales. | F8.3, F8.4 |
| ADR-015 fechas (nuevo) | `LocalDate` con aritmética de calendario pura, semanas ISO, `Clock` (solo `now()`) y el puerto `LocalCalendar` (`localDateOf`, `instantAt`, `nextLocalMidnight`) como única conversión, en la zona del dispositivo; *fixtures* de `America/Santiago`, `Pacific/Easter` y `America/Punta_Arenas`. *(Ajustado en F0.1.)* | F0.1, F0.7 y todo lo que use fechas |
| ADR-006 migraciones | `configureAndMigrate`: FK desactivadas → `migrate` → `PRAGMA foreign_key_check` → FK activadas. E2E de instalación nueva y de actualización. | F0.9, F0.10, F0.15, V-E2E-UPG |
| ADR-012 restauración | Validaciones: *path traversal*, solo STORED, nombres duplicados y espacio libre suficiente. | F8.3, F8.4, F8.6 |
| ADR-011 notificaciones | La reconciliación es **serializada** (cola en la que gana la última) y aplica **diferencias** (`diffNotifications`), no un reemplazo total. D-13 ya está resuelto en el texto final de ADR-011 con los **estados A/B**: A = solo el `WEEKLY` neutro; B = aviso adaptado de una sola vez + 47 avisos neutros de una sola vez, sin `WEEKLY`. *(Ajustado en F0.1.)* | F7.0, F7.2, F7.4, F7.5 |
| ADR-007 ganancia | El **costo actual** de la versión (para ítems sin `unit_cost`) lo entrega `ProductRepository.currentCostsFor(versionIds)`; el hook de seguimiento arma el mapa y la función pura `approximateProfit(records, currentCostByVersion)` lo recibe explícito. Las lecturas de ventas **no** resuelven costos. *(Ajustado en F0.1.)* | F1.3, F4.2, F4.3 |
| ADR-007 "no vendí" | La marca de una semana tiene un **id determinista**: `UUIDv5(week_start, NAMESPACE_CUANTOVENDI)` (ADR-006). | F3.2, F3.3 |
| ADR-006 ids | Las PK son **UUIDv7** generados con `uuid` 14 (`v7({ msecs: clock.now(), random })`), con los bytes aleatorios de `getRandomBytes(16)` de `expo-crypto`. No se usa `randomUUID` (v4). *(Agregado en F0.1.)* | F0.8 |
| ADR-009 / ADR-015 | Hooks **`useToday`** y **`useCurrentWeek`**, que cambian al pasar la medianoche y al volver a primer plano. | F0.11 y toda la UI con fechas |
| ADR-013 / builds | Build **`e2e`** de Android generado localmente (sin EAS): `EXPO_PUBLIC_E2E=1 npx expo run:android --variant release`. Las semillas de datos se cargan **restaurando un respaldo *fixture*** por el camino real de restauración (`cuantovendi://e2e/seed?fixture=<nombre>`), así que existen recién desde F8 (F8.11). *(Ajustado en F0.1.)* | F0.2, F0.15, F8.11, V-E2E-A |
| ADR-012 restauración (texto final) | No hay *staging* ni intercambio de directorios ni marcador `restore-in-progress`: las fotos verificadas se copian a `photos/<id>.jpg.part`, se verifica el `sha256` y se renombran **antes** del commit; los datos se reemplazan en una sola `runInTransaction`. El lector usa el **directorio central** con acceso aleatorio. *(Agregado en F0.1.)* | F8.0, F8.3 a F8.6 |
| ADR-006 exportación de emergencia | Si la migración falla o la base es más nueva que el código: copia cruda con `backupDatabaseAsync` + `photos/`, empaquetada con el escritor STORED de ADR-012. No usa el mapeo de dominio ni `BackupDataV1`. *(Agregado en F0.1.)* | F0.9, F0.10, F8.8 |
| ADR-010 montos | **Formateador de CLP propio**, sin `Intl`. | F0.6, F0.13 (`Amount`) |

### 2.2 Estado y ADRs nuevos
Los ADR-001 a ADR-015 están **aceptados** (2026-11-13). Si una tarea necesita cambiar uno, se crea un ADR que lo reemplaza y la ejecución se detiene para consultarlo con el usuario (sección 7.2).

ADRs nuevos que pide este plan. Los crea el architect con el siguiente número libre (hoy se prevé el 016) y los agrega al índice `docs/architecture/README.md`:

| ADR | Tarea | Tema |
|---|---|---|
| ADR-016 | F0.2 | Plataformas (se quita web), builds locales de desarrollo, `release` y `e2e`, dependencias de la plantilla y `minSdkVersion` efectiva. Aceptado. |

### 2.3 Ajustes hechos en F0.1 (contraste con el texto final de los ADRs)
El architect contrastó el plan con los ADR-001 a ADR-015 aceptados. Cada cambio queda marcado en el texto con *(Ajustado en F0.1)* o *(Agregado en F0.1)*. Resumen:

| # | Dónde | Antes | Ahora | ADR |
|---|---|---|---|---|
| 1 | 2.1, F0.8 | Ids UUID v4 con `randomUUID` de `expo-crypto` | UUIDv7 con `uuid` 14 + `getRandomBytes` de `expo-crypto`; UUIDv5 para ids deterministas. F0.8 pasa a depender de F0.7 (`Clock`) | ADR-006 |
| 2 | 2.1, F0.7 | `Clock` con `now()` y `timeZone()`; `todayIn`, `weekStartOf`, `isAfterToday`; *fixtures* de dos zonas | `Clock` solo con `now()`; `LocalCalendar` (`localDateOf`, `instantAt`, `nextLocalMidnight`); `addDays`, `isoWeekStart`, `isoWeekday`, `monthRange` en `shared/domain/calendar/`; tres zonas; catálogo de nombres de meses y días | ADR-015, ADR-010 |
| 3 | F0.5 | Faltaban `test:tz`, `e2e:build`, `local/routes-only-in-app`, `engines`/`.nvmrc` y los proyectos de Jest exactos | Agregados según ADR-013 | ADR-013, ADR-006 |
| 4 | F0.6 | `EntityId`, `entityIdSchema`; casos de `parseClpInput` incompletos | `uuidSchema` + ids con marca por entidad; `SignedClp` y `-$5.000`; códigos de error de la tabla de ADR-010; se agrega `zod` | ADR-010, ADR-007 |
| 5 | F0.9, F0.10 | Los PRAGMA dentro de `configureAndMigrate`; sin "base más nueva"; sin anidamiento de transacciones | `configureConnection` aparte (WAL, FK verificadas, `trusted_schema = OFF`); detección de base más nueva que el código; `runInTransaction` síncrona que se une a la externa; `loadMigrationBundle`; `MigrationGate` en `core/providers` | ADR-006, ADR-005 |
| 6 | F0.11 | `core/dependencies` con `clock`, `ids` y `dataChanges` | Se suman `calendar` y `logger` (tipo `AppDependencies` de ADR-005); `useToday`/`useCurrentWeek` en `shared/lib/time/` | ADR-005, ADR-009, ADR-015 |
| 7 | F0.12, F0.13 | `prettier-plugin-tailwindcss` en dos tareas; sin envoltorios de formulario | El plugin se configura en F0.5 y F0.12 solo lo confirma; F0.13 agrega `FormTextField` y `FormAmountField` (`react-hook-form`, `@hookform/resolvers`) | ADR-013, ADR-009 |
| 8 | F0.15, F8.11 (nueva) | Deep link que carga conjuntos con fábricas, disponible en builds de desarrollo y `e2e` | Solo con `EXPO_PUBLIC_E2E=1`; la semilla **restaura un respaldo *fixture*** (requiere F8), por eso se crea **F8.11**. Hasta entonces los E2E crean sus datos por la UI con subflujos de Maestro. Se suma la pantalla de diagnóstico de fechas (ADR-015) | ADR-013, ADR-015 |
| 9 | F2.0, F2.2, F2.3, F2.4, F2.6 | El adaptador devuelve el "nombre relativo"; vive en `core/files`; huérfanos sin antigüedad | Sin nombre de archivo (se deriva del id, `StoredPhoto`); adaptador en `features/products/adapters/`; huérfanos con antigüedad > 15 min, lock de archivos y `.part` | ADR-007, ADR-008 |
| 10 | F3.0, F3.2, F3.3, F4.0, F4.2, F4.3 | Las lecturas de ventas resuelven el costo efectivo; cursor `(sold_on, id)` | `currentCostsFor` + `approximateProfit(records, map)`; cursor `(sold_on, created_at, id)`; regla de "no vendí" lunes y martes | ADR-007 |
| 11 | F7.0, F7.2, F7.4, F7.5, F7.6 | "D-13 cambia ADR-011"; variante `not_registered`; `replaceAll`; adaptador en `data/` | ADR-011 ya resuelve D-13 con los estados A/B; variantes `already_registered` / `neutral`; `listScheduled` + `diffNotifications` + `cancel`/`schedule`; adaptador en `adapters/` | ADR-011, ADR-005 |
| 12 | F8.0, F8.3 a F8.6, F8.8, sección 8 | *Staging*, intercambio de directorios, marcador `restore-in-progress`, streaming; adaptador en `core/files`; F8.8 exporta un respaldo normal | Copia directa con `.part` y verificación antes del commit; directorio central con acceso aleatorio; adaptador en `features/backup/adapters/`; F8.8 es la exportación de emergencia cruda de ADR-006 | ADR-012, ADR-006 |
| 13 | F6.0 | — | Nota: ADR-007 define `Tip.topic` con cuatro valores y F6.1 usa seis categorías. F6.0 debe resolverlo; si cambia el tipo, es un ADR nuevo (condición de parada) | ADR-007 |
| 14 | F0.2 | Mover `jest`, `jest-expo`, `@types/jest` y `eslint-config-expo` a `devDependencies`; quitar `react-dom` | Ya estaban en `devDependencies`; `react-dom` **se queda** (peer obligatorio de `@radix-ui/react-tabs`, dependencia de `expo-router`). Detalle en ADR-016 | ADR-016 |
| 15 | F1.5 / F0.13, F0.6, F0.8, F0.9 | Dependencias sin tarea: `zod`, `uuid`, `react-hook-form`, `@hookform/resolvers`, `drizzle-kit`, `better-sqlite3`, `babel-plugin-inline-import` | Cada una queda en la V-DEPS de su tarea | ADR-006, ADR-009, ADR-010 |

---

## 3. Decisiones de producto

### 3.1 Decisiones tomadas (se asumen en todo el plan)
En F0.0 el orquestador registra en `docs/product.md` las que todavía no figuran. Las decisiones D-16 a D-30 las tomó el orquestador; D-25 a D-30 aplican la recomendación por defecto del architect.

| Id | Decisión | Dónde impacta |
|---|---|---|
| D-01 | La semana va de **lunes a domingo** (ISO 8601), en la zona horaria del dispositivo. | F0.7, F3, F4, F5, F7 |
| D-02 | Registrar una venta en una semana marcada como "no vendí" **quita la marca**, en la misma transacción. | F3.4 |
| D-03 | **No se permiten ventas con fecha futura.** | F3.2, F3.6 |
| D-04 | Las ventas son **editables y borrables**, con confirmación al borrar. | F3 |
| D-05 | **Máximo 6 fotos** por producto, desde **galería y cámara**. | F2 |
| D-06 | El permiso de notificaciones se pide **después de la primera venta**. | F7.8 |
| D-07 | El resumen mensual llega el **día 1 a las 10:00**. | F7.2 |
| D-08 | Restaurar **reemplaza todo**, con un **respaldo de seguridad** automático previo. | F8 |
| D-09 | El respaldo va **sin contraseña** (sin cifrado). | F8 |
| D-10 | **Dos CSV separados**: ventas y productos. | F8 |
| D-11 | El consejo **no aparece en Inicio**: solo después de registrar una venta y en la sección "Consejos". La invitación a cargar costos llega por el consejo que se muestra después de guardar. | F4.1, F6 |
| D-12 | La v1 tiene **tema claro y oscuro**, según `docs/design-system.md`. | F0.12, F10.1 |
| D-13 | Si la persona deja de abrir la app, el recordatorio semanal **sigue llegando** con un texto neutro, sin datos de la semana, y siempre se puede desactivar en Ajustes. Nunca llegan dos en la misma semana. Implementación: los **estados A/B** de ADR-011 (A: solo `WEEKLY` neutro; B: aviso adaptado de una sola vez + 47 neutros de una sola vez, sin `WEEKLY`). *(Ajustado en F0.1.)* | F7.0, F7.2, F7.4, F7.5 |
| D-14 | Los E2E corren **localmente con Maestro en Android** al cierre de cada feature. Los E2E de iOS quedan fuera de la v1 (sección 10). | V-E2E-A, F10.5 |
| D-15 | Ganancia parcial: se calcula sobre los ítems con costo y se muestra **"de lo que tiene costo cargado, te quedaron aprox. $X"**. Si todos los ítems tienen costo: "te quedaron aprox. $X". | F4.0, F4.2, F4.4 |
| D-16 | Al agregar la segunda versión, la primera, que no tenía nombre, pasa a llamarse **"Estándar"** (editable). | F1 |
| D-17 | La **primera foto es la portada**, y las fotos **se pueden reordenar**. | F2 |
| D-18 | "No vendí" se puede marcar en la **semana actual y en la anterior**, no en semanas más viejas. | F3, F5 |
| D-19 | La comparación suave es **contra el mismo tramo transcurrido** del período anterior. | F4 |
| D-20 | "Producto más vendido" y "dónde vendiste más" se miden **por monto**; los empates se muestran juntos. | F4 |
| D-21 | Los consejos **no tocan temas tributarios** ni de formalización. | F6.1 |
| D-22 | Se conserva **solo el último respaldo de seguridad** previo a restaurar. | F8, F9 |
| D-23 | **Todo es local**: sin publicación, sin cuentas de tiendas ni identificadores de release, sin EAS, sin reporte de errores externo (basta el `logger` local) y sin servicios en la nube. Solo recursos locales; no se asume iPhone ni cuenta de EAS. | Todo el plan; sección 10 |
| D-24 | **Sin ganchos de git** (husky o lint-staged): los agentes corren V-BASE en cada tarea. | F0.5 |
| D-25 | En una semana que ya tiene ventas **no se ofrece** "no vendí"; un texto amable explica por qué. | F3 |
| D-26 | Costo efectivo de un ítem (ADR-007): se usa el **costo copiado al vender** y, si no había, el **costo actual** de la versión, que entrega `ProductRepository.currentCostsFor` y recibe explícito la función pura del dominio. *(Ajustado en F0.1.)* | F1.3, F3.2, F4.2, F4.3 |
| D-27 | Límites de longitud: nombre de producto y de versión **80**, descripción **1000** y nota **500** caracteres. | F1.2, F3.2 |
| D-28 | Las preferencias de notificación **no viajan en el respaldo**: son del dispositivo y se mantienen al restaurar. | F8 |
| D-29 | En iOS **no** se usa la autorización provisional: se pide el permiso normal, con la pantalla explicativa. | F7 |
| D-30 | El resumen mensual se puede ver para **cualquier mes con datos**, navegando hacia atrás. | F4 |

### 3.2 Decisiones pendientes con el usuario

| Id | Pregunta | Propuesta por defecto | Bloquea |
|---|---|---|---|
| **P-23** | Montos: ¿solo Lexend (sin cifras tabulares) o Sora dentro de `Amount`? Es la pregunta abierta de `docs/design-system.md` y ADR-014. | Solo Lexend; se confirma viendo una lista real en el teléfono. | CP1 |

Las demás preguntas que tuvo el plan (P-01 a P-22) quedaron resueltas en D-11 a D-30. Si P-23 no tiene respuesta al llegar a CP1, se sigue con la propuesta por defecto (solo Lexend), porque cambiarla después afecta un solo componente.

---

## 4. Mapa de fases

```
F0 Fundaciones ──► F1 Productos ──► F2 Fotos
                        │
                        └──► F3 Ventas ──► F4 Inicio y resumen ──► F5 Calendario y racha
                                 │
                                 ├──► F6 Consejos (F6.1, el contenido, puede empezar tras CP0)
                                 └──► F7 Notificaciones
F1+F2+F3 (+F7 para reconciliar) ──► F8 Respaldo y exportación
F7+F8 ──► F9 Ajustes ──► F10 Cierre (accesibilidad, rendimiento, gate)
```

- F2 puede ir antes o después de F3. Se ordena F1 → F2 → F3 para cerrar "productos" completo antes de vender.
- F6.1 (investigar y redactar los consejos) no depende de código y puede correr en paralelo desde CP0. Su aprobación (CP7a) bloquea F6.4.
- El esquema de v1 está completo desde F0.9, así que F8 respalda todas las tablas aunque alguna feature termine después.

---

## 5. Fases y tareas

### F0 — Fundaciones

#### F0.0 — Aprobación del plan

- [x] F0.0
- **Agente**: orquestador + usuario (CP0).
- **Objetivo**: que el usuario apruebe este plan. Después, el orquestador registra D-01 a D-30 en `docs/product.md` (ya hecho). Los ADR-005 a ADR-015 ya están aceptados.
- **Archivos**: `docs/product.md`.
- **Aceptación**: el usuario aprobó el plan y `docs/product.md` contiene D-01 a D-30.
- **Depende de**: nada. **Bloquea**: todo, salvo F6.1.

#### F0.1 — Contraste del plan con los ADRs finales

- [x] F0.1
- **Agente**: architect.
- **Objetivo**: leer el texto final de los ADR-005 a ADR-015 y comprobar que cada requisito de la sección 2.1 está en el ADR que corresponde y en las tareas del plan. En particular, que ADR-015 fija la API de `LocalDate` y `Clock`, dónde viven `useToday` y `useCurrentWeek`, cómo se fija la zona horaria en Jest y los *fixtures* obligatorios: cambios de horario de abril y septiembre en `America/Santiago`, una zona sin cambio de horario (`America/Punta_Arenas`), fin de año y años bisiestos.
- **Archivos**: `docs/plan-v1.md`, solo si hace falta ajustar algo, dejando nota del cambio.
- **Aceptación**: no queda ningún requisito de un ADR sin tarea, ni una tarea que contradiga un ADR.
- **Depende de**: F0.0.

#### F0.2 — ADR-016: plataformas y builds locales

- [x] F0.2
- **Agente**: architect.
- **Objetivo**: escribir un ADR que trate **solo** dos cosas: quitar web y definir los builds locales. EAS (Build, Submit, Update) y sus perfiles quedan fuera de alcance (sección 10).
  - **Quitar el soporte web** de la plantilla (`react-native-web`, `react-dom`, `web.output: server`, el script `web`), porque la app es solo iOS y Android.
  - Revisar las dependencias que la plantilla trae y no se usan (`@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-web-browser`).
  - Mover a `devDependencies` las de desarrollo que quedaron en `dependencies`. *(Nota de F0.1: `jest`, `jest-expo`, `@types/jest` y `eslint-config-expo` ya estaban en `devDependencies`; ADR-016 lo verifica y deja la lista final.)*
  - **Build de desarrollo local** con `npx expo run:android`, cuando un módulo nativo lo exija.
  - **Build `e2e` local**: variante release con los datos de prueba habilitados por una variable de entorno de build, generada en este entorno (por ejemplo, `npx expo run:android --variant release`).
  - Dónde se guardan los APK de cada punto de control, para V-E2E-UPG.
  - `minSdkVersion` efectiva de Android, que importa para la sombra sticker.
- **Archivos**: `docs/architecture/adr-016-plataformas-y-builds-locales.md`, índice.
- **Aceptación**:
  - el ADR deja la lista exacta de dependencias que se quitan, se mueven o se quedan, cada una con su motivo;
  - los comandos exactos de los builds de desarrollo y `e2e` funcionan en este entorno sin ningún servicio en la nube.
- **Depende de**: F0.0.

#### F0.3 — Diseño técnico de las fundaciones

- [x] F0.3
- **Agente**: architect.
- **Objetivo**: escribir `docs/architecture/foundations.md`, que define:
  - el arranque como máquina de estados pura (splash → fuentes y `configureAndMigrate` → providers → pestañas);
  - la estructura inicial de `src/` (ADR-005);
  - la navegación (pestañas y stacks);
  - cómo se compone una transacción que abarca varios repositorios (la necesita F3.4);
  - los dobles de test compartidos (`FakeClock`, `SequentialIdGenerator`, base en memoria);
  - el helper que valida los parámetros de ruta;
  - la ubicación del test de humo actual, porque ADR-005 dice que `src/app/` no se testea con tests unitarios.
- **Aceptación**: tiene los seis apartados del entregable del architect y no contradice ningún ADR aceptado.
- **Depende de**: F0.1. **ADRs**: ADR-005, ADR-006, ADR-009, ADR-015.

#### F0.4 — Limpieza de la plantilla y estructura de carpetas

- [x] F0.4
- **Agente**: code-writer.
- **Objetivo**: aplicar ADR-016 (dependencias y web, más `"platforms"`, `android.package` provisional, los scripts `android`, `ios`, `android:release` y `e2e:build`, y `builds/` en `.gitignore`) y llevar el proyecto a la estructura de ADR-005 según `docs/architecture/foundations.md`. *(Ajustado en F0.1.)* Se crean `src/features/`, `src/shared/{domain,ui,lib}`, `src/core/{db,files,dependencies,providers}` y `e2e/maestro/`. El test de humo `src/__tests__/home-screen.test.tsx` se mueve según F0.3: hoy importa `@/app/index`, y debe probar la screen de la feature, no la ruta.
- **Tests primero**: no hay lógica nueva; el test de humo, reubicado, sigue en verde.
- **Aceptación**: no queda código de ejemplo de la plantilla; V-BASE (con `npx prettier --check .`) y `npx expo-doctor` en verde; `npx expo start` levanta la app sin errores.
- **Verificación**: V-BASE, V-DEPS.
- **Depende de**: F0.2, F0.3. **ADRs**: ADR-005.

#### F0.5 — Completar el tooling según ADR-013

- [x] F0.5
- **Agente**: code-writer.
- **Objetivo**: completar lo que el boilerplate dejó a medias:
  - `tsconfig.json` con las opciones estrictas extra.
  - `eslint.config.js` con `typescript-eslint` *type-checked*, `jsdoc` completo, la regla local `local/docstring-only-comments`, los límites de capas, `no-console` y `testing-library`.
  - `.prettierrc.json` con `prettier-plugin-tailwindcss` apuntando a `src/global.css`.
  - `jest.config.js` con los proyectos `node` (`jest-expo/node`: `**/domain/**`, `**/use-cases/**`, `**/data/**`, `tools/eslint/**`) y `ui` (`jest-expo`: `**/hooks/**`, `**/components/**`, `**/screens/**`, `**/adapters/**`, `shared/ui/**`, `shared/lib/**`, `src/__tests__/**`), el setup común y un `globalSetup` que fija `process.env.TZ = 'America/Santiago'` (ADR-013, ADR-015). *(Ajustado en F0.1.)*
  - La regla local `local/routes-only-in-app` (ADR-013) y `settings['import/resolver']` con el resolver de TypeScript para el alias `@/`. *(Agregado en F0.1.)*
  - `engines.node >= 22` en `package.json` y `.nvmrc` (lo exige `better-sqlite3` 13, ADR-006). *(Agregado en F0.1.)*
  - Los scripts que faltan: `format:check`, `test:watch`, `test:node`, `test:ui`, `test:tz`, `doctor`, `e2e:build`, `e2e:android` y `db:generate` (ADR-013), y el cambio de `android` a `expo run:android` (ADR-016). *(Ajustado en F0.1.)*
- **Archivos**: `tsconfig.json`, `eslint.config.js`, `tools/eslint/{docstring-only-comments,routes-only-in-app}.*` y sus tests, `.prettierrc.json`, `jest.config.js`, `jest.setup.ts`, `jest.global-setup.js`, `package.json`, `.nvmrc`.
- **Tests primero**:
  - `RuleTester` de `local/docstring-only-comments`: acepta `/** */` sobre declaraciones y las directivas (`eslint-disable…`, `@ts-expect-error`); rechaza `//` sueltos, `//` al final de una línea y `/* */` que no sea docstring.
  - *Fixtures* de lint, uno por límite de capa: `domain` que importa `react-native`, `components` que importa `data`, un import profundo a otra feature, `drizzle-orm` fuera de `data` o `core`, un `expo-*` en `data/`, `@/core/dependencies` fuera de `src/app/_layout.tsx`, `@/features/<f>` desde la misma feature, un archivo de `src/app/` que no es ruta y un `*.test.*` dentro de `src/app/`. Cada uno tiene que fallar en `npx expo lint`, también escrito con el alias `@/`. *(Ajustado en F0.1.)*
  - `RuleTester` de `local/routes-only-in-app`.
  - Un test trivial en cada proyecto de Jest y un test que comprueba que la zona horaria configurada está activa; `npm run test:tz` corre en las tres zonas de ADR-015.
- **Aceptación**: V-BASE pasa completo; cada *fixture* de violación produce el error esperado; `npm run test:node` no carga React Native.
- **Verificación**: V-BASE, V-DEPS (se agregan `typescript-eslint`, `eslint-plugin-testing-library` y `prettier-plugin-tailwindcss`, de ADR-013).
- **Depende de**: F0.4. **Decisiones**: D-24. **ADRs**: ADR-013, ADR-003, ADR-005, ADR-016.
- **Al cerrar**: el orquestador actualiza la sección "Comandos" de `CLAUDE.md` con el visto bueno del usuario.

#### F0.6 — Dominio compartido: dinero, ids, resultados y textos

- [x] F0.6
- **Agente**: code-writer.
- **Objetivo**: crear las primitivas de `src/shared/domain/`: los esquemas Zod, fuente única de cada tipo con marca (ADR-010), `clpSchema`, `signedClpSchema`, `epochMsSchema`, `uuidSchema` y los ids con marca de cada entidad de ADR-007 (`productIdSchema`, `productVersionIdSchema`, `productPhotoIdSchema`, `saleRecordIdSchema`, `saleItemIdSchema`, `noSalesWeekIdSchema`); `Result`; `requiredTextSchema` y `optionalTextSchema`. Incluye `parseClpInput` y un **`formatClp` propio, sin `Intl`**, para que el resultado sea idéntico en Jest, Hermes para iOS y Hermes para Android. *(Ajustado en F0.1: no hay `EntityId` genérico.)*
- **Archivos**: `src/shared/domain/{money,ids,result,text,index}.ts` y sus tests.
- **Verificación de dependencias**: V-DEPS (se agrega `zod`, ADR-010). *(Agregado en F0.1.)*
- **Tests primero**:
  - `formatClp`: `$0`, `$1`, `$999`, `$1.000`, `$15.000`, `$1.000.000`, `$999.999.999`, y con `SignedClp` negativo `-$5.000` (ADR-010). Rechaza valores fuera del tipo en los tipos o con una aserción.
  - Variante accesible del monto: "15.000 pesos". La usa `Amount` (F0.13).
  - `parseClpInput`: acepta "15000", "15.000", "1.500.000", "$15.000" y espacios. Rechaza con el código de la tabla de ADR-010: `1.5` y `1.50.0` → `invalid_grouping`; `15,000` y `15,5` → `comma_not_allowed`; `-500` → `negative_not_allowed`; `1000000000` → `too_large`; vacío → `empty`; letras → un código de formato inválido.
  - Textos: recorta espacios, convierte el vacío en `null` y aplica el límite de longitud.
- **Aceptación**: `shared/domain` no importa React, React Native ni `expo-*` (lo comprueba el lint), y en `money.ts` no hay ninguna llamada a `Intl`.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F0.5. **ADRs**: ADR-007, ADR-010.

#### F0.7 — Fechas, semanas y reloj (ADR-015)

- [x] F0.7
- **Agente**: code-writer.
- **Objetivo** *(ajustado en F0.1 al texto final de ADR-015)*: implementar `LocalDate` y `localDateSchema`; la aritmética de calendario pura (`addDays`, `isoWeekStart`, `isoWeekday`, `monthRange`, diferencia en días) con número de día civil, sin `Date`; el puerto `Clock` (solo `now()`) con su adaptador real y `FakeClock`; el puerto `LocalCalendar` (`localDateOf`, `instantAt`, `nextLocalMidnight`) con su implementación sobre `Date` local y la regla del minuto inexistente o repetido; y el catálogo de nombres de meses y días en español (ADR-010).
- **Archivos**: `src/shared/domain/calendar/{local-date,arithmetic,clock,local-calendar,device-local-calendar,calendar-names,index}.ts`, `src/shared/domain/calendar/__fixtures__/time-zones.ts`, `src/shared/domain/testing/fake-clock.ts` y sus tests. Las implementaciones reales (`deviceLocalCalendar` sobre `Date` local y `systemClock` sobre `Date.now()`) también viven en `shared/domain/calendar/`, porque no importan nada de plataforma y así `test:tz` (`**/calendar/**`, proyecto `node`) las cubre; `core/dependencies` solo las conecta (ver `docs/architecture/foundations.md`).
- **Tests primero** (con *fixtures* de zona horaria):
  - `localDateSchema` rechaza "2026-02-30", "2026-2-3" y fechas con hora.
  - `localDateOf` cerca de la medianoche local, por ejemplo a las 23:30 en Santiago, cuando en UTC ya es el día siguiente.
  - `isoWeekStart` devuelve el lunes; el domingo pertenece a la semana que empezó seis días antes; semanas que cruzan mes y año; propiedades `addDays(addDays(d, n), -n) = d` e `isoWeekStart` siempre lunes.
  - `isAfter(date, today)` como función pura sobre `LocalDate`, para D-03.
  - `monthRange` de febrero en año bisiesto (2028) y en año normal.
  - `instantAt` y `nextLocalMidnight` en los días de cambio de horario (salto hacia adelante con 00:00 inexistente y salto hacia atrás con 23:00–23:59 repetidas) en `America/Santiago` y `Pacific/Easter`, y en `America/Punta_Arenas` sin cambio. Cada suite verifica primero que la zona del proceso es la esperada; `npm run test:tz` la repite en las tres zonas.
  - Nombres de meses y días en español, sin `Intl`.
- **Aceptación**: ningún módulo de dominio usa `new Date()` ni `Date.now()` fuera de la implementación de `LocalCalendar` y del adaptador de `Clock` (lo controla el reviewer); ninguna `LocalDate` se convierte a instante para hacer aritmética.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F0.6. **ADRs**: ADR-015.

#### F0.8 — Generador de ids y logger

- [x] F0.8
- **Agente**: code-writer.
- **Objetivo** *(ajustado en F0.1 a ADR-006)*: crear el puerto `IdGenerator` (`next(): Uuid`) con su implementación **UUIDv7** pura (`v7({ msecs: clock.now(), random })` de `uuid` 14, con la fuente de bytes aleatorios inyectada) y `SequentialIdGenerator`; la función `deterministicId(key)` con **UUIDv5** y `NAMESPACE_CUANTOVENDI`; la conexión con `getRandomBytes(16)` de `expo-crypto` en `core/dependencies`; y el logger de `shared/lib/logger.ts`, que no escribe en los builds de release. En la v1 el logger es solo local (D-23).
- **Tests primero**: el generador devuelve UUIDv7 válidos (versión 7, variante RFC 9562, en minúsculas y aceptados por `uuidSchema`), con los primeros 48 bits iguales a `clock.now()` de un `FakeClock` y los bytes aleatorios de una fuente falsa; no usa `crypto.getRandomValues` global; `deterministicId` es estable para la misma clave y distinto entre claves; el doble es determinista; el logger no llama a `console` en modo producción.
- **Aceptación**: `no-console` solo tiene una excepción, en el archivo del logger.
- **Verificación**: V-BASE, V-DEPS (se agregan `uuid` y `expo-crypto`).
- **Depende de**: F0.6, F0.7 (`Clock`). **ADRs**: ADR-005, ADR-006.

#### F0.9 — Base de datos, esquema y `configureAndMigrate`

- [x] F0.9
- **Agente**: code-writer.
- **Objetivo**:
  - `expo-sqlite` + Drizzle 0.45 (ADR-006).
  - El esquema completo de ADR-007 (todas las tablas de v1), `drizzle.config.ts` y la migración `0000`, generada y revisada a mano.
  - Metro y Babel configurados para importar `.sql`.
  - **`configureConnection(raw)`** en `core/db/open.ts` *(agregado en F0.1, ADR-006)*: `journal_mode = WAL`, `foreign_keys = ON` verificado con una lectura (si no da `1`, lanza) y `trusted_schema = OFF`. La llaman igual la app y los tests.
  - **`configureAndMigrate(raw, db, bundle)`**: desactiva las FK fuera de toda transacción, migra con `drizzle-orm/expo-sqlite/migrator`, ejecuta `PRAGMA foreign_key_check` (si hay violaciones, falla con un error tipado) y vuelve a activar las FK, verificadas. **Detecta una base más nueva que el código** (más migraciones aplicadas que las del journal) y falla con otro error tipado sin migrar. *(Ajustado en F0.1.)*
  - `runInTransaction` **síncrona**: acumula las tablas tocadas y emite `DataChanges` después del commit; si se anida, se une a la externa y solo la externa emite (ADR-006).
  - `loadMigrationBundle(folder)` para los tests, que arma `{ journal, migrations }` con la misma forma que `migrations.js`, y una fábrica de base en memoria sobre `better-sqlite3` que pasa por `configureConnection` y `configureAndMigrate`.
- **Archivos**: `src/core/db/{open,client,configure-and-migrate,schema/*,transaction,data-changes,table-names}.ts`, `src/core/db/testing/{test-database,load-migration-bundle}.ts`, `src/core/db/migrations/*`, `drizzle.config.ts`, `metro.config.js`, `babel.config.js`.
- **Tests primero** (integración, proyecto `node`):
  - `configureConnection`: deja `foreign_keys = 1` y `trusted_schema = 0`, y lanza si no puede activar las FK.
  - `configureAndMigrate`: en una base vacía deja el esquema actual con las FK activas; una segunda llamada no hace nada; una base con una violación de FK sembrada hace fallar `foreign_key_check` con el error tipado y no deja las FK desactivadas; una base con una migración que el journal no conoce falla con `newer_database` sin tocar nada.
  - El bundle recortado del journal (N-1 → N) funciona, para que las migraciones futuras tengan su test de datos previos.
  - Cada `CHECK` de ADR-007: montos fuera de rango, `pricing_mode` y `price` incoherentes, `quantity` 0 y 10000, fechas mal formadas, `week_start` que no es lunes y `channel` desconocido.
  - El índice único de `no_sales_weeks` y el comportamiento del id determinista que fije ADR-007.
  - FK con `ON DELETE RESTRICT`.
  - `runInTransaction`: ante un error hace rollback, re-lanza y no emite; después del commit emite una sola vez el conjunto de tablas; una llamada anidada se une a la externa y no emite por su cuenta.
  - `DataChanges`: suscribir, emitir y cancelar la suscripción.
- **Aceptación**: V-DB sin cambios pendientes; la migración `0000` corre igual en `better-sqlite3` y en el dispositivo (se confirma en F0.17).
- **Regla de migraciones durante v1**: una migración queda **publicada** en cuanto forma parte de un build instalado en un dispositivo del usuario, es decir, desde CP1. A partir de ahí, todo cambio de esquema es una migración nueva, con su test de datos previos y V-E2E-UPG al cerrar la feature.
- **Verificación**: V-NODE, V-BASE, V-DB, V-DEPS (se agregan `expo-sqlite` y `drizzle-orm`, y como desarrollo `drizzle-kit`, `better-sqlite3` y `babel-plugin-inline-import`, de ADR-006).
- **Depende de**: F0.7, F0.8. **ADRs**: ADR-006, ADR-007, ADR-009 (`TableName`).

#### F0.10 — Arranque: fuentes, migraciones, splash y pantalla de error

- [x] F0.10
- **Agente**: code-writer (la pantalla de error la define el designer en F0.13).
- **Objetivo**: con `MigrationGate` en `core/providers` (ADR-005), montado desde `src/app/_layout.tsx`, mantener el splash mientras se cargan las fuentes con `useFonts` (ADR-014) y corre `configureAndMigrate`. Si la migración falla o la base es más nueva que el código, se muestra una pantalla de error que no permite escribir (en el segundo caso, "actualiza la app"). La opción de **exportación de emergencia** de esa pantalla (copia cruda, ADR-006) se conecta en F8.8. *(Ajustado en F0.1.)*
- **Tests primero**:
  - La máquina de estados pura del arranque: `booting → loading → ready | failed`, con fuentes y migraciones como dos condiciones independientes; si las fuentes fallan se sigue con la fuente del sistema y queda registrado; `failed` distingue `migration_failed`, `foreign_key_violation` y `newer_database`.
  - La screen de error muestra un texto accesible y no ofrece ninguna acción de escritura.
- **Aceptación**: un fallo forzado de `foreign_key_check` lleva al estado `failed`.
- **Verificación**: V-BASE.
- **Depende de**: F0.9, F0.13. **ADRs**: ADR-006, ADR-012, ADR-014.

#### F0.11 — Raíz de composición, providers y hooks de tiempo

- [x] F0.11
- **Agente**: code-writer.
- **Objetivo**:
  - `core/dependencies`, que crea los repositorios y adaptadores reales a medida que existen (en F0: `clock`, `calendar`, `ids`, `logger` y `dataChanges`; ADR-005). *(Ajustado en F0.1.)*
  - `DependenciesProvider` y su hook, y `AppProviders` con el `QueryClient` según ADR-009 y el `IconContext` de Phosphor (ADR-014).
  - El puente de invalidación `rootKeysToInvalidate`, agrupado por tick.
  - **`useToday` y `useCurrentWeek`** en `src/shared/lib/time/` (ADR-009 los ubica en `shared`; ADR-015), sobre `Clock` y `LocalCalendar`: despiertan en `nextLocalMidnight` o como máximo cada hora, lo que ocurra primero, y al volver a primer plano. *(Ajustado en F0.1.)*
  - Los helpers de test `renderWithProviders` y `createTestDependencies`.
- **Tests primero**:
  - `rootKeysToInvalidate`: tablas sin dependientes, varias claves que dependen de la misma tabla y un conjunto vacío.
  - El puente agrupa dos emisiones del mismo tick en una sola invalidación y cancela la suscripción al desmontar.
  - `createQueryClient` usa `networkMode: 'always'`, `staleTime: Infinity`, `retry: false` y `refetchOnWindowFocus: false`.
  - `useToday` cambia al cruzar la medianoche (con *timers* falsos y `FakeClock`) y al volver a primer plano; `useCurrentWeek` cambia entre el domingo 23:59 y el lunes 00:00; ambos limpian el *timer* y el listener de `AppState` al desmontar.
- **Aceptación**: `core/dependencies` es el único módulo que importa implementaciones concretas (lo comprueba el lint).
- **Verificación**: V-BASE, V-DEPS (se agrega `@tanstack/react-query`).
- **Depende de**: F0.9. **ADRs**: ADR-005, ADR-009, ADR-015.

#### F0.12 — Sistema de diseño "Bruma" en código

- [x] F0.12
- **Agente**: designer.
- **Objetivo**: llevar `docs/design-system.md` a código:
  - el bloque de tema de su sección 5.2 en `src/global.css`, con los tokens claro y oscuro (D-12), los radios, los bordes y las sombras `shadow-sticker` y `shadow-sticker-pressed`;
  - las variables `--font-*` de HeroUI apuntando a Lexend, cargada con `useFonts` (ADR-014; **no** con el plugin de `expo-font`);
  - confirmar que el `tailwindStylesheet` de `prettier-plugin-tailwindcss`, configurado en F0.5, apunta al archivo de tokens definitivo (ADR-013). *(Ajustado en F0.1: la configuración se hace en F0.5.)*
- **Archivos**: `src/global.css`, `src/shared/ui/theme/*`.
- **Tests primero**:
  - Una función pura de contraste WCAG, con sus propios tests.
  - Un test que recorre todos los pares de la tabla 2.3 de `docs/design-system.md`, en claro y en oscuro, y exige 4,5:1 para texto y 3:1 para bordes, íconos y foco.
- **Aceptación**: no hay valores de color, tamaño ni espaciado fuera de los tokens, y el test de contraste pasa en los dos temas.
- **Verificación**: V-BASE, V-DEPS.
- **Depende de**: F0.5. **ADRs**: ADR-004, ADR-014.

#### F0.13 — Componentes base

- [x] F0.13
- **Agente**: designer.
- **Objetivo**: construir los componentes de `src/shared/ui/` según la sección 6 de `docs/design-system.md`, sobre HeroUI Native:
  - **`Amount`**: usa `formatClp`; se alinea a la derecha en listas; su etiqueta accesible es "15.000 pesos"; la variante display usa `adjustsFontSizeToFit` y `maxFontSizeMultiplier={1.5}`; no se anima.
  - Botones principal, secundario, de texto y de borrar. El principal **nunca se deshabilita**.
  - **`TextField`**, que fuerza `border-2 border-field-border` y, con foco, `border-accent`, para corregir el borde transparente que `Input` pone en Android en HeroUI 1.0.11.
  - `MoneyField`, `QuantityStepper`, `Card` / `Sticker`, con la sombra en una `View` contenedora si el `overflow: hidden` de `Surface` / `Card` la recorta, `ListRow`, `Chip` / `ChipGroup`, `DateField`, `ConfirmDialog`, `Sheet`, `EmptyState`, `LoadingState` (`Skeleton`), `ErrorState` y `Toast`.
  - Un helper que anuncia cambios al lector de pantalla y otro para los íconos de Phosphor (importados uno por uno).
  - Los envoltorios de formulario **`FormTextField`** y **`FormAmountField`**, que encapsulan `useController` de React Hook Form y el mensaje de error accesible (ADR-009). *(Agregado en F0.1.)*
  - La pantalla de error de arranque (F0.10).
- **Tests primero** (RNTL, por rol y etiqueta):
  - `Amount` se lee como "15.000 pesos".
  - El botón principal sigue activo con datos inválidos y avisa a quien lo usa de que se mostraron los errores.
  - `IconButton` exige etiqueta por tipos.
  - `TextField` muestra el error con el ícono y el texto, y lo asocia al campo.
  - `QuantityStepper` respeta el mínimo y el máximo y lo comunica con `accessibilityState.disabled`.
  - `Chip` expone `selected` y muestra el check.
  - `ConfirmDialog` llama a `onConfirm` y `onCancel` y se cierra con el botón atrás de Android.
  - `DateField` no permite elegir una fecha posterior a `maxDate`.
- **Aceptación**: áreas táctiles de al menos 48 × 48; sin alturas fijas; nada por debajo de `text-xs` (13).
- **Verificación**: V-UI, V-BASE, V-DEPS (se agregan `phosphor-react-native`, `react-hook-form` y `@hookform/resolvers`).
- **Depende de**: F0.12, F0.6. **ADRs**: ADR-004, ADR-009, ADR-014.

#### F0.14 — Navegación y estructura de pantallas

- [x] F0.14
- **Agente**: designer (pestañas y acción principal) → code-writer (implementación).
- **Objetivo**: layout de pestañas y stacks con pantallas provisorias. La propuesta de pestañas sale de los íconos de referencia del sistema de diseño (Inicio, Calendario, Productos, Consejos y Ajustes); el designer la confirma, junto con dónde va la acción principal "Registrar venta". También la ruta `+not-found` y el helper `parseRouteParams(schema, params)`, que redirige en lugar de lanzar.
- **Archivos**: `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/*.tsx`, `src/app/+not-found.tsx`, `src/shared/lib/route-params.ts`.
- **Tests primero**: `parseRouteParams` con parámetros válidos, faltantes y mal formados (devuelve `Result`, no lanza); la barra de pestañas expone `selected` y la pestaña activa usa el peso `fill` (sección 6.9 del sistema de diseño).
- **Aceptación**: las rutas no tienen lógica: solo validan y renderizan una screen.
- **Verificación**: V-BASE.
- **Depende de**: F0.11, F0.13. **ADRs**: ADR-001, ADR-005, ADR-010.

#### F0.15 — Infraestructura de E2E y datos de prueba

- [~] F0.15
- **Agente**: code-writer.
- **Objetivo**:
  - Configurar Maestro en `e2e/maestro/`, con subflujos reutilizables en `e2e/maestro/_shared/` (por ejemplo, "crear producto" y "registrar venta en una fecha"), que los E2E de F1 a F7 usan para crear sus datos **por la UI**.
  - El *flag* de build `EXPO_PUBLIC_E2E` (ADR-013, ADR-016): un módulo único que lo lee, y las rutas ocultas que solo existen con `EXPO_PUBLIC_E2E=1`. En F0 la única es la **pantalla de diagnóstico de fechas** de ADR-015 (`localDateOf` e `instantAt` de los casos de los *fixtures*, ejecutados en Hermes). La semilla `cuantovendi://e2e/seed?fixture=<nombre>` restaura un respaldo *fixture* por el camino real de restauración (ADR-013), así que se implementa en **F8.11**.
  - Crear los flujos de **instalación nueva** (`e2e/maestro/foundations/fresh-install.yaml`) y el procedimiento documentado de **actualización** (V-E2E-UPG) según ADR-016: instalar el APK guardado del punto de control anterior, crear datos con los subflujos, instalar el nuevo encima con `adb install -r` y verificar los datos.
- **Tests primero**:
  - El módulo del *flag* devuelve `false` salvo que la variable sea exactamente `'1'`.
  - Un test comprueba que las rutas ocultas no se registran ni se alcanzan cuando el *flag* es `false`.
- **Aceptación**: `smoke.yaml` abre la app y recorre todas las pestañas, y `fresh-install.yaml` pasa.
- **Verificación**: V-BASE.
- **Depende de**: F0.14, F0.2.
- **Nota** *(ajustada en F0.1)*: antes decía que la semilla cargaba los conjuntos `empty`, `basic` y `large` con fábricas en builds de desarrollo y `e2e`. ADR-013 fija que la semilla restaura un respaldo *fixture* y solo con `EXPO_PUBLIC_E2E=1`; los *fixtures* (`basic`, `large`) se generan en F8.11 con fábricas puras y deterministas (`FakeClock`, `SequentialIdGenerator`) y el escritor ZIP de F8.3. Los E2E de F1 a F7 crean sus datos por la UI.

#### F0.16 — Revisión de fundaciones

- [x] F0.16
- **Agente**: reviewer.
- **Objetivo**: revisar F0.4 a F0.15 contra los ADR-003, 005, 006, 009, 010, 013, 014 y 015, contra `docs/design-system.md` y contra `.claude/rules/react-native/`.
- **Aceptación**: sin hallazgos críticos ni importantes abiertos.
- **Verificación**: V-BASE, V-DEPS, V-AUDIT.
- **Depende de**: F0.4 a F0.15.

#### F0.17 — E2E de humo y verificaciones en el dispositivo

- [~] F0.17
- **Agente**: code-writer (a pedido del orquestador) + reviewer; usuario para las comprobaciones visuales.
- **Objetivo**: correr `smoke.yaml` y `fresh-install.yaml` en el build `e2e` local de Android, e instalar la app en el emulador o en el teléfono del usuario conectado para CP1.
- **Comprobaciones en el dispositivo** (pendientes del sistema de diseño):
  1. **Borde del `TextField` en Android**: se ve `field-border` sin foco y `accent` con foco.
  2. **Sombra sticker (`boxShadow`)** en Android 9 o superior; en Android 7 u 8 (emulador) queda solo el borde, que es la degradación aceptada.
  3. **`overflow: hidden`** de `Surface` / `Card` no recorta la sombra.
  4. Lexend en los cuatro pesos, en Android.
  5. `Amount` y la alineación de una lista real de montos, para responder **P-23**.
  6. Tema claro y oscuro.
  7. La migración `0000` en el dispositivo.
  8. La pantalla de diagnóstico de fechas (F0.15) con el teléfono en `America/Santiago`: los resultados en Hermes coinciden con los *fixtures* de Jest (ADR-015). *(Agregado en F0.1.)*
- **Aceptación**: V-E2E-A en verde y las ocho comprobaciones registradas, con capturas, en el informe de CP1. Los APK de CP1 (`release` y `e2e`) quedan guardados según ADR-016.
- **Depende de**: F0.16. **Decisiones**: D-23. **Pendiente**: P-23.
- **Punto de control**: **CP1**.

---

### F1 — Productos y versiones

#### F1.0 — Diseño técnico de productos

- [x] F1.0
- **Agente**: architect. **Archivo**: `docs/architecture/products.md`.
- **Objetivo**: definir:
  - los comandos `createProduct`, `updateProduct`, `archiveProduct`, `unarchiveProduct`, `addVersion`, `archiveVersion` y `deleteVersion`, con sus esquemas y sus errores por código;
  - cómo se sabe si una versión tiene ventas;
  - las claves de query y las tablas de las que dependen;
  - el formulario: React Hook Form con `useFieldArray`, y el precio como texto que se transforma a `Clp`.
- **Aceptación**: aplica D-16 y D-27.
- **Depende de**: CP1. **ADRs**: ADR-007, ADR-009, ADR-010.

#### F1.1 — Especificación de pantallas de productos

- [x] F1.1
- **Agente**: designer.
- **Objetivo**: especificar las pantallas de productos:
  - la lista de activos, con acceso a los archivados, y el detalle;
  - el formulario de crear y editar con divulgación progresiva: con una sola versión no se muestra el concepto; "agregar otra versión"; "a convenir"; "agregar costo" escondido ("¿cuánto te cuesta hacerlo?");
  - archivar y desarchivar, con una explicación amable;
  - los estados vacío, cargando y error.
- **Depende de**: F1.0, F0.13.

#### F1.2 — Dominio de productos

- [x] F1.2
- **Agente**: code-writer. **Archivos**: `src/features/products/domain/{product,version,schemas,rules,index}.ts` y sus tests.
- **Tests primero**:
  - El nombre es obligatorio, se recorta y respeta el límite de D-27.
  - Con una sola versión activa, su nombre puede ser `null`. Con dos o más, todas llevan nombre y los nombres son únicos sin distinguir mayúsculas ni tildes: "Print A4" choca con "print a4" y "Lámina" con "Lamina".
  - Al pasar de una versión a dos, la primera recibe el nombre "Estándar" (D-16), editable, y no choca con el nombre de la nueva.
  - `fixed` exige precio y `negotiable` no lo tiene; el costo es opcional y está acotado.
  - Un producto activo tiene siempre al menos una versión activa.
  - Una versión con ventas no se borra, solo se archiva; una sin ventas se borra lógicamente.
  - `position` es estable al agregar o quitar versiones.
  - Las fábricas reciben `Clock` e `IdGenerator` y devuelven `Result`.
  - Tolerancia a invariantes rotas (ADR-007, regla 15): las funciones de lectura no fallan con un producto sin versión activa ni con nombres de versión repetidos; solo las fábricas y comandos las exigen. *(Agregado en F0.1.)*
- **Aceptación**: todos los errores son códigos estables y el dominio no tiene textos de UI.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F1.0. **Decisiones**: D-16, D-27.

#### F1.3 — Repositorio de productos

- [x] F1.3
- **Agente**: code-writer. **Archivos**: `src/features/products/data/{product-repository,drizzle-product-repository}.ts` y su test.
- **Tests primero** (integración sobre `better-sqlite3`):
  - `save` de un producto nuevo y de uno editado: las versiones se actualizan por id, sin reemplazarlas todas.
  - `listActive` excluye los archivados y los borrados.
  - `listArchived` y `findById`, con las versiones ordenadas.
  - `setArchived` actualiza `updated_at`.
  - `versionIdsWithSales`.
  - `findVersionsByIds` y `currentCostsFor(versionIds)`, que devuelve el costo actual (o `null`) de cada versión, también de las archivadas (ADR-007, D-26). *(Agregado en F0.1.)*
  - Cada escritura emite `DataChanges` con las tablas correctas.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F1.2, F0.9.

#### F1.4 — Hooks de productos

- [x] F1.4
- **Agente**: code-writer. **Archivos**: `src/features/products/hooks/*` y `query-keys.ts`.
- **Tests primero**: `useActiveProducts` expone los estados de carga, vacío, datos y error; `useSaveProduct` devuelve el error de dominio sin lanzar; después de guardar, la lista se actualiza por la invalidación, sin invalidar a mano.
- **Verificación**: V-UI, V-BASE.
- **Depende de**: F1.3, F0.11.

#### F1.5 — Componentes y formulario de producto

- [x] F1.5
- **Agente**: code-writer. **Archivos**: `src/features/products/components/*` y `components/error-messages.ts`.
- **Tests primero**:
  - Con una sola versión no aparece la palabra "versión".
  - "Agregar costo" muestra el campo solo al tocarlo.
  - "A convenir" oculta el precio.
  - Los errores se muestran como texto asociado al campo, con ícono.
  - Se pueden agregar y quitar versiones.
  - Cada código de error tiene su mensaje en español y sin culpa (un test los recorre todos).
  - Los precios se muestran con `Amount`.
- **Aceptación**: se usan `useWatch` y `useFormState`, no `watch()` (ADR-009).
- **Verificación**: V-UI, V-BASE.
- **Depende de**: F1.1, F1.4.

#### F1.6 — Pantallas y rutas de productos

- [x] F1.6
- **Agente**: code-writer. **Archivos**: `src/features/products/screens/*`, `src/features/products/index.ts`, `src/app/(tabs)/products.tsx`, `src/app/products/new.tsx`, `src/app/products/[id].tsx` y `src/app/products/[id]/edit.tsx`.
- **Tests primero**:
  - Lista vacía con la invitación a crear el primer producto.
  - Crear un producto y volver a la lista.
  - Archivar con confirmación y verlo en archivados; desarchivar.
  - Un id inválido en la ruta lleva a not-found.
- **Verificación**: V-UI, V-BASE.
- **Depende de**: F1.5.

#### F1.7 — Revisión de productos

- [x] F1.7
- **Agente**: reviewer. **Depende de**: F1.2 a F1.6. **Verificación**: V-BASE, V-DEPS.

#### F1.8 — E2E de productos

- [~] F1.8
- **Agente**: code-writer (a pedido del orquestador) + reviewer.
- **Flujos** (`e2e/maestro/products/`):
  - Crear un producto con una sola versión, sin ver el concepto de versión.
  - Crear un producto con tres versiones: una "a convenir" y una con costo.
  - Editar el nombre de una versión.
  - Archivar y desarchivar.
- **Verificación**: V-E2E-A.
- **Depende de**: F1.7. **Punto de control**: **CP2**.

---

### F2 — Fotos de producto

#### F2.0 — Diseño técnico de fotos

- [x] F2.0
- **Agente**: architect. **Archivo**: `docs/architecture/product-photos.md`.
- **Objetivo**: definir:
  - el puerto `PhotoStorage` (ADR-008) y su doble en memoria; el nombre del archivo se deriva siempre del id y la base no lo guarda (ADR-007);
  - el caso de uso que guarda un producto con fotos nuevas y quitadas, respetando el orden de escritura de ADR-008;
  - la selección limitada al cupo que queda hasta 6;
  - la cámara con `launchCameraAsync` y el texto del permiso (`NSCameraUsageDescription`, en español); el plugin de `expo-image-picker` sin micrófono;
  - la recolección de huérfanos después del primer render, con la antigüedad mínima de 15 minutos, el lock de archivos en memoria que comparten respaldo y restauración, y la limpieza de `photos/<id>.jpg.part` (ADR-008, ADR-012);
  - la portada y el orden, según D-17;
  - cómo se verifica la ausencia de EXIF en F2.9.
- **Depende de**: CP2. **ADRs**: ADR-008. **Decisiones**: D-17.

#### F2.1 — Especificación de pantallas de fotos

- [x] F2.1
- **Agente**: designer.
- **Objetivo**: la tira de fotos en el formulario y en el detalle; la elección entre "galería" y "cámara" (íconos `Image` y `Camera`); el contador "3 de 6"; quitar una foto con confirmación; un placeholder neutro cuando falta el archivo; el orden y la portada según D-17.
- **Depende de**: F2.0.

#### F2.2 — Dominio de fotos

- [x] F2.2
- **Agente**: code-writer. **Archivos**: `src/features/products/domain/photos.ts` y su test.
- **Tests primero**:
  - `fitWithin` con fotos verticales, horizontales y cuadradas; una más chica que 1600 px no se agranda.
  - `remainingPhotoSlots` va de 0 a 6 y nunca es negativo.
  - Una selección múltiple se recorta al cupo disponible.
  - `findOrphans(files, activeIds, now, minAgeMs)`: un archivo reciente sin fila (no se borra), un archivo antiguo sin fila (se borra), uno con fila activa, una fila borrada lógicamente y el caso sin huérfanos. *(Ajustado en F0.1, ADR-008.)*
  - Reordenar posiciones (D-17); la posición 0 es la portada.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F2.0.

#### F2.3 — Adaptador de almacenamiento de fotos

- [x] F2.3
- **Agente**: code-writer. **Archivos**: `src/features/products/adapters/expo-photo-storage.ts` (ADR-008) y su test. *(Ajustado en F0.1: antes decía `src/core/files/`.)*
- **Tests primero** (con `jest.mock` de `expo-image-manipulator` y `expo-file-system`):
  - Decodifica con un tamaño máximo, guarda un JPEG con `compress: 0.8` en `photos/<photoId>.jpg`, calcula el `sha256` con `File.digest('SHA-256')` y el tamaño, y devuelve `StoredPhoto` (`id`, `width`, `height`, `byteSize`, `sha256`); **no hay nombre de archivo** que devolver ni guardar (ADR-007). *(Ajustado en F0.1.)*
  - Rechaza un id que no cumple el patrón de UUID.
  - Borra en `finally` el temporal del selector y la salida del manipulador, también si falla.
  - `uriFor(id)` resuelve la URI en tiempo de ejecución; `listFiles` ignora y registra los nombres inválidos.
  - `remove` no falla si el archivo ya no existe.
  - Un error de lectura se convierte en `PhotoImportError`.
- **Verificación**: V-BASE, V-DEPS (se agregan `expo-image-picker`, `expo-image-manipulator` y `expo-file-system`).
- **Depende de**: F2.2. **ADRs**: ADR-008.

#### F2.4 — Caso de uso y repositorio de fotos

- [x] F2.4
- **Agente**: code-writer.
- **Tests primero**:
  - Guardar un producto con dos fotos nuevas inserta las filas en la misma transacción que el producto.
  - Si la transacción falla, se borran los archivos nuevos. (Ajustado en F2.7: ya no se borran; pertenecen a la sesión del formulario, que los descarta al salir sin guardar o, si no, la recolección de huérfanos. Ver `docs/architecture/product-photos.md`, sección 3.5.)
  - Quitar una foto la borra lógicamente y elimina el archivo **después** del commit.
  - La recolección borra solo los archivos sin fila activa y registra las filas sin archivo.
  - Nunca hay más de 6 fotos activas.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F2.3, F1.3.

#### F2.5 — UI de fotos

- [x] F2.5
- **Agente**: code-writer.
- **Tests primero**:
  - Al llegar a 6, el botón de agregar se reemplaza por un texto que lo explica.
  - Galería y cámara llaman al selector correcto (con un doble).
  - Si se deniega el permiso de cámara, aparece un mensaje amable con la opción de abrir los ajustes.
  - Las fotos se muestran con `expo-image` y `recyclingKey`, y cada una tiene una etiqueta accesible.
- **Verificación**: V-UI, V-BASE.
- **Depende de**: F2.1, F2.4.

#### F2.6 — Recolección de huérfanos al arrancar

- [x] F2.6
- **Agente**: code-writer.
- **Tests primero**: la recolección se agenda después del primer render y no bloquea; si falla, el arranque sigue; no corre mientras el lock de archivos está tomado; borra los `.part` antiguos con la misma regla de antigüedad.
- **Depende de**: F2.4.

#### F2.7 — Revisión de fotos

- [x] F2.7
- **Agente**: reviewer. **Foco extra**: permisos mínimos en `app.json` y el orden de escritura. **Depende de**: F2.2 a F2.6.

#### F2.8 — E2E de fotos

- [~] F2.8
- **Agente**: code-writer (a pedido del orquestador) + reviewer.
- **Flujos** (`e2e/maestro/products/photos-*.yaml`): agregar una foto de la galería del emulador, con imágenes precargadas; ver el contador; quitarla con confirmación; comprobar que no se pueden pasar las 6. La cámara se verifica a mano en F2.9.
- **Depende de**: F2.7.

#### F2.9 — Verificación manual en el dispositivo

- [~] F2.9
- **Agente**: usuario, guiado por el orquestador.
- **Checklist**, en Android (iOS queda para el futuro):
  - una foto de cámara tomada con un teléfono físico queda con la orientación correcta;
  - el archivo guardado no tiene EXIF ni GPS, comprobado con el método definido en F2.0;
  - el peso está entre 150 y 400 KB.
  - los permisos efectivos de Android se comprueban sobre el APK release con `aapt2 dump permissions` o `apkanalyzer manifest permissions` (`npx expo config --type introspect` solo muestra lo que declara `app.json`).
- **Depende de**: F2.8. **Punto de control**: **CP3**.

---

### F3 — Registro de ventas

#### F3.0 — Diseño técnico de ventas

- [x] F3.0
- **Agente**: architect. **Archivo**: `docs/architecture/sales.md`.
- **Objetivo**:
  - Casos de uso `saveSaleRecord` (crear y editar), `deleteSaleRecord`, `markNoSales` y `unmarkNoSales`, usando la transacción que abarca varios repositorios (F0.3). Por D-02, guardar una venta en una semana marcada borra lógicamente la marca en la misma transacción.
  - **Id determinista** de la marca de "no vendí" (ADR-007: UUIDv5 de `week_start`): volver a marcar una semana desmarcada reactiva la misma fila en lugar de insertar otra.
  - **"No vendí" un lunes o un martes** (ADR-007, decisión 2): se marca la semana en curso, salvo que la semana anterior no tenga registro; en ese caso se pregunta "¿la semana pasada o esta?", con la pasada preseleccionada. *(Agregado en F0.1.)*
  - Reglas de validación:
    - la versión pertenece al producto y no está archivada al crear; al editar se conservan los ítems de versiones archivadas;
    - `unit_price` es obligatorio en las versiones "a convenir";
    - `unit_cost` se copia según D-26;
    - no se aceptan fechas futuras (D-03), usando `useToday` en la UI y `Clock` en el dominio;
    - los ítems se editan por id;
    - quitar el último ítem equivale a borrar el registro.
  - **Costo efectivo** (ADR-007, D-26): `SaleItem.unitCost` es solo el costo copiado al vender. Las lecturas de ventas no resuelven costos; el costo actual lo entrega `ProductRepository.currentCostsFor` y lo combina el dominio. *(Ajustado en F0.1: antes decía que las lecturas de ventas devolvían el costo ya resuelto.)*
  - El **flujo después de guardar** como punto de extensión. En F3 muestra una confirmación que celebra; F6 le agrega el consejo y F7 el pedido de permiso después de la primera venta.
  - Paginación *keyset* con cursor `(sold_on, created_at, id)` (ADR-007). *(Ajustado en F0.1.)*
- **Aceptación**: aplica D-18, D-25, D-26 y D-27.
- **Depende de**: CP3. **ADRs**: ADR-007, ADR-009, ADR-010, ADR-015.

#### F3.1 — Especificación de pantallas de ventas

- [x] F3.1
- **Agente**: designer.
- **Objetivo**: especificar las pantallas de ventas:
  - El registro rapidísimo:
    - elegir el producto, con miniaturas;
    - la versión, solo si hay más de una;
    - la cantidad, 1 por defecto;
    - el precio precargado y editable;
    - la fecha "hoy", fácil de cambiar y sin fechas futuras;
    - "más detalles" escondido (dónde vendiste, nota);
    - agregar otro ítem, ver el total con `Amount` y guardar.
  - "Esta semana no vendí" (botón secundario), según D-18 y D-25.
  - La confirmación que celebra.
  - El detalle, la edición y el borrado con confirmación.
  - El caso sin productos, que invita a crear uno desde el mismo flujo.
- **Aceptación**: documenta el número de toques del camino más corto (producto con una versión, precio fijo, hoy), que el E2E verifica.
- **Depende de**: F3.0.

#### F3.2 — Dominio de ventas

- [x] F3.2
- **Agente**: code-writer. **Archivos**: `src/features/sales/domain/*` y sus tests.
- **Tests primero**:
  - Hay al menos un ítem; la cantidad va de 1 a 9999; el precio está en rango; se acepta `0` en "a convenir"; el canal usa los códigos estables; la nota respeta el límite de D-27.
  - Una fecha posterior a hoy se rechaza con `future_date`; se aceptan hoy y el pasado, incluido el borde de la medianoche local, con `FakeClock` y los *fixtures* de zona horaria.
  - Una versión archivada o de otro producto da un error con código.
  - `recordTotal` es Σ cantidad × `unit_price`.
  - `effectiveUnitCost(item, currentCost)` sigue D-26: el `unitCost` copiado si existe; si no, el costo actual recibido.
  - `diffItems` devuelve los ítems insertados, actualizados y borrados por id; sin cambios, no hay escrituras.
  - Quitar todos los ítems produce la intención de borrar el registro.
  - El **id determinista** de una semana es estable para la misma semana y distinto entre semanas.
  - `canMarkNoSales(week, salesInWeek, today)` aplica D-18 y D-25, y la sugerencia de semana del lunes y el martes (ADR-007).
  - Tolerancia a invariantes rotas: un registro sin ítems activos suma 0 en las lecturas (ADR-007, regla 15).
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F3.0. **Decisiones**: D-18, D-25, D-26, D-27.

#### F3.3 — Repositorios de ventas y de "no vendí"

- [x] F3.3
- **Agente**: code-writer. **Archivos**: `src/features/sales/data/*` y sus tests.
- **Tests primero** (integración):
  - `save` de un registro nuevo y de uno editado.
  - `listBetween` con rango cerrado y sin borrados; un ítem conserva su `unit_cost` copiado aunque después cambie el costo de la versión. *(Ajustado en F0.1: el costo actual lo resuelve `currentCostsFor`, F1.3.)*
  - `listRecent`, paginado con el cursor `(sold_on, created_at, id)` y estable con fechas iguales.
  - `findById` y `softDelete` del registro y de sus ítems.
  - `activeWeekStartsBetween`.
  - `sale_items.product_id` es consistente con la versión.
  - `mark`, `unmark` y volver a marcar reutilizan el id determinista, sin duplicar filas.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F3.2, F0.9.

#### F3.4 — Casos de uso de ventas

- [x] F3.4
- **Agente**: code-writer. **Archivos**: `src/features/sales/use-cases/*` y sus tests.
- **Tests primero**:
  - Guardar en una semana marcada quita la marca y emite un solo `DataChanges` con `sale_records`, `sale_items` y `no_sales_weeks` (D-02).
  - Si falla la inserción de un ítem, no queda nada escrito y la marca sigue.
  - Si una edición mueve la fecha a otra semana marcada, se quita esa marca.
  - Borrar un registro no recrea marcas.
  - El resultado indica si fue la **primera venta** (lo usa F7.8).
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F3.3.

#### F3.5 — Hooks de ventas

- [x] F3.5
- **Agente**: code-writer.
- **Tests primero**:
  - `useSaveSaleRecord` y `useDeleteSaleRecord` devuelven los errores por código.
  - `useRecentSales` usa `useInfiniteQuery`.
  - `useSaleRecord(id)` y `useMarkNoSales`, que usa `useCurrentWeek`.
  - Las pantallas montadas se actualizan por invalidación.
- **Verificación**: V-UI, V-BASE.
- **Depende de**: F3.4, F1.4, F0.11.

#### F3.6 — Componentes de ventas

- [x] F3.6
- **Agente**: code-writer.
- **Tests primero**:
  - Un producto con una sola versión precarga el precio y no muestra el selector de versión; con varias, lo muestra.
  - "A convenir" exige el precio, con un mensaje amable.
  - El total se recalcula al cambiar la cantidad o el precio.
  - "Más detalles" queda oculto hasta tocarlo.
  - La fecha por defecto viene de `useToday` y no se puede elegir mañana.
  - Los productos archivados no aparecen.
  - Cada código de error tiene su mensaje.
- **Verificación**: V-UI, V-BASE.
- **Depende de**: F3.1, F3.5, F0.13.

#### F3.7 — Pantallas y rutas de ventas

- [x] F3.7
- **Agente**: code-writer. **Archivos**: `src/features/sales/screens/*`, `src/features/sales/index.ts`, `src/app/sales/new.tsx` (destino del recordatorio), `src/app/sales/[id].tsx` y `src/app/sales/[id]/edit.tsx`.
- **Tests primero**:
  - Registrar y ver la confirmación.
  - Marcar "no vendí".
  - Editar y ver el cambio.
  - Borrar con confirmación.
  - Sin productos, invitar a crear uno y volver al registro.
  - Un id inválido lleva a not-found.
- **Verificación**: V-UI, V-BASE.
- **Depende de**: F3.6. **Nota**: los datos de prueba de F0.15 suman las fábricas de ventas.

#### F3.8 — Revisión de ventas

- [x] F3.8
- **Agente**: reviewer. **Foco extra**: la atomicidad de D-02; que las fechas sean siempre `LocalDate` obtenidas de `Clock` o `useToday`; las promesas no esperadas. **Depende de**: F3.2 a F3.7.

#### F3.9 — E2E de ventas

- [~] F3.9
- **Agente**: code-writer (a pedido del orquestador) + reviewer.
- **Flujos** (`e2e/maestro/sales/`):
  - Registrar una venta por el camino más corto, en el número de toques de F3.1.
  - Registrar una venta de feria con tres ítems (uno "a convenir"), canal y nota.
  - Cambiar la fecha a ayer.
  - Intentar elegir una fecha futura.
  - Marcar "no vendí" y luego registrar una venta en esa semana: la marca desaparece.
  - Editar y borrar con confirmación.
- **Verificación**: V-E2E-A; V-E2E-UPG si la feature agregó una migración.
- **Depende de**: F3.8. **Punto de control**: **CP4**.

---

### F4 — Inicio y resumen mensual (`features/tracking`, primera parte)

#### F4.0 — Diseño técnico de inicio y resumen

- [x] F4.0
- **Agente**: architect. **Archivo**: `docs/architecture/tracking-home.md`.
- **Objetivo**:
  - Funciones puras sobre `SaleRecord[]` de un rango acotado y, para la ganancia, el mapa `currentCostByVersion` que el hook arma con `ProductRepository.currentCostsFor` (ADR-007; *ajustado en F0.1*):
    - los totales de la semana y del mes;
    - la comparación suave (D-19);
    - las últimas ventas;
    - el resumen mensual: total, producto más vendido y canal principal (D-20);
    - la ganancia aproximada con cobertura parcial y el texto de D-15 (D-26).
  - Las consultas, por rango, usando `useCurrentWeek` y `useToday`.
  - La ruta `/tracking/monthly` con el mes validado, que es el destino del resumen de F7, y la navegación entre meses (D-30).
  - El nombre del producto en ventas pasadas: se muestra el **actual**, con un indicador de archivado.
- **Depende de**: CP4. **Decisiones**: D-19, D-20, D-30.

#### F4.1 — Especificación de Inicio y del resumen mensual

- [x] F4.1
- **Agente**: designer.
- **Objetivo**: definir:
  - la jerarquía, con el monto principal en `accent` y en display (`Amount`);
  - la comparación con lenguaje positivo, también cuando baja;
  - el estado vacío del primer uso (sección 6.7 del sistema de diseño);
  - la ganancia, que solo aparece con costos.
  - **Sin consejos en Inicio** (D-11).
- **Depende de**: F4.0.

#### F4.2 — Dominio de seguimiento: totales, comparación, resumen y ganancia

- [x] F4.2
- **Agente**: code-writer. **Archivos**: `src/features/tracking/domain/*` y sus tests.
- **Tests primero**:
  - Totales de una semana que cruza dos meses; las ventas del domingo cuentan en su semana.
  - La comparación según D-19, incluido un período anterior en cero, sin dividir por cero.
  - El producto más vendido con empates (D-20) y el canal principal con ventas sin canal.
  - Ganancia (`approximateProfit(records, currentCostByVersion)`, que devuelve `ProfitSummary | null`, ADR-007):
    - sin costos devuelve `null`;
    - con todos los costos, el valor completo;
    - con cobertura parcial devuelve el monto calculado solo sobre los ítems con costo y `revenueWithCost < revenueTotal`, que la UI traduce al texto de D-15;
    - un ítem sin `unitCost` toma el costo actual del mapa, y uno con `unitCost` lo conserva aunque el mapa diga otra cosa;
    - un precio menor que el costo da una ganancia negativa.
  - El resumen de un mes sin ventas.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F4.0, F3.2.

#### F4.3 — Hooks de Inicio y resumen

- [x] F4.3
- **Agente**: code-writer.
- **Tests primero**: se piden solo los rangos necesarios; el hook de ganancia pide `currentCostsFor` solo con las versiones del rango y su key depende de `product_versions`; los agregados se calculan en el dominio y nunca en componentes; los datos se actualizan al guardar una venta, al cambiar un costo y al cambiar de semana con `useCurrentWeek`.
- **Depende de**: F4.2, F3.5, F1.4.

#### F4.4 — Componentes y pantallas de Inicio y resumen

- [x] F4.4
- **Agente**: code-writer. **Archivos**: `src/features/tracking/{components,screens}/*`, `src/app/(tabs)/index.tsx` y `src/app/tracking/monthly.tsx`.
- **Tests primero**:
  - El primer uso invita a registrar.
  - Los montos usan `Amount`.
  - La ganancia no aparece sin costos.
  - La comparación usa texto positivo al subir y al bajar.
  - Inicio no muestra consejos.
  - Tocar una venta reciente abre su detalle.
  - Un mes inválido en la ruta se trata según F4.0.
- **Verificación**: V-UI, V-BASE.
- **Depende de**: F4.1, F4.3.

#### F4.5 — Revisión

- [x] F4.5
- **Agente**: reviewer. **Depende de**: F4.2 a F4.4.

#### F4.6 — E2E de Inicio y resumen

- [~] F4.6
- **Flujos** (`e2e/maestro/tracking/home-*.yaml`):
  - Con datos creados por los subflujos de F0.15 (en ventas de hoy y de días anteriores), Inicio muestra los totales esperados. *(Ajustado en F0.1: la semilla `basic` existe recién en F8.11.)*
  - Registrar una venta actualiza Inicio.
  - Cargar un costo hace aparecer la ganancia.
  - Abrir el resumen de un mes y navegar al anterior.
- **Depende de**: F4.5. **Punto de control**: **CP5**.

---

### F5 — Calendario y racha (`features/tracking`, segunda parte)

#### F5.0 — Diseño técnico de calendario y racha

- [x] F5.0
- **Agente**: architect. **Archivo**: `docs/architecture/tracking-calendar.md`.
- **Objetivo**:
  - La cuadrícula del mes, empezando el lunes, como función pura.
  - Los niveles de intensidad. La propuesta es que sean relativos a los propios días del usuario, para no desanimar a quien vende poco; lo valida el designer.
  - El detalle del día.
  - La racha según ADR-007, con una consulta acotada hasta encontrar un hueco.
  - Un calendario propio con los componentes base, **sin librería de calendario**.
- **Depende de**: CP5.

#### F5.1 — Especificación del calendario y la racha

- [x] F5.1
- **Agente**: designer.
- **Objetivo**:
  - La intensidad marcada con algo más que color (tamaño, forma o texto).
  - Las semanas con "no vendí", visibles.
  - La racha en `accent` con el ícono `Fire`; dónde se muestra (Inicio, Calendario o ambos).
  - La racha en 0, con tono amable.
  - El detalle del día.
  - Marcar "no vendí" en la semana anterior desde el calendario (D-18).
- **Depende de**: F5.0.

#### F5.2 — Dominio de calendario y racha

- [x] F5.2
- **Agente**: code-writer.
- **Tests primero**:
  - La cuadrícula de un febrero que empieza en lunes y la de un mes que empieza en domingo.
  - La intensidad: días sin ventas, el máximo, empates y un único día con ventas.
  - La racha:
    - una semana actual sin registrar no la corta, pero una semana anterior sin registrar sí;
    - "no vendí" cuenta;
    - los registros borrados no cuentan;
    - la racha cruza el cambio de año;
    - con `FakeClock` el domingo a las 23:59 y el lunes a las 00:00.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F5.0, F3.3.

#### F5.3 — Hooks, componentes y pantallas

- [x] F5.3
- **Agente**: code-writer. **Archivos**: `src/app/(tabs)/calendar.tsx` y `src/app/tracking/day/[date].tsx` (o lo que defina F5.0).
- **Tests primero**:
  - La etiqueta accesible de cada día dice la fecha y lo vendido ("12 de noviembre, 45.000 pesos, 2 ventas").
  - Se puede cambiar de mes.
  - Tocar un día abre su detalle.
  - Un día futuro no ofrece registrar.
  - La racha se actualiza al guardar y al empezar una semana nueva.
- **Verificación**: V-UI, V-BASE.
- **Depende de**: F5.1, F5.2.

#### F5.4 — Revisión

- [x] F5.4
- **Agente**: reviewer. **Foco extra**: el render del mes, sin listas virtualizadas anidadas. **Depende de**: F5.2 y F5.3.

#### F5.5 — E2E de calendario y racha

- [~] F5.5
- **Flujos** (`e2e/maestro/tracking/calendar-*.yaml`): ver los días marcados, con datos creados por los subflujos de F0.15 *(ajustado en F0.1)*; abrir el detalle de un día; marcar "no vendí" y ver la racha.
- **Depende de**: F5.4. **Punto de control**: **CP6**.

---

### F6 — Consejos

#### F6.0 — Diseño técnico de consejos

- [x] F6.0
- **Agente**: architect. **Archivo**: `docs/architecture/tips.md`.
- **Objetivo**:
  - La interfaz `TipCatalog` y el catálogo incluido en `features/tips/domain/catalog.ts` (ADR-007).
  - Los tipos `Tip`, `TipCategory`, `TipTrigger` y `TipContext`. El contexto incluye si hay costos cargados, si es la primera venta, el canal, si hay versiones "a convenir" y la racha.
  - La función pura `pickTipAfterSale`.
  - Cuándo un consejo cuenta como visto.
  - `TipViewRepository`.
  - La integración con el flujo después de guardar de F3. Por D-11, el consejo **no** aparece en Inicio.
  - **Nota de F0.1**: ADR-007 define `Tip.topic` como `'recording' | 'costs' | 'pricing' | 'general'`, y F6.1 usa seis categorías (registro, costos, precios, ferias, redes, flujo de dinero). F6.0 tiene que conciliarlas. Si la solución cambia el tipo de ADR-007, hace falta un ADR que lo reemplace, y eso es una condición de parada (sección 7.2).
- **Depende de**: CP6.

#### F6.1 — Investigación y redacción del contenido

- [x] F6.1
- **Agente**: designer (redacción, con WebSearch y WebFetch); lo revisa el orquestador.
- **Puede empezar**: desde CP0, en paralelo con el resto.
- **Objetivo**: escribir entre 20 y 30 consejos breves, en español neutro, con tuteo y tono cercano, para artistas emprendedores. Las categorías son **registro**, **costos**, **precios**, **ferias**, **redes** y **flujo de dinero**, con al menos 3 consejos por categoría.
- **Entregable**: `docs/content/consejos.md`, con una ficha por consejo:
  - `id`: un slug estable en kebab-case que no cambia nunca, porque `tip_views` lo referencia;
  - `categoria`;
  - `titulo`;
  - `cuerpo`, breve; el límite exacto lo fija F6.2;
  - `contexto` (opcional): en qué situación tiene prioridad;
  - `fuentes`: una o más URLs confiables (organismos de fomento del emprendimiento, guías de negocio para artistas, material de educación financiera), con la fecha de consulta.
- **Criterios**:
  - parafraseado, sin copiar;
  - sin jerga contable, o explicada en palabras simples;
  - sin culpa ni presión;
  - montos de ejemplo con el formato `$15.000`;
  - sin consejos tributarios ni legales (D-21);
  - sin promesas de resultados;
  - nada que dependa de una red social puntual.
- **Aceptación**: el orquestador comprueba los criterios y el usuario aprueba el contenido en **CP7a**.
- **Decisiones**: D-21.

#### F6.2 — Especificación de pantallas de consejos

- [x] F6.2
- **Agente**: designer.
- **Objetivo**: definir:
  - la tarjeta del consejo en la confirmación de la venta, que se puede cerrar;
  - la sección "Consejos", por categoría, con los vistos marcados con ícono y texto, no solo con color;
  - el detalle de un consejo;
  - el orden respecto del pedido de permiso de F7.8 en la primera venta;
  - los límites de longitud del título y del cuerpo.
- **Depende de**: F6.0.

#### F6.3 — Dominio de consejos

- [x] F6.3
- **Agente**: code-writer.
- **Tests primero**:
  - Sin costos cargados, el consejo de costos tiene prioridad hasta que se vea.
  - No se repite un consejo visto mientras queden consejos sin ver.
  - Cuando todos están vistos, se elige el visto hace más tiempo.
  - El desempate es determinista.
  - Con el catálogo vacío no se muestra nada.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F6.0.

#### F6.4 — Catálogo de consejos

- [x] F6.4
- **Agente**: code-writer. **Archivo**: `src/features/tips/domain/catalog.ts`.
- **Tests primero** (sobre el contenido):
  - los ids son únicos y están en kebab-case;
  - las categorías son válidas;
  - título y cuerpo respetan los límites de F6.2;
  - ningún texto coincide con los patrones de culpa, compartidos con F7.2;
  - hay al menos 3 consejos por categoría y entre 20 y 30 en total.
- **Aceptación**: el catálogo transcribe fielmente `docs/content/consejos.md` aprobado.
- **Depende de**: F6.3, CP7a.

#### F6.5 — Repositorio, hooks e integración

- [x] F6.5
- **Agente**: code-writer.
- **Tests primero**:
  - `TipViewRepository` (integración) conserva `first_seen_at`.
  - `useTipAfterSale` usa el contexto de la venta recién guardada.
  - Cerrar el consejo lo marca como visto.
  - La sección muestra todos los consejos, con los vistos marcados.
- **Depende de**: F6.3, F6.4, F3.7.

#### F6.6 — Pantallas y rutas de consejos

- [x] F6.6
- **Agente**: code-writer. **Archivos**: `src/app/(tabs)/tips.tsx` y `src/app/tips/[id].tsx`.
- **Tests primero**: un id desconocido lleva a la lista; el consejo de la confirmación se cierra y no vuelve a aparecer en esa venta.
- **Depende de**: F6.2, F6.5.

#### F6.7 — Revisión

- [x] F6.7
- **Agente**: reviewer. **Depende de**: F6.3 a F6.6.

#### F6.8 — E2E de consejos

- [~] F6.8
- **Flujos** (`e2e/maestro/tips/`): sin costos cargados, la primera venta muestra el consejo de costos; cerrarlo; verlo marcado en "Consejos"; Inicio no muestra el consejo.
- **Depende de**: F6.7. **Punto de control**: **CP7**.

---

### F7 — Notificaciones

#### F7.0 — Diseño técnico de notificaciones

- [x] F7.0
- **Agente**: architect. **Archivo**: `docs/architecture/notifications.md`.
- **Objetivo**: aplicar ADR-011 con D-06 y D-07:
  - `planNotifications`, `diffNotifications`, `toExpoWeekday` y el catálogo de textos con las variantes `already_registered` y `neutral` (ADR-011);
  - **D-13 ya está resuelto en el texto final de ADR-011** con los **estados A/B**: A (semana no registrada o `T` ya pasó) programa solo el `WEEKLY` neutro; B (semana registrada y `T` futuro) cancela el `WEEKLY` y programa el aviso adaptado en `T` más 47 avisos neutros de una sola vez. Así nunca hay dos avisos para la misma semana, y el `WEEKLY` está verificado en el código de `expo-notifications` 58.1.9 para iOS y Android. F7.0 lo aplica; no hay que cambiar ADR-011. *(Ajustado en F0.1: antes decía que D-13 cambiaba ADR-011.)* La entrega real se sigue verificando a mano en F7.10;
  - `NotificationScheduler` (`getPermission`, `requestPermission`, `listScheduled`, `cancel`, `schedule`) y su adaptador `ExpoNotificationScheduler` en `features/notifications/adapters/`;
  - la reconciliación **serializada** (`NotificationReconciler.request()`, una cola en la que gana la última: los pedidos que llegan mientras corre se juntan en **una** ejecución posterior con el estado más reciente), que aplica solo las diferencias, y sus disparadores: el arranque, la vuelta a primer plano, los `DataChanges` relevantes, el final de una restauración y la concesión del permiso;
  - `PreferencesRepository`;
  - la validación del payload al tocar la notificación;
  - el canal de Android, creado antes de pedir el permiso, y `enableRemoteNotifications: false`;
  - una acción **solo de desarrollo y `e2e`** que programa un recordatorio de prueba cercano.
- **Depende de**: CP7. **ADRs**: ADR-011 (ya incluye D-13), ADR-015. **Decisiones**: D-13, D-29.

#### F7.1 — Especificación de pantallas de notificaciones

- [x] F7.1
- **Agente**: designer.
- **Objetivo**: la pantalla explicativa después de la primera venta (D-06), con "ahora no" y sin insistir; las preferencias del recordatorio semanal (día y hora) y del resumen mensual; el estado del permiso, con la opción de abrir los ajustes del sistema si está denegado.
- **Depende de**: F7.0.

#### F7.2 — Dominio de notificaciones

- [x] F7.2
- **Agente**: code-writer.
- **Tests primero**:
  - Valores por defecto: domingo 20:00 y día 1 a las 10:00.
  - El día configurado es hoy, antes y después de la hora.
  - **Estados A/B** (ADR-011): semana no registrada → solo `cv.weekly.repeat` (`WEEKLY`, `neutral`); semana registrada y `T` futuro → sin `WEEKLY`, `cv.weekly.<lunes>` con `already_registered` en `T` y 47 avisos `neutral` de una sola vez en las semanas siguientes; `T` ya pasado → estado A. Transiciones A → B → A. *(Ajustado en F0.1: antes había una variante `not_registered`.)*
  - `toExpoWeekday`: 1 (lunes ISO) → 2 y 7 (domingo ISO) → 1.
  - `diffNotifications`: sin cambios no hay operaciones; cambia solo lo que difiere en trigger o contenido; ignora identificadores sin el prefijo `cv.`.
  - Cambio de horario en `America/Santiago`, `Pacific/Easter` y `America/Punta_Arenas`, con los *fixtures* de F0.7.
  - El paso de diciembre a enero y el nombre del mes en el texto.
  - Desactivar el semanal, el mensual o ambos.
  - No hay instantes pasados; el plan va ordenado; los ids son deterministas (`cv.weekly.repeat`, `cv.weekly.AAAA-MM-DD`, `cv.monthly.AAAA-MM`); nunca hay más de 64 pendientes (60 en el estado B).
  - **D-13**: con el semanal activado, el plan siempre incluye el recordatorio neutro de respaldo; su texto no menciona datos de la semana; **en ninguna semana del plan hay dos recordatorios semanales que puedan llegar** (incluida la semana en curso, con y sin registros); al desactivar el semanal no queda ninguno, tampoco el de respaldo.
  - **Test de tono**: ningún texto coincide con la lista de patrones de culpa. La lista se revisa con el usuario en CP8 y la comparte F6.4.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F7.0, F0.7.

#### F7.3 — Repositorio de preferencias

- [x] F7.3
- **Agente**: code-writer.
- **Tests primero** (integración): sin fila devuelve los valores por defecto; guardar y leer; valida `weekday` entre 1 y 7 y `minuteOfDay` entre 0 y 1439; emite `notification_preferences`.
- **Depende de**: F7.2.

#### F7.4 — Adaptador de notificaciones

- [x] F7.4
- **Agente**: code-writer. **Archivo**: `src/features/notifications/adapters/expo-notification-scheduler.ts` (ADR-005 prohíbe `expo-*` en `data/`). *(Ajustado en F0.1.)*
- **Tests primero** (con `jest.mock` de `expo-notifications`):
  - En Android, el canal se crea antes de pedir el permiso.
  - `listScheduled` devuelve solo las notificaciones con prefijo `cv.`, normalizadas a `ScheduledNotification`; `cancel` y `schedule` operan por identificador. Los triggers son `DATE` para los avisos de una sola vez y `WEEKLY` (con `toExpoWeekday`, 1 = domingo en ambas plataformas) para el neutro del estado A, en el canal `reminders`. *(Ajustado en F0.1: antes decía `replaceAll`.)*
  - Los permisos se mapean a `granted`, `denied` o `undetermined`.
  - En iOS se piden alerta y sonido, sin badge.
- **Verificación**: V-BASE, V-DEPS (se agregan `expo-notifications` y su plugin).
- **Depende de**: F7.2. **ADRs**: ADR-011.

#### F7.5 — Reconciliación serializada y sus disparadores

- [x] F7.5
- **Agente**: code-writer.
- **Tests primero**:
  - Sin permiso no se programa nada.
  - La reconciliación es idempotente.
  - **Serialización**: tres pedidos simultáneos producen como máximo una ejecución en curso y una posterior; nunca se intercalan `cancel` y `schedule` de dos ejecuciones (scheduler falso lento); la última ejecución usa el estado más reciente; si una ejecución falla, la cola no queda trabada.
  - Sin permiso concedido, el plan es vacío y se cancela todo lo de la app.
  - Se dispara con `DataChanges` de `sale_records`, `sale_items`, `no_sales_weeks` y `notification_preferences`, y no con otras tablas; también al conceder el permiso.
  - Se dispara al volver a primer plano, y el listener de `AppState` se limpia al desmontar.
- **Depende de**: F7.3, F7.4.

#### F7.6 — Respuesta al tocar una notificación

- [x] F7.6
- **Agente**: code-writer.
- **Tests primero**: un payload válido navega a `/sales/new` o a `/tracking/monthly` con el mes; uno inválido abre Inicio; la misma respuesta llegada por `useLastNotificationResponse` y por el listener se procesa una sola vez (por `request.identifier`) y después se llama a `clearLastNotificationResponseAsync`; no navega antes de que el router raíz esté listo; `setNotificationHandler` muestra un banner sin sonido; el listener se limpia.
- **Depende de**: F7.5, F4.4, F3.7. **ADRs**: ADR-010.

#### F7.7 — UI de preferencias

- [x] F7.7
- **Agente**: code-writer.
- **Tests primero**: cambiar el día y la hora se guarda y reconcilia; se puede desactivar; con el permiso denegado se muestra el estado y el acceso a los ajustes del sistema, sin insistir.
- **Depende de**: F7.1, F7.5.

#### F7.8 — Pedido de permiso después de la primera venta

- [x] F7.8
- **Agente**: code-writer.
- **Tests primero**:
  - La pantalla explicativa aparece solo en la primera venta y con el permiso en `undetermined`.
  - "Ahora no" no vuelve a aparecer solo; queda disponible en Ajustes.
  - Al conceder el permiso, se reconcilia.
  - El orden con el consejo sigue lo definido en F6.2.
- **Depende de**: F7.7, F6.5, F3.4.

#### F7.9 — Revisión

- [x] F7.9
- **Agente**: reviewer. **Foco extra**: permisos mínimos, limpieza de listeners, la serialización y que no haya textos de culpa. **Depende de**: F7.2 a F7.8.

#### F7.10 — E2E y verificación manual

- [~] F7.10
- **E2E** (`e2e/maestro/notifications/`): la primera venta muestra la pantalla explicativa; "ahora no"; cambiar el día y la hora en preferencias.
- **Manual** (Android, con la acción de prueba):
  - el recordatorio llega con el texto que corresponde a la semana;
  - sin abrir la app durante al menos dos ocurrencias (con la acción de prueba ajustada a un intervalo corto, si F7.0 lo permite), llega el recordatorio neutro y nunca dos en la misma semana (D-13);
  - tocarlo abre el registro de venta;
  - el resumen abre el mes correcto;
  - con el permiso denegado, la app no insiste.
- **Depende de**: F7.9. **Punto de control**: **CP8**.

---

### F8 — Respaldo y exportación

#### F8.0 — Diseño técnico de respaldo y exportación

- [x] F8.0
- **Agente**: architect. **Archivo**: `docs/architecture/backup.md`.
- **Objetivo**: aplicar ADR-012 en su versión revisada, con D-08, D-09 y D-10:
  - los mapeos entre dominio y `BackupDataV1`, y los esquemas Zod *strict*;
  - el **formato ZIP restringido** de ADR-012: solo STORED, sin ZIP64, sin data descriptors, sin comentario, sin campos extra, sin cifrado, nombres en UTF-8 y la lista blanca de rutas;
  - el **parser puro** sobre bytes (EOCD, directorio central y encabezados locales, con acceso aleatorio), separado de la E/S (`ArchiveIo`, `RandomAccessFile`);
  - el escritor STORED, que lee cada entrada completa, calcula su CRC32 en JS y escribe encabezado local, datos, directorio central y EOCD; y el `sha256` nativo de las fotos;
  - los valores concretos de `ZipLimits`: tamaño total, número de entradas, tamaño por entrada y de `data.json`;
  - la comprobación de **espacio libre** antes del respaldo de seguridad y de copiar fotos;
  - la copia de fotos verificadas a `photos/<id>.jpg.part` y el renombrado **antes** del commit, el caso `photo_conflict` y el lock de archivos (ADR-008). **No hay staging, intercambio de directorios ni marcador `restore-in-progress`** (ADR-012). *(Ajustado en F0.1.)*
  - el respaldo de seguridad en `Paths.document/safety/` (solo el último, D-22) y las preferencias fuera del respaldo (D-28);
  - las columnas de los dos CSV y la limpieza de temporales.
- **Depende de**: CP8. **ADRs**: ADR-012. **Decisiones**: D-22, D-28.

#### F8.1 — Especificación de pantallas de respaldo y exportación

- [x] F8.1
- **Agente**: designer.
- **Objetivo**:
  - exportar los dos CSV (ícono `Export`);
  - crear y compartir un respaldo;
  - restaurar, con una vista previa (cantidad de productos y ventas, fecha) y una confirmación explícita que avisa que se reemplaza todo y que se guarda una copia de seguridad;
  - un progreso accesible;
  - un mensaje amable para cada `RestoreError`, incluido "no hay espacio suficiente".
- **Depende de**: F8.0.

#### F8.2 — CSV

- [x] F8.2
- **Agente**: code-writer. **Archivos**: `src/features/backup/domain/csv/*` y sus tests.
- **Tests primero**:
  - Formato: comillas, `;`, saltos de línea y comillas dobles dentro de una celda (RFC 4180); BOM y CRLF; montos como enteros sin símbolo; fechas `AAAA-MM-DD`; encabezados en español.
  - Protección contra inyección de fórmulas: una celda que empieza con `=`, `+`, `-`, `@`, tabulación o retorno de carro se prefija con `'`.
  - Contenido: una fila por ítem en `ventas.csv` y una por versión en `productos.csv`; "a convenir" en lugar del precio; los archivados marcados; los borrados lógicos excluidos.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F8.0.

#### F8.3 — Parser ZIP puro, formato de respaldo y validación

- [x] F8.3
- **Agente**: code-writer. **Archivos**: `src/features/backup/domain/zip/*` (o donde lo ubique F8.0), `src/features/backup/domain/format/*` y `__fixtures__/`.
- **Tests primero**:
  - **CRC32** contra vectores conocidos.
  - **Parser STORED**: un ZIP válido escrito por el escritor propio y otro escrito por una herramienta estándar con STORED.
  - ***Fixtures* adversariales**, cada uno rechazado con su código y sin efectos:
    - *path traversal* (`../`, `..\`, rutas absolutas, letras de unidad, barras invertidas y bytes nulos);
    - un método de compresión distinto de STORED;
    - nombres de entrada **duplicados**;
    - cabecera local y directorio central que no coinciden;
    - entradas que se solapan;
    - un archivo truncado;
    - un CRC incorrecto;
    - tamaños declarados que superan los límites, como una *zip bomb*;
    - más entradas que el máximo permitido;
    - un comentario, campos extra o dos EOCD;
    - entradas cifradas o con el *flag* de data descriptor;
    - ZIP64 (valores centinela `0xFFFFFFFF`);
    - datos de foto que contienen las firmas `PK\x03\x04`, `PK\x07\x08` y `PK\x01\x02` (deben leerse bien);
    - nombres duplicados que solo difieren en mayúsculas. *(Lista ajustada en F0.1 a ADR-012.)*
  - **Formato**:
    - la ida y vuelta dominio → `BackupDataV1` → dominio no pierde datos, incluidos archivados y borrados lógicos;
    - el esquema rechaza claves desconocidas y montos fuera de rango;
    - un `formatVersion` mayor da `newer_format`;
    - la integridad referencial rota da `broken_references`;
    - la lista blanca de nombres;
    - un `sha256` que no coincide con el manifiesto.
  - *Fixtures* versionados de v1: válido, manipulado y de una versión futura.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F8.0.

#### F8.4 — Adaptador de E/S de ZIP

- [x] F8.4
- **Agente**: code-writer. **Archivo**: `src/features/backup/adapters/expo-archive-io.ts` (ADR-012: adaptador delgado sobre `FileHandle` de `expo-file-system`; o el nombre que fije F8.0). *(Ajustado en F0.1: antes decía `src/core/files/`.)*
- **Tests primero** (proyecto `ui`, con `jest.mock` de `expo-file-system` y `expo-crypto`):
  - `openForRead` lee rangos por offset; `createForWrite` escribe en orden; escribir con el escritor puro y volver a leer produce bytes idénticos.
  - `copyRange` copia exactamente el rango pedido al destino indicado, que siempre se calcula desde el id validado, nunca desde el nombre del ZIP.
  - `sha256OfFile`, `sha256OfBytes` y `availableDiskSpace` delegan en los módulos de Expo.
  - `close` se llama también si una lectura falla.
- **Verificación**: V-BASE, V-DEPS (se agregan `expo-sharing` y `expo-document-picker`; **no** se agrega `fflate`).
- **Depende de**: F8.3. **ADRs**: ADR-012.

#### F8.5 — Caso de uso de exportación del respaldo

- [x] F8.5
- **Agente**: code-writer.
- **Tests primero**:
  - Toma el lock de archivos y lo libera también si falla.
  - Lee una instantánea consistente.
  - Calcula el `sha256` de cada foto activa desde el disco; si no coincide con la fila, usa el del disco y registra una advertencia; si el archivo falta, exporta la fila como borrada lógicamente y sin archivo.
  - El manifiesto tiene los conteos (`activePhotos` = fotos con archivo) y los `sha256` correctos, y lista `data.json` y solo las fotos activas.
  - El archivo se llama `cuantovendi-respaldo-AAAA-MM-DD.zip`, con la fecha local de `Clock`.
  - Comprueba el espacio libre antes de escribir.
  - El temporal se borra al terminar o al próximo arranque.
- **Depende de**: F8.4.

#### F8.6 — Caso de uso de restauración

- [x] F8.6
- **Agente**: code-writer.
- **Tests primero** (integración, con la base en memoria y archivos falsos):
  - Un archivo válido produce la vista previa sin tocar nada.
  - Valida por contenido (primeros bytes `PK\x03\x04`), no por tipo MIME, y exige que las entradas sean exactamente `manifest.json` más `manifest.files`.
  - Al confirmar:
    - comprueba el espacio libre;
    - crea el respaldo de seguridad y borra el anterior solo cuando el nuevo está completo (D-22);
    - con el lock de archivos tomado, copia cada foto verificada a `photos/<id>.jpg.part`, verifica el `sha256` y renombra; salta las que ya existen con el mismo `sha256` y aborta con `photo_conflict` si existen con otro;
    - reemplaza las tablas en una sola `runInTransaction`, de hijos a padres al borrar y de padres a hijos al insertar, sin tocar `notification_preferences` ni `__drizzle_migrations`;
    - emite `DataChanges` con todas las tablas;
    - pide una reconciliación de notificaciones (serializada, F7.5).
  - Cualquier error antes del commit deja intactos los datos actuales; las fotos ya copiadas quedan huérfanas y las limpia la recolección (F2.6).
  - Se mantienen las preferencias del dispositivo (D-28). *(Ajustado en F0.1: ya no hay intercambio de directorios ni marcador `restore-in-progress`, ADR-012.)*
- **Depende de**: F8.5, F7.5.

#### F8.7 — Hooks, componentes y pantallas de respaldo

- [x] F8.7
- **Agente**: code-writer.
- **Tests primero**: el progreso tiene un texto accesible; cada `RestoreError` tiene un mensaje en español sin tecnicismos; la confirmación es explícita; cancelar el selector de archivos no muestra un error.
- **Depende de**: F8.1, F8.6, F8.2.

#### F8.8 — Exportar desde la pantalla de error de arranque

- [x] F8.8
- **Agente**: code-writer.
- **Objetivo**: conectar la opción de F0.10 con la **exportación de emergencia** de ADR-006: copia cruda de la base con `backupDatabaseAsync` a un `.db` nuevo, más `photos/`, empaquetada con el escritor STORED y compartida. No usa el mapeo de dominio ni `BackupDataV1`; restaurar ese archivo no se soporta en la v1. *(Ajustado en F0.1: antes reutilizaba la exportación normal de F8.5.)*
- **Tests primero**: la acción está disponible en los estados `failed` (también `newer_database`) y no escribe en la base; el ZIP contiene el `.db` y las fotos.
- **Depende de**: F8.4, F0.10.

#### F8.9 — Revisión

- [x] F8.9
- **Agente**: reviewer. **Foco extra**: el parser frente a entradas hostiles, que nada escriba fuera de `photos/`, `safety/` y la caché con nombres derivados de ids validados, la atomicidad, el espacio libre y que no haya datos del negocio en los logs. **Depende de**: F8.2 a F8.8 y F8.11. *(Ajustado en F0.1.)*

#### F8.10 — E2E y medición de respaldo

- [~] F8.10
- **E2E** (`e2e/maestro/backup/`):
  - Exportar los dos CSV (se abre el menú de compartir).
  - Crear un respaldo.
  - Restaurar un *fixture* precargado y ver los datos.
  - Restaurar un archivo que no es un respaldo y ver el mensaje amable.
- **Medición**: el tiempo y la memoria de exportar y restaurar el conjunto `large` (unos 50 MB de fotos) en el Android de referencia, incluido el CRC32 en JS. Si supera el presupuesto de F10.0, el architect abre un ADR conservando el formato.
- **Manual**: abrir los CSV en Excel y en Google Sheets y comprobar las tildes, el separador y que los montos se puedan sumar.
- **Depende de**: F8.9, F8.11. **Decisiones**: D-23. **Punto de control**: **CP9**.

#### F8.11 — Semillas de E2E por restauración de *fixtures* *(agregada en F0.1)*

- [x] F8.11
- **Agente**: code-writer.
- **Objetivo**: implementar la semilla de ADR-013: la ruta oculta `cuantovendi://e2e/seed?fixture=<nombre>`, que existe solo con `EXPO_PUBLIC_E2E=1` (F0.15) y **restaura un respaldo *fixture* incluido en el bundle por el camino real de restauración** (F8.6). Los *fixtures* `basic` y `large` (por ejemplo, tres años de ventas, 200 productos y fotos) se generan con un script de Node a partir de fábricas puras y deterministas (`FakeClock`, `SequentialIdGenerator`) y del escritor ZIP puro de F8.3, y se versionan en `e2e/fixtures/`.
- **Tests primero**: las fábricas producen entidades que pasan las validaciones del dominio y `BackupDataV1`; generar dos veces da bytes idénticos; el parser de F8.3 acepta los *fixtures*; con el *flag* en `false` la ruta no existe ni se empaquetan los *fixtures*.
- **Aceptación**: los E2E de F8.10 y F10.2 cargan `large` con la semilla; F10.5 puede reemplazar los subflujos de datos de F1 a F7 por la semilla donde convenga.
- **Verificación**: V-NODE, V-BASE.
- **Depende de**: F8.6, F0.15. **ADRs**: ADR-012, ADR-013, ADR-016.

---

### F9 — Ajustes

#### F9.0 — Diseño técnico y especificación de Ajustes

- [x] F9.0
- **Agente**: architect (`docs/architecture/settings.md`) → designer (pantalla).
- **Objetivo**: definir una pantalla que reúne:
  - las preferencias de notificación (F7.7);
  - el respaldo y la exportación (F8.7);
  - el último respaldo de seguridad (D-22), que se puede restaurar con el flujo de F8;
  - la versión de la app y una nota de privacidad ("tus datos viven en tu teléfono");
  - las **licencias de terceros**: Apache 2.0 de HeroUI Native (ADR-004), OFL 1.1 de Lexend y MIT de Phosphor (ADR-014), y el resto de las dependencias de producción.

  El architect decide cómo se genera la lista de licencias. Si hace falta una dependencia de desarrollo nueva, la justifica en un ADR.
- **Depende de**: CP9.

#### F9.1 — Implementación de Ajustes

- [x] F9.1
- **Agente**: code-writer. **Archivos**: `src/features/settings/*`, `src/app/(tabs)/settings.tsx` y `src/app/settings/licenses.tsx`.
- **Tests primero**: se muestran las secciones con sus estados; las licencias incluyen HeroUI Native, Lexend y Phosphor con su texto; un test falla si una dependencia de producción no tiene su licencia en la lista generada.
- **Verificación**: V-UI, V-BASE.
- **Depende de**: F9.0.

#### F9.2 — Revisión

- [x] F9.2
- **Agente**: reviewer. **Depende de**: F9.1.

#### F9.3 — E2E de Ajustes

- [~] F9.3
- **Flujos** (`e2e/maestro/settings/`): navegar a cada sección y abrir las licencias.
- **Depende de**: F9.2. **Punto de control**: **CP10**.

---

### F10 — Cierre local

#### F10.0 — Presupuestos de rendimiento

- [x] F10.0
- **Agente**: architect.
- **Objetivo**: fijar presupuestos de rendimiento medibles en el Android de referencia local (un teléfono de gama baja conectado o un emulador con recursos limitados):
  - el arranque en frío hasta que Inicio responde;
  - la apertura del registro de venta;
  - guardar una venta;
  - el render de un mes del calendario;
  - el scroll del historial con `large`;
  - exportar y restaurar.
- **Depende de**: CP10. **Decisión**: D-23.

#### F10.1 — Auditoría de accesibilidad

- [~] F10.1
- **Agente**: designer (auditoría) + code-writer (correcciones con tests) + usuario (recorrido con TalkBack en su teléfono Android conectado).
- **Checklist** (`accessibility.md` y sección 7 de `docs/design-system.md`):
  - roles y etiquetas en todo lo interactivo, y `accessibilityState` en los estados;
  - anuncios de errores y toasts;
  - el foco en diálogos y hojas;
  - el botón atrás de Android;
  - áreas táctiles de 48 × 48;
  - la fuente máxima del sistema sin cortes;
  - "reducir movimiento";
  - contraste en claro y en oscuro;
  - nada comunicado solo con color;
  - los montos se leen como "pesos".
- **Aceptación**: se cumplen DT-15 y DT-16, y cada corrección tiene su test de RNTL. VoiceOver queda para el futuro (sección 10).
- **Depende de**: CP10.

#### F10.2 — Rendimiento en Android de gama baja

- [~] F10.2
- **Agente**: code-writer (mediciones y correcciones) + reviewer.
- **Objetivo**: medir con el conjunto `large`, en el build `e2e` local, contra los presupuestos de F10.0. Se usan el profiler de React DevTools, el profiler de Hermes y el monitor de rendimiento. Se revisan las listas, las imágenes, los renders, la memoria al navegar y el trabajo síncrono en el hilo de JS (el driver de SQLite y el CRC32).
- **Aceptación**: se cumple DT-17. Cada optimización tiene su medición antes y después, y no se agrega memoización manual sin una medición que la justifique.
- **Depende de**: F10.0.

#### F10.3 — Anulada

- [x] F10.3 — anulada: el reporte de errores en un servicio externo queda fuera de la v1 (D-23, sección 10). En la v1 basta el `logger` local de F0.8.

#### F10.4 — Auditoría local de permisos y secretos

- [~] F10.4
- **Agente**: code-writer + reviewer.
- **Objetivo**:
  - comprobar que el `app.json` y el manifiesto generado declaran solo cámara y notificaciones (DT-19), con sus textos en español;
  - comprobar que no hay secretos en el código, en `app.json` ni en el bundle del build `e2e`.
- **Verificación**: V-DEPS, V-AUDIT e inspección del manifiesto de Android generado.
- **Depende de**: F10.0.

#### F10.5 — Regresión E2E completa

- [~] F10.5
- **Agente**: code-writer (a pedido del orquestador) + reviewer.
- **Objetivo**: correr toda la suite de `e2e/maestro/` localmente en el build `e2e` de Android, más los E2E de instalación nueva y de **actualización desde el build de CP1** (V-E2E-UPG).
- **Aceptación**: se cumple DT-12.
- **Depende de**: F10.1 a F10.4.

#### F10.6 — Prueba en el teléfono del usuario

- [~] F10.6
- **Agente**: usuario, guiado por el orquestador.
- **Objetivo**: recorrer todos los flujos críticos en el teléfono Android del usuario conectado a este entorno, incluidas las notificaciones reales, la cámara, compartir y restaurar. La verificación en iOS queda para el futuro (sección 10).
- **Depende de**: F10.5.

#### F10.7 — Gate de cierre local de la v1

- [~] F10.7
- **Agente**: reviewer (verifica) + orquestador (consolida).
- **Checklist** (sección 1.2):
  - `npm run typecheck` y `npm run lint` limpios;
  - `npm test` en verde;
  - `npx expo-doctor` y `npx expo install --check` sanos;
  - toda la suite de Maestro en verde, con instalación nueva y actualización;
  - el recorrido con TalkBack aprobado;
  - los presupuestos de rendimiento cumplidos;
  - solo los permisos necesarios y sin secretos;
  - `npm audit` revisado;
  - sin hallazgos críticos ni importantes del reviewer.
- **Depende de**: F10.1 a F10.6. **Punto de control**: **CP11** y luego **CP12**.

---

## 6. Contenido de consejos (resumen)
El contenido es una tarea propia (F6.1), con su aprobación (CP7a) y un test que comprueba que el catálogo cumple las reglas (F6.4). Puede empezar desde CP0 porque no depende de código. Las fuentes quedan en `docs/content/consejos.md`; en la app no se muestran, salvo que el usuario lo pida en CP7a. Cuando exista un servidor, `TipCatalog` permite reemplazar el catálogo incluido por uno remoto sin tocar el dominio.

---

## 7. Puntos de control con el usuario

### 7.1 Puntos de control planificados
La ejecución **no se detiene** en los puntos de control. El orquestador registra cada uno en el Registro de progreso con lo hecho, cómo probarlo, los resultados de V-BASE, la revisión del reviewer y los E2E o verificaciones manuales pendientes de entorno. El usuario los revisa cuando pueda. **No se hace commit** salvo que el usuario lo pida explícitamente.

| CP | Después de | Qué aprueba el usuario |
|---|---|---|
| CP0 | F0.0 | El usuario aprueba el plan. |
| CP1 | F0.17 | En el dispositivo: "Bruma" en claro y oscuro, Lexend, el estilo sticker, las pestañas, `Amount` (P-23) y las tres verificaciones de HeroUI. |
| CP2 | F1.8 | Productos y versiones. |
| CP3 | F2.9 | Fotos de galería y de cámara, y la orientación y el EXIF. |
| CP4 | F3.9 | Registro de ventas, "no vendí", edición y borrado, y la cantidad de toques. |
| CP5 | F4.6 | Inicio y resumen mensual, y cómo se ven los textos de comparación y de ganancia parcial (D-15). |
| CP6 | F5.5 | Calendario, intensidad y racha. |
| CP7a | F6.1 | El contenido de los consejos y sus fuentes. |
| CP7 | F6.8 | Los consejos en la app. |
| CP8 | F7.10 | Las notificaciones reales, sus textos y la lista de frases prohibidas. |
| CP9 | F8.10 | Respaldo, restauración y CSV en una planilla. |
| CP10 | F9.3 | Ajustes y licencias. |
| CP11 | F10.7 | El resultado del gate de cierre local. |
| CP12 | CP11 | La aprobación final de la v1 (DT-20). No hay publicación (D-23). |

### 7.2 Condiciones de parada
La ejecución se detiene, y el orquestador consulta al usuario, solo cuando:
- una tarea necesita una `P-nn` que todavía no tiene respuesta;
- aparece una ambigüedad de producto (no se inventa);
- hace falta una dependencia que no está en un ADR, o cambiar un ADR;
- algo requiere cuentas, pagos, servicios en la nube o sacar algo de este entorno: queda fuera de la v1 (sección 10) y se consulta;
- un presupuesto de rendimiento o un criterio de accesibilidad no se puede cumplir con el diseño actual;
- una verificación falla de forma persistente por causas ajenas al código;
- una verificación de HeroUI en el dispositivo (F0.17) obliga a cambiar el sistema de diseño;
- el reviewer marca un hallazgo crítico que exige rediseño.

---

## 8. Riesgos y detección temprana

| Riesgo | Impacto | Detección temprana |
|---|---|---|
| El texto final de los ADRs difiere de lo que asume el plan. | Retrabajo de tareas. | F0.1 contrasta el plan con los ADRs antes de escribir código. |
| HeroUI Native 1.0.11, Uniwind y el React Compiler en SDK 58 (React 19.3, RN 0.88) no funcionan como se espera. | Componentes rotos. | F0.12 y F0.13 antes de cualquier feature; CP1 en el dispositivo. |
| Borde del `TextField` en Android, sombra sticker en Android menor a 9, `overflow` que recorta la sombra. | Diferencias visuales entre plataformas. | El `TextField` base fuerza el borde, la sombra va en un contenedor si hace falta, y se comprueban en F0.17 (con un emulador de Android 7–8). |
| Lexend sin cifras tabulares desalinea los montos. | Listas menos legibles. | `Amount` único; P-23 se decide en CP1; si se elige Sora, el cambio queda en un solo componente con un ADR que reemplace al 014. |
| Errores de zona horaria y cambio de horario. | Ventas en el día o la semana equivocados; recordatorios a deshoras. | ADR-015 con *fixtures* de `America/Santiago`, `Pacific/Easter` y `America/Punta_Arenas`, Jest con zona horaria fija y `test:tz`, `useToday` y `useCurrentWeek` con tests de medianoche. |
| Formato de montos distinto entre plataformas. | `$15.000` mal mostrado. | `formatClp` propio sin `Intl` (F0.6), verificado en el dispositivo en F0.17. |
| Migraciones que dejan FK rotas o difieren entre `better-sqlite3` y el dispositivo. | Datos corruptos al actualizar. | `configureAndMigrate` con `foreign_key_check`, test por migración y E2E de instalación nueva y de actualización (F0.15, V-E2E-UPG). |
| El driver síncrono de SQLite bloquea el hilo de JS. | Lentitud en gama baja. | Consultas por rango, conjunto `large` desde F0.15 y medición en F10.2. |
| Fotos con EXIF o mal orientadas. | Privacidad (GPS) y fotos giradas. | Verificación manual obligatoria en F2.9. |
| Maestro no controla la cámara, el selector de archivos ni las notificaciones del sistema. | Huecos de E2E. | Se declaran en F2.8, F7.10 y F8.10, y se cubren con dobles y verificación manual. |
| Parser ZIP propio con errores ante entradas hostiles. | *Path traversal*, consumo de memoria o archivos escritos donde no corresponde. | Parser puro con *fixtures* adversariales (F8.3), validación completa del directorio central y de los límites **antes** de copiar datos, destinos derivados del id (F8.4, F8.6) y foco del reviewer (F8.9). |
| CRC32 y E/S por bloques lentos en Hermes. | Respaldos lentos. | Medición con `large` en F8.10; un ADR nuevo si no cumple, manteniendo el formato. |
| Falta de espacio durante la restauración. | Restauración a medias. | Comprobación de espacio libre antes del respaldo de seguridad y de copiar fotos; nada cambia hasta el commit único, y las fotos copiadas de más quedan huérfanas y se limpian (F8.6, ADR-012). |
| Reconciliaciones de notificaciones simultáneas. | Notificaciones duplicadas o perdidas. | Cola serializada con tests de concurrencia (F7.5). |
| Recordatorios duplicados o que no llegan (entrega aproximada en Android, permiso denegado, comportamiento del trigger `WEEKLY` distinto entre plataformas). | Dos avisos en la misma semana, o ninguno. | Estados A/B de ADR-011, un test de "nunca dos por semana" en F7.2 y una verificación manual de varias semanas en F7.10 (D-13). |
| Textos con tono de culpa. | Rompe un principio de producto. | Test de patrones prohibidos compartido (F6.4 y F7.2) y revisión en CP7a y CP8. |
| Consejos inexactos o leídos como asesoría legal. | Pérdida de confianza. | Fuentes obligatorias, D-21 y aprobación en CP7a. |
| Falta un Android de gama baja o un emulador de Android 7–8 en este entorno. | No se pueden medir los presupuestos ni la degradación de la sombra. | Se confirma en CP1; si falta, se usa un emulador con recursos limitados y se anota la limitación en el Registro de progreso. |

---

## 9. Trazabilidad de `docs/product.md`

| Sección de producto | Tareas |
|---|---|
| 1. Productos (nombre, descripción, versiones, a convenir, costo, archivado) | F1.* |
| 1. Productos (fotos) | F2.* |
| 2. Registro de ventas, "no vendí" y consejo al guardar | F3.*, F6.5 |
| 3. Seguimiento: Inicio, resumen mensual y ganancia | F4.* |
| 3. Seguimiento: calendario y racha | F5.* |
| 4. Notificaciones | F7.* |
| 5. Consejos (solo después de guardar y en la sección; no en Inicio) | F6.* |
| 6. Respaldo y exportación | F8.* |
| Moneda CLP, tono e idioma | F0.6, F0.13 (`Amount`), test de tono (F6.4, F7.2) |
| Local primero y preparada para servidor | F0.9 (convenciones sync-ready, id determinista), F0.11, `TipCatalog` (F6.0) |
| iOS y Android | Código multiplataforma; en la v1 se verifica en Android (F0.17, F10.6) y la verificación en iOS queda para el futuro (sección 10) |

---

## 10. Fuera de alcance v1 / futuro release
La v1 no se publica y nada sale de este entorno de desarrollo (D-23). Esto queda para un release futuro, con su propio plan:
- **Publicación**: envío a tiendas, cuentas de Apple y Google, identificadores de la app (`bundleIdentifier` / `package`), nombre visible, política de privacidad, ícono y splash de release, y configuración de release (versionado, firma).
- **EAS**: EAS Build, Submit y Update, perfiles de `eas.json` y política de `runtimeVersion` y OTA. La parte de EAS que planteaba ADR-016 sale de ese ADR, que en la v1 trata solo de quitar web y de los builds locales.
- **Observabilidad externa**: reporte de errores en un servicio externo (Sentry o similar) y el ADR que lo decidiría (el antiguo ADR-017). En la v1 basta el `logger` local.
- **iOS**: verificación en iPhone físico o simulador, VoiceOver, E2E de iOS en EAS (el antiguo V-E2E-I) y la decisión sobre su costo.
- **Gate de pre-release** de `production-readiness.md` (EAS, OTA, reporte de errores, dispositivos físicos de ambas plataformas). En la v1 se reemplaza por el gate local de F10.7.
- **Cualquier dependencia de servicios en la nube**, incluida la sincronización con un servidor y los consejos remotos.

---

## 11. Registro de progreso
Quien cierra una tarea agrega aquí una fila (la más reciente al final). La columna "Verificación" resume la salida real de los comandos: por ejemplo, "typecheck 0 errores · lint 0 problemas · jest 142 passed · maestro 4/4 flujos". Los puntos de control se anotan con la respuesta del usuario.

| Fecha | Tarea o CP | Agente | Verificación (salida resumida) | Notas |
|---|---|---|---|---|
| 2026-11-13 | F0.0 / CP0 | orquestador | `docs/product.md` contiene D-01 a D-30 | El usuario aprobó ADRs y plan, y lanzó la ejecución autónoma. |
| 2026-11-13 | F6.1 | designer | 30 consejos (6 categorías, ≥4 c/u); títulos ≤60, cuerpos ≤221 car.; ids únicos; grep sin temas tributarios ni redes específicas | CP7a registrado: aprobación del contenido pendiente de revisión del usuario; una fuente (PDF BancoEstado) no se pudo abrir, cada consejo que la cita tiene otra fuente leída. |
| 2026-11-13 | F0.1 | architect | Plan contrastado con ADR-005..016; 15 ajustes en sección 2.3; F8.11 agregada | — |
| 2026-11-13 | F0.2 | architect | ADR-016 aceptado (quitar web, builds locales, minSdk 24, package `com.cuantovendi.local`) | Comandos de build pendientes de entorno Android. `react-dom` se queda (peer de expo-router). |
| 2026-11-13 | F0.3 | architect | `docs/architecture/foundations.md` con los 6 apartados | Decisiones del orquestador: `@types/better-sqlite3` cubierto por ADR-006 (solo tipos de dev); `TransactionRunner` es detalle de implementación de ADR-006, sin ADR nuevo; utilidades de E2E en `src/core/e2e/` (no es una feature); `.prettierignore` para `docs/`, `.claude/` y `assets/` en F0.4. |
| 2026-11-13 | F0.4 | code-writer | V-BASE ok · expo-doctor 20/20 · `expo start` levanta · web y 6 deps de plantilla quitadas | Verificado también por el orquestador. |
| 2026-11-13 | F0.5 | code-writer | typecheck 0 · lint 0 · prettier ok · jest 7 suites / 55 tests · test:tz ok en 3 zonas · 13 fixtures de violación de capas fallan como se espera | `jest-expo/node` cargaba RN real: se mapea `react-native` a un stub que lanza (anotar en ADR-013). TZ de tests vía `TEST_TZ`. Comandos actualizados en CLAUDE.md. |
| 2026-11-13 | F0.6 | code-writer | V-BASE ok · jest 22 suites / 338 tests | `formatClp` sin Intl, `parseClpInput` con códigos de ADR-010; `epoch-ms.ts` extra. |
| 2026-11-13 | F0.7 | code-writer | test:tz ok (Santiago 99, Pascua 95, Punta Arenas 86) | `deviceLocalCalendar` maneja horas inexistentes/repetidas. |
| 2026-11-13 | F0.8 | code-writer | V-BASE ok · doctor 20/20 | UUIDv7 + UUIDv5 (namespace fijo). `uuid` ESM en transformIgnorePatterns. Script `doctor` usa `npx expo-doctor`. |
| 2026-11-13 | F0.12 | designer | 19 pares × 2 temas ≥ mínimo WCAG · V-BASE ok (verificado por orquestador tras F0.8) | Mutación verificada. `home-screen` provisional usa `text-2xl` (se reemplaza en F4). |
| 2026-11-13 | deps | orquestador | expo-sqlite, drizzle-orm 0.45.4, @tanstack/react-query, phosphor-react-native, react-hook-form, @hookform/resolvers; dev: drizzle-kit, better-sqlite3, @types/better-sqlite3, babel-plugin-inline-import · doctor 20/20 | Preinstaladas para F0.9, F0.11 y F0.13 (evita escrituras concurrentes de package.json). |
| 2026-11-13 | F0.9 | code-writer | V-DB sin cambios · doctor 20/20 · 55 tests de db | Migración `0000_initial_schema` revisada. CHECK de fechas corregido (`date(x) IS NOT NULL`) también en ADR-007. Confirmación en dispositivo pendiente de entorno (F0.17). |
| 2026-11-13 | F0.13 | designer | V-BASE completo (orquestador): typecheck 0 · lint 0 · prettier ok · jest 47 suites / 483 tests · test:tz ok | Orquestador agregó a jest.config `heroui-native`, `phosphor-react-native`, `uniwind` transpilados y el resolver de Reanimated en `ui`. `Sheet` sobre Modal de RN (sin @gorhom). `DateField` por pasos de un día. Borde TextField Android y toast duplicado en TalkBack: pendientes de entorno. |
| 2026-11-13 | F0.11 | code-writer | V-BASE ok · jest 77 suites / 604 tests | IconContext de Phosphor sin efecto con imports por ícono: `Icon` fija tamaño y peso. |
| 2026-11-13 | F0.10 | code-writer | V-BASE ok · fallo de foreign_key_check lleva a `failed` (test de integración) | Exportación de emergencia queda para F8.8. |
| 2026-11-13 | F0.14 | code-writer | V-BASE ok · navegación con 5 pestañas probada con renderRouter | 'Registrar venta' sin destino hasta F3 (conectar en F3). |
| 2026-11-13 | F0.15 | code-writer | V-BASE ok · flag y rutas E2E testeadas | `[~]` pendiente de entorno: smoke.yaml, fresh-install.yaml y release-has-no-e2e.yaml escritos, sin ejecutar (no hay Android SDK ni Maestro). |
| 2026-11-13 | F1.0 | architect | `docs/architecture/products.md` (6 apartados) | Preguntas 6.9–6.18 resueltas por el orquestador con los valores por defecto → D-31..D-34 en product.md. Pendiente para F1.3/F1.4: excepción de lint para `src/core/dependencies/**` → `features/*/data/drizzle-*` (lo permite ADR-005) y una única instancia de `RunInTransaction`. |
| 2026-11-13 | F1.1 | designer | `docs/design/products.md` (navegación, 6 pantallas, estados, textos, a11y, pruebas sugeridas) | Producto archivado editable. 'Agregar otra opción' con una sola versión (texto a confirmar por el usuario). Componentes nuevos para F1.5: `ScreenHeader`, `InlineNotice`, `ListRow.amountPrefix`; `useConfirmLeave` en `shared/lib`. |
| 2026-11-13 | F0.16 | reviewer + code-writer | Revisión: 0 críticos, 2 importantes (I1 código E2E en release, I2 throw síncrono en migración) y 15 menores, todos corregidos · V-BASE ok · jest 83 suites / 723 tests · test:tz ok · doctor 20/20 · npm audit: 0 altas/críticas · bundle release sin el texto del diagnóstico (verificado) | ADR-013 y ADR-014 enmendados por el orquestador (stub RN; Icon en vez de IconContext). |
| 2026-11-13 | F0.17 / CP1 | orquestador | `[~]` pendiente de entorno: smoke/fresh-install y las 8 comprobaciones en dispositivo requieren Android SDK, emulador y Maestro | CP1 registrado. P-23 sin respuesta → se sigue con 'solo Lexend' (según plan). |
| 2026-11-13 | F1.2 | code-writer | V-BASE ok (tras F0.16) · 73 tests de dominio de productos | `testing/product-fixtures.ts` agregado. |
| 2026-11-13 | F1.3 | code-writer | V-BASE ok · V-DB sin cambios · jest 89 suites / 797 tests · suite de contrato contra Drizzle y doble en memoria | El test del doble y la suite de contrato se escribieron junto con la implementación (desvío de TDD estricto anotado para el reviewer F1.7). |
| 2026-11-13 | F1.4 | code-writer | V-BASE ok · test:tz ok | Invalidación por DataChanges probada (ventas no recargan `['products']`). `renderWithProviders` usa `gcTime: Infinity` en tests. Una sola instancia de `runInTransaction` verificada. |
| 2026-11-13 | F2.0 | architect | `docs/architecture/product-photos.md` (6 apartados) | Preguntas resueltas por el orquestador → D-35. F2.4/F2.5 empiezan después de F1.6 (comparten archivos de productos). |
| 2026-11-13 | F3.0 | architect | `docs/architecture/sales.md` (6 apartados) | Preguntas resueltas por el orquestador → D-36..D-38 (clave UUIDv5 = `YYYY-MM-DD`). |
| 2026-11-13 | F1.5 | code-writer | V-BASE ok · jest 103 suites / 885 tests · test:tz ok | Nuevos en shared: ScreenHeader, InlineNotice, ListRow.amountPrefix, useConfirmLeave, optionalClpTextSchema. `ProductFormValues` con arrays mutables (RHF). Sin foco programático tras quitar versión (ButtonBase sin ref). |
| 2026-11-13 | F1.6 | code-writer | V-BASE ok · rutas probadas con renderRouter (crear, archivar, desarchivar, not-found) | Typecheck requiere `.expo/types` generado: en clon limpio correr `npm start` una vez. |
| 2026-11-13 | F2.1 | designer | `docs/design/photos.md` | Galería y Cámara visibles; grilla 80×80; hoja con portada/mover/quitar (D-35). |
| 2026-11-13 | F3.1 | designer | `docs/design/sales.md` | Registro en 3 toques; celebración con lugar para el consejo (F6). Componentes para F3: QuantityStepper editable, ChipGroup.allowDeselect, Amount variante total, DatePickerSheet. El orquestador decide incluir `DatePickerSheet` en F3 (el tiempo no es criterio). |
| 2026-11-13 | F3.2 | code-writer | V-BASE ok · jest 109 suites / 1002 tests · test:tz ok | `canMarkNoSales` implementado como `noSalesWeekStatus`/`noSalesPrompt` según sales.md. `too_many_items` (>100). F3.5 usa `activeVersions` de products. |
| 2026-11-13 | F4.0 | architect | `docs/architecture/tracking-home.md` | Preguntas → D-39, D-40. Aditivos en sales: `earliestSoldOn`, `SaleRecordView` puro en `sales/domain`. |
| 2026-11-13 | F5.0 | architect | `docs/architecture/tracking-calendar.md` | Preguntas → D-41. Racha en `sales/domain/streak.ts`. `/sales/new?date=`. |
| 2026-11-13 | F6.0 | architect | `docs/architecture/tips.md` · ADR-007 enmendado (6 categorías, `trigger`, `TipId`, `tip_views.updated_at` = última vez visto; extras aceptados por el orquestador) | Preguntas → D-42. ADR-005 enmendado (consejo vía `renderAfterSave`). Para F7.0: el aviso mensual lleva `month` en el payload y abre `/tracking/monthly?month=…`. Lista compartida de patrones de culpa para tests aprobada. |
| 2026-11-13 | F1.7 | reviewer + code-writer | Revisión: 0 críticos, 2 importantes (ruta de error de versiones nuevas; foco al quitar versión) y 10 menores, corregidos con tests · V-BASE ok · jest 113 suites / 1109 tests | Foco con `sendAccessibilityEvent(ref,'focus')` (setAccessibilityFocus deprecado). Verificación con TalkBack pendiente de entorno. |
| 2026-11-13 | F2.2 | code-writer | V-BASE ok · tests de fitWithin, findOrphans (15 min), setProductPhotos, diffPhotos | — |
| 2026-11-13 | F2.3 | code-writer | V-BASE ok · doctor 20/20 · 25 tests del adaptador · FileLock 11 tests · introspect: sin RECORD_AUDIO ni almacenamiento externo | `blockedPermissions` en app.json. `expo-photo-picker.ts` queda para F2.5/F2.6. |
| 2026-11-13 | F4.1 | designer | `docs/design/tracking-home.md` | Monto de la semana como protagonista; comparación por monto ('a esta altura de…'). |
| 2026-11-13 | F5.1 | designer | `docs/design/tracking-calendar.md` | Intensidad con 1–3 puntos (no solo color). Excepciones: grilla `px-3`, números de día con `maxFontSizeMultiplier={2}`. El calendario retrocede hasta el primer mes con ventas (valor por defecto). |
| 2026-11-13 | F6.2 | designer | `docs/design/tips.md` | Orquestador aprueba límites 50/240 (actualizados consejos.md y tips.md; el contenido cumple: máx. 43/221). La celebración pasa `focusDone()` a `renderAfterSave` (F3.6/F3.7). Patrón de culpa 'Todavía no': corregido en design-system.md; quedan textos en `products-screen.tsx` ('Todavía no tienes productos') y `home-screen` provisoria → corregir en F4.5 / revisión F2.7. |
| 2026-11-13 | F1.8 / CP2 | code-writer | `[~]` 4 flujos Maestro escritos en `e2e/maestro/products/`, sin ejecutar (sin Android SDK/Maestro) | CP2 registrado. |
| 2026-11-13 | F2.4 | code-writer | V-BASE completo (orquestador): typecheck 0 · lint 0 · prettier ok · jest 145 suites / 1473 tests · test:tz ok · V-DB sin cambios | Puertos de fotos movidos a `domain/photo-ports.ts`; index de products exporta adaptadores para `core/dependencies`. |
| 2026-11-13 | F2.5 | code-writer | ídem | Miniaturas en listas (UX-F7) no incluidas: quedan para F4/F10. `border-border` en marcos de fotos. |
| 2026-11-13 | F2.6 | code-writer | ídem | `runAfterFirstRender` en MigrationGate. |
| 2026-11-13 | F3.3 | code-writer | ídem | Parte del código de datos se escribió antes que sus tests (desvío TDD, para el reviewer F3.8). |
| 2026-11-13 | F3.4 | code-writer | ídem | D-02 atómico verificado con fallo a mitad de transacción. Racha (`streakFrom`, `loadStreak`), `earliestSoldOn` y `SaleRecordView` agregados. |
| 2026-11-13 | F3.5 | code-writer | ídem | Hooks escritos antes que sus tests (desvío TDD). `useSaleRecordView`, `useProductsByIds`, `useSellableProducts` pasan a F3.6. |
| 2026-11-13 | F4.2 | code-writer | ídem | `yearMonthSchema` en shared. `home-summary.test` escrito junto con su implementación (desvío TDD). |
| 2026-11-13 | F6.3 | code-writer | ídem | Catálogo de 30 consejos con test de fidelidad. Lista de patrones de culpa aprobada por el orquestador. |
| 2026-11-13 | F2.7 | reviewer + code-writer | Revisión: 2 bloqueantes (borrado de archivos en rollback; permisos SYSTEM_ALERT_WINDOW/VIBRATE) + 3 importantes + 12 menores, corregidos · V-BASE ok · jest 165 suites / 1743 tests · introspect: solo INTERNET (+ CAMERA del plugin) | ADR-008 enmendado por el orquestador. `getPendingResultAsync` no implementado (anotado). Foco al título de la hoja: pendiente (Sheet en shared/ui). |
| 2026-11-13 | F2.8 / F2.9 / CP3 | code-writer | `[~]` 3 flujos Maestro de fotos escritos; verificación manual de EXIF/orientación y permisos sobre APK pendientes de entorno | CP3 registrado. |
| 2026-11-13 | F3.6 | code-writer | V-BASE ok | DatePickerSheet, Amount total, ChipGroup allowDeselect, QuantityStepper editable, monthGrid. 'de nuevo' en vez de 'otra vez' (patrón de culpa). Algunos helpers escritos junto con sus tests (desvío TDD). |
| 2026-11-13 | F3.7 | code-writer | V-BASE ok · rutas de ventas probadas (6) | `renderAfterSave`/`focusDone` ya expuestos para F6.5. Botón 'Registrar venta' de Inicio conectado. |
| 2026-11-13 | F3.8 | reviewer + code-writer | 'F3 aprobado' (D-02 atómico, fechas vía Clock/useToday, sin promesas sueltas); 4 importantes + 8 menores corregidos · V-BASE ok · jest 1893 tests · test:tz ok | `runAsPromise` a core/db; lint impide imports entre features por ruta relativa; `goBackOrHome`; selector virtualizado (hoja con FlatList, inline máx. 20 con buscador). Tests inestables bajo carga (`products-routes`, `sale-form` con 100 filas): revisar en F10.5. |
| 2026-11-13 | F3.9 / CP4 | code-writer | `[~]` 7 flujos Maestro de ventas escritos (rama lunes/martes en no-sales); sin ejecutar | CP4 registrado. |
| 2026-11-13 | F4.3 | code-writer | V-BASE ok · jest 181 suites / 1893 tests · test:tz ok | Una sola consulta para Inicio; costos solo de ítems sin unitCost; `useStreak` creado (reutilizar en F5). |
| 2026-11-13 | F4.4 | code-writer | V-BASE ok | AmountSentence, formatShortDateLabel, ListRow.accessibilityHint. Sin consejos en Inicio (D-11). |
| 2026-11-13 | F4.5 | code-writer | V-BASE ok · 8 tests de ruta de `/tracking/monthly` | F4 no tiene tarea de revisión propia: la revisión de F5.4 cubre F4.3–F4.5 (decisión del orquestador). |
| 2026-11-13 | F4.6 / CP5 | code-writer | `[~]` 4 flujos Maestro de tracking escritos; sin ejecutar | CP5 registrado. |
| 2026-11-13 | F6.4 | code-writer | Catálogo de 30 consejos con tests de contenido (ids, categorías, límites 50/240, culpa, ≥3 por categoría) y fidelidad con consejos.md | Hecho junto con F6.3. CP7a: contenido pendiente de revisión del usuario. |
| 2026-11-13 | F7.0 | architect | `docs/architecture/notifications.md` | ADR-011 enmendado (dedupe por id+fecha, `unrecognized`, `month` en payload, permisos). Preguntas → D-43. Bloqueado `c2dm.RECEIVE` en app.json. Instalado `expo-notifications` ~58.1.9. |
| 2026-11-13 | F8.0 | architect | `docs/architecture/backup.md` | Condición de parada (`expo-asset` para F8.11) resuelta por el orquestador: enmienda de ADR-016, instalado ~58.0.21. ADR-012 enmendado. `large.zip` no se versiona (se genera). Preguntas → D-44. Instalados `expo-sharing`, `expo-document-picker`. |
| 2026-11-13 | F5.2 | code-writer | jest 206 suites / 2066 tests (maxWorkers=3) · test:tz ok · lint/typecheck limpios en tracking | `monthGridRange` agregado; intensidad 1–3 con bordes probados; racha en cambio de semana con FakeClock. |
| 2026-11-13 | F5.3 | code-writer | ídem | `/tracking/day/[date]`, `/sales/new?date=` (initialSoldOn). Botones 'no vendí' con texto largo (ButtonBase sin etiqueta accesible propia). Timeouts de 5 s bajo carga: el orquestador fija `maxWorkers: '50%'` y `testTimeout: 15000` en jest.config. |
| 2026-11-13 | F6.5 | code-writer | jest 208 suites / 2087 tests (maxWorkers=3) · test:tz ok · sin errores en tips | Tarjeta después de la venta (vista al mostrarse, X, foco a 'Listo'), solo en ventas nuevas. |
| 2026-11-13 | F6.6 | code-writer | ídem · 6 tests de ruta | El agente revirtió por error cambios de app.json (bloqueo c2dm, plugins expo-sharing/expo-asset); restaurados por el orquestador y regla agregada en CLAUDE.md. |
| 2026-11-13 | F7.1 | designer | `docs/design/notifications.md` (~590 textos sin patrones de culpa) | Preguntas → D-45. El PNG del ícono de notificación (96×96 blanco) se genera en F7.4. |
| 2026-11-13 | F8.1 | designer | `docs/design/backup.md` | `prepareRestore` devuelve un código propio para la copia de emergencia (decisión del orquestador, en vez de detectar por nombre). Componentes: SwitchRow, ProgressBlock, InlineNotice.tone, usePreventLeave. Íconos de lanzador/adaptiveIcon de plantilla: resolver en F10. |
| 2026-11-13 | F5.4 | reviewer | 'F4+F5 aprobados': 0 críticos, 0 importantes, 9 menores · jest 221 suites / 2345 tests · test:tz ok · lint/typecheck limpios en lo revisado | Cubre también F4.3–F4.5. Menores (un solo proveedor de 'hoy', guard de doble toque, etiqueta accesible en ButtonBase, archivado falso, Thumbnail como función, regla de navegación en dominio, test de listas virtualizadas, a11y iOS de relleno, doble anuncio) → lote de pulido antes de F10. |
| 2026-11-13 | F5.5 / CP6 | code-writer | `[~]` 3 flujos Maestro de calendario escritos; sin ejecutar | CP6 registrado. |
| 2026-11-13 | F6.7 | reviewer | 'F6 aprobado': 3 importantes (padding del encabezado, Volver sin historial, dependencia tips→sales) + 10 menores | Dependencia tips→sales aceptada en ADR-005; el resto se corrige ahora. |
| 2026-11-13 | F7.2 | code-writer | typecheck 0 · format ok · test:tz ok (3 zonas) · D-13 probado en ~1.200 combinaciones · nunca >64 pendientes | `expo-weekday.ts` → `to-expo-weekday.ts` por el lint de dominio. |
| 2026-11-13 | F7.3 | code-writer | V-DB sin cambios · contrato Drizzle + doble | Fila inválida → valores por defecto + log. Implementado sin correr el rojo por separado (desvío TDD, para el reviewer F7.9). |
| 2026-11-13 | F8.2 | code-writer | typecheck 0 · format ok · jest 224 suites / 2379 tests · test:tz ok · lint limpio en backup | CSV con BOM, `;`, CRLF, prefijo contra fórmulas. `productListSortKey` exportado de products. |
| 2026-11-13 | F8.3 | code-writer | ídem · fixtures adversariales para todos los códigos de rechazo (traversal, comprimidas, duplicadas, solapes, bytes escondidos, segundo EOCD, ZIP64, cifrado, zip bomb) · PK dentro de JPEG se lee bien | ZIP de herramienta estándar generado con `zipfile` de Python (no hay `zip`). Fixtures v1 congelados. Parte de utf8/formato/reader escrita junto con sus tests (desvío TDD, para el reviewer F8.9). |
| 2026-11-13 | F6.7 (correcciones) | code-writer | V-BASE ok · jest 224 suites / 2386 tests · test:tz ok | Encabezado fuera del SectionList; Volver sin historial → `/tips`; patrones de culpa ampliados (aún no, no has, dejaste de, te falta, hace … que no) con normalización sin tildes: ningún texto real los activa. `listAll` descarta filas inválidas con log. |
| 2026-11-13 | F6.8 / CP7 | code-writer | `[~]` 4 flujos Maestro de consejos escritos; sin ejecutar | CP7a y CP7 registrados. |
| 2026-11-13 | F5.4 (pulido de menores) | code-writer | jest tracking 242 tests · test:tz ok · sin errores propios | Un solo `TodayProvider` (un timer y un listener para toda la app); `ButtonBase.accessibilityLabel`; reglas de navegación del calendario en dominio; test de re-render de una sola celda. RNTL 14 no tiene `UNSAFE_*`. |
| 2026-11-13 | F7.4 | code-writer | V-BASE completo (orquestador): typecheck 0 · lint 0 · prettier ok · jest 266 suites / 2773 tests · test:tz ok · doctor 20/20 | Plugin expo-notifications en app.json (sin quitar nada). Ícono 96×96 generado con `tools/assets/generate-notification-icon.py`. AAR declara solo RECEIVE_BOOT_COMPLETED y POST_NOTIFICATIONS; WAKE_LOCK no se bloquea (permiso normal, riesgo de SecurityException): revisar en el manifiesto fusionado cuando haya entorno. |
| 2026-11-13 | F7.5 | code-writer | ídem | Cola serializada probada con scheduler lento; disparadores por tablas, primer plano y permiso. |
| 2026-11-13 | F7.6 | code-writer | ídem | Dedupe id@fecha; espera navegación lista. `clearLastNotificationResponse` síncrono (la versión async está deprecada). |
| 2026-11-13 | F7.7 | code-writer | ídem | `/settings/notifications`; SwitchRow, InlineNotice.tone, ListRow.trailing. |
| 2026-11-13 | F7.8 | code-writer | ídem | Explicación solo tras 'Listo' en la primera venta con permiso sin decidir. 10 flujos Maestro ajenos ahora cierran la explicación. Mock global de expo-notifications en jest.setup. Algunos adaptadores escritos junto con sus tests (desvío TDD, para F7.9). |
| 2026-11-13 | F8.4 | code-writer | ídem | Adaptadores de archivo/compartir; `PhotoStorage.partialUriFor`/`promotePartial`; `isCacheUri` en core/files. |
| 2026-11-13 | F8.5 | code-writer | ídem | Exportación de respaldo con lock, sha desde disco, foto sin archivo exportada como borrada. CSV. Se verifica 'compartir disponible' antes de escribir. |
| 2026-11-13 | F8.8 | code-writer | ídem | Exportación de emergencia desde la pantalla de error (`backupDatabaseAsync` con copia cruda de respaldo); el lector de restauración la rechaza a propósito. Ruta sin `file://` verificada solo en Android. |
| 2026-11-14 | F7.9 | reviewer + code-writer | Revisión: 1 crítico (la cola podía correr dos reconciliaciones a la vez, reproducido) + 2 importantes (doble aviso al cambiar de día a mitad de semana; doble toque en Activar) + 8 menores, corregidos · V-BASE completo (orquestador): typecheck 0 · lint 0 · prettier ok · jest 274 suites / 2893 tests · V-DB sin cambios · test:tz ok | D-13 se cumple siempre: columna `last_weekly_fire_at` con **migración 0001** (con test de datos previos). Enmiendas en ADR-007 y ADR-011. |
| 2026-11-14 | F7.10 / CP8 | code-writer | `[~]` 4 flujos Maestro de notificaciones escritos (requieren Android 13+); sin ejecutar. La migración 0001 exige V-E2E-UPG al cierre (pendiente de entorno) | CP8 registrado. |
| 2026-11-14 | F8.6 | code-writer | V-BASE completo (orquestador): typecheck 0 · lint 0 · prettier ok · jest 274 suites / 2893 tests · V-DB sin cambios | Restauración validada (contenido, entradas = manifest, CRC/sha, esquema, integridad, fotos), respaldo de seguridad previo (D-22), fotos a `.part` con sha antes del commit, reemplazo en una transacción sin tocar preferencias. Código `emergency_backup`. Decisión del orquestador: agregar código `current_data_too_large` (en F8.7) en vez de lanzar si el respaldo de seguridad excede los límites. |
| 2026-11-14 | F8.11 | code-writer | V-BASE completo (orquestador): typecheck 0 · lint 0 · prettier ok · jest 274 suites / 2893 tests · V-DB sin cambios · bundle release sin zips ni textos de la semilla (verificado) | `basic.zip` versionado; `large.zip` generado con `npm run e2e:fixtures` e ignorado. Falta un test que restaure `basic.zip` por el flujo real: se agrega en F8.7. |
| 2026-11-14 | F9.0 | architect + designer | `docs/architecture/settings.md`, ADR-018 (licencias, aceptado por el orquestador), `docs/design/settings.md` (textos sin patrones de culpa) | D-46. ADR-013 enmendado (no-restricted-globals fetch/XHR/WebSocket). Preguntas del designer aceptadas: `CardListItem`/`CardListSeparator` a shared/ui; 'Apagados' tiene prioridad en `summarizeReminders`. F9.1 espera a que cierre F8.7 (comparten la pantalla de Ajustes). |
| 2026-11-14 | F10.0 | architect | `docs/architecture/performance-budgets.md` · medido aquí: `.hbc` release 7.879.806 B (umbral 9.000.000) · CRC32 48,5 MiB ≈ 5 s con `--jitless` en Node | Riesgo: exportar/restaurar `large` por CRC32 en JS. Decisiones del orquestador: umbrales aceptados como provisionales (aprobación final del usuario en CP11); marcas internas aprobadas (enmienda ADR-013); en F10.2 se aplican ya el bucle por índice del CRC32, ceder la UI entre bloques y las fuentes por subruta (~390 KB); 50 MP en Android 7 y APK se deciden con medición en el teléfono. Recomendado teléfono físico de 2 GB para DT-17. |
| 2026-11-14 | F8.7 | code-writer | typecheck 0 · lint 0 · prettier ok · jest 292 suites / 3082 tests · test:tz ok | Pantalla Respaldo completa; `current_data_too_large`; test que restaura `basic.zip` por el flujo real (5 productos, 2 fotos). `DocumentPicker` puerto y adaptador; `BackupFiles.restoreCopyTarget`. Un fallo intermitente no identificado en una corrida de `npm test` (pasa en las siguientes): vigilar en F10.5. Algunos tests escritos junto con su código (desvío TDD, para F8.9). |
| 2026-11-14 | F9.1 | code-writer | typecheck 0 · lint 0 (con no-restricted-globals) · prettier ok · jest 313 suites / 3327 tests · test:tz ok · licenses:check ok (81 paquetes) | `CardListItem` en shared/ui; resúmenes de Recordatorios/Respaldo; licencias generadas con test de frescura. Excepción `metro-runtime` con texto de react-native y copyright de `standard-navigation` sin verificar en la web: para el reviewer F9.2. Algunos tests escritos junto con su código (desvío TDD). |
| 2026-11-14 | F8.9 | reviewer + code-writer | 'F8 aprobado': 0 críticos, 1 importante (doble toque en restaurar) + 11 menores, corregidos · typecheck 0 · lint 0 · prettier ok · jest 313 suites / 3327 tests · test:tz ok · bundle release sin fixtures (verificado) | CRC32 sin JIT 4,3 s → 3,1 s (48,5 MiB, escritorio). `inconsistent_data`, `countActive`, `clearEmergencyDirectory`; backup.md actualizado por el orquestador. |
| 2026-11-14 | F8.10 / CP9 | code-writer | `[~]` 4 flujos Maestro de respaldo escritos; medición de exportar/restaurar `large` en el teléfono pendiente de entorno | CP9 registrado. |
| 2026-11-14 | F9.2 (correcciones) | code-writer | lint 0 · test:tz ok · licenses:check ok (81) · introspect `allowBackup=false` · tests propios en verde | Decisión del orquestador: `android.allowBackup=false` (la nota de privacidad era falsa con Auto Backup) + test de configuración; enmienda ADR-016. Regla de red endurecida (globalThis/global/window/self, computado, desestructuración, URLs, `Linking.openURL`); enmienda ADR-013. Párrafos de Apache legibles; parser SPDX estricto; Apache canónico. V-BASE completo pendiente de las correcciones de accesibilidad en curso. |
| 2026-11-14 | F10.2 | code-writer | `[~]` parte local hecha: assets 729.914 → 337.166 B (Lexend por subruta), `.hbc` 8.004.770 B (≤ 9 MB) · EXPLAIN QUERY PLAN sobre `large`: sin SCAN completo de sale_records/sale_items (sin migración 0002) · marcas `perfMark` solo en build e2e (verificado con expo export) · 4 flujos Maestro de medición + `tools/perf/parse-marks.js` | Mediciones P1–P7 en dispositivo pendientes del usuario (Android Studio). |
| 2026-11-14 | F9.2 | reviewer + code-writer | V-BASE completo (reviewer, subagente): typecheck 0 · lint 0 · prettier ok · jest 322 suites / 3493 tests · test:tz ok (3 zonas) · V-DB sin cambios · licenses:check ok (81) · doctor 20/20 | 2 bloqueantes (allowBackup, evasión de la regla de red) + 2 importantes + 8 menores corregidos. |
| 2026-11-14 | F9.3 / CP10 | code-writer | `[~]` 3 flujos Maestro de Ajustes escritos; sin ejecutar | CP10 registrado. |
| 2026-11-14 | F10.1 | designer + code-writer | `[~]` auditoría (26 hallazgos) y correcciones de los 5 altos, 12 medios y bajos de código, con tests · V-BASE completo (reviewer, subagente): typecheck 0 · lint 0 · prettier ok · jest 322 suites / 3493 tests · test:tz ok (3 zonas) · V-DB sin cambios · licenses:check ok (81) · doctor 20/20 | Decisiones: toast oculto al lector + announce único; ConfirmDialog sobre Modal de RN; pestañas en 2 líneas a 1,3×. Recorrido con TalkBack (sección 6 de `docs/design/accessibility-audit.md`) pendiente del usuario. El foco no vuelve al botón que abrió el diálogo (anotado). |
| 2026-11-14 | F10.4 | reviewer + code-writer | `[~]` sin secretos (archivos e historial); 3 importantes corregidos: INTERNET quitado del release (plugin), exclusión de cloud-backup y device-transfer (plugin `dataExtractionRules` + `fullBackupContent`), regla de red ampliada (`expo/fetch`, descargas de expo-file-system); ATS e `bundleIdentifier` de iOS · typecheck 0 · lint 0 · prettier ok · jest 324 suites / 3521 tests | Pendiente de entorno: `aapt dump permissions` del APK e2e (manifiesto fusionado, WAKE_LOCK). Enmiendas ADR-013 y ADR-016. |
| 2026-11-14 | F10.5 | — | `[~]` regresión E2E completa pendiente: el usuario la hará con Android Studio | Entorno instalado (SDK, NDK, CMake, Maestro 2.12.1, AVD API 34); el usuario pidió no correr E2E en el emulador. |
| 2026-11-14 | F10.6 | usuario | `[~]` prueba en el teléfono pendiente del usuario | — |
| 2026-11-15 | F10.7 (gate local, 1ª pasada) | reviewer | typecheck 0 · lint 0 · prettier ok · jest 324 suites / 3521 tests · test:tz ok · V-DB sin cambios · licenses ok (81) · doctor 20/20 · audit sin altas/críticas · `.hbc` 8.011.391 B · bundle sin textos E2E (26 buscados, UTF-8 y UTF-16) | 4 importantes (prebuild en scripts, `check-jpeg-metadata`, `upgrade-verify` sin datos, miniaturas UX-F7) en corrección. DT-10/11/13/16 cumplidos; el resto `[~]` pendiente del usuario. Íconos de lanzador y splash: fuera de alcance v1 (sección 10). Guía: `docs/v1-pendiente-usuario.md`. |
| 2026-11-15 | F10.7 (gate local, cierre) / CP11 | code-writer + orquestador | typecheck 0 · lint 0 · prettier ok · jest 326 suites / 3548 tests · test:tz ok · licenses ok (81) | 4 importantes del gate cerrados: prebuild automático en `android`/`android:release`/`e2e:build` (con test); `tools/photos/check-jpeg-metadata.mjs` (11 tests); `upgrade-seed` + `upgrade-verify` con datos; miniaturas en Productos y Archivados. DT-14 cumplido. **v1 lista localmente; `[~]` pendiente de verificación en dispositivo por el usuario** (guía `docs/v1-pendiente-usuario.md`) y aprobación final CP12. |
| 2026-11-15 | F10.5 (emulador) | code-writer | `[~]` maestro 38/38 flujos en `cuantovendi_api34` (+ `release-has-no-e2e` OK en release limpio) · 3 bugs de la app corregidos con test (SafeAreaView sin estilos en Android, `toSorted` ausente en Hermes, permiso de notificaciones nunca "undetermined" en Android) · flujos YAML ajustados a la UI real | V-E2E-UPG (actualización) no ejecutado: el build `ef90f82` tiene el bug de SafeAreaView (Productos en blanco) y no permite cargar datos por la UI. Pendiente del usuario: teléfono, TalkBack, notificaciones reales. |
