import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';
import { useApiMutation } from '../useApiMutation';
import type { AppNotification } from '../../types';

export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications.list(),
    queryFn: () => api.notifications.getNotifications(),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  return useApiMutation(
    (id: string) => api.notifications.markNotificationRead(id),
    {
      invalidates: [qk.notifications.list()],
    },
  );
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.deleteNotification(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk.notifications.list() });
      const previous = queryClient.getQueryData<AppNotification[]>(qk.notifications.list());
      queryClient.setQueryData<AppNotification[]>(
        qk.notifications.list(),
        (old) => old?.filter((n) => n.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qk.notifications.list(), ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.notifications.list() }),
  });
}
