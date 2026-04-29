import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';
import { useUIStore } from '../../store/uiStore';

export function usePowerBiEmbed(reportId: string | null) {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.powerbi.embed(reportId, dashboardCompanyId),
    queryFn: () => api.powerbi.getEmbedConfig(reportId!),
    enabled: !!reportId && !!dashboardCompanyId,
  });
}
