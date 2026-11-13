import { useState } from 'react';

import type { SaleRecordId } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PencilSimpleIcon,
  PrimaryButton,
  ReceiptIcon,
  Screen,
  ScreenHeader,
  formatDateLabel,
  useAppToast,
} from '@/shared/ui';
import { formatClp } from '@/shared/domain';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SALE_ERROR_MESSAGES } from '../components/error-messages';
import { SaleDetail } from '../components/sale-detail';
import { useDeleteSaleRecord } from '../hooks/use-delete-sale-record';
import { useSaleRecordView } from '../hooks/use-sale-record-view';

/** Props of {@link SaleDetailScreen}. */
export interface SaleDetailScreenProps {
  readonly saleRecordId: SaleRecordId;
  readonly onBack: () => void;
  readonly onEdit: (id: SaleRecordId) => void;
  readonly onDeleted: () => void;
}

/** Estado "no encontrado" de una venta (4.3), también para la edición. */
export function SaleNotFound({ onBack }: { readonly onBack: () => void }) {
  return (
    <EmptyState
      icon={ReceiptIcon}
      title="No encontramos esta venta"
      description="Puede que ya no exista."
      primaryAction={{ label: 'Volver', onPress: onBack }}
    />
  );
}

/** "viernes 13 de noviembre" para la frase del diálogo (sin "Hoy" ni "Ayer"). */
function sentenceDate(label: string): string {
  const plain = label.replace(/^(Hoy|Ayer), /, '');
  return `${plain.charAt(0).toLowerCase()}${plain.slice(1)}`;
}

/**
 * Detalle de una venta (3.8): total, lo vendido, "Editar venta" fijo y "Borrar venta" con
 * confirmación. Un id sin registro muestra el estado "no encontrado".
 */
export function SaleDetailScreen({
  saleRecordId,
  onBack,
  onEdit,
  onDeleted,
}: SaleDetailScreenProps) {
  const { status, view, refetch } = useSaleRecordView(saleRecordId);
  const today = useToday();
  const remove = useDeleteSaleRecord();
  const toast = useAppToast();
  const [isConfirming, setIsConfirming] = useState(false);

  const confirmDelete = async () => {
    setIsConfirming(false);
    try {
      const result = await remove.mutateAsync(saleRecordId);
      if (result.ok) {
        toast.showSuccess('Venta borrada');
        onDeleted();
        return;
      }
      toast.showError(SALE_ERROR_MESSAGES[result.error[0].code]);
      if (result.error.some((error) => error.code === 'record_not_found')) onDeleted();
    } catch {
      toast.showError('No se pudo borrar la venta. Inténtalo de nuevo.');
    }
  };

  if (status !== 'ready' || view === null) {
    return (
      <Screen>
        <ScreenHeader onBack={onBack} />
        {status === 'pending' ? (
          <LoadingState label="Cargando venta" shape="cards" count={2} />
        ) : status === 'error' ? (
          <ErrorState
            message="No se pudo cargar esta venta. Inténtalo de nuevo."
            onRetry={refetch}
          />
        ) : (
          <SaleNotFound onBack={onBack} />
        )}
      </Screen>
    );
  }
  const dateLabel = formatDateLabel(view.record.soldOn, today);
  return (
    <Screen>
      <ScreenHeader title={dateLabel} onBack={onBack} />
      <SaleDetail
        view={view}
        today={today}
        onDelete={() => {
          setIsConfirming(true);
        }}
      />
      <SafeAreaView edges={['bottom']} className="px-4 pt-2 pb-4">
        <PrimaryButton
          label="Editar venta"
          icon={PencilSimpleIcon}
          onPress={() => {
            onEdit(saleRecordId);
          }}
        />
      </SafeAreaView>
      <ConfirmDialog
        isOpen={isConfirming}
        title="¿Borrar esta venta?"
        description={`Se borra la venta del ${sentenceDate(dateLabel)} por ${formatClp(view.total)}. No se puede deshacer.`}
        confirmLabel="Borrar venta"
        isDestructive
        onConfirm={() => {
          void confirmDelete();
        }}
        onCancel={() => {
          setIsConfirming(false);
        }}
      />
    </Screen>
  );
}
