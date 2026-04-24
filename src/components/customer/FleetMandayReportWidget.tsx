import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FleetMandayReport } from '../../types';
import { Card } from '../ui/Card';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const FleetMandayReportWidget: React.FC = () => {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [report, setReport] = useState<FleetMandayReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuthStore();
  const { addToast, dashboardCompanyId } = useUIStore();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.customer.getFleetMandayReport({ year, month })
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setIsLoading(false);
          addToast({ title: 'Failed to load fleet report', message: msg, type: 'error' });
        }
      });
    return () => { cancelled = true; };
  }, [dashboardCompanyId, user?.companyId, year, month]);

  const selector = (
    <div className="flex items-center gap-2 text-sm">
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={i + 1} value={i + 1}>{name}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
      >
        {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Exception Alerts */}
      <Card title="Exception Alerts">
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : !report || report.exceptions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No exceptions this month.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {report.exceptions.map((exc) => (
              <div key={exc.imo} className="flex items-center gap-3 py-2">
                <span className={`size-2 rounded-full flex-shrink-0 ${exc.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <span className="font-medium text-sm">{exc.vesselName}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Manday rate {exc.mandayRate.toFixed(2)} (+{exc.overPct}% over)
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Fleet Spend vs Budget */}
      <Card title="Fleet Spend vs Budget" action={selector}>
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : !report || report.vessels.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No manday data for selected month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                  <th className="pb-2 font-medium">Vessel</th>
                  <th className="pb-2 font-medium text-right">Budget</th>
                  <th className="pb-2 font-medium text-right">Actual</th>
                  <th className="pb-2 font-medium text-right">Var%</th>
                  <th className="pb-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {report.vessels.map((v) => (
                  <tr key={v.imo}>
                    <td className="py-2 font-medium">{v.vesselName}</td>
                    <td className="py-2 text-right">{v.budget.toLocaleString()}</td>
                    <td className="py-2 text-right">{v.actual.toLocaleString()}</td>
                    <td className={`py-2 text-right font-medium ${v.variancePct > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {v.variancePct > 0 ? '+' : ''}{v.variancePct.toFixed(1)}%
                    </td>
                    <td className="py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        v.exceeded
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {v.exceeded ? 'EXCEEDED' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
