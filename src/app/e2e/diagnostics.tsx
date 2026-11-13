import { Redirect } from 'expo-router';

import type * as E2eFeature from '@/features/e2e';

/**
 * Hidden E2E route (ADR-013, ADR-015): shows the date diagnostics only in the E2E build.
 * Otherwise it redirects to the home tab. The flag is read inline as
 * `process.env.EXPO_PUBLIC_E2E === '1'` and the feature is loaded with `require` inside that
 * branch: Expo inlines the variable at bundle time, so the release bundle folds the branch
 * away and never includes `@/features/e2e`. Going through a helper or a constant would defeat
 * that dead-code elimination.
 */
export default function DiagnosticsRoute() {
  if (process.env.EXPO_PUBLIC_E2E === '1') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the require must stay inside the inlined flag branch so Metro drops the E2E feature from release bundles
    const { DateDiagnosticsScreen } = require('@/features/e2e') as typeof E2eFeature;
    return <DateDiagnosticsScreen />;
  }
  return <Redirect href="/" />;
}
