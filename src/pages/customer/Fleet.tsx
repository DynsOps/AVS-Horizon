import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Vessel } from '../../types';
import { Card } from '../../components/ui/Card';
import { ChevronRight, Anchor, MapPin } from 'lucide-react';

export const Fleet: React.FC = () => {
  const [fleet, setFleet] = useState<Vessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null);

  useEffect(() => {
    api.customer.getFleet().then(setFleet);
  }, []);

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
                    <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm">View Full Specs</button>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-8 mb-8">
                     <div className="space-y-4">
                         <h3 className="font-semibold text-slate-500 uppercase text-xs tracking-wider">Current Location</h3>
                         <div className="flex items-start space-x-3">
                             <MapPin className="text-red-500 mt-1" strokeWidth={1.5} />
                             <div>
                                 <p className="font-medium text-slate-900 dark:text-white">En route to Singapore</p>
                                 <p className="text-sm text-slate-500 dark:text-slate-400">Lat: 1.290270, Long: 103.851959</p>
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

                 {/* Mock Map Placeholder */}
                 <div className="w-full h-64 bg-slate-100 dark:bg-slate-950 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-800 flex items-center justify-center text-gray-400 dark:text-slate-600">
                     <div className="text-center">
                         <MapPin size={40} strokeWidth={1} className="mx-auto mb-2 opacity-50" />
                         <p>Live Map Integration (Mapbox/Google Maps)</p>
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