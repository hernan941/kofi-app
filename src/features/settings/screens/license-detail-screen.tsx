import { ScrollView, Text, View } from 'react-native';

import { Screen, ScreenHeader } from '@/shared/ui';

import { LicenseText } from '../components/license-text';
import { licenseNames } from '../components/settings-texts';
import { LICENSE_TEXTS, noticeTexts, type ThirdPartyNotice } from '../domain';

/** Props of {@link LicenseDetailScreen}. */
export interface LicenseDetailScreenProps {
  readonly notice: ThirdPartyNotice;
  readonly onBack: () => void;
}

/** Lines of the package data, which are read as a single element. */
function packageLines(notice: ThirdPartyNotice): {
  version: string;
  pack: string | null;
  license: string;
} {
  return {
    version: `Versión ${notice.version}`,
    pack: notice.packageName === notice.displayName ? null : `Paquete: ${notice.packageName}`,
    license: `Licencia: ${licenseNames(notice)}`,
  };
}

/**
 * Detalle de una licencia (F9): el nombre, los datos del paquete y el texto completo de cada
 * licencia, un `Text` seleccionable por párrafo. Sin botones ni enlaces aparte de volver.
 */
export function LicenseDetailScreen({ notice, onBack }: LicenseDetailScreenProps) {
  const { version, pack, license } = packageLines(notice);
  const texts = noticeTexts(notice, LICENSE_TEXTS);
  return (
    <Screen>
      <ScreenHeader title={notice.displayName} onBack={onBack} />
      <ScrollView contentContainerClassName="gap-6 px-4 pt-2 pb-8">
        <View
          accessible
          accessibilityLabel={[version, pack, license].filter((line) => line !== null).join(', ')}
          className="gap-1"
        >
          <Text className="text-base text-foreground">{version}</Text>
          {pack === null ? null : <Text className="text-sm text-muted">{pack}</Text>}
          <Text className="text-sm text-muted">{license}</Text>
        </View>
        {texts.map(({ spdxId, part, text }) => (
          <LicenseText
            key={`${spdxId}-${part ?? 'single'}`}
            spdxId={spdxId}
            part={part}
            text={text}
            showHeading={texts.length > 1}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}
