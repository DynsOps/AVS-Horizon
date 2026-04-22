import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ContractedVessel } from '../../types';
import { Card } from '../../components/ui/Card';
import { Anchor, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

export const Fleet: React.FC = () => {
  const [vessels, setVessels] = useState<ContractedVessel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImo, setSelectedImo] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { addToast, dashboardCompanyId } = useUIStore();

  useEffect(() => {
    const fetchVessels = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.customer.getContractedVessels();
        setVessels(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Veri yüklenirken bir hata oluştu.';
        setError(msg);
        addToast({ title: 'Hata', message: msg, type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchVessels();
  }, [dashboardCompanyId, user?.companyId, addToast]);

  const selectedVessel = vessels.find(v => v.imo === selectedImo) ?? null;

  return (
    <div className="flex h-[calc(100vh-8rem)] space-x-6">
      {/* Left panel */}
      <div className="w-1/3 flex flex-col space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Contracted Fleet</h2>
        <Card className="flex-1 overflow-y-auto p-0" noPadding>
          <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border-b dark:border-slate-800 font-medium text-slate-700 dark:text-slate-200">
            Vessels
          </div>
          {isLoading ? (
            <div className="p-4 text-slate-500 dark:text-slate-400 text-sm">Yükleniyor...</div>
          ) : error ? (
            <div className="p-4 text-red-600 dark:text-red-400 text-sm">{error}</div>
          ) : vessels.length === 0 ? (
            <div className="p-4 text-slate-500 dark:text-slate-400 text-sm">Bu şirket için contracted vessel bulunamadı.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {vessels.map(vessel => (
                <div
                  key={vessel.imo}
                  onClick={() => setSelectedImo(vessel.imo)}
                  className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedImo === vessel.imo ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
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

      {/* Right panel */}
      <div className="flex-1 flex flex-col">
        {selectedVessel ? (
          <Card className="flex-1">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedVessel.name ?? '—'}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">IMO: {selectedVessel.imo}</p>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-500 uppercase text-xs tracking-wider mb-3">Project Assignments</h3>
                {selectedVessel.projIdDataAreaIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedVessel.projIdDataAreaIds.map(pid => (
                      <span key={pid} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-mono">
                        {pid}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">—</p>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-slate-500 uppercase text-xs tracking-wider mb-3">Data Area</h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">{selectedVessel.dataAreaId ?? '—'}</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 bg-gray-50/50 dark:bg-slate-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-800">
            Bir vessel seçin
          </div>
        )}
      </div>
    </div>
  );
};
