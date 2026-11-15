import { ScrollView, Text, View } from 'react-native';

import type { SaleRecordView } from '@/features/sales';
import { SALE_CHANNEL_LABELS } from '@/features/sales';
import { formatClpAccessible, type LocalDate, type SaleRecordId } from '@/shared/domain';
import {
  Amount,
  CalendarBlankIcon,
  Card,
  EmptyState,
  ErrorState,
  InlineNotice,
  ListRow,
  ListSeparator,
  LoadingState,
  PlusIcon,
  PrimaryButton,
  AccessibleGroup,
} from '@/shared/ui';

import { useToday } from '@/shared/lib/time/use-today';
import { useDayDetail } from '../hooks/use-day-detail';
import { thumbnailOf, titleOf } from './sale-row-parts';

/** Props of {@link DayDetailView}. */
export interface DayDetailViewProps {
  readonly date: LocalDate;
  readonly onOpenSale: (id: SaleRecordId) => void;
  readonly onRegisterSale: (date: LocalDate) => void;
}

const REGISTER_LABEL = 'Registrar una venta este día';

function countText(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

function subtitleOf(view: SaleRecordView): string {
  const { channel } = view.record;
  const products = countText(view.items.length, 'producto', 'productos');
  return channel === null ? products : `${SALE_CHANNEL_LABELS[channel]} · ${products}`;
}

function labelOf(view: SaleRecordView): string {
  const { channel } = view.record;
  return [
    titleOf(view),
    channel === null ? null : SALE_CHANNEL_LABELS[channel],
    countText(view.items.length, 'producto', 'productos'),
    formatClpAccessible(view.total),
  ]
    .filter((part) => part !== null)
    .join(', ');
}

function RecordsCard({
  records,
  onOpenSale,
}: {
  readonly records: readonly SaleRecordView[];
  readonly onOpenSale: DayDetailViewProps['onOpenSale'];
}) {
  return (
    <Card title="Ventas de este día">
      {records.map((view, index) => (
        <View key={view.record.id}>
          {index > 0 ? <ListSeparator /> : null}
          <ListRow
            leading={thumbnailOf(view.items[0])}
            title={titleOf(view)}
            subtitle={subtitleOf(view)}
            amount={view.total}
            accessibilityLabel={labelOf(view)}
            accessibilityHint="Abre el detalle de la venta"
            onPress={() => {
              onOpenSale(view.record.id);
            }}
          />
        </View>
      ))}
    </Card>
  );
}

/**
 * Cuerpo del detalle de un día (3.5 y 4.2 del diseño de F5): total, registros y "Registrar una
 * venta este día" solo si no es futuro (D-03). Un día sin ventas muestra el estado vacío con
 * esa misma acción como único botón principal; un día futuro, el aviso en su lugar.
 */
export function DayDetailView({ date, onOpenSale, onRegisterSale }: DayDetailViewProps) {
  const today = useToday();
  const isToday = date === today;
  const { status, detail, records, refetch } = useDayDetail(date);
  const register = () => {
    onRegisterSale(date);
  };
  if (status === 'error') {
    return (
      <ErrorState message="No se pudo cargar este día. Inténtalo de nuevo." onRetry={refetch} />
    );
  }
  if (status === 'pending' || detail === null) {
    return <LoadingState label="Cargando el día" shape="cards" count={2} />;
  }
  if (detail.canRegister && detail.recordCount === 0) {
    return (
      <EmptyState
        icon={CalendarBlankIcon}
        title={isToday ? 'Hoy sin ventas anotadas' : 'Sin ventas anotadas este día'}
        description={
          isToday
            ? 'Cuando vendas algo, regístralo aquí en segundos.'
            : 'Si vendiste algo, regístralo con esta fecha.'
        }
        primaryAction={{ label: REGISTER_LABEL, onPress: register }}
      />
    );
  }
  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-6">
        <AccessibleGroup
          label={`Vendiste: ${formatClpAccessible(detail.total)}, ${countText(detail.recordCount, 'venta', 'ventas')}`}
          contentClassName="gap-1"
        >
          <Text className="font-medium text-sm text-muted">Vendiste</Text>
          <Amount value={detail.total} variant="display" />
          <Text className="text-sm text-muted">
            {countText(detail.recordCount, 'venta', 'ventas')}
          </Text>
        </AccessibleGroup>
        {detail.recordCount > 0 ? <RecordsCard records={records} onOpenSale={onOpenSale} /> : null}
        {detail.canRegister ? null : (
          <InlineNotice message="Puedes registrar ventas de hoy o de días anteriores." />
        )}
      </ScrollView>
      {detail.canRegister ? (
        <View className="px-4 pt-2 pb-4">
          <PrimaryButton label={REGISTER_LABEL} icon={PlusIcon} onPress={register} />
        </View>
      ) : null}
    </>
  );
}
