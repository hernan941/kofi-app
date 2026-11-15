import type { LocalDate, SaleRecordId } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';
import { Screen, ScreenHeader, formatDateLabel } from '@/shared/ui';

import { DayDetailView } from '../components/day-detail-view';

/** Props of {@link DayDetailScreen}. */
export interface DayDetailScreenProps {
  readonly date: LocalDate;
  readonly onBack: () => void;
  readonly onOpenSale: (id: SaleRecordId) => void;
  readonly onRegisterSale: (date: LocalDate) => void;
}

/** Detalle de un día (UX-C9): el título lleva la fecha y el cuerpo es {@link DayDetailView}. */
export function DayDetailScreen({
  date,
  onBack,
  onOpenSale,
  onRegisterSale,
}: DayDetailScreenProps) {
  const today = useToday();
  return (
    <Screen>
      <ScreenHeader title={formatDateLabel(date, today)} onBack={onBack} />
      <DayDetailView date={date} onOpenSale={onOpenSale} onRegisterSale={onRegisterSale} />
    </Screen>
  );
}
