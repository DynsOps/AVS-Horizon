import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { qk } from '../../lib/queryKeys';

export function useShipments() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.shipments.list(dashboardCompanyId),
    queryFn: () => api.customer.getShipments(),
    enabled: !!dashboardCompanyId,
  });
}
