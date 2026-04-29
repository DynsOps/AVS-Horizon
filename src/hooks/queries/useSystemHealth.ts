import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';

export function useSystemHealth() {
  return useQuery({
    queryKey: qk.systemHealth.all(),
    queryFn: () => api.admin.getSystemHealth(),
    refetchInterval: 30_000,
  });
}
