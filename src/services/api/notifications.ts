import { request } from '../../lib/apiClient';
import type { AppNotification } from '../../types';

export const notifications = {
  getNotifications: async (): Promise<AppNotification[]> => {
    const payload = await request<{ notifications: AppNotification[] }>('api/notifications');
    return payload.notifications;
  },

  markNotificationRead: async (id: string): Promise<void> => {
    await request<{ notification: { id: string; isRead: boolean } }>(`api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  deleteNotification: async (id: string): Promise<void> => {
    await request<{ deleted: boolean }>(`api/notifications/${id}`, { method: 'DELETE' });
  },
};
