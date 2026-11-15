/** Claves de consulta de la feature; ninguna depende de una tabla (viven en archivos). */
export const backupKeys = {
  latestSafety: () => ['backup-latest-safety'] as const,
};
