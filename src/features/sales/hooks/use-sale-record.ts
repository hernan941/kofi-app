import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { SaleRecordId } from '@/shared/domain';

import type { SaleRecord } from '../domain';
import { salesKeys } from './query-keys';

/** Un registro por id; `data === null` es "no encontrado": la screen muestra su estado, no lanza. */
export function useSaleRecord(id: SaleRecordId): UseQueryResult<SaleRecord | null> {
  const { sales } = useDependencies();
  return useQuery({
    queryKey: salesKeys.detail(id),
    queryFn: () => sales.findById(id),
  });
}
