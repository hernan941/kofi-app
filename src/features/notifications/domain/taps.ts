/** Cuántas claves de toques recuerda el deduplicador por defecto. */
export const DEFAULT_TAP_MEMORY = 20;

/** Recuerda las últimas claves de toques procesados. */
export interface TapDeduplicator {
  /** `true` la primera vez que ve la clave y la recuerda; `false` si ya la había visto. */
  isNew(key: string): boolean;
}

/**
 * Deduplicador puro de toques (ADR-011, enmienda): la clave es `request.identifier` más la
 * fecha de entrega, porque el `WEEKLY` repite el identificador cada semana. Olvida las claves
 * más viejas al pasar `limit`.
 */
export function createTapDeduplicator(limit: number = DEFAULT_TAP_MEMORY): TapDeduplicator {
  const seen = new Set<string>();
  return {
    isNew: (key) => {
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      if (seen.size > limit) {
        const oldest = seen.values().next();
        if (oldest.done !== true) {
          seen.delete(oldest.value);
        }
      }
      return true;
    },
  };
}
