# ADR-006: Persistencia local preparada para sincronización

- **Estado**: Aceptado
- **Fecha**: 2026-11-12 (revisado 2026-11-13 tras la revisión del reviewer)
- **Versiones verificadas (npm y código fuente, 2026-11-13)**:
  - Persistencia: `expo-sqlite` ~58.0.17 (SDK 58), `drizzle-orm` 0.45.4 (`latest`; la 1.0 está en `rc` 1.0.0-rc.5), `drizzle-kit` 0.31.11.
  - Tests: `better-sqlite3` 13.1.1, que exige Node ≥22 y compila con `SQLITE_DEFAULT_FOREIGN_KEYS=1` y `SQLITE_DQS=0` según su `docs/compilation.md`.
  - Ids: `uuid` 14.0.3, con `v7({ msecs, random })` y `v5` en JS puro.
  - Alternativas revisadas: `@nozbe/watermelondb` 0.28.0 (última versión 2025-04-07, último commit 2025-08), `@powersync/react-native` 2.4.1 (usa `@op-engineering/op-sqlite`), `tinybase` 10.1.0, `@op-engineering/op-sqlite` 19.0.5.
- **Comportamiento verificado en el código de `drizzle-orm` 0.45.4**:
  - `SQLiteSyncDialect.migrate` ejecuta **todas** las migraciones pendientes dentro de un único `BEGIN … COMMIT`.
  - `drizzle-orm/expo-sqlite/migrator` recibe `{ journal, migrations }` empaquetados (`migrations.js` con los `.sql` importados inline) y no lee la carpeta.
  - La aplicación de una migración se decide comparando `created_at` (`folderMillis` del journal) contra la última aplicada.

## Contexto
- Al principio todos los datos viven en el teléfono. La arquitectura tiene que permitir sincronizar con un backend **sin reescribir**.
- Los datos son relacionales y con reglas de integridad (ADR-007). El volumen es bajo.
- El dinero es CLP sin decimales.
- Exigencias: TDD (repositorios testeados en Jest, ADR-002), New Architecture y development builds (ADR-001).

## Opciones consideradas

| Opción | Pros | Contras |
|---|---|---|
| **expo-sqlite sin ORM** | Módulo oficial, cero dependencias, SQL bajo control total. | Tipos de fila y mapeos a mano, que se pueden desincronizar del esquema; migraciones manuales. |
| **expo-sqlite + Drizzle ORM** | El esquema en TS es la única fuente de los tipos de fila. Consultas tipadas, migraciones SQL generadas y versionables, `CHECK` y FK declarativos. Las mismas consultas corren en Jest sobre `better-sqlite3`. Hay drivers para op-sqlite y PowerSync. | La línea estable es 0.x y la 1.0 está en RC. Requiere configurar Babel y Metro. El migrador tiene limitaciones (ver abajo). |
| **expo-sqlite + Kysely** | Query builder maduro. | No genera migraciones a partir del esquema; tipos a mano. |
| **op-sqlite / nitro-sqlite** | Más rendimiento. | Mantenidos por terceros; el rendimiento extra no se necesita con este volumen. |
| **WatermelonDB** | Trae sincronización incluida. | Sin releases desde abril de 2025. **Descartada por mantenimiento.** |
| **PowerSync** (local-only ahora) | Local-first real y mantenido. | Esquema sobre vistas JSON, sin FK ni `CHECK`. Compromete el backend antes de tiempo. |
| **TinyBase** | Reactividad y CRDT. | Todo en memoria; sin integridad relacional declarativa. |
| **Realm / MMKV / AsyncStorage** | — | Realm está deprecado; MMKV y AsyncStorage no son bases de datos. |

## Decisión
**`expo-sqlite` + Drizzle ORM (estable 0.45.x)**, con convenciones *sync-ready* y todo el acceso detrás de repositorios. El motor de sincronización se decide en un ADR futuro.

### Apertura y configuración (una sola función para app y tests)
`core/db/open.ts` expone `configureConnection(raw)`, que **la app y los tests llaman igual**:
- `PRAGMA journal_mode = WAL` (en memoria no aplica, y se ignora).
- `PRAGMA foreign_keys = ON`, verificado con una lectura posterior; si no devuelve `1`, la función lanza un error.
- `PRAGMA trusted_schema = OFF`.

No se confía en los valores por defecto del motor: `better-sqlite3` trae las FK activadas por compilación y `expo-sqlite` no. Si el código dependiera de esos defaults, los tests podrían pasar y la app fallar. El helper de test verifica `PRAGMA foreign_keys` = 1 después de abrir.

