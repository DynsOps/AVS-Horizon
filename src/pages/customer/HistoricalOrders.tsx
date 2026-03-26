import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { Order } from '../../types';
import { History, Search } from 'lucide-react';

export const HistoricalOrders: React.FC = () => {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.customer.getHistoricalOrders(user?.companyId).then(setOrders);
  }, [user?.companyId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      o.id.toLowerCase().includes(q) ||
      o.vesselName.toLowerCase().includes(q) ||
      o.port.toLowerCase().includes(q)
    );
  }, [orders, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <History size={20} className="text-blue-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Historical Orders</h1>
      </div>

      <Card>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search historical orders..."
            className="w-full pl-8 pr-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm"
          />
        </div>
      </Card>

      <Card noPadding className="overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3">Order ID</th>
              <th className="px-6 py-3">Vessel</th>
              <th className="px-6 py-3">Port</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {filtered.map((o) => (
              <tr key={o.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-6 py-3 font-mono text-slate-700 dark:text-slate-200">{o.id}</td>
                <td className="px-6 py-3 text-slate-700 dark:text-slate-200">{o.vesselName}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{o.port}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{o.date}</td>
                <td className="px-6 py-3 text-slate-700 dark:text-slate-200">{o.currency} {o.amount.toLocaleString()}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{o.status}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-sm text-slate-500">No historical orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
