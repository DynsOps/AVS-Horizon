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

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconAlert = () => (
  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

const IconPieChart = () => (
  <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
  </svg>
);

const IconTrendingUp = ({ className = 'w-4 h-4 text-red-500' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const IconTrendingDown = ({ className = 'w-4 h-4 text-emerald-500' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
  </svg>
);

const IconTable = () => (
  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
  </svg>
);

const IconCurrency = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconRate = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const IconShipExceeded = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const IconFleet = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3m-4 12H9m-2 0v-4m0 4H5m4 0v-4m6-8l2 2-2 2m0-4h4v8h-4m0 0l-2 2" />
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const diffLabel = diff >= 0 ? `${fmt(diff)} under budget` : `${fmt(Math.abs(diff))} over budget`;

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
    body{font-family:sans-serif;padding:32px;color:#111}h2{margin-bottom:4px}.summary{margin-bottom:24px;font-size:14px;color:#555}
    table{width:100%;border-collapse:collapse;font-size:14px}
    th{text-align:left;padding:8px 12px;border-bottom:2px solid #ddd;color:#555;text-transform:uppercase;font-size:11px}
    td{padding:8px 12px;border-bottom:1px solid #eee}@media print{body{padding:16px}}
  </style></head><body>
  <h2>Fleet Spend vs Budget</h2>
  <div class="summary">${monthName} ${year} &nbsp;·&nbsp; Budget: ${fmt(totalBudget)} &nbsp;·&nbsp; Actual: ${fmt(totalActual)} &nbsp;·&nbsp; ${diffLabel}</div>
  <table><thead><tr><th>Vessel</th><th>Budget</th><th>Actual</th><th>Var%</th><th>Rate</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`;

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
  }));

  if (rest.length > 0) {
    const otherActual = rest.reduce((s, v) => s + v.actual, 0);
    entries.push({
      name: `Other (${rest.length} vessel${rest.length > 1 ? 's' : ''})`,
      value: otherActual,
      pct: totalActual > 0 ? (otherActual / totalActual) * 100 : 0,
    });
  }

  return entries;
};

// ── KPI mini-card ─────────────────────────────────────────────────────────────

interface MiniKpiProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'default' | 'red' | 'green';
}

const MiniKpi: React.FC<MiniKpiProps> = ({ icon, label, value, sub, accent = 'default' }) => {
  const iconBg =
    accent === 'red' ? 'bg-red-500/10 text-red-500' :
    accent === 'green' ? 'bg-emerald-500/10 text-emerald-500' :
    'bg-blue-500/10 text-blue-500';

  return (
    <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/90 border border-white/60 dark:border-slate-800/70 rounded-xl p-4 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-blue-400/20 to-transparent opacity-70" />
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${iconBg} shrink-0`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">{value}</p>
          {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
        </div>
      </div>
    </div>
  );
};

// ── Widget ────────────────────────────────────────────────────────────────────

export const FleetMandayReportWidget: React.FC = () => {
  const [year, setYear] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.getMonth() + 1;
  });
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
      .then((data) => { if (!cancelled) { setReport(data); setIsLoading(false); } })
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

  const totalBudget = report?.kpis.totalBudget ?? 0;
  // Invoice-based → KPI card only
  const totalSpendMtd = report?.kpis.totalSpendMtd ?? 0;
  const totalYtd = report?.kpis.totalSpendYtd ?? 0;
  // Manday-based → progress bars, donut, table
  const mandayActual = report?.vessels.reduce((s, v) => s + v.actual, 0) ?? 0;
  const avgCost = report?.kpis.avgCostPerManday ?? 0;
  const vesselsExceeded = report?.kpis.vesselsExceeded ?? 0;
  const vesselsTotal = report?.kpis.vesselsTotal ?? 0;
  const maxVal = Math.max(totalBudget, mandayActual, 1);
  const budgetPct = Math.min((totalBudget / maxVal) * 100, 100);
  const actualPct = Math.min((mandayActual / maxVal) * 100, 100);
  const diff = totalBudget - mandayActual;

  const pieEntries = report && report.vessels.length > 0 ? buildPieData(report.vessels) : [];
  const hasVessels = report && report.vessels.length > 0;

  const topOffenders = report
    ? [...report.vessels].filter((v) => v.budget > 0 && v.variancePct > 0).sort((a, b) => b.variancePct - a.variancePct).slice(0, 3)
    : [];
  const topImprovers = report
    ? [...report.vessels].filter((v) => v.budget > 0 && v.variancePct < 0).sort((a, b) => a.variancePct - b.variancePct).slice(0, 3)
    : [];

  const loadingEl = <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>;
  const errorEl = error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null;

  return (
    <div className="space-y-4">

      {/* ── Global filter ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Fleet Performance</h2>
        <div className="flex items-center gap-2">
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
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniKpi icon={<IconCurrency />} label="Total Spend MTD" value={fmt(totalSpendMtd)} sub={`YTD: ${fmt(totalYtd)}`} />
        <MiniKpi icon={<IconRate />} label="Avg Cost / Manday" value={fmt(avgCost)} sub="fleet daily avg" />
        <MiniKpi
          icon={<IconShipExceeded />}
          label="Over Budget"
          value={String(vesselsExceeded)}
          sub={vesselsTotal > 0 ? `of ${vesselsTotal} vessels` : undefined}
          accent={vesselsExceeded > 0 ? 'red' : 'default'}
        />
        <MiniKpi icon={<IconFleet />} label="Fleet Size" value={String(vesselsTotal)} sub="contracted vessels" accent="green" />
      </div>

      {/* ── Exception Alerts ── */}
      <Card title={<span className="flex items-center gap-2"><IconAlert />Exception Alerts</span>}>
        {isLoading ? loadingEl : errorEl ?? (
          !report || report.exceptions.length === 0
            ? <p className="text-sm text-gray-500 dark:text-gray-400">No exceptions this month.</p>
            : (
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
            )
        )}
      </Card>

      {/* ── Fleet Spend vs Budget ── */}
      <Card title={<span className="flex items-center gap-2"><IconTable />Fleet Spend vs Budget</span>}>
        {isLoading ? loadingEl : errorEl ?? (
          !hasVessels
            ? <p className="text-sm text-gray-500 dark:text-gray-400">No manday data for selected month.</p>
            : (
              <>
                {/* Aggregate bars */}
                <div className="mb-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-sm text-gray-500 dark:text-gray-400 shrink-0">Budget</span>
                    <div className="flex-1 h-5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full bg-cyan-400 transition-all duration-500" style={{ width: `${budgetPct}%` }} />
                    </div>
                    <span className="w-32 text-right text-sm font-medium tabular-nums">{fmt(totalBudget)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-sm text-gray-500 dark:text-gray-400 shrink-0">Actual</span>
                    <div className="flex-1 h-5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${mandayActual > totalBudget ? 'bg-red-400' : 'bg-cyan-500'}`} style={{ width: `${actualPct}%` }} />
                    </div>
                    <span className="w-32 text-right text-sm font-medium tabular-nums">{fmt(mandayActual)}</span>
                  </div>
                  <div className="text-right text-sm font-medium">
                    <span className={diff >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                      {fmt(Math.abs(diff))} {diff >= 0 ? 'under budget' : 'over budget'}
                    </span>
                  </div>
                </div>

                {/* Table */}
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
                        <tr key={v.imo} className={`border-t border-gray-100 dark:border-gray-800 ${idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{v.vesselName}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmt(v.budget)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmt(v.actual)}</td>
                          <td className="px-4 py-3 text-right">
                            {v.budget === 0 ? (
                              <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                            ) : (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${v.variancePct > 0 ? 'bg-red-500/15 text-red-500 dark:text-red-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                                {v.variancePct > 0 ? '+' : ''}{v.variancePct.toFixed(1)}%
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">${v.rate.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Export */}
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => exportToPDF(report!.vessels, year, month, totalBudget, mandayActual)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                    PDF
                  </button>
                  <button onClick={() => exportToXLSX(report!.vessels, year, month)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                    Excel
                  </button>
                </div>
              </>
            )
        )}
      </Card>

      {/* ── Spend by Vessel ── */}
      <Card title={<span className="flex items-center gap-2"><IconPieChart />Spend by Vessel</span>}>
        {isLoading ? loadingEl : errorEl ?? (
          !hasVessels
            ? <p className="text-sm text-gray-500 dark:text-gray-400">No data for selected month.</p>
            : (
              <div className="flex flex-col items-center gap-8">
                {/* Donut */}
                <div className="relative" style={{ width: 280, height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieEntries} cx="50%" cy="50%" innerRadius={90} outerRadius={130} paddingAngle={2} dataKey="value" strokeWidth={0}>
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-gray-400 dark:text-gray-500 mb-1">Total</span>
                    <span className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt(mandayActual)}</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-3 w-full max-w-lg mx-auto">
                  {pieEntries.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2 min-w-0">
                      <span className="mt-1 size-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{entry.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{fmt(entry.value)} · {entry.pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
        )}
      </Card>

      {/* ── Top Offenders + Top Improvers ── */}
      {hasVessels && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title={<span className="flex items-center gap-2"><IconTrendingUp />Top Offenders</span>}>
            {topOffenders.length === 0
              ? <p className="text-sm text-gray-500 dark:text-gray-400">No vessels over budget.</p>
              : (
                <ol className="space-y-3">
                  {topOffenders.map((v, i) => (
                    <li key={v.imo} className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 dark:text-gray-500 w-5 shrink-0">{i + 1}.</span>
                      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{v.vesselName}</span>
                      <span className="text-sm font-semibold tabular-nums text-red-500">+{v.variancePct.toFixed(1)}%</span>
                    </li>
                  ))}
                </ol>
              )}
          </Card>

          <Card title={<span className="flex items-center gap-2"><IconTrendingDown />Top Improvers</span>}>
            {topImprovers.length === 0
              ? <p className="text-sm text-gray-500 dark:text-gray-400">No vessels under budget.</p>
              : (
                <ol className="space-y-3">
                  {topImprovers.map((v, i) => (
                    <li key={v.imo} className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 dark:text-gray-500 w-5 shrink-0">{i + 1}.</span>
                      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{v.vesselName}</span>
                      <span className="text-sm font-semibold tabular-nums text-emerald-500">{v.variancePct.toFixed(1)}%</span>
                    </li>
                  ))}
                </ol>
              )}
          </Card>
        </div>
      )}

    </div>
  );
};
