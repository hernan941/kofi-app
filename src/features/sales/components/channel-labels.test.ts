import { SALE_CHANNELS } from '../domain';
import { SALE_CHANNEL_LABELS } from './channel-labels';

describe('SALE_CHANNEL_LABELS', () => {
  it('names every channel in Spanish', () => {
    expect(SALE_CHANNELS.map((channel) => SALE_CHANNEL_LABELS[channel])).toEqual([
      'Feria',
      'Redes sociales',
      'Tienda o consignación',
      'Encargo',
      'Otro',
    ]);
  });
});
