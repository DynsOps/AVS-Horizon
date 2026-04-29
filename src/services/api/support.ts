import { request } from '../../lib/apiClient';
import type { SupportTicket } from '../../types';

export const support = {
  getMyTickets: async (): Promise<SupportTicket[]> => {
    const payload = await request<{ tickets: SupportTicket[] }>('api/support/tickets/me');
    return payload.tickets;
  },

  createTicket: async (
    body: Pick<SupportTicket, 'subject' | 'description' | 'category'>,
  ): Promise<SupportTicket> => {
    const payload = await request<{ ticket: SupportTicket }>('api/support/tickets', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return payload.ticket;
  },

  replyToMyTicket: async (ticketId: string, message: string): Promise<void> => {
    await request<{ reply: unknown }>(`api/support/tickets/${ticketId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  getAdminTickets: async (): Promise<SupportTicket[]> => {
    const payload = await request<{ tickets: SupportTicket[] }>('api/support/admin/tickets');
    return payload.tickets;
  },

  getOpenTicketsCount: async (): Promise<number> => {
    const payload = await request<{ count: number }>('api/support/admin/tickets/open-count');
    return payload.count;
  },

  replyToTicket: async (ticketId: string, message: string): Promise<void> => {
    await request<{ reply: unknown }>(`api/support/admin/tickets/${ticketId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  updateTicketStatus: async (ticketId: string, status: SupportTicket['status']): Promise<void> => {
    await request<{ ticket: { id: string; status: SupportTicket['status'] } }>(
      `api/support/admin/tickets/${ticketId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    );
  },
};
