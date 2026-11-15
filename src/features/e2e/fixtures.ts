import type { E2eFixtureName } from './domain/fixture-names';

/**
 * Módulos de assets de los fixtures (`e2e/fixtures/*.zip`). Solo existe en el build E2E: la ruta
 * `src/app/e2e/seed.tsx` carga esta feature dentro de la rama del flag, así que el bundle
 * `release` no los incluye. `large.zip` lo genera `npm run e2e:fixtures` (no se versiona).
 */
export const E2E_FIXTURE_MODULES: Readonly<Record<E2eFixtureName, number>> = {
  basic: require('../../../e2e/fixtures/basic.zip') as number,
  large: require('../../../e2e/fixtures/large.zip') as number,
};
