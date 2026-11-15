import { Text, View } from 'react-native';

import {
  EmptyState,
  InlineNotice,
  LightbulbIcon,
  LoadingState,
  Screen,
  ScreenHeader,
} from '@/shared/ui';

import { TipList } from '../components/tip-list';
import type { TipId } from '../domain';
import { useTipSections } from '../hooks/use-tip-sections';

/** Props of {@link TipsScreen}. */
export interface TipsScreenProps {
  readonly onOpenTip: (id: TipId) => void;
}

/** Título de la sección y su frase de introducción; igual en todos los estados, fuera de la lista. */
function TipsHeader() {
  return (
    <View>
      <ScreenHeader title="Consejos" />
      <Text className="px-4 pb-4 text-base text-muted">
        Ideas breves para llevar tu negocio. Cada vez que registras una venta, te mostramos una.
      </Text>
    </View>
  );
}

/**
 * Pestaña "Consejos" (3.3): todos los consejos por categoría, con los vistos marcados. Mientras
 * se leen los vistos muestra un cargando, para que las marcas no aparezcan de a una; si la
 * lectura falla, muestra la lista completa sin marcas y un aviso, porque los consejos están en
 * la app.
 */
export function TipsScreen({ onOpenTip }: TipsScreenProps) {
  const { status, sections } = useTipSections();
  if (status === 'pending') {
    return (
      <Screen>
        <TipsHeader />
        <LoadingState label="Cargando consejos" shape="rows" count={6} />
      </Screen>
    );
  }
  if (sections.length === 0) {
    return (
      <Screen>
        <TipsHeader />
        <EmptyState
          icon={LightbulbIcon}
          title="Aquí vas a encontrar consejos"
          description="Pronto vas a tener ideas para tu negocio en esta sección."
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <TipsHeader />
      {status === 'error' ? (
        <View className="px-4 pb-2">
          <InlineNotice message="No pudimos revisar cuáles ya leíste. Igual puedes leerlos todos." />
        </View>
      ) : null}
      <TipList sections={sections} onOpenTip={onOpenTip} />
    </Screen>
  );
}
