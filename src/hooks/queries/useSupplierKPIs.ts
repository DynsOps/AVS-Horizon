import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';

export function useSupplierKPIs() {
  return useQuery({
    queryKey: qk.supplier.kpis(),
    queryFn: () => api.supplier.getKPIs(),
  });
}