Además:
- `DQS=0` en `better-sqlite3` rechaza literales con comillas dobles, que expo-sqlite acepta. **En SQL escrito a mano los literales van siempre con comillas simples**, para que ambos motores se comporten igual.
- No se usa `withExclusiveTransactionAsync`, porque abre otra conexión que no hereda los PRAGMAs.
- Solo se usa el query builder básico de Drizzle, nunca la API relacional `db.query`, que cambia en la 1.0.
- Sin SQLCipher. Ambos sistemas cifran el almacenamiento, los datos no son credenciales, y una clave perdida significaría perder todos los datos.

### Migraciones
- `drizzle-kit generate` produce `src/core/db/migrations/` (SQL + `meta/_journal.json` + `migrations.js`). Se versionan, **nunca se editan una vez publicadas** y solo avanzan.
- **`configureAndMigrate(raw, db, bundle)`** es la única forma de migrar, en la app y en los tests:
  1. `PRAGMA foreign_keys = OFF`, **fuera** de toda transacción, porque dentro no tiene efecto. Esto es necesario porque Drizzle corre todas las migraciones dentro de un `BEGIN … COMMIT`: si las FK siguieran activas, recrear o borrar una tabla padre con `ON DELETE RESTRICT` fallaría.
  2. `migrate(db, bundle)`.
  3. `PRAGMA foreign_key_check`. Si devuelve filas, aborta: la migración dejó referencias rotas. Como el commit ya ocurrió, se muestra la pantalla de error con exportación de emergencia y no se permite escribir.
  4. `PRAGMA foreign_keys = ON`, verificado.
- **En la app** se pasa el bundle `migrations.js` al migrador de Expo. **En los tests** se pasa el mismo `_journal.json` y los mismos `.sql`, leídos del disco con un helper (`loadMigrationBundle(folder)`) que construye `{ journal, migrations }` con la misma forma que `migrations.js`. Ambos usan `drizzle-orm/expo-sqlite/migrator`, que solo depende de `db.dialect`, sobre una base `better-sqlite3`. Así **se ejercita el mismo migrador y el mismo formato que en la app**. Si en la implementación esto no compila por tipos, se usa `dialect.migrate` directamente con el mismo bundle; nunca el migrador por carpeta.
- **Test por migración N-1 → N**: se construye un bundle **recortado** del journal hasta N-1, se migra, se insertan datos y después se migra con el bundle completo. Es necesario porque Drizzle decide qué aplicar comparando `folderMillis` con la última aplicada.
- **Revisión manual obligatoria** de cada migración generada; si recrea tablas, su test N-1 → N incluye datos en tablas hijas.
- **Base más nueva que el código** (v1): si al arrancar la base tiene más migraciones aplicadas que las que conoce el código (por ejemplo, tras instalar a mano un build anterior), la app no escribe: muestra "actualiza la app" y ofrece la exportación de emergencia.
- **Futuro, fuera de la v1 (para cuando haya un release)**: la v1 no se publica ni usa EAS Update. Si se adopta EAS Update, las migraciones **solo deben viajar en builds nativos**: el `runtimeVersion` incluye la versión de esquema (cantidad de entradas del journal, calculada en `app.config.ts`). Así un OTA nunca trae ni revierte una migración. La política completa de updates y rollback va en ADR-016 (pendiente).
- **Exportación de emergencia** (si falla la migración o la base es más nueva): `backupDatabaseAsync` a un archivo `.db` nuevo, más la carpeta `photos/`, empaquetados con el escritor STORED de ADR-012 y compartidos. No depende del mapeo de dominio de la versión N, porque es una copia cruda. Restaurar ese archivo no se soporta en la app v1: sirve para soporte y recuperación manual.

### Transacciones (`runInTransaction`)
- **Es síncrona** (el driver de Expo para Drizzle es síncrono). El bloque no puede usar `await`, y la UI no se repinta mientras corre.
- **Si se anida**, la llamada interna se une a la transacción externa (no hay savepoints), y **solo la externa emite `DataChanges`** después del commit (ADR-009).
- Las operaciones largas (restaurar) informan su progreso **por fases** fuera de la transacción: validar, copiar fotos, aplicar datos (un único paso síncrono) y finalizar. No hay progreso dentro del commit.
- Los repositorios **solo escriben a través de `runInTransaction`**; reciben esa función y la base para leer, nunca el cliente crudo.

