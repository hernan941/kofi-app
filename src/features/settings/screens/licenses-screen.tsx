import { useCallback, useMemo } from 'react';
import { FlatList, Text, type ListRenderItemInfo } from 'react-native';

import { CardListItem, CardListSeparator, Screen, ScreenHeader } from '@/shared/ui';

import { LicenseRow } from '../components/license-row';
import { LICENSES_TEXTS } from '../components/settings-texts';
import { THIRD_PARTY_NOTICES, sortNotices, type NoticeId, type ThirdPartyNotice } from '../domain';

/** Props of {@link LicensesScreen}. */
export interface LicensesScreenProps {
  readonly onBack: () => void;
  readonly onOpenNotice: (id: NoticeId) => void;
  /** Avisos a listar; por defecto, todos los de la app. Los tests pasan un subconjunto porque la lista se virtualiza. */
  readonly notices?: readonly ThirdPartyNotice[];
}

/** Stable key of a row. */
function keyOf(notice: ThirdPartyNotice): string {
  return notice.id;
}

/** Introduction above the list. */
function Introduction() {
  return <Text className="pb-4 text-base text-muted">{LICENSES_TEXTS.introduction}</Text>;
}

/**
 * Lista de licencias de terceros (F9): una `FlatList` virtualizada, en orden alfabético, cuyas
 * filas se ven como una sola tarjeta. Los datos son constantes, así que no hay carga ni vacío.
 */
export function LicensesScreen({
  onBack,
  onOpenNotice,
  notices = THIRD_PARTY_NOTICES,
}: LicensesScreenProps) {
  const sorted = useMemo(() => sortNotices(notices), [notices]);
  const lastIndex = sorted.length - 1;
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ThirdPartyNotice>) => (
      <CardListItem isFirst={index === 0} isLast={index === lastIndex}>
        <LicenseRow
          notice={item}
          onPress={() => {
            onOpenNotice(item.id);
          }}
        />
      </CardListItem>
    ),
    [lastIndex, onOpenNotice],
  );
  return (
    <Screen>
      <ScreenHeader title={LICENSES_TEXTS.title} onBack={onBack} />
      <FlatList
        data={sorted}
        keyExtractor={keyOf}
        ListHeaderComponent={Introduction}
        ItemSeparatorComponent={CardListSeparator}
        contentContainerClassName="px-4 pb-8"
        renderItem={renderItem}
      />
    </Screen>
  );
}
