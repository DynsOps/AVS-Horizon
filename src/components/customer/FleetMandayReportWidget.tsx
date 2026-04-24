import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../services/api';
import { FleetMandayReport, FleetMandayReportVessel } from '../../types';
import { Card } from '../ui/Card';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DONUT_COLORS = [
  '#22d3ee', '#8b5cf6', '#f97316', '#ec4899', '#10b981', '#f59e0b', '#6b7280',
];

const fmt = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US');

const exportToXLSX = (vessels: FleetMandayReportVessel[], year: number, month: number) => {
  const rows = vessels.map((v) => ({
    Vessel: v.vesselName,
    Budget: Math.round(v.budget),
    Actual: Math.round(v.actual),
    'Var%': v.budget === 0 ? '—' : (v.variancePct > 0 ? '+' : '') + v.variancePct.toFixed(1) + '%',
    Rate: v.rate.toFixed(2),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fleet Spend');
  XLSX.writeFile(wb, `fleet-spend-${year}-${String(month).padStart(2, '0')}.xlsx`);
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
      <td style="color:${v.budget === 0 ? '#9ca3af' : v.variancePct > 0 ? '#dc2626' : '#16a34a'}">${v.budget === 0 ? '—' : (v.variancePct > 0 ? '+' : '') + v.variancePct.toFixed(1) + '%'}</td>
      <td>${v.rate.toFixed(2)}</td>
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
  <table><thead><tr><th>Vessel</th><th>Budget</th><th>Actual</th><th>Var%</th><th>Rate</th></tr></thead>
  <tbody>${rows}</tbody></table>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
};

const buildPieData = (vessels: FleetMandayReportVessel[]) => {
  const sorted = [...vessels].sort((a, b) => b.actual - a.actual);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const totalActual = vessels.reduce((s, v) => s + v.actual, 0);

  const entries = top.map((v) => ({
    name: v.vesselName,
    value: v.actual,
    pct: totalActual > 0 ? (v.actual / totalActual) * 100 : 0,
    isOther: false,
  }));

  if (rest.length > 0) {
    const otherActual = rest.reduce((s, v) => s + v.actual, 0);
    entries.push({
      name: `Other (${rest.length} vessel${rest.length > 1 ? 's' : ''})`,
      value: otherActual,
      pct: totalActual > 0 ? (otherActual / totalActual) * 100 : 0,
      isOther: true,
    });
  }

  return { entries, totalActual };
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

  // Donut chart data
  const { entries: pieEntries } = report && report.vessels.length > 0
    ? buildPieData(report.vessels)
    : { entries: [] };

  // Top offenders: budget > 0, variance positive, sorted desc
  const topOffenders = report
    ? [...report.vessels]
        .filter((v) => v.budget > 0 && v.variancePct > 0)
        .sort((a, b) => b.variancePct - a.variancePct)
        .slice(0, 3)
    : [];

  // Top improvers: budget > 0, variance negative, sorted asc (most negative first)
  const topImprovers = report
    ? [...report.vessels]
        .filter((v) => v.budget > 0 && v.variancePct < 0)
        .sort((a, b) => a.variancePct - b.variancePct)
        .slice(0, 3)
    : [];

  const hasVessels = report && report.vessels.length > 0;

  return (
    <div className="space-y-4">
      {/* Exception Alerts */}
      <Card title="Exception Alerts" action={selector}>
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
                  {exc.noBudget
                    ? `Manday rate $${exc.mandayRate.toFixed(2)} — no budget set`
                    : `Manday rate $${exc.mandayRate.toFixed(2)} (+${exc.overPct}% over)`}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Spend by Vessel donut */}
      <Card title="Spend by Vessel">
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : !hasVessels ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No data for selected month.</p>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Donut */}
            <div className="relative shrink-0" style={{ width: 260, height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieEntries}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieEntries.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [fmt(value), 'Actual']}
                    contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: '#e5e7eb' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Total</span>
                <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {fmt(totalActual)}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 flex-1">
              {pieEntries.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 min-w-0">
                  <span
                    className="mt-1 size-2.5 rounded-full shrink-0"
                    style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{entry.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {fmt(entry.value)} · {entry.pct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Top Offenders + Top Improvers */}
      {hasVessels && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Offenders */}
          <Card title="Top Offenders">
            {topOffenders.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No vessels over budget.</p>
            ) : (
              <ol className="space-y-3">
                {topOffenders.map((v, i) => (
                  <li key={v.imo} className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 dark:text-gray-500 w-5 shrink-0">{i + 1}.</span>
                    <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{v.vesselName}</span>
                    <span className="text-sm font-semibold tabular-nums text-red-500">
                      +{v.variancePct.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* Top Improvers */}
          <Card title="Top Improvers">
            {topImprovers.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No vessels under budget.</p>
            ) : (
              <ol className="space-y-3">
                {topImprovers.map((v, i) => (
                  <li key={v.imo} className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 dark:text-gray-500 w-5 shrink-0">{i + 1}.</span>
                    <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{v.vesselName}</span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-500">
                      {v.variancePct.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}

      {/* Fleet Spend vs Budget */}
      <Card title="Fleet Spend vs Budget">
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : !hasVessels ? (
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
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Vessel</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Budget</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actual</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Var %</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {report!.vessels.map((v, idx) => (
                    <tr
                      key={v.imo}
                      className={`border-t border-gray-100 dark:border-gray-800 ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{v.vesselName}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmt(v.budget)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmt(v.actual)}</td>
                      <td className="px-4 py-3 text-right">
                        {v.budget === 0 ? (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            v.variancePct > 0
                              ? 'bg-red-500/15 text-red-500 dark:text-red-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {v.variancePct > 0 ? '+' : ''}{v.variancePct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
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
                onClick={() => exportToPDF(report!.vessels, year, month, totalBudget, totalActual)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                PDF
              </button>
              <button
                onClick={() => exportToXLSX(report!.vessels, year, month)}
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
