const MAX_NAME_BYTES = 255;
const FIRST_PRINTABLE = 0x20;
const LAST_PRINTABLE = 0x7e;
const BACKUP_NAME_PATTERN =
  /^(manifest\.json|data\.json|photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg)$/;

function isPrintableAscii(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < FIRST_PRINTABLE || code > LAST_PRINTABLE) {
      return false;
    }
  }
  return true;
}

/** Lista blanca de la restauración: `manifest.json`, `data.json` y `photos/<uuid en minúsculas>.jpg`. */
export function isBackupEntryName(name: string): boolean {
  return BACKUP_NAME_PATTERN.test(name);
}

/**
 * Nombres que el escritor acepta: ASCII imprimible de 1 a 255 bytes, sin `\`, sin `:`, sin `/`
 * inicial y sin segmentos vacíos ni `..`. Más amplio que la lista blanca de la restauración.
 */
export function isSafeEntryName(name: string): boolean {
  if (name.length === 0 || name.length > MAX_NAME_BYTES || !isPrintableAscii(name)) {
    return false;
  }
  if (name.includes('\\') || name.includes(':') || name.startsWith('/')) {
    return false;
  }
  return name.split('/').every((segment) => segment !== '' && segment !== '..');
}

/** `true` si los bytes del nombre son de 1 a 255 caracteres ASCII imprimibles. */
export function isPrintableAsciiName(bytes: Uint8Array): boolean {
  if (bytes.length === 0 || bytes.length > MAX_NAME_BYTES) {
    return false;
  }
  return bytes.every((byte) => byte >= FIRST_PRINTABLE && byte <= LAST_PRINTABLE);
}

/** Clave para detectar nombres repetidos sin distinguir mayúsculas. */
export function entryNameKey(name: string): string {
  return name.toLowerCase();
}
