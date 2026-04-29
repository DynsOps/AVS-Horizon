import React from 'react';
import { Card } from '../../components/ui/Card';
import { Ship } from 'lucide-react';
import { usePortFees } from '../../hooks/queries/usePortFees';

export const PortFeeList: React.FC = () => {
  const { data: rows = [], isLoading, isError } = usePortFees();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Ship size={20} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Port Fee List</h1>
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
