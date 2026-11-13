import { CLP_INPUT_ERROR_MESSAGES, TEXT_ERROR_MESSAGES, describeWith } from '@/shared/ui';

import type { SaleErrorCode } from '../domain';

/** Texto en español de cada código de `SALE_ERROR_CODES`: dice cómo seguir y nunca culpa. */
export const SALE_ERROR_MESSAGES: Readonly<Record<SaleErrorCode, string>> = {
  required: 'Completa este campo',
  too_long: 'Es demasiado largo. Acórtalo un poco',
  no_items: 'Elige al menos un producto que vendiste',
  too_many_items: 'Llegaste a 100 productos en esta venta. Guárdala y registra el resto en otra',
  quantity_out_of_range: 'Escribe una cantidad entre 1 y 9.999',
  price_required: 'Escribe a cuánto lo vendiste, por ejemplo 15.000',
  future_date: 'Elige hoy o un día anterior',
  product_not_found: 'Este producto ya no está. Quítalo y elige otro',
  product_archived: 'Este producto está archivado. Elige otro o vuelve a usarlo desde Productos',
  version_not_found: 'Esta versión ya no está. Elige otra',
  version_product_mismatch: 'Esta versión no corresponde a este producto. Vuelve a elegirla',
  version_archived: 'Esta versión ya no está a la venta. Elige otra',
  item_not_found: 'Esta venta cambió mientras la editabas. Vuelve a abrirla',
  record_not_found: 'No encontramos esta venta. Puede que ya no exista',
  week_has_sales: 'Esta semana ya tiene ventas, así que no hace falta marcar "no vendí"',
  week_not_allowed: 'Solo puedes marcar esta semana o la anterior',
  not_a_week_start: 'No pudimos marcar esa semana. Inténtalo de nuevo',
};

/**
 * Traduce el código de un error de formulario. El catálogo de ventas gana sobre los textos
 * genéricos; los códigos de monto conservan sus propios mensajes.
 */
export const describeSaleError = describeWith({
  ...TEXT_ERROR_MESSAGES,
  ...CLP_INPUT_ERROR_MESSAGES,
  ...SALE_ERROR_MESSAGES,
});
