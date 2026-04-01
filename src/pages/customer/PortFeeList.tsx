import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../services/api';
import { Ship } from 'lucide-react';

type PortFeeRow = {
  port: string;
  vesselCount: number;
  totalFee: number;
  currency: string;
};

export const PortFeeList: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboardCompanyId } = useUIStore();
  const [rows, setRows] = useState<PortFeeRow[]>([]);
  const effectiveCompanyId = dashboardCompanyId || user?.companyId;

  useEffect(() => {
    api.customer.getPortFees(effectiveCompanyId).then(setRows);
  }, [effectiveCompanyId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Ship size={20} className="text-blue-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Port Fee List</h1>
      </div>

      <Card noPadding className="overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3">Port</th>
              <th className="px-6 py-3">Active Vessels</th>
              <th className="px-6 py-3 text-right">Total Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.port} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-6 py-3 text-slate-700 dark:text-slate-200">{row.port}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{row.vesselCount}</td>
                <td className="px-6 py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                  {row.currency} {row.totalFee.toLocaleString()}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-6 text-center text-sm text-slate-500">No port fee records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
