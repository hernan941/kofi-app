/** Comparación de textos por unidades de código, estable entre motores (ids y fechas ISO). */
export function compareText(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
