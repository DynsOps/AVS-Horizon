import { request } from '../../lib/apiClient';
import { useUIStore } from '../../store/uiStore';

type EmbedConfig = {
  report: { id: string; name: string; permissionKey: string };
  embedConfig: {
    type: 'report';
    reportId: string;
    embedUrl: string;
    tokenType: 'Embed';
    accessToken: string;
    expiration: string;
  };
  rls: { username: string | null; roles: string[] };
};

export const powerbi = {
  getEmbedConfig: async (reportConfigId: string): Promise<EmbedConfig> => {
    const selectedCompanyId = useUIStore.getState().dashboardCompanyId;
    return request<EmbedConfig>('api/powerbi/embed-config', {
      method: 'POST',
      body: JSON.stringify({
        reportConfigId,
        ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
      }),
    });
  },
};
