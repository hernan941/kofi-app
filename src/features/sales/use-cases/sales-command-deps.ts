import type { ProductWriter } from '@/features/products';
import type { Clock, IdGenerator, LocalCalendar } from '@/shared/domain';
import type { TransactionRunner } from '@/shared/domain/transaction-runner';

import type { NoSalesWeekWriter, SaleRecordWriter } from '../data/sale-repository';

/** Puertos de los casos de uso de ventas. */
export interface SalesCommandDeps {
  readonly transactions: TransactionRunner;
  readonly sales: SaleRecordWriter;
  readonly noSalesWeeks: NoSalesWeekWriter;
  readonly products: Pick<ProductWriter, 'findByIdSync'>;
  readonly clock: Clock;
  readonly calendar: LocalCalendar;
  readonly ids: IdGenerator;
}
