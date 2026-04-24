import React, { useEffect, useMemo, useState } from 'react';
import { AsyncActionButton } from '../../components/ui/AsyncActionButton';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../services/api';
import { SupportTicket } from '../../types';
import { LifeBuoy, Send } from 'lucide-react';

const PAGE_SIZE = 6;
type TicketFilter = 'All' | SupportTicket['status'];

const statusClasses: Record<SupportTicket['status'], string> = {
  Open: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-300',
  Resolved: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-300',
};

export const SupportTickets: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SupportTicket['category']>('General');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TicketFilter>('All');
  const [page, setPage] = useState(1);

  const loadTickets = async () => {
    if (!user?.id) return;
    const data = await api.support.getMyTickets();
    setTickets(data);
  };

  useEffect(() => {
    void loadTickets();
  }, [user?.id]);

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

  const submitTicket = async () => {
    if (!user?.id) return;
    if (!subject.trim() || !description.trim()) {
      addToast({ title: 'Validation Error', message: 'Subject and description are required.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.support.createTicket({
        subject: subject.trim(),
        description: description.trim(),
        category,
      });
      setSubject('');
      setDescription('');
      setCategory('General');
      setActiveFilter('All');
      setPage(1);
      await loadTickets();
      addToast({ title: 'Ticket Created', message: 'Support ticket created successfully.', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create support ticket.';
      addToast({ title: 'Error', message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReplyPreview = (ticket: SupportTicket): string => {
    const supportReply = [...(ticket.replies || [])].reverse().find((reply) => reply.authorRole === 'supadmin');
    return supportReply ? supportReply.message : 'Waiting for support response';
  };

  const filterButtons: TicketFilter[] = ['All', 'Open', 'Resolved'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LifeBuoy size={20} className="text-blue-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Support Tickets</h1>
      </div>

      <Card title="Create Ticket">
        <div className="space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SupportTicket['category'])}
            className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="General">General</option>
            <option value="Operational">Operational</option>
            <option value="Invoice">Invoice</option>
            <option value="Technical">Technical</option>
          </select>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your issue..."
            rows={4}
            className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />

          <AsyncActionButton
            onClick={() => void submitTicket()}
            isPending={isSubmitting}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
          >
            <Send size={14} />
            Submit Ticket
          </AsyncActionButton>
        </div>
      </Card>

      <Card title="My Ticket History">
        <div className="space-y-4">
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
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Support</th>
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
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{ticket.subject}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] ${statusClasses[ticket.status]}`}>{ticket.status}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{new Date(ticket.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {ticket.replies?.some((reply) => reply.authorRole === 'supadmin') ? 'Answered' : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagedTickets.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No tickets found.</p>}
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

          {selectedTicket && (
            <div className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-mono text-slate-500">{selectedTicket.id}</p>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[11px] ${statusClasses[selectedTicket.status]}`}>{selectedTicket.status}</span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your Request</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{selectedTicket.description}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Support Response</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{getReplyPreview(selectedTicket)}</p>
              </div>

              <p className="text-xs text-slate-500">
                To add new details after closure, please open a new support ticket.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
