import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { qk } from '../../lib/queryKeys';

export function usePortFees() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.portFees.list(dashboardCompanyId),
    queryFn: () => api.customer.getPortFees(),
    enabled: !!dashboardCompanyId,
  });
}
