# ADR-003: Comentarios solo como docstrings TSDoc

- **Estado**: Aceptado
- **Fecha**: 2026-11-12

## Contexto
Los comentarios inline tienden a desactualizarse y a describir el "qué" en lugar del "porqué". Se quiere documentación consistente y visible desde el editor (el LSP muestra los docstrings al pasar el cursor).

## Decisión
- Los comentarios van **siempre como docstrings TSDoc/JSDoc (`/** ... */`)**, sobre la declaración que documentan: función, componente, hook, tipo, constante o módulo.
- **Prohibidos los comentarios inline**: ni `//` al final de una línea ni `//` sueltos dentro del cuerpo de una función.
- Si un bloque necesita explicación, se extrae a una función con nombre claro y se documenta con su docstring.
- El docstring explica el **porqué** y el contrato (qué recibe, qué devuelve, qué efectos tiene). Usar `@param`, `@returns` y `@throws` cuando aporten.

```ts
/**
 * Calcula el total vendido en el período, excluyendo ventas anuladas.
 *
 * @param sales - Ventas del período.
 * @returns Total en la moneda de las ventas.
 */
export function totalSold(sales: Sale[]): number {
  return sales.filter((s) => !s.cancelled).reduce((acc, s) => acc + s.amount, 0);
}
```

## Consecuencias
- Al crear el proyecto se configura ESLint para hacerlo cumplir en parte: `no-inline-comments`, `line-comment-position` y `eslint-plugin-jsdoc` (docstrings en exports).
- Los `//` sueltos dentro de funciones no los detecta ninguna regla estándar: los controla el `reviewer`.
