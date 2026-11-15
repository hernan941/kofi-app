import { Redirect } from 'expo-router';

import type * as E2eFeature from '@/features/e2e';

/**
 * Hidden E2E route (ADR-013): `cuantovendi://e2e/perf` shows the performance marks of
 * `docs/architecture/performance-budgets.md` only in the E2E build. Otherwise it redirects to
 * the home tab. The flag is read inline as `process.env.EXPO_PUBLIC_E2E === '1'` and the
 * feature is loaded with `require` inside that branch, so the release bundle folds it away.
 */
export default function PerfRoute() {
  if (process.env.EXPO_PUBLIC_E2E === '1') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the require must stay inside the inlined flag branch so Metro drops the E2E feature from release bundles
    const { PerfMarksScreen } = require('@/features/e2e') as typeof E2eFeature;
    return <PerfMarksScreen />;
  }
  return <Redirect href="/" />;
}
