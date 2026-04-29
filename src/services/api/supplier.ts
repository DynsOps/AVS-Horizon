import { request } from '../../lib/apiClient';
import type { KPI } from '../../types';

export const supplier = {
  getKPIs: async (): Promise<KPI[]> => {
    const payload = await request<{ kpis: KPI[] }>('api/supplier/kpis');
    return payload.kpis;
  },
};
