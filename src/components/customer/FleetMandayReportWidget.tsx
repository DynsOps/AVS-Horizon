import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { FleetMandayReport, FleetMandayReportVessel } from '../../types';
import { Card } from '../ui/Card';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmt = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US');

const exportToCSV = (vessels: FleetMandayReportVessel[], year: number, month: number) => {
  const header = ['Vessel', 'Budget', 'Actual', 'Rate', 'Var%', 'Status'];
  const rows = vessels.map((v) => [
    v.vesselName,
    Math.round(v.budget),
    Math.round(v.actual),
    v.rate.toFixed(2),
    v.variancePct.toFixed(1) + '%',
    v.exceeded ? 'EXCEEDED' : 'OK',
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fleet-spend-${year}-${String(month).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportToPDF = (vessels: FleetMandayReportVessel[], year: number, month: number, totalBudget: number, totalActual: number) => {
  const monthName = MONTH_NAMES[month - 1];
  const diff = totalBudget - totalActual;
  const diffLabel = diff >= 0
    ? `${fmt(diff)} under budget`
    : `${fmt(Math.abs(diff))} over budget`;

  const rows = vessels.map((v) => `
    <tr>
      <td>${v.vesselName}</td>
      <td>${fmt(v.budget)}</td>
      <td>${fmt(v.actual)}</td>
      <td>${fmt(v.rate)}</td>
      <td style="color:${v.variancePct > 0 ? '#dc2626' : '#16a34a'}">${v.variancePct > 0 ? '+' : ''}${v.variancePct.toFixed(1)}%</td>
      <td>${v.exceeded ? 'EXCEEDED' : 'OK'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><title>Fleet Spend vs Budget — ${monthName} ${year}</title>
  <style>
    body { font-family: sans-serif; padding: 32px; color: #111; }
    h2 { margin-bottom: 4px; }
    .summary { margin-bottom: 24px; font-size: 14px; color: #555; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #ddd; color: #555; text-transform: uppercase; font-size: 11px; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    @media print { body { padding: 16px; } }
  </style></head><body>
  <h2>Fleet Spend vs Budget</h2>
  <div class="summary">${monthName} ${year} &nbsp;·&nbsp; Budget: ${fmt(totalBudget)} &nbsp;·&nbsp; Actual: ${fmt(totalActual)} &nbsp;·&nbsp; ${diffLabel}</div>
  <table><thead><tr><th>Vessel</th><th>Budget</th><th>Actual</th><th>Rate</th><th>Var%</th><th>Status</th></tr></thead>
  <tbody>${rows}</tbody></table>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
};

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

  const totalBudget = report?.kpis.totalBudget ?? 0;
  const totalActual = report?.kpis.totalSpendMtd ?? 0;
  const maxVal = Math.max(totalBudget, totalActual, 1);
  const budgetPct = Math.min((totalBudget / maxVal) * 100, 100);
  const actualPct = Math.min((totalActual / maxVal) * 100, 100);
  const diff = totalBudget - totalActual;

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
                  Manday rate ${exc.mandayRate.toFixed(2)} (+{exc.overPct}% over)
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
          <>
            {/* Aggregate progress bars */}
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-16 text-sm text-gray-500 dark:text-gray-400 shrink-0">Budget</span>
                <div className="flex-1 h-5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <span className="w-32 text-right text-sm font-medium tabular-nums">{fmt(totalBudget)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 text-sm text-gray-500 dark:text-gray-400 shrink-0">Actual</span>
                <div className="flex-1 h-5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${totalActual > totalBudget ? 'bg-red-400' : 'bg-cyan-500'}`}
                    style={{ width: `${actualPct}%` }}
                  />
                </div>
                <span className="w-32 text-right text-sm font-medium tabular-nums">{fmt(totalActual)}</span>
              </div>
              <div className="text-right text-sm font-medium">
                <span className={diff >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                  {fmt(Math.abs(diff))} {diff >= 0 ? 'under budget' : 'over budget'}
                </span>
              </div>
            </div>

            {/* By Vessel table */}
            <div className="overflow-x-auto">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">By Vessel</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                    <th className="pb-2 font-medium uppercase text-xs tracking-wider">Vessel</th>
                    <th className="pb-2 font-medium text-right uppercase text-xs tracking-wider">Budget</th>
                    <th className="pb-2 font-medium text-right uppercase text-xs tracking-wider">Actual</th>
                    <th className="pb-2 font-medium text-right uppercase text-xs tracking-wider">Var %</th>
                    <th className="pb-2 font-medium text-right uppercase text-xs tracking-wider">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {report.vessels.map((v) => (
                    <tr key={v.imo}>
                      <td className="py-2 font-medium">{v.vesselName}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(v.budget)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(v.actual)}</td>
                      <td className="py-2 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          v.variancePct > 0
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {v.variancePct > 0 ? '+' : ''}{v.variancePct.toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                        ${v.rate.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Export buttons */}
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => exportToPDF(report.vessels, year, month, totalBudget, totalActual)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                PDF
              </button>
              <button
                onClick={() => exportToCSV(report.vessels, year, month)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Excel
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
