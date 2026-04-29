import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ContractedVessel, FleetMandayReportVessel } from '../../types';
import { Card } from '../../components/ui/Card';
import { Anchor, ChevronRight, DollarSign, TrendingUp, TrendingDown, BarChart2, MapPin, Package } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

// DUMMY — replace with real operation data when available
const DUMMY_PORT_CALLS = [
  { port: 'Rotterdam', dateRange: '01–05 Mar', status: 'Delivered' as const, cost: 3200 },
  { port: 'Port Said', dateRange: '10–11 Mar', status: 'Delivered' as const, cost: 2100 },
  { port: 'Fujairah', dateRange: '18–19 Mar', status: '1 Claim' as const, cost: 2850 },
  { port: 'Mumbai', dateRange: 'ETA 28 Mar', status: 'Confirmed' as const, cost: 2400 },
];

const DUMMY_UPCOMING_DELIVERIES = [
  {
    port: 'Mumbai',
    eta: '28 Mar',
    supplier: 'Mumbai Ship Chandlers Pvt Ltd',
    value: 2400,
    services: ['Provisions', 'Bonded Stores'],
  },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

// ── KpiCard ───────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'default' | 'red' | 'green';
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, sub, accent = 'default' }) => {
  const iconBg =
    accent === 'red' ? 'bg-red-500/10 text-red-500' :
    accent === 'green' ? 'bg-emerald-500/10 text-emerald-500' :
    'bg-blue-500/10 text-blue-500';
  return (
    <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/70 rounded-xl p-4 shadow-sm">
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

// ── PortCallTimeline ──────────────────────────────────────────────────────────

const PORT_CALL_STATUS_STYLES: Record<string, string> = {
  'Delivered': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  '1 Claim': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'Confirmed': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

const PortCallTimeline: React.FC = () => (
  <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
    <div className="flex items-center gap-2 mb-5">
      <MapPin size={15} className="text-slate-400" />
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Port-Call Timeline</h3>
    </div>
    <div className="relative">
      <div className="absolute top-5 left-5 right-5 h-px bg-slate-200 dark:bg-slate-700" />
      <div className="relative z-10 grid w-full grid-cols-4 gap-4">
        {DUMMY_PORT_CALLS.map((call, idx) => (
          <div key={idx} className="flex flex-col items-center text-center gap-2">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${
              call.status === 'Delivered' ? 'bg-emerald-500' :
              call.status === '1 Claim' ? 'bg-amber-500' : 'bg-blue-500'
            }`}>
              {idx + 1}
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{call.port}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{call.dateRange}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PORT_CALL_STATUS_STYLES[call.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {call.status}
            </span>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">${call.cost.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── UpcomingDeliveries ────────────────────────────────────────────────────────

const UpcomingDeliveries: React.FC = () => (
  <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
    <div className="flex items-center gap-2 mb-4">
      <Package size={15} className="text-slate-400" />
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Upcoming Deliveries</h3>
    </div>
    <div className="space-y-3">
      {DUMMY_UPCOMING_DELIVERIES.map((delivery, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 dark:border-slate-800 p-3">
          <div className="flex items-center gap-3 min-w-0">
            <MapPin size={14} className="text-slate-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{delivery.port}</p>
                <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-300">
                  ETA {delivery.eta}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {delivery.supplier} · Est. value: {fmt(delivery.value)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {delivery.services.map(s => (
              <span key={s} className="rounded border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                {s}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── VesselDetailPanel ─────────────────────────────────────────────────────────

interface VesselDetailPanelProps {
  vessel: ContractedVessel;
  vesselReport: FleetMandayReportVessel | null;
  reportLoading: boolean;
  year: number;
  month: number;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
}

const VesselDetailPanel: React.FC<VesselDetailPanelProps> = ({
  vessel,
  vesselReport,
  reportLoading,
  year,
  month,
  onYearChange,
  onMonthChange,
}) => {
  const varianceAccent: 'red' | 'green' | 'default' =
    vesselReport == null ? 'default' :
    vesselReport.variancePct > 0 ? 'red' : 'green';

  const varianceLabel =
    vesselReport == null ? '—' :
    (vesselReport.variancePct > 0 ? '+' : '') + vesselReport.variancePct.toFixed(1) + '%';

  const kpis = [
    {
      icon: <DollarSign size={18} />,
      label: 'Budget Status',
      value: vesselReport ? fmt(vesselReport.actual) : '—',
      sub: 'Month-to-date spend',
      accent: 'default' as const,
    },
    {
      icon: <BarChart2 size={18} />,
      label: 'Actual Rate',
      value: vesselReport ? `$${vesselReport.rate.toFixed(2)}/day` : '—',
      sub: 'Per manday',
      accent: 'default' as const,
    },
    {
      icon: vesselReport && vesselReport.variancePct > 0
        ? <TrendingUp size={18} />
        : <TrendingDown size={18} />,
      label: 'Variance',
      value: varianceLabel,
      sub: vesselReport ? `vs ${fmt(vesselReport.budget)} budget` : undefined,
      accent: varianceAccent,
    },
    {
      icon: <DollarSign size={18} />,
      label: 'Budget',
      value: vesselReport ? fmt(vesselReport.budget) : '—',
      sub: `${MONTH_NAMES[month - 1]} ${year}`,
      accent: 'default' as const,
    },
  ];

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{vessel.name ?? '—'}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">IMO: {vessel.imo}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={e => onMonthChange(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 outline-none"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => onYearChange(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 outline-none"
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {reportLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map(kpi => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      )}

      <PortCallTimeline />
      <UpcomingDeliveries />
    </div>
  );
};

// ── Fleet page ────────────────────────────────────────────────────────────────

export const Fleet: React.FC = () => {
  const { dashboardCompanyId } = useUIStore();
  const [selectedImo, setSelectedImo] = useState<string | null>(null);
  const [year, setYear] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.getMonth() + 1;
  });

  const { data: vessels = [], isLoading: vesselsLoading } = useQuery({
    queryKey: ['contracted-vessels', dashboardCompanyId],
    queryFn: () => api.customer.getContractedVessels(),
    enabled: !!dashboardCompanyId,
  });

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['fleet-manday-report', year, month, dashboardCompanyId],
    queryFn: () => api.customer.getFleetMandayReport({ year, month }),
    enabled: !!selectedImo && !!dashboardCompanyId,
  });

  const selectedVessel = vessels.find(v => v.imo === selectedImo) ?? null;
  const vesselReport = report?.vessels.find(v => v.imo === selectedImo) ?? null;

  return (
    <div className="flex h-[calc(100vh-8rem)] space-x-6">
      <div className="w-1/3 flex flex-col space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Contracted Fleet</h2>
        <Card className="flex-1 overflow-y-auto p-0" noPadding>
          <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border-b dark:border-slate-800 font-medium text-slate-700 dark:text-slate-200">
            Vessels
          </div>
          {vesselsLoading ? (
            <div className="p-4 text-slate-500 dark:text-slate-400 text-sm">Loading...</div>
          ) : vessels.length === 0 ? (
            <div className="p-4 text-slate-500 dark:text-slate-400 text-sm">No contracted vessels found for this company.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {vessels.map(vessel => (
                <div
                  key={vessel.imo}
                  onClick={() => setSelectedImo(vessel.imo)}
                  className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    selectedImo === vessel.imo
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                      : 'border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-full text-blue-600 dark:text-blue-400">
                      <Anchor size={16} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{vessel.name ?? '—'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">IMO: {vessel.imo}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        {selectedVessel ? (
          <VesselDetailPanel
            vessel={selectedVessel}
            vesselReport={vesselReport}
            reportLoading={reportLoading}
            year={year}
            month={month}
            onYearChange={setYear}
            onMonthChange={setMonth}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 bg-gray-50/50 dark:bg-slate-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-800">
            Select a vessel to view details
          </div>
        )}
      </div>
    </div>
  );
};
