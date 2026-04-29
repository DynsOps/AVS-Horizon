import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { AsyncActionButton } from '../../components/ui/AsyncActionButton';
import { useUIStore } from '../../store/uiStore';
import { SupportTicket } from '../../types';
import { useAdminTickets, useReplyToTicket } from '../../hooks/queries/useSupportTickets';

const PAGE_SIZE = 8;
type AdminFilter = 'All' | SupportTicket['status'];

const statusClasses: Record<SupportTicket['status'], string> = {
  Open: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-300',
  Resolved: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-300',
};

export const SupportTicketManagement: React.FC = () => {
  const { addToast } = useUIStore();
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState<AdminFilter>('Open');
  const [page, setPage] = useState(1);

  const { data: tickets = [] } = useAdminTickets();
  const replyToTicket = useReplyToTicket();

  const isSubmittingReply = replyToTicket.isPending;

  const filteredTickets = useMemo(() => {
    if (activeFilter === 'All') return tickets;
    return tickets.filter((ticket) => ticket.status === activeFilter);
  }, [activeFilter, tickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedTickets = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTickets.slice(start, start + PAGE_SIZE);
  }, [filteredTickets, page]);

  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicketId(filteredTickets[0]?.id || '');
      return;
    }

    const existsInFiltered = filteredTickets.some((ticket) => ticket.id === selectedTicketId);
    if (!existsInFiltered) {
      setSelectedTicketId(filteredTickets[0]?.id || '');
    }
  }, [filteredTickets, selectedTicketId]);

  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedTicketId) || null;

  const latestSupportReply = useMemo(() => {
    if (!selectedTicket?.replies?.length) return null;
    return [...selectedTicket.replies].reverse().find((reply) => reply.authorRole === 'supadmin') || null;
  }, [selectedTicket]);

  const submitReply = () => {
    if (!selectedTicket) return;
    const message = replyMessage.trim();
    if (!message) {
      addToast({ title: 'Validation Error', message: 'Reply message is required.', type: 'error' });
      return;
    }

    replyToTicket.mutate(
      { ticketId: selectedTicket.id, message },
      {
        onSuccess: () => {
          setReplyMessage('');
          addToast({ title: 'Resolved', message: `Ticket ${selectedTicket.id} resolved with response.`, type: 'success' });
        },
        onError: (error) => {
          addToast({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to send reply.', type: 'error' });
        },
      },
    );
  };

  const filterButtons: AdminFilter[] = ['Open', 'Resolved', 'All'];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <Card title="Support Queue" className="xl:col-span-3" noPadding>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setActiveFilter(filter);
                  setPage(1);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeFilter === filter
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-800">
              <thead className="bg-gray-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/60">
                <tr>
                  <th className="px-3 py-2">Ticket</th>
                  <th className="px-3 py-2">Requester</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {pagedTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className={`cursor-pointer transition hover:bg-gray-50 dark:hover:bg-slate-900/60 ${
                      ticket.id === selectedTicketId ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                    }`}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{ticket.id}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{ticket.createdByEmail || ticket.createdByUserId}</td>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{ticket.subject}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] ${statusClasses[ticket.status]}`}>{ticket.status}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{new Date(ticket.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagedTickets.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No tickets in this filter.</p>}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded border border-gray-200 px-3 py-1.5 text-xs text-slate-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded border border-gray-200 px-3 py-1.5 text-xs text-slate-600 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Ticket Detail" className="xl:col-span-2">
        {!selectedTicket && <p className="text-sm text-slate-500">Select a ticket from queue.</p>}

        {selectedTicket && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-slate-800">
              <p className="text-xs font-mono text-slate-500">{selectedTicket.id}</p>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{selectedTicket.subject}</h2>
              <p className="text-sm text-slate-500">{selectedTicket.createdByEmail || selectedTicket.createdByUserId}</p>
              <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] ${statusClasses[selectedTicket.status]}`}>{selectedTicket.status}</span>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Request</p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg border border-gray-200 p-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
                {selectedTicket.description}
              </p>
            </div>

            {latestSupportReply && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Response</p>
                <p className="mt-1 whitespace-pre-wrap rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-100">
                  {latestSupportReply.message}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resolve Ticket</p>
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={5}
                disabled={selectedTicket.status === 'Resolved'}
                placeholder={selectedTicket.status === 'Resolved' ? 'Resolved ticket. Create a new ticket for further requests.' : 'Write official response and resolve ticket...'}
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 disabled:opacity-70"
              />
              <AsyncActionButton
                onClick={() => void submitReply()}
                isPending={isSubmittingReply}
                disabled={selectedTicket.status === 'Resolved'}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
              >
                Send Response And Resolve
              </AsyncActionButton>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
