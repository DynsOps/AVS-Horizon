import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';

export function usePowerBiEmbed(reportId: string | null) {
  return useQuery({
    queryKey: qk.powerbi.embed(reportId),
    queryFn: () => api.powerbi.getEmbedConfig(reportId!),
    enabled: !!reportId,
  });
}
