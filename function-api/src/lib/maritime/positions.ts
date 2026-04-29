import { readJsonCache, writeJsonCache } from '../cache/redis';
import { CacheStatus } from '../cache/cacheAside';
import { runQuery } from '../db';
import { fetchDatadockedPositions, DatadockedResult } from './client';
import { env } from '../env';
import { parsePositiveInt } from '../fabric/utils';

// ---------------------------------------------------------------------------
// Public types — field names match the frontend Vessel/VesselPosition/VesselRoute interfaces
// ---------------------------------------------------------------------------

export interface MappedVessel {
  id: string;
  companyId: string;
  name: string;
  imo: string;
  type: string;
  flagCountry: string;
}

export interface MappedPosition {
  id: string;
  vesselId: string;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  course: number | null;
  heading: number | null;
  navStatus: string;
  destination: string;
  eta: string | null;
  fetchedAt: string;
}

export interface MappedRoute {
  id: string;
  vesselId: string;
  departurePort: string;
  arrivalPort: string;
  departureDate: string | null;
  arrivalDate: string | null;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Cancelled';
}

export interface MaritimeMapPayload {
  vessels: MappedVessel[];
  positions: MappedPosition[];
  routes: MappedRoute[];
}

export interface MaritimePositionsResult {
  payload: MaritimeMapPayload;
  cacheStatus: CacheStatus;
}

// ---------------------------------------------------------------------------
// Mapper: DatadockedResult → internal types
// ---------------------------------------------------------------------------

const safeFloat = (raw: string | undefined | null): number | null => {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
};

function mapResult(result: DatadockedResult, companyId: string): {
  vessel: MappedVessel;
  position: MappedPosition;
  route: MappedRoute;
} {
  const vesselId = `imo-${result.imo}`;
  const now = new Date().toISOString();

  const vessel: MappedVessel = {
    id: vesselId,
    companyId,
    name: result.name,
    imo: result.imo,
    type: result.typeSpecific,
    flagCountry: '',
  };

  const position: MappedPosition = {
    id: `pos-${result.imo}`,
    vesselId,
    lat: safeFloat(result.latitude),
    lng: safeFloat(result.longitude),
    speed: safeFloat(result.speed),
    course: safeFloat(result.course),
    heading: safeFloat(result.heading),
    navStatus: result.navigationalStatus,
    destination: result.destination,
    eta: result.etaUtc ? new Date(result.etaUtc).toISOString() : null,
    fetchedAt: now,
  };

  const route: MappedRoute = {
    id: `route-${result.imo}`,
    vesselId,
    departurePort: result.lastPort,
    arrivalPort: result.destination,
    departureDate: result.atdUtc ? new Date(result.atdUtc).toISOString() : null,
    arrivalDate: result.etaUtc ? new Date(result.etaUtc).toISOString() : null,
    status: 'In Progress',
  };

  return { vessel, position, route };
}

// ---------------------------------------------------------------------------
// DB read — freshness check
// ---------------------------------------------------------------------------

interface DbPositionRow {
  vessel_id: string;
  fetched_at: Date;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  course: number | null;
  heading: number | null;
  nav_status: string;
  destination: string;
  eta: Date | null;
  id: string;
  name: string;
  imo: string;
  type: string;
  flag_country: string;
  company_id: string;
  departure_port: string | null;
  arrival_port: string | null;
  departure_date: Date | null;
  arrival_date: Date | null;
  route_status: string | null;
}

const READ_POSITIONS_SQL = `
SELECT p.vessel_id, p.fetched_at, p.lat, p.lng, p.speed, p.course, p.heading,
       p.nav_status, p.destination, p.eta,
       v.id, v.name, v.imo, v.type, v.flag_country, v.company_id,
       vr.departure_port, vr.arrival_port, vr.departure_date, vr.arrival_date, vr.status AS route_status
FROM dbo.vessel_positions p
JOIN dbo.vessels v ON v.id = p.vessel_id
LEFT JOIN dbo.vessel_routes vr ON vr.vessel_id = p.vessel_id
WHERE v.company_id = @companyId
  AND p.fetched_at > DATEADD(hour, -1, SYSUTCDATETIME())
`;

