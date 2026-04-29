import { request, requestPublic } from '../../lib/apiClient';
import type { GuestRFQ, SuggestedItem } from '../../types';

export const guest = {
  generateSuggestedProducts: async (input: {
    vesselName: string;
    port: string;
    details: string;
  }): Promise<SuggestedItem[]> => {
    const payload = await requestPublic<{ items: SuggestedItem[] }>('api/guest/suggest-products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return payload.items;
  },

  submitRFQ: async (body: Omit<GuestRFQ, 'id' | 'createdAt'>): Promise<GuestRFQ> => {
    const payload = await request<{ rfq: GuestRFQ }>('api/guest/rfq', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return payload.rfq;
  },

  getMyRFQs: async (_userId: string): Promise<GuestRFQ[]> => {
    const payload = await request<{ rfqs: GuestRFQ[] }>('api/guest/rfq/me');
    return payload.rfqs;
  },
};
