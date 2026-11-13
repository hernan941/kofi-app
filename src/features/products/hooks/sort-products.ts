import { compareProductsForList, type Product } from '../domain';

/** `select` de las listas: ordena una copia con el orden de la lista de productos. */
export function sortProductsForList(products: readonly Product[]): readonly Product[] {
  return [...products].sort(compareProductsForList);
}