async function readFreshFromDb(companyId: string, imos: string[]): Promise<{ payload: MaritimeMapPayload; cacheStatus: 'db-hit' } | null> {
  const result = await runQuery<DbPositionRow>(READ_POSITIONS_SQL, { companyId });
  const rows = result.recordset;
  const dbImos = new Set(rows.map((r) => r.imo));
  const allCovered = imos.every((imo) => dbImos.has(imo));
  if (!allCovered) return null;
  return { payload: dbRowsToPayload(rows), cacheStatus: 'db-hit' };
}

function dbRowsToPayload(rows: DbPositionRow[]): MaritimeMapPayload {
  const vessels: MappedVessel[] = [];
  const positions: MappedPosition[] = [];
  const routes: MappedRoute[] = [];

  for (const row of rows) {
    vessels.push({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      imo: row.imo,
      type: row.type,
      flagCountry: row.flag_country,
    });

    positions.push({
      id: `pos-${row.imo}`,
      vesselId: row.vessel_id,
      lat: row.lat,
      lng: row.lng,
      speed: row.speed,
      course: row.course,
      heading: row.heading,
      navStatus: row.nav_status,
      destination: row.destination,
      eta: row.eta ? row.eta.toISOString() : null,
      fetchedAt: row.fetched_at.toISOString(),
    });

    if (row.departure_port !== null || row.arrival_port !== null) {
      routes.push({
        id: `route-${row.imo}`,
        vesselId: row.vessel_id,
        departurePort: row.departure_port ?? '',
        arrivalPort: row.arrival_port ?? '',
        departureDate: row.departure_date ? row.departure_date.toISOString() : null,
        arrivalDate: row.arrival_date ? row.arrival_date.toISOString() : null,
        status: (row.route_status as MappedRoute['status']) ?? 'In Progress',
      });
    }
  }

  return { vessels, positions, routes };
}

// ---------------------------------------------------------------------------
// DB upserts
// ---------------------------------------------------------------------------

const MERGE_VESSEL_SQL = `
MERGE dbo.vessels AS target
USING (VALUES (@id, @companyId, @name, @imo, @type, @flagCountry))
  AS source (id, company_id, name, imo, type, flag_country)
ON target.imo = source.imo
WHEN MATCHED THEN
  UPDATE SET name = source.name, type = source.type, updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (id, company_id, name, imo, type, flag_country, created_at, updated_at)
  VALUES (source.id, source.company_id, source.name, source.imo, source.type, source.flag_country, SYSUTCDATETIME(), SYSUTCDATETIME());
`;

const MERGE_POSITION_SQL = `
MERGE dbo.vessel_positions AS target
USING (VALUES (@id, @vesselId, @lat, @lng, @speed, @course, @heading, @navStatus, @destination, @eta))
  AS source (id, vessel_id, lat, lng, speed, course, heading, nav_status, destination, eta)
ON target.vessel_id = source.vessel_id
WHEN MATCHED THEN
  UPDATE SET id = source.id, lat = source.lat, lng = source.lng, speed = source.speed,
             course = source.course, heading = source.heading, nav_status = source.nav_status,
             destination = source.destination, eta = source.eta, fetched_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (id, vessel_id, lat, lng, speed, course, heading, nav_status, destination, eta, fetched_at)
  VALUES (source.id, source.vessel_id, source.lat, source.lng, source.speed, source.course,
          source.heading, source.nav_status, source.destination, source.eta, SYSUTCDATETIME());
`;

const MERGE_ROUTE_SQL = `
MERGE dbo.vessel_routes AS target
USING (VALUES (@id, @vesselId, @departurePort, @arrivalPort, @departureDate, @arrivalDate, @status))
  AS source (id, vessel_id, departure_port, arrival_port, departure_date, arrival_date, status)
ON target.vessel_id = source.vessel_id
WHEN MATCHED THEN
  UPDATE SET id = source.id, departure_port = source.departure_port, arrival_port = source.arrival_port,
             departure_date = source.departure_date, arrival_date = source.arrival_date, status = source.status,
             updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (id, vessel_id, departure_port, arrival_port, departure_date, arrival_date, status, created_at, updated_at)
  VALUES (source.id, source.vessel_id, source.departure_port, source.arrival_port,
          source.departure_date, source.arrival_date, source.status, SYSUTCDATETIME(), SYSUTCDATETIME());
`;

