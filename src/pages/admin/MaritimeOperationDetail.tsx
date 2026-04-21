import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Company, Vessel, VesselRoute, VesselOperation } from '../../types';
import { Card } from '../../components/ui/Card';
import { ArrowLeft, ArrowRight, Ship, Fuel, Package, Wrench, Landmark, Users, ChevronDown } from 'lucide-react';

const opTypeIcons: Record<string, React.ElementType> = {
  Bunkering: Fuel,
  Provisioning: Package,
  Maintenance: Wrench,
  'Port Fees': Landmark,
  'Crew Change': Users,
};

const opTypeColors: Record<string, string> = {
  Bunkering: 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20',
  Provisioning: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20',
  Maintenance: 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
  'Port Fees': 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
  'Crew Change': 'border-cyan-300 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-900/20',
};

const routeStatusColors: Record<string, string> = {
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Planned: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const formatAmount = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
};

export const MaritimeOperationDetail: React.FC = () => {
  const { vesselId } = useParams<{ vesselId: string }>();
  const navigate = useNavigate();
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [routes, setRoutes] = useState<VesselRoute[]>([]);
  const [operations, setOperations] = useState<VesselOperation[]>([]);
  const [collapsedRoutes, setCollapsedRoutes] = useState<Set<string>>(new Set());
  const [filterPort, setFilterPort] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    if (!vesselId) return;
    const load = async () => {
      const [v, r, ops] = await Promise.all([
        api.maritime.getVessel(vesselId),
        api.maritime.getVesselRoutes(vesselId),
        api.maritime.getVesselOperations(vesselId),
      ]);
      setVessel(v);
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

  const filteredOperations = useMemo(() => {
    return operations.filter((op) => {
      if (filterPort && op.port !== filterPort) return false;
      if (filterType && op.operationType !== filterType) return false;
      return true;
    });
  }, [operations, filterPort, filterType]);

  const opsByRoute = useMemo(() => {
    const map = new Map<string, VesselOperation[]>();
    // Group by routeId
    filteredOperations.forEach((op) => {
      const key = op.routeId || 'unlinked';
      const list = map.get(key) || [];
      list.push(op);
      map.set(key, list);
    });
    return map;
  }, [filteredOperations]);

  const ports = useMemo(() => [...new Set(operations.map((op) => op.port))], [operations]);
  const opTypes = useMemo(() => [...new Set(operations.map((op) => op.operationType))], [operations]);

  const toggleRoute = (routeId: string) => {
    setCollapsedRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });
  };

  const totalSpend = useMemo(() => {
    return filteredOperations.reduce((sum, op) => sum + op.totalAmount, 0);
  }, [filteredOperations]);

  if (!vessel) {
    return <div className="p-6 text-sm text-slate-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/admin/maritime-map')}
          className="mb-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <ArrowLeft size={14} /> Back to Maritime Map
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Ship size={20} className="text-blue-500" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{vessel.name}</h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-mono">IMO {vessel.imo}</span>
              <span>·</span>
              <span>{vessel.type}</span>
              {company && <><span>·</span><span>{company.name}</span></>}
              {vessel.flagCountry && <><span>·</span><span>{vessel.flagCountry}</span></>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Spend</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatAmount(totalSpend, 'USD')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterPort}
          onChange={(e) => setFilterPort(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">All Ports</option>
          {ports.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">All Types</option>
          {opTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Timeline by Route */}
      {routes.map((route) => {
        const routeOps = opsByRoute.get(route.id) || [];
        if (routeOps.length === 0 && (filterPort || filterType)) return null;
        const isCollapsed = collapsedRoutes.has(route.id);

        return (
          <Card key={route.id} className="overflow-hidden">
            <button
              onClick={() => toggleRoute(route.id)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <span>{route.departurePort}</span>
                  <ArrowRight size={14} className="text-slate-400" />
                  <span>{route.arrivalPort}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${routeStatusColors[route.status] || ''}`}>
                  {route.status}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{new Date(route.departureDate).toLocaleDateString()}</span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
              </div>
            </button>

            {!isCollapsed && (
              <div className="mt-4 relative">
                {/* Timeline line */}
                {routeOps.length > 0 && (
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700" />
                )}

                <div className="space-y-3">
                  {routeOps.length === 0 ? (
                    <p className="text-xs text-slate-400 pl-8">No operations for this route.</p>
                  ) : (
                    routeOps.map((op) => {
                      const Icon = opTypeIcons[op.operationType] || Package;
                      const cardColor = opTypeColors[op.operationType] || 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50';
                      return (
                        <div key={op.id} className="flex gap-3">
                          {/* Timeline dot */}
                          <div className="relative z-10 mt-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-100 dark:border-slate-900 dark:bg-slate-700">
                            <Icon size={12} className="text-slate-600 dark:text-slate-300" />
                          </div>

                          {/* Operation card */}
                          <div className={`flex-1 rounded-xl border p-3 ${cardColor}`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{op.operationType}</p>
                                <p className="text-xs text-slate-500">{op.port} · {new Date(op.operationDate).toLocaleDateString()}</p>
                              </div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {formatAmount(op.totalAmount, op.currency)}
                              </p>
                            </div>

                            {/* Items table */}
                            {op.items.length > 0 && (
                              <table className="mt-2 w-full text-xs">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th className="text-left font-medium py-1">Item</th>
                                    <th className="text-right font-medium py-1">Qty</th>
                                    <th className="text-right font-medium py-1">Unit</th>
                                    <th className="text-right font-medium py-1">Price</th>
                                    <th className="text-right font-medium py-1">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="text-slate-700 dark:text-slate-200">
                                  {op.items.map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="py-0.5">{item.name}</td>
                                      <td className="text-right py-0.5">{item.quantity}</td>
                                      <td className="text-right py-0.5">{item.unit}</td>
                                      <td className="text-right py-0.5">{item.unitPrice.toLocaleString()}</td>
                                      <td className="text-right py-0.5 font-semibold">{(item.quantity * item.unitPrice).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            {op.notes && (
                              <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">{op.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {/* Unlinked operations */}
      {opsByRoute.has('unlinked') && (opsByRoute.get('unlinked') || []).length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Other Operations</h3>
          <div className="space-y-2">
            {(opsByRoute.get('unlinked') || []).map((op) => {
              const Icon = opTypeIcons[op.operationType] || Package;
              return (
                <div key={op.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <Icon size={14} className="mt-0.5 text-slate-500" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{op.operationType}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{formatAmount(op.totalAmount, op.currency)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{op.port} · {new Date(op.operationDate).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {operations.length === 0 && (
        <Card>
          <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No operations recorded for this vessel.
          </div>
        </Card>
      )}
    </div>
  );
};
