import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../services/api';
import { Order, Shipment } from '../../types';

type OperationalRow = {
  id: string;
  type: 'Order' | 'Shipment';
  reference: string;
  location: string;
  etaOrDate: string;
  status: string;
};

export const OperationalList: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboardCompanyId } = useUIStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const effectiveCompanyId = dashboardCompanyId || user?.companyId;

  useEffect(() => {
    if (!effectiveCompanyId) return;
    Promise.all([
      api.customer.getOrders(effectiveCompanyId),
      api.customer.getShipments(effectiveCompanyId),
    ]).then(([o, s]) => {
      setOrders(o);
      setShipments(s);
    });
  }, [effectiveCompanyId]);

  const rows = useMemo<OperationalRow[]>(() => {
    const orderRows = orders.map((o) => ({
      id: `order-${o.id}`,
      type: 'Order' as const,
      reference: o.id,
      location: o.port,
      etaOrDate: o.date,
      status: o.status,
    }));
    const shipmentRows = shipments.map((s) => ({
      id: `shipment-${s.id}`,
      type: 'Shipment' as const,
      reference: s.id,
      location: `${s.origin} -> ${s.destination}`,
      etaOrDate: s.eta,
      status: s.status,
    }));
    return [...orderRows, ...shipmentRows];
  }, [orders, shipments]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Operational List</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Unified view of orders and shipments for your entity.</p>
      </div>

      <Card noPadding className="overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Reference</th>
              <th className="px-6 py-3">Location</th>
              <th className="px-6 py-3">Date / ETA</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-6 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs border ${
                    row.type === 'Order'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800'
                  }`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-6 py-3 font-mono text-slate-700 dark:text-slate-200">{row.reference}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{row.location}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{row.etaOrDate}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{row.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-sm text-slate-500">
                  No operational records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
