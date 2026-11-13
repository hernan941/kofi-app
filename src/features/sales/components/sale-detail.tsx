import { ScrollView, Text, View } from 'react-native';

import { formatClp, formatClpAccessible, type LocalDate } from '@/shared/domain';
import {
  Amount,
  Card,
  DeleteButton,
  Icon,
  ListRow,
  ListSeparator,
  StorefrontIcon,
} from '@/shared/ui';

import { activeItemsTotal, type SaleItemView, type SaleRecordView } from '../domain';
import { SALE_CHANNEL_LABELS } from './channel-labels';
import { ProductThumbnail } from './product-thumbnail';

/** Props of {@link SaleDetail}. */
export interface SaleDetailProps {
  readonly view: SaleRecordView;
  readonly today: LocalDate;
  readonly onDelete: () => void;
}

/** Subtítulo de un ítem: versión (si el producto tiene varias), "2 × $15.000" y "Archivado". */
function subtitleOf({
  item,
  versionName,
  showVersion,
  isArchived,
}: SaleItemView): string | undefined {
  const parts = [
    showVersion ? versionName : null,
    item.quantity > 1 ? `${String(item.quantity)} × ${formatClp(item.unitPrice)}` : null,
    isArchived ? 'Archivado' : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** Etiqueta accesible de un ítem, en el orden de lectura de la tabla de diseño. */
function labelOf(
  view: SaleItemView,
  name: string,
  subtotal: SaleItemView['item']['unitPrice'],
): string {
  const { item, versionName, showVersion, isArchived } = view;
  return [
    name,
    showVersion ? versionName : null,
    item.quantity > 1 ? `${String(item.quantity)} de ${formatClpAccessible(item.unitPrice)}` : null,
    isArchived ? 'archivado' : null,
    formatClpAccessible(subtotal),
  ]
    .filter((part) => part !== null)
    .join(', ');
}

/**
 * Detalle de una venta de solo lectura (3.8): total en grande, lo que se vendió en filas
 * estáticas con nombres actuales, y canal y nota si existen. Cierra con "Borrar venta", lejos
 * del pulgar. "Editar venta" es un botón fijo de la pantalla.
 */
export function SaleDetail({ view, onDelete }: SaleDetailProps) {
  const { record } = view;
  const showThumbnails = view.items.some((item) => item.coverPhotoId !== null);
  return (
    <ScrollView contentContainerClassName="gap-6 px-4 pb-6">
      <View className="gap-1">
        <Text className="font-medium text-sm text-muted">Total</Text>
        <Amount value={view.total} variant="display" />
      </View>
      <Card title="Lo que vendiste">
        {view.items.map((itemView, index) => {
          const name = itemView.productName ?? 'Producto sin nombre';
          const subtotal = activeItemsTotal([itemView.item]);
          return (
            <View key={itemView.item.id}>
              {index > 0 ? <ListSeparator /> : null}
              <ListRow
                leading={
                  showThumbnails ? (
                    <ProductThumbnail coverPhotoId={itemView.coverPhotoId} />
                  ) : undefined
                }
                title={name}
                subtitle={subtitleOf(itemView)}
                amount={subtotal}
                accessibilityLabel={labelOf(itemView, name, subtotal)}
              />
            </View>
          );
        })}
      </Card>
      {record.channel === null ? null : (
        <View className="gap-1">
          <Text className="font-medium text-sm text-muted">Dónde vendiste</Text>
          <View className="flex-row items-center gap-2">
            <Icon icon={StorefrontIcon} size="md" />
            <Text className="text-base text-foreground">{SALE_CHANNEL_LABELS[record.channel]}</Text>
          </View>
        </View>
      )}
      {record.note === null ? null : (
        <View className="gap-1">
          <Text className="font-medium text-sm text-muted">Nota</Text>
          <Text selectable className="text-base text-foreground">
            {record.note}
          </Text>
        </View>
      )}
      <View className="items-start pt-8">
        <DeleteButton label="Borrar venta" onPress={onDelete} />
      </View>
    </ScrollView>
  );
}
