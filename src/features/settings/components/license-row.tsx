import { CaretRightIcon, Icon, ListRow } from '@/shared/ui';

import type { ThirdPartyNotice } from '../domain';
import { LICENSES_TEXTS, licenseRowLabel, licenseRowSubtitle } from './settings-texts';

/** Props of {@link LicenseRow}. */
export interface LicenseRowProps {
  readonly notice: ThirdPartyNotice;
  readonly onPress: () => void;
}

/** Row of the license list: name, version and readable license; a single button. */
export function LicenseRow({ notice, onPress }: LicenseRowProps) {
  return (
    <ListRow
      title={notice.displayName}
      subtitle={licenseRowSubtitle(notice)}
      trailing={<Icon icon={CaretRightIcon} color="muted" />}
      accessibilityLabel={licenseRowLabel(notice)}
      accessibilityHint={LICENSES_TEXTS.rowHint}
      onPress={onPress}
    />
  );
}
