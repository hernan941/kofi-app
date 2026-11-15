import { TIP_CATEGORIES } from '../domain';
import { TIP_CATEGORY_LABELS } from './category-labels';

describe('TIP_CATEGORY_LABELS', () => {
  it('names every category in Spanish, in the order of the catalog', () => {
    expect(TIP_CATEGORIES.map((category) => TIP_CATEGORY_LABELS[category])).toEqual([
      'Registro',
      'Costos',
      'Precios',
      'Ferias',
      'Redes',
      'Flujo de dinero',
    ]);
  });
});
