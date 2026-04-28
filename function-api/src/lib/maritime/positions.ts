import { readJsonCache, writeJsonCache } from '../cache/redis';
import { CacheStatus } from '../cache/cacheAside';
import { runQuery } from '../db';
import { fetchDatadockedPositions, DatadockedResult } from './client';
import { env } from '../env';
import { parsePositiveInt } from '../fabric/utils';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MappedVessel {
  id: string;
  company_id: string;
  name: string;
  imo: string;
  type: string;
  flag_country: string;
  vessel_status: string;
}

export interface MappedPosition {
  id: string;
  vessel_id: string;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  course: number | null;
  heading: number | null;
  nav_status: string;
  destination: string;
  eta: Date | null;
}

export interface MappedRoute {
  id: string;
  vessel_id: string;
  departure_port: string;
  arrival_port: string;
  departure_date: Date | null;
  arrival_date: Date | null;
  status: string;
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

  const vessel: MappedVessel = {
    id: vesselId,
    company_id: companyId,
    name: result.name,
    imo: result.imo,
    type: result.typeSpecific,
    flag_country: '',
    vessel_status: 'Active',
  };

  const speed = safeFloat(result.speed);

  const position: MappedPosition = {
    id: `pos-${result.imo}`,
    vessel_id: vesselId,
    lat: safeFloat(result.latitude),
    lng: safeFloat(result.longitude),
    speed: speed,
    course: safeFloat(result.course),
    heading: safeFloat(result.heading),
    nav_status: result.navigationalStatus,
    destination: result.destination,
    eta: result.etaUtc ? new Date(result.etaUtc) : null,
  };

  const route: MappedRoute = {
    id: `route-${result.imo}`,
    vessel_id: vesselId,
    departure_port: result.lastPort,
    arrival_port: result.destination,
    departure_date: result.atdUtc ? new Date(result.atdUtc) : null,
    arrival_date: result.etaUtc ? new Date(result.etaUtc) : null,
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
  vessel_status: string;
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
       v.id, v.name, v.imo, v.type, v.flag_country, v.vessel_status, v.company_id,
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
      company_id: row.company_id,
      name: row.name,
      imo: row.imo,
      type: row.type,
      flag_country: row.flag_country,
      vessel_status: row.vessel_status,
    });

    positions.push({
      id: `pos-${row.imo}`,
      vessel_id: row.vessel_id,
      lat: row.lat,
      lng: row.lng,
      speed: row.speed,
      course: row.course,
      heading: row.heading,
      nav_status: row.nav_status,
      destination: row.destination,
      eta: row.eta ?? null,
    });

    if (row.departure_port !== null || row.arrival_port !== null) {
      routes.push({
        id: `route-${row.imo}`,
        vessel_id: row.vessel_id,
        departure_port: row.departure_port ?? '',
        arrival_port: row.arrival_port ?? '',
        departure_date: row.departure_date ?? null,
        arrival_date: row.arrival_date ?? null,
        status: row.route_status ?? 'In Progress',
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
USING (VALUES (@id, @companyId, @name, @imo, @type, @flagCountry, @vesselStatus))
  AS source (id, company_id, name, imo, type, flag_country, vessel_status)
ON target.imo = source.imo
WHEN MATCHED THEN
  UPDATE SET name = source.name, type = source.type, vessel_status = source.vessel_status, updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (id, company_id, name, imo, type, flag_country, vessel_status, created_at, updated_at)
  VALUES (source.id, source.company_id, source.name, source.imo, source.type, source.flag_country, source.vessel_status, SYSUTCDATETIME(), SYSUTCDATETIME());
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
    companyId: vessel.company_id,
    name: vessel.name,
    imo: vessel.imo,
    type: vessel.type,
    flagCountry: vessel.flag_country,
    vesselStatus: vessel.vessel_status,
  });
}

async function upsertPosition(position: MappedPosition): Promise<void> {
  await runQuery(MERGE_POSITION_SQL, {
    id: position.id,
    vesselId: position.vessel_id,
    lat: position.lat,
    lng: position.lng,
    speed: position.speed,
    course: position.course,
    heading: position.heading,
    navStatus: position.nav_status,
    destination: position.destination,
    eta: position.eta,
  });
}

async function upsertRoute(route: MappedRoute): Promise<void> {
  await runQuery(MERGE_ROUTE_SQL, {
    id: route.id,
    vesselId: route.vessel_id,
    departurePort: route.departure_port,
    arrivalPort: route.arrival_port,
    departureDate: route.departure_date,
    arrivalDate: route.arrival_date,
    status: route.status,
  });
}

async function persistToDb(payload: MaritimeMapPayload): Promise<void> {
  for (let i = 0; i < payload.vessels.length; i++) {
    await upsertVessel(payload.vessels[i]);
    await upsertPosition(payload.positions[i]);
    const route = payload.routes.find(r => r.vessel_id === payload.vessels[i].id);
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

  // Persist to DB then write Redis
  try {
    await persistToDb(payload);
  } catch (persistErr) {
    console.warn('[maritime] DB persist failed (cache will still be populated):', persistErr instanceof Error ? persistErr.message : String(persistErr));
  }
  await writeJsonCache(cacheKey, payload, ttl);
  return { payload, cacheStatus: 'miss' };
}
