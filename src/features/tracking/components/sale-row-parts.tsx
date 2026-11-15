import type { ReactElement } from 'react';

import { ProductPhoto } from '@/features/products';
import type { SaleItemView, SaleRecordView } from '@/features/sales';

/** Título de un registro: el primer producto y "y N más". */
export function titleOf(view: SaleRecordView): string {
  const name = view.items[0]?.productName ?? 'Producto sin nombre';
  const others = view.items.length - 1;
  return others > 0 ? `${name} y ${String(others)} más` : name;
}

/** Miniatura del primer ítem para `ListRow.leading`, o `undefined` si no tiene foto. */
export function thumbnailOf(item: SaleItemView | undefined): ReactElement | undefined {
  if (item === undefined || item.coverPhotoId === null) {
    return undefined;
  }
  return (
    <ProductPhoto
      photoId={item.coverPhotoId}
      label="Foto del producto"
      className="size-10 rounded-xl border-2 border-field-border"
      placeholderIconSize="md"
      isDecorative
    />
  );
}
