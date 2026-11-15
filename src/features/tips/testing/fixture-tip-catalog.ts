import { makeTip } from '../domain/testing/tip-fixtures';
import type { Tip, TipCatalog } from '../domain';

/** Consejos de prueba: uno por contexto y algunos sin contexto, de varias categorías. */
export const FIXTURE_TIPS: readonly Tip[] = [
  makeTip('fixture-no-costs', { category: 'costs', trigger: 'no_costs' }),
  makeTip('fixture-first-sale', { category: 'recording', trigger: 'first_sale' }),
  makeTip('fixture-fair-sale', { category: 'fairs', trigger: 'fair_sale' }),
  makeTip('fixture-streak', { category: 'recording', trigger: 'streak' }),
  makeTip('fixture-no-channel', { category: 'pricing', trigger: 'no_channel' }),
  makeTip('fixture-plain', { category: 'social_media' }),
];

/** Catálogo de prueba por defecto de `createTestDependencies`; los tests de contenido usan el real. */
export function createFixtureTipCatalog(tips: readonly Tip[] = FIXTURE_TIPS): TipCatalog {
  return { all: () => tips };
}
