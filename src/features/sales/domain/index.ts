export { SALE_ERROR_CODES, toSaleErrors } from './errors';
export type { SaleError, SaleErrorCode, SaleErrorPath, SaleErrors } from './errors';
export {
  MAX_SALE_TOTAL,
  QUANTITY_MAX,
  QUANTITY_MIN,
  SALE_CHANNELS,
  SALE_ITEMS_MAX,
  SALE_NOTE_MAX_LENGTH,
  activeItemsTotal,
  hasItems,
  recordTotal,
} from './sale';
export type { NoSalesWeek, SaleChannel, SaleItem, SaleRecord } from './sale';
export {
  quantitySchema,
  saleChannelSchema,
  saleItemInputSchema,
  saleNoteSchema,
  saveSaleRecordInputSchema,
} from './schemas';
export type { SaleItemInput, SaveSaleRecordInput } from './schemas';
export {
  buildSaleRecord,
  diffItems,
  effectiveUnitCost,
  planSaleRecordUpdate,
  resolveItems,
  validateSoldOn,
} from './rules';
export type {
  ProductsById,
  SaleCommandContext,
  SaleItemsDiff,
  SaleRecordUpdatePlan,
} from './rules';
export {
  canUnmarkNoSales,
  noSalesPrompt,
  noSalesWeekId,
  noSalesWeekOf,
  noSalesWeekStatus,
} from './no-sales';
export type { NoSalesPrompt, NoSalesWeekStatus, WeekFacts } from './no-sales';
export { STREAK_SCAN_WEEKS, registeredWeeks, streakFrom } from './streak';
export type { Streak } from './streak';
export { buildSaleRecordView } from './sale-record-view';
export type { SaleItemView, SaleRecordView } from './sale-record-view';
