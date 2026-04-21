import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Company, Vessel, VesselPosition, VesselRoute, VesselOperation } from '../../types';
import { Ship, MapPin, Navigation, Anchor, ArrowRight, Fuel, Package, Wrench, Landmark, Users } from 'lucide-react';

type Props = {
  vesselId: string;
};

const opTypeIcons: Record<string, React.ElementType> = {
  Bunkering: Fuel,
  Provisioning: Package,
  Maintenance: Wrench,
  'Port Fees': Landmark,
  'Crew Change': Users,
};

const opTypeColors: Record<string, string> = {
  Bunkering: 'text-orange-500',
  Provisioning: 'text-emerald-500',
  Maintenance: 'text-blue-500',
  'Port Fees': 'text-purple-500',
  'Crew Change': 'text-cyan-500',
};

export const VesselDrawer: React.FC<Props> = ({ vesselId }) => {
  const navigate = useNavigate();
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [position, setPosition] = useState<VesselPosition | null>(null);
  const [routes, setRoutes] = useState<VesselRoute[]>([]);
  const [operations, setOperations] = useState<VesselOperation[]>([]);
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    const load = async () => {
      const [v, pos, r, ops] = await Promise.all([
        api.maritime.getVessel(vesselId),
        api.maritime.getVesselPosition(vesselId),
        api.maritime.getVesselRoutes(vesselId),
        api.maritime.getVesselOperations(vesselId),
      ]);
      setVessel(v);
      setPosition(pos);
      setRoutes(r);
      setOperations(ops);

      if (v.companyId) {
        try {
          const companies = await api.admin.getCompanies();
          setCompany(companies.find((c) => c.id === v.companyId) || null);
        } catch { /* ignore */ }
      }
    };
    void load();
  }, [vesselId]);

  if (!vessel) {
    return <div className="p-4 text-sm text-slate-500">Loading vessel data...</div>;
  }

  const activeRoute = routes.find((r) => r.status === 'In Progress');
  const recentOps = operations.slice(0, 5);

  const statusColor = (status?: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'Under Repair': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'Laid Up': return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
      default: return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Ship size={18} className="text-blue-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{vessel.name}</h2>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            IMO {vessel.imo}
          </span>
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
            {vessel.type}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusColor(vessel.vesselStatus)}`}>
            {vessel.vesselStatus || 'Active'}
          </span>
        </div>
        {company && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{company.name}</p>
        )}
        {vessel.flagCountry && (
          <p className="text-xs text-slate-500 dark:text-slate-400">Flag: {vessel.flagCountry}</p>
        )}
      </div>

      {/* Position */}
      {position && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
            <MapPin size={12} /> Current Position
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-200">
            <div>
              <span className="text-slate-500">Lat:</span> {position.lat.toFixed(4)}
            </div>
            <div>
              <span className="text-slate-500">Lng:</span> {position.lng.toFixed(4)}
            </div>
            <div>
              <span className="text-slate-500">Speed:</span> {position.speed} kn
            </div>
            <div>
              <span className="text-slate-500">Heading:</span> {position.heading}°
            </div>
            <div className="col-span-2">
              <span className="text-slate-500">Status:</span> {position.navStatus}
            </div>
            {position.destination && (
              <div className="col-span-2">
                <span className="text-slate-500">Dest:</span> {position.destination}
                {position.eta && <span className="ml-2 text-slate-400">ETA: {new Date(position.eta).toLocaleDateString()}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Route */}
      {activeRoute && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-300 mb-2">
            <Navigation size={12} /> Active Route
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <span>{activeRoute.departurePort}</span>
            <ArrowRight size={14} className="text-blue-400" />
            <span>{activeRoute.arrivalPort}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Departed: {new Date(activeRoute.departureDate).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Recent Operations */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
          <Anchor size={12} /> Recent Operations ({operations.length} total)
        </div>
        {recentOps.length === 0 ? (
          <p className="text-xs text-slate-400">No operations recorded.</p>
        ) : (
          <div className="space-y-2">
            {recentOps.map((op) => {
              const Icon = opTypeIcons[op.operationType] || Package;
              const color = opTypeColors[op.operationType] || 'text-slate-500';
              return (
                <div key={op.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/50">
                  <Icon size={14} className={`mt-0.5 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">{op.operationType}</span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{formatAmount(op.totalAmount, op.currency)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{op.port} · {new Date(op.operationDate).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View All Operations */}
      {operations.length > 0 && (
        <button
          onClick={() => navigate(`/admin/maritime-map/operations/${vesselId}`)}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          View All Operations ({operations.length})
        </button>
      )}
    </div>
  );
};
