# ADR-021: Nombre del producto Kofi e identificadores internos

- **Estado**: Aceptado (2026-11-24)
- **Relacionados**: ADR-006 (persistencia local), ADR-012 (respaldo y exportación), ADR-016 (identificadores y builds locales).

## Contexto
La app pasa a llamarse **Kofi**. Se escribe siempre con mayúscula inicial en todo texto visible, también al empezar una frase; esto reemplaza la regla de `docs/design/settings.md` de escribir "cuantovendi" en minúscula. El ícono de la app es un gato tuxedo sobrio; su diseño está en `docs/design-system.md`. El consejo "cuánto vendiste" es lenguaje normal y no cambia.

## Decisión
1. **Cambia lo que ve o comparte el usuario**: `expo.name` y el texto del permiso de cámara en `app.json`; los textos de la interfaz (Ajustes, respaldo, permisos de avisos y de cámara); los nombres de los archivos que se comparten: `kofi-respaldo-AAAA-MM-DD.zip` y `kofi-emergencia-AAAA-MM-DD.zip`; los flujos de Maestro que afirman esos textos; y la documentación.
2. **Compatibilidad con archivos anteriores**: los respaldos `cuantovendi-respaldo-AAAA-MM-DD.zip` siguen reconociéndose (`isExportFileName` acepta ambos prefijos). La restauración valida el contenido (`manifest.json`), no el nombre, así que restaura cualquier respaldo válido. El mensaje de "no es un respaldo" nombra el prefijo nuevo y el anterior.
3. **No cambian (identificadores internos)**:
   - `android.package` e `ios.bundleIdentifier` `com.cuantovendi.local`: cambiarlos crearía otra app en el teléfono y se perderían los datos (ADR-016).
   - `slug` y `scheme` `cuantovendi` (los enlaces `cuantovendi://e2e/**` del build E2E), y el `name` de `package.json`.
   - `cuantovendi.db` y las copias `cuantovendi-<epochMs>.db` de la exportación de emergencia: la base ya existe en los teléfonos y el nombre queda dentro del ZIP.
   - El formato `cuantovendi-backup` del manifiesto y el `kind` `cuantovendi-emergency` de `info.json`: forman parte del formato de archivo y los respaldos antiguos deben seguir siendo válidos.
   - `cuantovendi-seguridad-*.zip` (carpeta interna `safety` en documentos de la app) y `cuantovendi-copia-de-seguridad.zip` (copia temporal en caché): verificado, el usuario nunca los ve ni los comparte.
   - `NAMESPACE_CUANTOVENDI` (los ids deterministas v5 dependen de él), el nombre del AVD `cuantovendi_api34`, los APK guardados `cuantovendi-*-e2e.apk`, la carpeta del repositorio y los fixtures binarios de Maestro.
4. Los ADR aceptados y el registro histórico del plan no se reescriben.
5. Esto resuelve el nombre visible, el ícono y el splash que ADR-016 dejaba pendientes en "Futuro"; los identificadores definitivos (`android.package`, `ios.bundleIdentifier`) siguen pendientes.
