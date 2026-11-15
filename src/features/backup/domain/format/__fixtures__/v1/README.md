# Fixtures congeladas de la versión 1

Son el contrato de lectura del formato v1. Se generaron una vez y **no se regeneran** jamás: si el formato cambia, se agrega una carpeta `v2/` y estos se siguen leyendo.

- `valid.zip`: respaldo completo (archivados, borrados lógicos, una foto activa con firmas `PK` en sus datos, una foto borrada sin archivo).
- `tampered.zip`: un byte de `data.json` cambiado ("Taza" por "Uaza"); el CRC32 del ZIP es correcto pero el `sha256` del manifiesto no coincide.
- `future-format.zip`: el manifiesto con `formatVersion: 2`.

Los generó el escritor propio (`writeStoredArchive`) con `richSnapshot()` de `testing/snapshot-fixtures.ts`, la fecha `1_790_000_000_000` y `appVersion` `1.0.0`.
