import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { qk } from '../../lib/queryKeys';

export function useInvoices() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.invoices.list(dashboardCompanyId),
    queryFn: () => api.customer.getInvoices(),
    enabled: !!dashboardCompanyId,
  });
}
