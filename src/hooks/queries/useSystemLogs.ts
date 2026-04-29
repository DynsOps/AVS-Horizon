import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';

export function useSystemLogs() {
  return useQuery({
    queryKey: qk.systemLogs.all(),
    queryFn: () => api.admin.getSystemLogs(),
  });
}
