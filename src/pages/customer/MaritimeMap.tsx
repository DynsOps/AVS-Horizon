import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../services/api';
import { Vessel, VesselPosition, VesselRoute, VesselOperation } from '../../types';
import { VesselMarker } from '../../components/maritime/VesselMarker';
import { RoutePolyline } from '../../components/maritime/RoutePolyline';
import { useUIStore } from '../../store/uiStore';
import { useThemeStore } from '../../store/themeStore';
import { VesselDrawer } from '../../components/maritime/VesselDrawer';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Maximize2,
  Ship,
  Route as RouteIcon,
  Package,
  Anchor,
  Filter as FilterIcon,
} from 'lucide-react';

const PORT_COORDS: Record<string, [number, number]> = {
  'Singapore': [1.29027, 103.851959],
  'Rotterdam': [51.9225, 4.47917],
  'Mumbai': [18.9388, 72.8354],
  'Jebel Ali': [25.0117, 55.0618],
  'Houston': [29.7604, -95.3698],
  'Corpus Christi': [27.8006, -97.3964],
  'Hamburg': [53.5511, 9.9937],
  'Oslo': [59.9139, 10.7522],
  'Busan': [35.1796, 129.0756],
  'Antwerp': [51.2194, 4.4025],
  'Colombo': [6.9271, 79.8612],
};

type OperationWithVessel = {
  vesselName: string;
  operation: VesselOperation;
};

type OperationPortInfo = {
  port: string;
  coords: [number, number];
  count: number;
  operations: OperationWithVessel[];
};

type MapStyle = {
  id: string;
  label: string;
  url: string;
  subdomains?: string;
  attribution: string;
  preview: string;
  dark?: boolean;
};

const MAP_STYLES: MapStyle[] = [
  {
    id: 'dark',
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OSM &copy; CARTO',
    preview: 'linear-gradient(135deg,#0f172a,#1e293b)',
    dark: true,
  },
  {
    id: 'light',
    label: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OSM &copy; CARTO',
    preview: 'linear-gradient(135deg,#e2e8f0,#f8fafc)',
  },
  {
    id: 'osm',
    label: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    preview: 'linear-gradient(135deg,#c6e2ff,#d7e6c8)',
  },
  {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    preview: 'linear-gradient(135deg,#0a1f3f,#1a3a5c)',
    dark: true,
  },
  {
    id: 'ocean',
    label: 'Ocean',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    preview: 'linear-gradient(135deg,#1e3a5f,#3b6ba5)',
    dark: true,
  },
];

const seedFromText = (value: string) => value.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

const getRouteProgress = (vesselId: string, nowMs: number) => {
  const seed = seedFromText(vesselId);
  const cycleMs = 90_000 + (seed % 4) * 15_000;
  return ((nowMs + seed * 977) % cycleMs) / cycleMs;
};

const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

const calculateBearing = (from: [number, number], to: [number, number]) => {
  const [lat1, lon1] = from.map((v) => (v * Math.PI) / 180);
  const [lat2, lon2] = to.map((v) => (v * Math.PI) / 180);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const getOperationPorts = (
  operations: VesselOperation[],
  vesselById: Map<string, Vessel>,
): Map<string, OperationPortInfo> => {
  const map = new Map<string, OperationPortInfo>();
  operations.forEach((op) => {
    const coords = PORT_COORDS[op.port];
    if (!coords) return;
    const vesselName = vesselById.get(op.vesselId)?.name || op.vesselId;
    const existing = map.get(op.port);
    if (existing) {
      existing.count++;
      existing.operations.push({ vesselName, operation: op });
    } else {
      map.set(op.port, { port: op.port, coords, count: 1, operations: [{ vesselName, operation: op }] });
    }
  });
  return map;
};

const numberOperationsForVessel = (
  operations: VesselOperation[],
  vesselId: string,
): Array<VesselOperation & { sequence: number }> => {
  return operations
    .filter((op) => op.vesselId === vesselId)
    .sort((a, b) => new Date(a.operationDate).getTime() - new Date(b.operationDate).getTime())
    .map((op, index) => ({ ...op, sequence: index + 1 }));
};

const FitBoundsControl: React.FC<{ positions: [number, number][] }> = ({ positions }) => {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (positions.length > 0 && !fitted.current) {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => L.latLng(lat, lng)));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
      fitted.current = true;
    }
  }, [positions, map]);
  return null;
};

