import type { SaleChannel } from '../domain';

/** Etiquetas en español de cada canal de venta (`SALE_CHANNELS`). */
export const SALE_CHANNEL_LABELS: Readonly<Record<SaleChannel, string>> = {
  fair: 'Feria',
  social_media: 'Redes sociales',
  store_or_consignment: 'Tienda o consignación',
  custom_order: 'Encargo',
  other: 'Otro',
};