async function upsertVessel(vessel: MappedVessel): Promise<void> {
  await runQuery(MERGE_VESSEL_SQL, {
    id: vessel.id,
    companyId: vessel.companyId,
    name: vessel.name,
    imo: vessel.imo,
    type: vessel.type,
    flagCountry: vessel.flagCountry,
  });
}

async function upsertPosition(position: MappedPosition): Promise<void> {
  await runQuery(MERGE_POSITION_SQL, {
    id: position.id,
    vesselId: position.vesselId,
    lat: position.lat,
    lng: position.lng,
    speed: position.speed,
    course: position.course,
    heading: position.heading,
    navStatus: position.navStatus,
    destination: position.destination,
    eta: position.eta ? new Date(position.eta) : null,
  });
}

async function upsertRoute(route: MappedRoute): Promise<void> {
  await runQuery(MERGE_ROUTE_SQL, {
    id: route.id,
    vesselId: route.vesselId,
    departurePort: route.departurePort,
    arrivalPort: route.arrivalPort,
    departureDate: route.departureDate ? new Date(route.departureDate) : null,
    arrivalDate: route.arrivalDate ? new Date(route.arrivalDate) : null,
    status: route.status,
  });
}

async function persistToDb(payload: MaritimeMapPayload): Promise<void> {
  for (let i = 0; i < payload.vessels.length; i++) {
    await upsertVessel(payload.vessels[i]);
    await upsertPosition(payload.positions[i]);
    const route = payload.routes.find(r => r.vesselId === payload.vessels[i].id);
    if (route) await upsertRoute(route);
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function fetchVesselPositionsCached(
  topProjectIdDataAreaId: string,
  companyId: string,
  imos: string[]
): Promise<MaritimePositionsResult> {
  if (imos.length === 0) {
    return { payload: { vessels: [], positions: [], routes: [] }, cacheStatus: 'miss' };
  }

  const cacheKey = `maritime:positions:top:${topProjectIdDataAreaId}`;
  const ttl = parsePositiveInt(env.maritimeCachePositionsTtlSecondsRaw, 3600);

  // Step 1 — Redis cache read
  const cached = await readJsonCache<MaritimeMapPayload>(cacheKey);
  if (cached.status === 'hit' && cached.value) {
    return { payload: cached.value, cacheStatus: 'hit' };
  }

  // Step 2 — DB freshness check
  let dbResult: { payload: MaritimeMapPayload; cacheStatus: 'db-hit' } | null = null;
  try {
    dbResult = await readFreshFromDb(companyId, imos);
  } catch (dbErr) {
    console.warn('[maritime] DB freshness check failed, falling through to Datadocked:', dbErr instanceof Error ? dbErr.message : String(dbErr));
  }
  if (dbResult) {
    await writeJsonCache(cacheKey, dbResult.payload, ttl);
    return { payload: dbResult.payload, cacheStatus: 'db-hit' };
  }

  // Step 3 — Datadocked fetch
  const ddResults = await fetchDatadockedPositions(imos);

  const vessels: MappedVessel[] = [];
  const positions: MappedPosition[] = [];
  const routes: MappedRoute[] = [];

  for (const result of ddResults) {
    const mapped = mapResult(result, companyId);
    vessels.push(mapped.vessel);
    positions.push(mapped.position);
    routes.push(mapped.route);
  }

  const payload: MaritimeMapPayload = { vessels, positions, routes };

  // Persist to DB then write Redis — only cache when Datadocked returned real data
  if (positions.length > 0) {
    try {
      await persistToDb(payload);
    } catch (persistErr) {
      console.warn('[maritime] DB persist failed (cache will still be populated):', persistErr instanceof Error ? persistErr.message : String(persistErr));
    }
    await writeJsonCache(cacheKey, payload, ttl);
  } else {
    console.warn('[maritime] Datadocked returned no position data — skipping cache write');
  }
  return { payload, cacheStatus: 'miss' };
}