```ts
/**
 * Base de datos Drizzle tipada con el esquema de la app.
 * La satisfacen el driver `expo-sqlite` (app) y `better-sqlite3` (tests en Node).
 */
export type AppDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/** Registro de las tablas modificadas dentro de una transacción. */
export interface TouchedTables {
  add(table: TableName): void;
}

/**
 * Ejecuta un bloque síncrono en una transacción. Si ya hay una transacción
 * en curso, se une a ella. Solo la transacción externa emite `DataChanges`,
 * y lo hace después del commit.
 *
 * @param work - Bloque síncrono que recibe la transacción y registra las tablas que toca.
 * @returns El valor que devuelve el bloque.
 * @throws Re-lanza el error del bloque después del rollback.
 */
export type RunInTransaction = <T>(work: (tx: AppDatabase, touched: TouchedTables) => T) => T;
```

### Convenciones sync-ready (tablas de entidades)
1. **PK `id TEXT` con UUIDv7** generado en el cliente con `IdGenerator`. La implementación real es `v7({ msecs: clock.now(), random: getRandomBytes(16) })` con `uuid` + `expo-crypto`, sin depender de `crypto.getRandomValues` global. Los UUIDv7 se ordenan por tiempo, lo que mejora la localidad del índice y deja un orden estable para sync. Para ids **deterministas** (ADR-007, semanas "no vendí") se usa `v5(clave, NAMESPACE_CUANTOVENDI)`. Sin `AUTOINCREMENT` ni dependencia del `rowid`.
2. **`created_at` y `updated_at`** como `INTEGER` en milisegundos epoch UTC, asignados por el repositorio con `Clock`.
3. **Borrado lógico con `deleted_at`**. No hay `DELETE` físico ni cascadas; las FK son `ON DELETE RESTRICT`. Archivar es otro concepto, de negocio.
4. **Enumeraciones** como `TEXT` con códigos estables en inglés y `CHECK (x IN (...))`.
5. **Dinero** como `INTEGER` CLP con `CHECK (x BETWEEN 0 AND 999999999)`.
6. **Fechas de negocio** como `TEXT` `YYYY-MM-DD` (ADR-015).
7. **Sin agregados almacenados.**
8. **Valores históricos copiados** donde corresponde (precio del ítem).
9. **Tablas propias del dispositivo** (preferencias de notificación) no sincronizables; las excepciones se documentan en ADR-007.
10. **Toda escritura pasa por `runInTransaction`**: es el lugar donde más adelante se agregará un *outbox*.
11. **No se agregan columnas de sync ahora** (YAGNI).

### Excepción explícita: restauración de respaldo
La restauración (ADR-012) es **la única operación que borra filas físicamente**:
- Lo hace dentro de una sola `runInTransaction`, con un orden fijo de hijos a padres: `sale_items`, `sale_records`, `no_sales_weeks`, `product_photos`, `product_versions`, `products`, `tip_views`.
- Después inserta de padres a hijos.
- No toca `notification_preferences` ni `__drizzle_migrations`.

Cuando exista sincronización, este reemplazo físico **no puede convivir con un outbox** tal cual: el ADR de sync tiene que decidir si la restauración se deshabilita con una cuenta activa, si se convierte en tombstones más upserts, o si se reinicia el estado de sync. Queda anotado como restricción para ese ADR.

### Tests
- **Dominio**: Jest puro.
- **Repositorios**: Jest (proyecto `node`, ADR-013) con `better-sqlite3` en `:memory:`, abierto con `configureConnection` y migrado con `configureAndMigrate`, exactamente como la app. **Requiere Node ≥22** (queda en `engines` del `package.json` y en `.nvmrc`).
- **E2E de base** al cerrar la primera feature con datos, en un build real:
  - instalación nueva;
  - actualización desde el build anterior con datos cargados.

  Cubre las diferencias de motor que Jest no ve.

## Consecuencias
- Los tipos de fila salen del esquema y los de dominio se definen una sola vez (ADR-007).
- Hay una sola función de apertura y una sola de migración, compartidas por la app y los tests. Así se reduce el riesgo de que los tests pasen con otro comportamiento.
- El driver síncrono bloquea el hilo de JS mientras dura cada transacción. Con este volumen son milisegundos; la restauración se hace por fases.
- Pasar a Drizzle 1.0 requiere un ADR de actualización, con impacto acotado.
- Cuando haya release con EAS Update, que las migraciones solo viajen en builds nativos le quitará flexibilidad a los OTA, a cambio de evitar un rollback de código sobre una base ya migrada.
- Configuración: `babel-plugin-inline-import` (`.sql`) y `sourceExts.push('sql')` en `metro.config.js`, que ya usa `withUniwindConfig`; la extensión se agrega antes de envolver la configuración.
