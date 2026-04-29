import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useUIStore } from '../store/uiStore';

export function useMaritimeMapPayload() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: ['maritime', 'mapPayload', dashboardCompanyId],
    queryFn: () => api.maritime.getMapPayload(),
    enabled: !!dashboardCompanyId,
    staleTime: 60 * 60 * 1000,
  });
}
