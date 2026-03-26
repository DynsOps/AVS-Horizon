import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../services/api';
import { SupportTicket } from '../../types';
import { LifeBuoy, Send } from 'lucide-react';

export const SupportTickets: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SupportTicket['category']>('General');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTickets = async () => {
    if (!user?.id) return;
    const data = await api.support.getTicketsByUser(user.id);
    setTickets(data);
  };

  useEffect(() => {
    void loadTickets();
  }, [user?.id]);

  const submitTicket = async () => {
    if (!user?.id) return;
    if (!subject.trim() || !description.trim()) {
      addToast({ title: 'Validation Error', message: 'Subject and description are required.', type: 'error' });
      return;
    }
    setIsSubmitting(true);
    try {
      await api.support.createTicket({
        createdByUserId: user.id,
        createdByEmail: user.email,
        subject: subject.trim(),
        description: description.trim(),
        category,
      });
      setSubject('');
      setDescription('');
      setCategory('General');
      await loadTickets();
      addToast({ title: 'Ticket Created', message: 'Support ticket created successfully.', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create support ticket.';
      addToast({ title: 'Error', message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportTicket['category'])}
              className="px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            >
              <option value="General">General</option>
              <option value="Operational">Operational</option>
              <option value="Invoice">Invoice</option>
              <option value="Technical">Technical</option>
            </select>
            <div className="md:col-span-2" />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your issue..."
            rows={4}
            className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          />
          <button
            onClick={() => void submitTicket()}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
          >
            <Send size={14} />
            {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </Card>

      <Card title="My Tickets" noPadding>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3">Ticket ID</th>
              <th className="px-6 py-3">Subject</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="text-sm">
                <td className="px-6 py-3 font-mono text-slate-700 dark:text-slate-200">{ticket.id}</td>
                <td className="px-6 py-3 text-slate-700 dark:text-slate-200">{ticket.subject}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{ticket.category}</td>
                <td className="px-6 py-3">
                  <span className="rounded-full px-2 py-1 text-xs border bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
                    {ticket.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{new Date(ticket.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-sm text-slate-500">
                  No tickets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
