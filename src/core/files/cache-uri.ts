import { Paths } from 'expo-file-system';

/**
 * Decodifica el URI una vez, como lo haría el sistema de archivos, y busca un segmento `..`.
 * Un URI que no se puede decodificar se trata como una escalada.
 */
function hasParentSegment(uri: string): boolean {
  try {
    return decodeURIComponent(uri)
      .split(/[/\\]/)
      .some((segment) => segment === '..');
  } catch {
    return true;
  }
}

/**
 * Indica si `uri` es un archivo dentro de `Paths.cache`. Rechaza otros esquemas, el propio
 * directorio y cualquier ruta con `..`, para que nunca se borre algo fuera de la caché.
 */
export function isCacheUri(uri: string): boolean {
  const cache = `${Paths.cache.uri.replace(/\/+$/, '')}/`;
  return uri.length > cache.length && uri.startsWith(cache) && !hasParentSegment(uri);
}

/**
 * Devuelve el esquema de `uri` en minúsculas (`file`, `content`...) o `unknown`. Es lo único
 * de un URI que se puede registrar: el resto puede incluir nombres de archivos del usuario.
 */
export function uriScheme(uri: string): string {
  return /^([a-z][a-z0-9+.-]*):/i.exec(uri)?.[1]?.toLowerCase() ?? 'unknown';
}
