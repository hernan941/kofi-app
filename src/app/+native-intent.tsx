import { isE2EBuild } from '@/core/e2e/e2e-flag';
import { resolveNativeIntentPath } from '@/core/e2e/native-intent';

/** Rewrites incoming links: `cuantovendi://e2e/**` only works in the E2E build (ADR-013). */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return resolveNativeIntentPath(path, isE2EBuild);
}
