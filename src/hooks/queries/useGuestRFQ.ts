import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { qk } from '../../lib/queryKeys';
import { useApiMutation } from '../useApiMutation';
import type { GuestRFQ } from '../../types';

export function useMyRFQs() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: qk.rfq.list(user?.id),
    queryFn: () => api.guest.getMyRFQs(user!.id),
    enabled: !!user?.id,
  });
}

export function useSubmitRFQ() {
  return useApiMutation(
    (body: Omit<GuestRFQ, 'id' | 'createdAt'>) => api.guest.submitRFQ(body),
    {
      invalidates: [qk.rfq.list()],
    },
  );
}

export function useGenerateSuggestedProducts() {
  return useApiMutation(
    (input: Parameters<typeof api.guest.generateSuggestedProducts>[0]) =>
      api.guest.generateSuggestedProducts(input),
  );
}
