import { runGraphqlQuery } from './client';
import { env } from '../env';
import { readThroughJsonCache, CacheStatus } from '../cache/cacheAside';

const FLEET_MANDAYS_QUERY = `
query FleetMandays($pairs: [String!]!) {
  mergedMandays(filter: { carriercode_dataareaid: { in: $pairs } }) {
    items {
      carriercode_dataareaid
      monthname
      vesselName
      Year
      BudgetPPD
      Manday
    }
  }
}
`;

// Raw row from Fabric
type MergedMandayRow = {
  carriercode_dataareaid?: string | null;
  monthname?: string | null;
  vesselName?: string | null;
  Year?: number | string | null;
  BudgetPPD?: number | string | null;
  Manday?: number | string | null;
};

type FleetMandaysData = {
  mergedMandays?: {
    items?: MergedMandayRow[] | null;
  } | null;
};

// Normalized record (this is what goes into Redis and is returned)
export type FleetMandayRecord = {
  imo: string;
  dataAreaId: string | null;
  vesselName: string | null;
  year: number;
  month: number; // 1–12
  budgetPpd: number;
  manday: number;
};

export type FleetMandayLookupResult = {
  items: FleetMandayRecord[];
  cacheStatus: CacheStatus;
};

const parsePositiveInt = (raw: string, fallback: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const parseMonth = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const asInt = parseInt(raw, 10);
  if (!isNaN(asInt) && asInt >= 1 && asInt <= 12) return asInt;
  const idx = MONTH_NAMES.indexOf(raw.trim().toLowerCase());
  return idx >= 0 ? idx + 1 : null;
};

const normalizeRows = (rows: MergedMandayRow[] | null | undefined): FleetMandayRecord[] => {
  const result: FleetMandayRecord[] = [];
  for (const row of rows || []) {
    const pair = (row.carriercode_dataareaid || '').trim();
    if (!pair) continue;
    const commaIdx = pair.indexOf(',');
    const imo = commaIdx >= 0 ? pair.slice(0, commaIdx).trim() : pair;
    const dataAreaId = commaIdx >= 0 ? pair.slice(commaIdx + 1).trim() || null : null;
    if (!imo) continue;

    const month = parseMonth(row.monthname);
    if (month === null) continue;

    const year = parseInt(String(row.Year ?? ''), 10);
    if (isNaN(year)) continue;

    result.push({
      imo,
      dataAreaId,
      vesselName: (row.vesselName || '').trim() || null,
      year,
      month,
      budgetPpd: Number(row.BudgetPPD ?? 0) || 0,
      manday: Number(row.Manday ?? 0) || 0,
    });
  }
  return result;
};

export const fetchMergedMandaysWithCache = async (
  topProjectIdDataAreaId: string,
  pairs: string[]
): Promise<FleetMandayLookupResult> => {
  if (pairs.length === 0) {
    return { items: [], cacheStatus: 'bypass' };
  }

  const ttlSeconds = parsePositiveInt(env.fabricCacheMergedMandaysTtlSecondsRaw, 86400);
  const key = `fabric:merged-mandays:top:${topProjectIdDataAreaId}`;

  const cached = await readThroughJsonCache<FleetMandayRecord[]>({
    key,
    ttlSeconds,
    load: async () => {
      const data = await runGraphqlQuery<FleetMandaysData>(FLEET_MANDAYS_QUERY, { pairs });
      return normalizeRows(data.mergedMandays?.items);
    },
  });

  return {
    items: cached.value,
    cacheStatus: cached.cacheStatus,
  };
};
