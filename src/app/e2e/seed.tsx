import { Redirect, useLocalSearchParams } from 'expo-router';

import type * as E2eFeature from '@/features/e2e';
import { parseRouteParams } from '@/shared/lib/route-params';

/**
 * Hidden E2E route (ADR-013): `cuantovendi://e2e/seed?fixture=<basic|large>` restores a fixture
 * backup through the real restore path, only in the E2E build. Otherwise (or with an invalid
 * fixture) it redirects to the home tab. The flag is read inline as
 * `process.env.EXPO_PUBLIC_E2E === '1'` and the feature is loaded with `require` inside that
 * branch, so the release bundle folds it away and never includes the fixtures.
 */
export default function SeedRoute() {
  const params = useLocalSearchParams();
  if (process.env.EXPO_PUBLIC_E2E === '1') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the require must stay inside the inlined flag branch so Metro drops the E2E feature from release bundles
    const e2e = require('@/features/e2e') as typeof E2eFeature;
    const parsed = parseRouteParams(e2e.seedRouteParamsSchema, params);
    if (parsed.ok) {
      return <e2e.SeedScreen fixture={parsed.value.fixture} materialize={e2e.materializeFixture} />;
    }
  }
  return <Redirect href="/" />;
}
