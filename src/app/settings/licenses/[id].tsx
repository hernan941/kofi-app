import { useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';

import {
  LicenseDetailScreen,
  THIRD_PARTY_NOTICES,
  findNotice,
  noticeIdSchema,
} from '@/features/settings';
import { goBackOrHome } from '@/shared/lib/go-back-or-home';
import { parseRouteParams } from '@/shared/lib/route-params';
import { NotFoundScreen } from '@/shared/ui';

const paramsSchema = z.object({ id: noticeIdSchema });

/** License detail: an invalid or unknown id shows the not-found screen. */
export default function LicenseDetailRoute() {
  const router = useRouter();
  const params = parseRouteParams(paramsSchema, useLocalSearchParams());
  const notice = params.ok ? findNotice(THIRD_PARTY_NOTICES, params.value.id) : null;
  if (notice === null) {
    return (
      <NotFoundScreen
        onGoHome={() => {
          router.replace('/');
        }}
      />
    );
  }
  return (
    <LicenseDetailScreen
      notice={notice}
      onBack={() => {
        goBackOrHome(router);
      }}
    />
  );
}
