import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Vessel, VesselPosition } from '../../types';
import { MapPin, Ship, ArrowUpRight } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

const statusColors: Record<string, string> = {
  Active: '#34d399',
  'Under Repair': '#fbbf24',
  'Laid Up': '#94a3b8',
  Scrapped: '#f87171',
};

const FitToVessels: React.FC<{ coords: [number, number][] }> = ({ coords }) => {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!coords.length || fitted.current) return;
    const bounds = L.latLngBounds(coords.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 3, animate: false });
    fitted.current = true;
  }, [coords, map]);

  return null;
};

const SizeInvalidator: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    invalidate();
    const t = window.setTimeout(invalidate, 200);
    window.addEventListener('resize', invalidate);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', invalidate);
    };
  }, [map]);
  return null;
};

export const MapWidget: React.FC = () => {
  const navigate = useNavigate();
  const [allVessels, setAllVessels] = useState<Vessel[]>([]);
  const [positions, setPositions] = useState<VesselPosition[]>([]);
  const { dashboardCompanyId } = useUIStore();
  const isCompanyReady = Boolean(dashboardCompanyId);

  useEffect(() => {
    const load = async () => {
      const [v, p] = await Promise.all([
        api.maritime.getVessels(),
        api.maritime.getVesselPositions(),
      ]);
      setAllVessels(v);
      setPositions(p);
    };
    void load();
  }, []);

  const vessels = useMemo(() => {
    if (!isCompanyReady) return [];
    return allVessels.filter((v) => !v.companyId || v.companyId === dashboardCompanyId);
  }, [allVessels, isCompanyReady, dashboardCompanyId]);

  const vesselIds = useMemo(() => new Set(vessels.map((v) => v.id)), [vessels]);
  const positionMap = useMemo(
    () => new Map(positions.filter((p) => vesselIds.has(p.vesselId)).map((p) => [p.vesselId, p])),
    [positions, vesselIds],
  );
  const coords = useMemo<[number, number][]>(
    () => Array.from(positionMap.values()).map((p) => [p.lat, p.lng]),
    [positionMap],
  );
  const activeCount = vessels.filter((v) => (v.vesselStatus || 'Active') === 'Active').length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3 dark:border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <MapPin size={15} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Fleet Overview</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Live positions · {vessels.length} vessels · {activeCount} active
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/customer/maritime-map')}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500/20 dark:text-blue-300"
        >
          Open Full Map
          <ArrowUpRight size={12} />
        </button>
      </div>

      <div className="relative h-[320px] bg-[#0a2a4d]">
        <MapContainer
          center={[20, 10]}
          zoom={2}
          className="h-full w-full"
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          boxZoom={false}
          keyboard={false}
          attributionControl={false}
          worldCopyJump
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
          <SizeInvalidator />
          <FitToVessels coords={coords} />

          {vessels.map((vessel) => {
            const pos = positionMap.get(vessel.id);
            if (!pos) return null;
            const color = statusColors[vessel.vesselStatus || 'Active'] || '#34d399';
            return (
              <React.Fragment key={vessel.id}>
                <CircleMarker
                  center={[pos.lat, pos.lng]}
                  radius={9}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 1, opacity: 0.5 }}
                />
                <CircleMarker
                  center={[pos.lat, pos.lng]}
                  radius={4}
                  pathOptions={{ color: '#fff', fillColor: color, fillOpacity: 1, weight: 1.5 }}
                >
                  <Tooltip direction="top" offset={[0, -6]}>
                    <span className="text-xs font-semibold">{vessel.name}</span>
                  </Tooltip>
                </CircleMarker>
              </React.Fragment>
            );
          })}
        </MapContainer>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

        {!isCompanyReady && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/90 px-3 py-2 text-xs font-medium text-white shadow-lg">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              Loading fleet...
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 rounded-lg bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          LIVE · {vessels.length} vessels tracked
        </div>

        <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-slate-900/80 px-2.5 py-1.5 text-[11px] text-white shadow-lg backdrop-blur">
          <Ship size={12} />
          {activeCount} underway
        </div>
      </div>
    </div>
  );
};