const MapSizeInvalidator: React.FC<{ trigger?: unknown }> = ({ trigger }) => {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    invalidate();
    const t1 = window.setTimeout(invalidate, 180);
    const t2 = window.setTimeout(invalidate, 360);
    window.addEventListener('resize', invalidate);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', invalidate);
    };
  }, [map, trigger]);
  return null;
};

type SectionProps = { title: string; icon: React.ReactNode; children: React.ReactNode };
const Section: React.FC<SectionProps> = ({ title, icon, children }) => (
  <div className="border-b border-white/5 px-4 py-4 last:border-0">
    <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {icon}
      {title}
    </div>
    {children}
  </div>
);

export const MaritimeMap: React.FC = () => {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [positions, setPositions] = useState<VesselPosition[]>([]);
  const [routes, setRoutes] = useState<VesselRoute[]>([]);
  const [operations, setOperations] = useState<VesselOperation[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [selectedVesselIds, setSelectedVesselIds] = useState<Set<string> | null>(null);
  const [vesselSearch, setVesselSearch] = useState('');
  const [showRoutes, setShowRoutes] = useState(true);
  const [showOperations, setShowOperations] = useState(true);
  const [showSeamarks, setShowSeamarks] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { isDarkMode } = useThemeStore();
  const [mapStyleId, setMapStyleId] = useState<string | null>(null);
  const mapStyle = useMemo<MapStyle>(() => {
    const defaultId = isDarkMode ? 'dark' : 'light';
    const id = mapStyleId ?? defaultId;
    return MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0];
  }, [isDarkMode, mapStyleId]);
  const [animationNow, setAnimationNow] = useState(() => Date.now());
  const { openDrawer, dashboardCompanyId } = useUIStore();
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const load = async () => {
      const [mapPayload, ops] = await Promise.all([
        api.maritime.getMapPayload(),
        api.maritime.getOperations(),
      ]);
      setVessels(mapPayload.vessels);
      setPositions(mapPayload.positions);
      setRoutes(mapPayload.routes);
      setOperations(ops);
    };
    void load();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setAnimationNow(Date.now()), 1200);
    return () => window.clearInterval(id);
  }, []);

  const isCompanyReady = Boolean(dashboardCompanyId);

  const filteredVessels = useMemo(() => {
    if (!isCompanyReady) return [];
    return vessels.filter((v) => {
      if (dashboardCompanyId && v.companyId && v.companyId !== dashboardCompanyId) return false;
      if (filterType && v.type !== filterType) return false;
      if (selectedVesselIds && !selectedVesselIds.has(v.id)) return false;
      return true;
    });
  }, [isCompanyReady, vessels, dashboardCompanyId, filterType, selectedVesselIds]);

  const companyFilteredVessels = useMemo(() => {
    if (!isCompanyReady) return [];
    return vessels.filter((v) => {
      if (dashboardCompanyId && v.companyId && v.companyId !== dashboardCompanyId) return false;
      if (filterType && v.type !== filterType) return false;
      return true;
    });
  }, [isCompanyReady, vessels, dashboardCompanyId, filterType]);

  const searchedVessels = useMemo(() => {
    const q = vesselSearch.trim().toLowerCase();
    if (!q) return companyFilteredVessels;
    return companyFilteredVessels.filter(
      (v) => v.name.toLowerCase().includes(q) || v.imo.toLowerCase().includes(q),
    );
  }, [companyFilteredVessels, vesselSearch]);

  const toggleVessel = (id: string) => {
    setSelectedVesselIds((prev) => {
      const base = prev ?? new Set(companyFilteredVessels.map((v) => v.id));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVessels = () => setSelectedVesselIds(null);
  const clearVessels = () => setSelectedVesselIds(new Set());

  const filteredVesselIds = useMemo(() => new Set(filteredVessels.map((v) => v.id)), [filteredVessels]);

  const singleFilteredVesselId = useMemo(() => {
    if (selectedVesselIds && selectedVesselIds.size === 1) {
      return [...selectedVesselIds][0];
    }
    return null;
  }, [selectedVesselIds]);

  const numberedOperations = useMemo(() => {
    if (!singleFilteredVesselId) return null;
    return numberOperationsForVessel(operations, singleFilteredVesselId);
  }, [singleFilteredVesselId, operations]);

  const vesselById = useMemo(() => new Map(vessels.map((v) => [v.id, v])), [vessels]);

  const positionMap = useMemo(() => {
    const m = new Map<string, VesselPosition>();
    positions.forEach((p) => m.set(p.vesselId, p));
    return m;
  }, [positions]);

  const activeRoutes = useMemo(
    () => routes.filter((r) => r.status === 'In Progress' && filteredVesselIds.has(r.vesselId)),
    [routes, filteredVesselIds],
  );

  const activeRouteByVesselId = useMemo(() => {
    const m = new Map<string, VesselRoute>();
    activeRoutes.forEach((r) => m.set(r.vesselId, r));
    return m;
  }, [activeRoutes]);

  const animatedPositionMap = useMemo(() => {
    const m = new Map<string, VesselPosition>();
    filteredVessels.forEach((vessel) => {
      const basePos = positionMap.get(vessel.id);
      if (!basePos) return;
      const activeRoute = activeRouteByVesselId.get(vessel.id);
      const depCoords = activeRoute ? PORT_COORDS[activeRoute.departurePort] : undefined;
      const arrCoords = activeRoute ? PORT_COORDS[activeRoute.arrivalPort] : undefined;

      if (!activeRoute || !depCoords || !arrCoords) {
        m.set(vessel.id, basePos);
        return;
      }

      const t = getRouteProgress(vessel.id, animationNow);
      const heading = calculateBearing(depCoords, arrCoords);

      m.set(vessel.id, {
        ...basePos,
        lat: lerp(depCoords[0], arrCoords[0], t),
        lng: lerp(depCoords[1], arrCoords[1], t),
        heading,
        course: heading,
        destination: activeRoute.arrivalPort,
        navStatus: 'Under Way (Mock)',
      });
    });
    return m;
  }, [activeRouteByVesselId, animationNow, filteredVessels, positionMap]);

  const allPositionCoords = useMemo(() => {
    const vesselCoords = Array.from(animatedPositionMap.values()).map((p): [number, number] => [p.lat, p.lng]);
    const routeCoords = activeRoutes.flatMap((route) => {
      const depCoords = PORT_COORDS[route.departurePort];
      const arrCoords = PORT_COORDS[route.arrivalPort];
      if (!depCoords || !arrCoords) return [];
      return [depCoords, arrCoords];
    });
    return [...vesselCoords, ...routeCoords];
  }, [activeRoutes, animatedPositionMap]);

  const filteredOperations = useMemo(
    () => operations.filter((op) => filteredVesselIds.has(op.vesselId)),
    [operations, filteredVesselIds],
  );

  const operationPortMarkers = useMemo(
    () => getOperationPorts(filteredOperations, vesselById),
    [filteredOperations, vesselById],
  );

  const vesselTypes = useMemo(() => [...new Set(vessels.map((v) => v.type))], [vessels]);

  const handleVesselClick = (vessel: Vessel) => {
    setSelectedVesselId(vessel.id);
    const pos = animatedPositionMap.get(vessel.id);
    if (pos && mapRef.current) {
      mapRef.current.flyTo([pos.lat, pos.lng], 6, { duration: 1 });
    }
    openDrawer(<VesselDrawer vesselId={vessel.id} />);
  };

  const handleFitAll = () => {
    if (allPositionCoords.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(allPositionCoords.map(([lat, lng]) => L.latLng(lat, lng)));
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
    }
  };

  const activeCount = filteredVessels.filter((v) => (v.vesselStatus || 'Active') === 'Active').length;
  const underwayCount = activeRoutes.length;

  return (
    <div className="relative -m-6 flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Left sidebar */}
      <aside
        className={`relative flex h-full shrink-0 flex-col border-r border-slate-200/70 bg-white/95 text-slate-700 backdrop-blur-xl transition-[width] duration-300 ease-in-out dark:border-white/5 dark:bg-slate-900/95 dark:text-slate-100 ${
          sidebarOpen ? 'w-80' : 'w-0'
        }`}
      >
        <div className={`flex h-full flex-col overflow-hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
          <div className="border-b border-slate-200/70 px-5 py-4 dark:border-white/5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500 dark:text-blue-400">
                <Ship size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Fleet Operations</h2>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live tracking
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Vessels" value={filteredVessels.length} accent="text-blue-600 dark:text-blue-300" />
              <Stat label="Underway" value={underwayCount} accent="text-emerald-600 dark:text-emerald-300" />
              <Stat label="Operations" value={filteredOperations.length} accent="text-amber-600 dark:text-amber-300" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <Section title="Map Style" icon={<Layers size={12} />}>
              <div className="grid grid-cols-3 gap-2">
                {MAP_STYLES.map((style) => {
                  const isActive = mapStyle.id === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => setMapStyleId(style.id)}
                      className={`group overflow-hidden rounded-lg border transition ${
                        isActive
                          ? 'border-blue-400 ring-2 ring-blue-400/40'
                          : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/30'
                      }`}
                    >
                      <div className="h-10 w-full" style={{ background: style.preview }} />
                      <div
                        className={`px-1 py-1 text-[10px] font-semibold ${
                          isActive
                            ? 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {style.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Filters" icon={<FilterIcon size={12} />}>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Vessel Type</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">All Types</option>
                    {vesselTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
              </div>
            </Section>

            <Section title={`Vessels (${filteredVessels.length}/${companyFilteredVessels.length})`} icon={<Ship size={12} />}>
              <div className="space-y-2">
                <input
                  type="text"
                  value={vesselSearch}
                  onChange={(e) => setVesselSearch(e.target.value)}
                  placeholder="Search name or IMO..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={selectAllVessels}
                    className="flex-1 rounded-md bg-blue-500/15 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-500/25 dark:text-blue-300"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearVessels}
                    className="flex-1 rounded-md bg-slate-200/70 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {searchedVessels.length === 0 && (
                    <p className="py-2 text-center text-[11px] text-slate-400 dark:text-slate-500">No vessels match</p>
                  )}
                  {searchedVessels.map((v) => {
                    const isChecked = selectedVesselIds ? selectedVesselIds.has(v.id) : true;
                    const color =
                      v.vesselStatus === 'Active' || !v.vesselStatus
                        ? '#10b981'
                        : v.vesselStatus === 'Under Repair'
                        ? '#f59e0b'
                        : v.vesselStatus === 'Scrapped'
                        ? '#ef4444'
                        : '#94a3b8';
                    return (
                      <label
                        key={v.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 transition ${
                          isChecked
                            ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                            : 'border-slate-100 bg-white opacity-60 hover:opacity-100 dark:border-white/5 dark:bg-slate-900/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleVessel(v.id)}
                          className="h-3.5 w-3.5 cursor-pointer accent-blue-500"
                        />
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{v.name}</p>
                          <p className="truncate text-[10px] text-slate-500">
                            {v.imo} · {v.type}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </Section>

            <Section title="Layers" icon={<RouteIcon size={12} />}>
              <div className="space-y-2">
                <ToggleRow
                  icon={<RouteIcon size={13} className="text-blue-500 dark:text-blue-400" />}
                  label="Active Routes"
                  checked={showRoutes}
                  onChange={setShowRoutes}
                />
                <ToggleRow
                  icon={<Anchor size={13} className="text-indigo-500 dark:text-indigo-400" />}
                  label="Operation Ports"
                  checked={showOperations}
                  onChange={setShowOperations}
                />
                <ToggleRow
                  icon={<Package size={13} className="text-amber-500 dark:text-amber-400" />}
                  label="Sea Marks"
                  checked={showSeamarks}
                  onChange={setShowSeamarks}
                />
              </div>
            </Section>

            <Section title="Vessel Status" icon={<Ship size={12} />}>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <LegendDot color="#10b981" label="Active" />
                <LegendDot color="#f59e0b" label="Under Repair" />
                <LegendDot color="#94a3b8" label="Laid Up" />
                <LegendDot color="#ef4444" label="Scrapped" />
              </div>
            </Section>
          </div>

          <div className="border-t border-slate-200/70 px-4 py-3 dark:border-white/5">
            <button
              onClick={handleFitAll}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-500/25 dark:text-blue-300"
            >
              <Maximize2 size={13} />
              Fit All Vessels
            </button>
          </div>
        </div>
      </aside>

      {/* Toggle handle */}
      <button
        onClick={() => setSidebarOpen((prev) => !prev)}
        className="absolute top-1/2 z-[1001] -translate-y-1/2 flex h-12 w-6 items-center justify-center rounded-r-lg bg-white/95 text-slate-600 shadow-lg transition hover:bg-white hover:text-slate-900 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        style={{ left: sidebarOpen ? '20rem' : '0' }}
        aria-label={sidebarOpen ? 'Hide panel' : 'Show panel'}
      >
        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Map area */}
      <div className="relative flex-1">
        <MapContainer
          center={[20, 0]}
          zoom={3}
          minZoom={2}
          maxBounds={L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180))}
          maxBoundsViscosity={1.0}
          className={`h-full w-full ${mapStyle.dark ? 'bg-[#0a1929]' : 'bg-slate-100'}`}
          ref={mapRef}
          zoomControl
          worldCopyJump
        >
          <TileLayer
            key={mapStyle.id}
            url={mapStyle.url}
            {...(mapStyle.subdomains ? { subdomains: mapStyle.subdomains } : {})}
            attribution={mapStyle.attribution}
          />
          {showSeamarks && (
            <TileLayer url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png" opacity={0.7} />
          )}

          <FitBoundsControl positions={allPositionCoords} />
          <MapSizeInvalidator trigger={sidebarOpen} />

          {filteredVessels.map((vessel) => {
            const pos = animatedPositionMap.get(vessel.id);
            if (!pos) return null;
            return (
              <VesselMarker
                key={vessel.id}
                vessel={vessel}
                position={pos}
                isSelected={selectedVesselId === vessel.id}
                onClick={() => handleVesselClick(vessel)}
              />
            );
          })}

          {showRoutes &&
            activeRoutes.map((route) => {
              const depCoords = PORT_COORDS[route.departurePort];
              const arrCoords = PORT_COORDS[route.arrivalPort];
              if (!depCoords || !arrCoords) return null;
              return (
                <RoutePolyline
                  key={route.id}
                  route={route}
                  departureCoords={depCoords}
                  arrivalCoords={arrCoords}
                  vesselName={vesselById.get(route.vesselId)?.name}
                />
              );
            })}

          {showOperations &&
            Array.from(operationPortMarkers.values()).map((portInfo) => (
              <CircleMarker
                key={portInfo.port}
                center={portInfo.coords}
                radius={8}
                pathOptions={{ color: '#6366f1', fillColor: '#818cf8', fillOpacity: 0.6, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div className="text-xs">
                    <p className="font-semibold">{portInfo.port}</p>
                    {singleFilteredVesselId && numberedOperations ? (
                      <>
                        {numberedOperations
                          .filter((op) => op.port === portInfo.port)
                          .map((op) => (
                            <p key={op.id}>
                              {op.sequence}. {op.operationType} — {new Date(op.operationDate).toLocaleDateString()}
                            </p>
                          ))}
                      </>
                    ) : (
                      <p>{portInfo.count} operation{portInfo.count > 1 ? 's' : ''}</p>
                    )}
                  </div>
                </Tooltip>
                {singleFilteredVesselId && numberedOperations && (() => {
                  const opsAtPort = numberedOperations.filter((op) => op.port === portInfo.port);
                  if (opsAtPort.length === 0) return null;
                  const label = opsAtPort.length === 1
                    ? `${opsAtPort[0].sequence}`
                    : `${opsAtPort[0].sequence}+`;
                  return (
                    <Tooltip permanent direction="center" className="!bg-transparent !border-0 !shadow-none !p-0">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                        {label}
                      </span>
                    </Tooltip>
                  );
                })()}
                <Popup maxWidth={360}>
                  <div className="space-y-2 text-xs">
                    <p className="text-sm font-semibold">{portInfo.port}</p>
                    <p className="text-slate-500">
                      {portInfo.count} operation{portInfo.count > 1 ? 's' : ''}
                    </p>
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {portInfo.operations.map(({ vesselName, operation }) => (
                        <div key={operation.id} className="rounded border border-slate-200 p-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-slate-800">{operation.operationType}</p>
                            <p className="font-semibold text-slate-700">
                              {formatAmount(operation.totalAmount, operation.currency)}
                            </p>
                          </div>
                          <p className="text-slate-600">
                            {vesselName} · {new Date(operation.operationDate).toLocaleDateString()}
                          </p>
                          {operation.items.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {operation.items.slice(0, 4).map((item, idx) => (
                                <p key={`${operation.id}-${item.name}-${idx}`} className="text-slate-500">
                                  {item.name}: {item.quantity} {item.unit}
                                </p>
                              ))}
                              {operation.items.length > 4 && (
                                <p className="text-slate-400">+{operation.items.length - 4} more item(s)</p>
                              )}
                            </div>
                          )}
                          {operation.notes && <p className="mt-1 text-slate-500">Note: {operation.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
        </MapContainer>

        {/* Loading overlay until header resolves the active company */}
        {!isCompanyReady && (
          <div className="pointer-events-auto absolute inset-0 z-[1000] flex items-center justify-center bg-slate-100/60 backdrop-blur-sm dark:bg-slate-950/60">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 py-3 text-sm font-medium text-slate-700 shadow-lg dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-100">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Loading fleet...
            </div>
          </div>
        )}

        {/* Top-right live indicator */}
        <div className="pointer-events-none absolute top-4 right-4 z-[1000] flex items-center gap-2 rounded-full bg-slate-900/85 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          LIVE
          <span className="text-slate-400">·</span>
          <span className="text-slate-300">{activeCount}/{filteredVessels.length} active</span>
        </div>

        {/* Bottom-left status bar */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] flex items-center gap-3 rounded-lg bg-slate-900/85 px-3 py-2 text-[11px] text-white shadow-lg backdrop-blur">
          <span className="font-semibold">{filteredVessels.length} vessels</span>
          <span className="h-3 w-px bg-white/20" />
          <span>{underwayCount} underway</span>
          <span className="h-3 w-px bg-white/20" />
          <span>{filteredOperations.length} ops</span>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; accent: string }> = ({ label, value, accent }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 dark:border-white/5 dark:bg-slate-800/50">
    <p className={`text-lg font-bold leading-none ${accent}`}>{value}</p>
    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
  </div>
);

const ToggleRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ icon, label, checked, onChange }) => (
  <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:bg-slate-100 dark:border-white/5 dark:bg-slate-800/40 dark:hover:bg-slate-800/70">
    <span className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
      {icon}
      {label}
    </span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-3.5 w-3.5 cursor-pointer accent-blue-500"
    />
  </label>
);

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    {label}
  </div>
);
