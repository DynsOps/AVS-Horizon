import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import { Vessel } from '../../types';
import { Card } from '../../components/ui/Card';
import { ChevronRight, Anchor, MapPin, BellRing } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

export const Fleet: React.FC = () => {
  const [fleet, setFleet] = useState<Vessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { addToast, dashboardCompanyId } = useUIStore();
  const shownAlertsRef = useRef<Set<string>>(new Set());
  const effectiveCompanyId = dashboardCompanyId || user?.companyId;

  useEffect(() => {
    api.customer.getFleet(effectiveCompanyId).then(setFleet);
  }, [effectiveCompanyId]);

  const vesselPositions: Record<string, { x: number; y: number; lat: string; lng: string }> = {
    'V-001': { x: 62, y: 38, lat: '1.290270', lng: '103.851959' },
    'V-002': { x: 44, y: 52, lat: '25.204849', lng: '55.270782' },
    'V-003': { x: 18, y: 44, lat: '29.760427', lng: '-95.369804' },
  };

  const selectedPosition = selectedVessel ? vesselPositions[selectedVessel] : null;

  const monitoredPorts = [
    { name: 'Singapore', lat: 1.29027, lng: 103.851959, thresholdKm: 250 },
    { name: 'Dubai', lat: 25.204849, lng: 55.270782, thresholdKm: 250 },
    { name: 'Houston', lat: 29.760427, lng: -95.369804, thresholdKm: 300 },
  ];

  const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const proximityAlerts = useMemo(() => {
    return fleet.flatMap((vessel) => {
      const pos = vesselPositions[vessel.id];
      if (!pos) return [];
      const vesselLat = Number(pos.lat);
      const vesselLng = Number(pos.lng);
      return monitoredPorts
        .map((port) => ({
          vesselId: vessel.id,
          vesselName: vessel.name,
          portName: port.name,
          distance: distanceKm(vesselLat, vesselLng, port.lat, port.lng),
          thresholdKm: port.thresholdKm,
        }))
        .filter((x) => x.distance <= x.thresholdKm)
        .map((x) => ({ ...x, distance: Math.round(x.distance) }));
    });
  }, [fleet]);

  useEffect(() => {
    proximityAlerts.forEach((alert) => {
      const key = `${alert.vesselId}-${alert.portName}`;
      if (shownAlertsRef.current.has(key)) return;
      shownAlertsRef.current.add(key);
      addToast({
        title: 'Port Proximity Alert',
        message: `${alert.vesselName} is ${alert.distance} km away from ${alert.portName}.`,
        type: 'info',
      });
    });
  }, [proximityAlerts, addToast]);

  return (
    <div className="flex h-[calc(100vh-8rem)] space-x-6">
      <div className="w-1/3 flex flex-col space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Fleet Hierarchy</h2>
        <Card className="flex-1 overflow-y-auto p-0" noPadding>
          <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border-b dark:border-slate-800 font-medium text-slate-700 dark:text-slate-200">All Vessels</div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {fleet.map(vessel => (
              <div 
                key={vessel.id}
                onClick={() => setSelectedVessel(vessel.id)}
                className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedVessel === vessel.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
              >
                <div className="flex items-center space-x-3">
                   <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-full text-blue-600 dark:text-blue-400">
                     <Anchor size={16} strokeWidth={1.5} />
                   </div>
                   <div>
                       <p className="font-semibold text-slate-800 dark:text-slate-200">{vessel.name}</p>
                       <p className="text-xs text-slate-500 dark:text-slate-400">IMO: {vessel.imo}</p>
                   </div>
                </div>
                <ChevronRight size={16} strokeWidth={1.5} className="text-slate-400" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex-1 flex flex-col">
         {selectedVessel ? (
             <Card className="flex-1">
                 <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{fleet.find(f => f.id === selectedVessel)?.name}</h2>
                        <span className="inline-block mt-2 px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium border border-green-200 dark:border-green-800">Active Status</span>
                    </div>
                    <button
                      onClick={() => addToast({ title: 'Vessel Specs', message: 'Detailed vessel specification panel is connected.', type: 'info' })}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
                    >
                      View Full Specs
                    </button>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-8 mb-8">
                     <div className="space-y-4">
                         <h3 className="font-semibold text-slate-500 uppercase text-xs tracking-wider">Current Location</h3>
                         <div className="flex items-start space-x-3">
                             <MapPin className="text-red-500 mt-1" strokeWidth={1.5} />
                             <div>
                                 <p className="font-medium text-slate-900 dark:text-white">En route to Singapore</p>
                                 <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Lat: {selectedPosition?.lat || 'N/A'}, Long: {selectedPosition?.lng || 'N/A'}
                                 </p>
                                 <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ETA: Oct 24, 14:00 LT</p>
                             </div>
                         </div>
                     </div>
                     <div className="space-y-4">
                         <h3 className="font-semibold text-slate-500 uppercase text-xs tracking-wider">Technical Managers</h3>
                         <div className="flex items-center space-x-3">
                             <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                             <div>
                                 <p className="font-medium text-slate-900 dark:text-white">Wilhelmsen Ship Mgmt</p>
                                 <p className="text-sm text-blue-600 dark:text-blue-400">Contact Superintendent</p>
                             </div>
                         </div>
                     </div>
                 </div>

                 <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-700/50 dark:bg-amber-900/10">
                    <div className="flex items-center gap-2 mb-2">
                      <BellRing size={14} className="text-amber-600 dark:text-amber-400" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Port Proximity Notifications</p>
                    </div>
                    {proximityAlerts.length > 0 ? (
                      <div className="space-y-1">
                        {proximityAlerts.map((alert) => (
                          <p key={`${alert.vesselId}-${alert.portName}`} className="text-xs text-amber-800 dark:text-amber-200">
                            {alert.vesselName} is within {alert.thresholdKm} km of {alert.portName} (current: {alert.distance} km).
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-800 dark:text-amber-200">No vessels are currently near monitored ports.</p>
                    )}
                 </div>

                 <div className="w-full h-64 rounded-lg border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 relative overflow-hidden">
                     <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,#3b82f6_0,transparent_30%),radial-gradient(circle_at_70%_65%,#06b6d4_0,transparent_25%)]" />
                     {Object.entries(vesselPositions).map(([id, p]) => {
                         const isSelected = id === selectedVessel;
                         return (
                             <button
                                 key={id}
                                 onClick={() => setSelectedVessel(id)}
                                 style={{ left: `${p.x}%`, top: `${p.y}%` }}
                                 className={`absolute -translate-x-1/2 -translate-y-1/2 ${isSelected ? 'z-20' : 'z-10'}`}
                             >
                                 <span className={`block rounded-full border-2 ${isSelected ? 'h-5 w-5 bg-blue-600 border-white shadow-lg shadow-blue-500/40' : 'h-4 w-4 bg-teal-500 border-white/90'}`} />
                             </button>
                         );
                     })}
                     <div className="absolute bottom-3 left-3 rounded bg-white/80 dark:bg-slate-900/80 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Vessel positions are shown from latest telemetry snapshot.
                     </div>
                 </div>
             </Card>
         ) : (
             <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 bg-gray-50/50 dark:bg-slate-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-800">
                 Select a vessel to view details
             </div>
         )}
      </div>
    </div>
  );
};
