import React from 'react';
import { Card } from '../../components/ui/Card';
import { useUIStore } from '../../store/uiStore';
import { FileText } from 'lucide-react';
import { useInvoices } from '../../hooks/queries/useInvoices';

export const InvoiceList: React.FC = () => {
  const { addToast } = useUIStore();
  const { data: invoices = [], isLoading, isError } = useInvoices();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoice List</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Entity-scoped invoice records.</p>
        </div>
        <Card noPadding className="overflow-hidden">
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-sm text-red-500 dark:text-red-400">
        Failed to load data. Please refresh and try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoice List</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Entity-scoped invoice records.</p>
      </div>

      <Card noPadding className="overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3">Invoice</th>
              <th className="px-6 py-3">Reference</th>
              <th className="px-6 py-3">Issue Date</th>
              <th className="px-6 py-3">Due Date</th>
              <th className="px-6 py-3 text-right">Amount</th>
              <th className="px-6 py-3 text-center">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {invoices.map((inv) => (
              <tr key={inv.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-6 py-3 font-mono text-slate-700 dark:text-slate-200">{inv.id}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{inv.reference}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{inv.issueDate}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{inv.dueDate}</td>
                <td className="px-6 py-3 text-right font-medium text-slate-800 dark:text-slate-200">${inv.amount.toLocaleString()}</td>
                <td className="px-6 py-3 text-center">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs border ${
                    inv.status === 'Paid'
                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                      : inv.status === 'Overdue'
                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
                  }`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => addToast({ title: 'Invoice', message: `Invoice ${inv.id} detail view is ready.`, type: 'info' })}
                    className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <FileText size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-6 text-center text-sm text-slate-500">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
