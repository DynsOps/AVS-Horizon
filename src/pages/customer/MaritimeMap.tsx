import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, CircleMarker, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../services/api';
import { Vessel, VesselPosition, VesselRoute, VesselOperation } from '../../types';
import { VesselMarker } from '../../components/maritime/VesselMarker';
import { useUIStore } from '../../store/uiStore';
import { useThemeStore } from '../../store/themeStore';
import { VesselDrawer } from '../../components/maritime/VesselDrawer';
import { useMaritimeMapPayload } from '../../hooks/useMaritimeMapPayload';
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

// Module-level cache — survives re-renders, cleared on page reload
const portCoordsMemCache = new Map<string, [number, number] | null>();

function parseDMS(dms: string): number | null {
  const m = dms.match(/(\d+)[°º]\s*(\d+)[''']\s*([\d.]+)[""""]?\s*([NSEW])/i);
  if (!m) return null;
  const decimal = parseFloat(m[1]) + parseFloat(m[2]) / 60 + parseFloat(m[3]) / 3600;
  return m[4].toUpperCase() === 'S' || m[4].toUpperCase() === 'W' ? -decimal : decimal;
}

async function queryNGA(name: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://msi.pub.kubic.nga.mil/api/publications/world-port-index?portName=${encodeURIComponent(name)}&output=json`
    );
    const data = await res.json() as { ports?: { latitude: string; longitude: string }[] };
    const port = data?.ports?.[0];
    if (port) {
      const lat = parseDMS(port.latitude);
      const lng = parseDMS(port.longitude);
      if (lat != null && lng != null) return [lat, lng];
    }
  } catch { /* silently fail */ }
  return null;
}

async function fetchPortCoords(portName: string): Promise<[number, number] | null> {
  if (portCoordsMemCache.has(portName)) return portCoordsMemCache.get(portName) ?? null;

  // Datadocked appends country names: "Mersin Turkey", "Port Elizabeth South Africa"
  // Try stripping trailing words first (country), fall back to full name
  const words = portName.trim().split(/\s+/);
  const candidates: string[] = [];
  if (words.length > 1) candidates.push(words.slice(0, -1).join(' ')); // strip last word (country)
  if (words.length > 2) candidates.push(words.slice(0, -2).join(' ')); // strip last 2 words
  candidates.push(portName); // full name as last resort

  for (const candidate of candidates) {
    const coords = await queryNGA(candidate);
    if (coords) {
      portCoordsMemCache.set(portName, coords);
      return coords;
    }
  }

  portCoordsMemCache.set(portName, null);
  return null;
}

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


const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const getOperationPorts = (
  operations: VesselOperation[],
  vesselById: Map<string, Vessel>,
  portCoords: Record<string, [number, number]>,
): Map<string, OperationPortInfo> => {
  const map = new Map<string, OperationPortInfo>();
  operations.forEach((op) => {
    const coords = portCoords[op.port];
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
  const { data: mapData, isLoading: isMapLoading } = useMaritimeMapPayload();
  const vessels = mapData?.vessels ?? [];
  const positions = mapData?.positions ?? [];
  const routes = mapData?.routes ?? [];
  const [operations, setOperations] = useState<VesselOperation[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [selectedVesselIds, setSelectedVesselIds] = useState<Set<string> | null>(null);
  const [vesselSearch, setVesselSearch] = useState('');
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
  const [portCoords, setPortCoords] = useState<Record<string, [number, number]>>({});
  const { openDrawer, dashboardCompanyId } = useUIStore();
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const ops = await api.maritime.getOperations();
        setOperations(ops);
      } catch (err) {
        console.error('[MaritimeMap] Failed to load operations:', err instanceof Error ? err.message : String(err));
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const portNames = new Set<string>();
    routes.forEach(r => { if (r.departurePort) portNames.add(r.departurePort); if (r.arrivalPort) portNames.add(r.arrivalPort); });
    operations.forEach(op => { if (op.port) portNames.add(op.port); });
    const missing = Array.from(portNames).filter(n => !portCoordsMemCache.has(n));
    if (missing.length === 0) return;
    Promise.all(missing.map(async n => ({ name: n, coords: await fetchPortCoords(n) }))).then(results => {
      const updates: Record<string, [number, number]> = {};
      results.forEach(r => { if (r.coords) updates[r.name] = r.coords; });
      if (Object.keys(updates).length > 0) setPortCoords(prev => ({ ...prev, ...updates }));
    });
  }, [routes, operations]);


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
    if (filteredVesselIds.size === 1) {
      return [...filteredVesselIds][0];
    }
    return null;
  }, [filteredVesselIds]);

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

  const allPositionCoords = useMemo(() => {
    const vesselCoords = Array.from(positionMap.values())
      .filter((p) => p.lat != null && p.lng != null)
      .map((p): [number, number] => [p.lat as number, p.lng as number]);
    const routeCoords = activeRoutes.flatMap((route) => {
      const depCoords = portCoords[route.departurePort];
      const arrCoords = portCoords[route.arrivalPort];
      if (!depCoords || !arrCoords) return [];
      return [depCoords, arrCoords];
    });
    return [...vesselCoords, ...routeCoords];
  }, [activeRoutes, positionMap, portCoords]);

  const filteredOperations = useMemo(
    () => operations.filter((op) => filteredVesselIds.has(op.vesselId)),
    [operations, filteredVesselIds],
  );

  const numberedOperations = useMemo(() => {
    if (!singleFilteredVesselId) return null;
    return numberOperationsForVessel(filteredOperations, singleFilteredVesselId);
  }, [singleFilteredVesselId, filteredOperations]);

  const operationPortMarkers = useMemo(
    () => getOperationPorts(filteredOperations, vesselById, portCoords),
    [filteredOperations, vesselById, portCoords],
  );

  const vesselTypes = useMemo(() => [...new Set(vessels.map((v) => v.type))], [vessels]);

  const handleVesselClick = (vessel: Vessel) => {
    setSelectedVesselId(vessel.id);
    const pos = positionMap.get(vessel.id);
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
                    const color = '#10b981';
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
            const pos = positionMap.get(vessel.id);
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


          {showOperations &&
            Array.from(operationPortMarkers.values()).map((portInfo) => {
              const opsAtPort = numberedOperations
                ? numberedOperations.filter((op) => op.port === portInfo.port)
                : [];
              const badgeLabel = opsAtPort.length === 1
                ? `${opsAtPort[0].sequence}`
                : opsAtPort.length > 1
                ? `${opsAtPort[0].sequence}+`
                : null;

              return (
                <React.Fragment key={portInfo.port}>
                  <CircleMarker
                    center={portInfo.coords}
                    radius={8}
                    pathOptions={{ color: '#6366f1', fillColor: '#818cf8', fillOpacity: 0.6, weight: 2 }}
                  >
                    <Tooltip direction="top" offset={[0, -10]}>
                      <div className="text-xs">
                        <p className="font-semibold">{portInfo.port}</p>
                        {singleFilteredVesselId && numberedOperations ? (
                          <>
                            {opsAtPort.map((op) => (
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
                  {badgeLabel && (
                    <Marker
                      position={portInfo.coords}
                      interactive={false}
                      icon={L.divIcon({
                        html: `<span style="display:flex;width:20px;height:20px;align-items:center;justify-content:center;border-radius:50%;background:#4f46e5;color:white;font-size:10px;font-weight:700">${badgeLabel}</span>`,
                        className: '',
                        iconSize: [20, 20],
                        iconAnchor: [10, 10],
                      })}
                    />
                  )}
                </React.Fragment>
              );
            })}
        </MapContainer>

        {/* Loading overlay until header resolves the active company */}
        {(isMapLoading || !isCompanyReady) && (
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
          <span className="text-slate-300">{filteredVessels.length} vessels</span>
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

