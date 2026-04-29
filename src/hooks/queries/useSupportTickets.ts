import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';
import { useApiMutation } from '../useApiMutation';
import type { SupportTicket } from '../../types';

export function useMyTickets() {
  return useQuery({
    queryKey: qk.support.myTickets(),
    queryFn: () => api.support.getMyTickets(),
  });
}

export function useAdminTickets() {
  return useQuery({
    queryKey: qk.support.adminTickets(),
    queryFn: () => api.support.getAdminTickets(),
  });
}

export function useOpenTicketsCount() {
  return useQuery({
    queryKey: qk.support.openCount(),
    queryFn: () => api.support.getOpenTicketsCount(),
    refetchInterval: 60_000,
  });
}

export function useCreateTicket() {
  return useApiMutation(
    (body: Pick<SupportTicket, 'subject' | 'description' | 'category'>) =>
      api.support.createTicket(body),
    {
      invalidates: [qk.support.myTickets()],
    },
  );
}

export function useReplyToMyTicket() {
  return useApiMutation(
    ({ ticketId, message }: { ticketId: string; message: string }) =>
      api.support.replyToMyTicket(ticketId, message),
    {
      invalidates: [qk.support.myTickets()],
    },
  );
}

export function useReplyToTicket() {
  return useApiMutation(
    ({ ticketId, message }: { ticketId: string; message: string }) =>
      api.support.replyToTicket(ticketId, message),
    {
      invalidates: [qk.support.adminTickets()],
    },
  );
}

export function useUpdateTicketStatus() {
  return useApiMutation(
    ({ ticketId, status }: { ticketId: string; status: SupportTicket['status'] }) =>
      api.support.updateTicketStatus(ticketId, status),
    {
      invalidates: [qk.support.adminTickets(), qk.support.openCount()],
    },
  );
}
