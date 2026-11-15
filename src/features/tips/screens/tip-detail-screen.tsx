import { useEffect } from 'react';

import { Screen, ScreenHeader } from '@/shared/ui';

import { TIP_CATEGORY_LABELS } from '../components/category-labels';
import { TipDetail } from '../components/tip-detail';
import type { TipId } from '../domain';
import { useMarkTipSeen } from '../hooks/use-mark-tip-seen';
import { useTip } from '../hooks/use-tip';

/** Props of {@link TipDetailScreen}. */
export interface TipDetailScreenProps {
  readonly tipId: TipId;
  readonly onBack: () => void;
  /** El id está bien formado pero no está en el catálogo: la ruta vuelve a la lista. */
  readonly onUnknownTip: () => void;
}

/**
 * Detalle de solo lectura de un consejo (3.4, D-42): la categoría en el encabezado, el título
 * y el cuerpo. El catálogo está en memoria, así que se dibuja de inmediato. Abrirlo lo marca
 * como visto, una vez por apertura; un id desconocido avisa con `onUnknownTip`.
 */
export function TipDetailScreen({ tipId, onBack, onUnknownTip }: TipDetailScreenProps) {
  const { tip } = useTip(tipId);
  const { mutate: markTipSeen } = useMarkTipSeen();
  const isKnown = tip !== null;

  useEffect(() => {
    if (isKnown) {
      markTipSeen(tipId);
    }
  }, [isKnown, tipId, markTipSeen]);

  useEffect(() => {
    if (!isKnown) {
      onUnknownTip();
    }
  }, [isKnown, onUnknownTip]);

  if (tip === null) {
    return null;
  }
  return (
    <Screen>
      <ScreenHeader title={TIP_CATEGORY_LABELS[tip.category]} onBack={onBack} />
      <TipDetail tip={tip} />
    </Screen>
  );
}
