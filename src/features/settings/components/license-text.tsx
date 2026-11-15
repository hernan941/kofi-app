import { Text, View } from 'react-native';

import { licenseLabel, toReadableParagraphs, type LicensePart } from '../domain';
import { licenseDetailHeading } from './settings-texts';

/** Props of {@link LicenseText}. */
export interface LicenseTextProps {
  readonly spdxId: string;
  readonly part: LicensePart | null;
  readonly text: string;
  /** Titles the part ("Licencia del código: MIT"); only when the notice has several texts. */
  readonly showHeading: boolean;
}

/** One license text of a notice: its optional heading and one selectable `Text` per paragraph. */
export function LicenseText({ spdxId, part, text, showHeading }: LicenseTextProps) {
  const paragraphs = toReadableParagraphs(text);
  return (
    <View className="gap-3">
      {showHeading && part !== null ? (
        <Text accessibilityRole="header" className="font-semibold text-heading text-foreground">
          {licenseDetailHeading(part, licenseLabel(spdxId))}
        </Text>
      ) : null}
      {paragraphs.map((paragraph, index) => (
        <Text key={index} selectable className="text-sm text-foreground">
          {paragraph}
        </Text>
      ))}
    </View>
  );
}
