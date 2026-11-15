import { useEffect, useRef, useState } from 'react';

import { FadeIn, announce } from '@/shared/ui';

import { AfterSaleTipCard } from '../components/after-sale-tip-card';
import { useMarkTipSeen } from '../hooks/use-mark-tip-seen';
import { useTipAfterSale, type AfterSaleTipInput } from '../hooks/use-tip-after-sale';

/** Props of {@link AfterSaleTip}. */
export interface AfterSaleTipProps extends AfterSaleTipInput {
  /** Se llama después de cerrar la tarjeta; la celebración lleva el foco a "Listo". */
  readonly onClosed?: () => void;
}

/**
 * Pieza que se inserta en la celebración de una venta nueva (4.1): elige el consejo, lo marca
 * como visto al mostrarse (una sola vez) y lo dibuja con una entrada suave. Cerrarlo lo oculta
 * y no vuelve en esa venta. Mientras elige, sin consejo o con error no dibuja nada: el error
 * (que registra `useTipAfterSale`) no interrumpe nada, porque la venta ya se guardó.
 */
export function AfterSaleTip({ recordId, isFirstSale, onClosed }: AfterSaleTipProps) {
  const query = useTipAfterSale({ recordId, isFirstSale });
  const { mutate: markTipSeen } = useMarkTipSeen();
  const [isClosed, setIsClosed] = useState(false);
  const markedId = useRef<string | null>(null);
  const tip = query.data ?? null;

  useEffect(() => {
    if (tip !== null && markedId.current !== tip.id) {
      markedId.current = tip.id;
      markTipSeen(tip.id);
    }
  }, [tip, markTipSeen]);

  if (tip === null || isClosed) {
    return null;
  }
  return (
    <FadeIn>
      <AfterSaleTipCard
        tip={tip}
        onClose={() => {
          setIsClosed(true);
          announce('Consejo cerrado');
          onClosed?.();
        }}
      />
    </FadeIn>
  );
}
