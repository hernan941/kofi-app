import { View } from 'react-native';

import type { SaleRecordView } from '@/features/sales';
import { formatClpAccessible, type LocalDate, type SaleRecordId } from '@/shared/domain';
import {
  Card,
  InlineNotice,
  ListRow,
  ListSeparator,
  TextButton,
  formatDateLabel,
  formatShortDateLabel,
} from '@/shared/ui';

import { thumbnailOf, titleOf } from './sale-row-parts';

/** Props of {@link LatestSalesList}. */
export interface LatestSalesListProps {
  readonly status: 'ready' | 'error';
  readonly sales: readonly SaleRecordView[];
  readonly today: LocalDate;
  readonly onOpenSale: (id: SaleRecordId) => void;
  readonly onRetry: () => void;
}

function visibleVersion(view: SaleRecordView): string | null {
  const only = view.items.length === 1 ? view.items[0] : undefined;
  return only?.showVersion === true ? only.versionName : null;
}

function subtitleOf(view: SaleRecordView, today: LocalDate): string {
  return [
    visibleVersion(view),
    formatShortDateLabel(view.record.soldOn, today),
    view.items[0]?.isArchived === true ? 'Archivado' : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function labelOf(view: SaleRecordView, today: LocalDate): string {
  return [
    titleOf(view),
    visibleVersion(view),
    lowerFirst(formatDateLabel(view.record.soldOn, today)),
    view.items[0]?.isArchived === true ? 'archivado' : null,
    formatClpAccessible(view.total),
  ]
    .filter((part) => part !== null)
    .join(', ');
}

/**
 * Tarjeta "Últimas ventas" de Inicio (UX-H7): una fila por registro con el nombre actual del
 * primer producto, la fecha corta y el total. Si la carga falla, un aviso con "Reintentar"
 * dentro de la misma tarjeta.
 */
export function LatestSalesList({
  status,
  sales,
  today,
  onOpenSale,
  onRetry,
}: LatestSalesListProps) {
  return (
    <Card title="Últimas ventas">
      {status === 'error' ? (
        <View className="items-start gap-1">
          <InlineNotice tone="danger" message="No se pudieron cargar tus últimas ventas." />
          <TextButton label="Reintentar" onPress={onRetry} />
        </View>
      ) : (
        sales.map((view, index) => (
          <View key={view.record.id}>
            {index > 0 ? <ListSeparator /> : null}
            <ListRow
              leading={thumbnailOf(view.items[0])}
              title={titleOf(view)}
              subtitle={subtitleOf(view, today)}
              amount={view.total}
              accessibilityLabel={labelOf(view, today)}
              accessibilityHint="Abre el detalle de la venta"
              onPress={() => {
                onOpenSale(view.record.id);
              }}
            />
          </View>
        ))
      )}
    </Card>
  );
}
