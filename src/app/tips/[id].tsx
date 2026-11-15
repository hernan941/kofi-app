import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';

import { TipDetailScreen, tipIdSchema } from '@/features/tips';
import { parseRouteParams } from '@/shared/lib/route-params';

const paramsSchema = z.object({ id: tipIdSchema });

/**
 * Tip detail: a malformed id redirects to the list, and so does a well-formed id that is
 * not in the catalog. "Volver" without history (deep link) replaces the stack with the list,
 * not with the start, because the list is the screen the tip belongs to.
 */
export default function TipDetailRoute() {
  const router = useRouter();
  const params = parseRouteParams(paramsSchema, useLocalSearchParams());
  if (!params.ok) {
    return <Redirect href="/tips" />;
  }
  return (
    <TipDetailScreen
      tipId={params.value.id}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/tips');
        }
      }}
      onUnknownTip={() => {
        router.replace('/tips');
      }}
    />
  );
}
