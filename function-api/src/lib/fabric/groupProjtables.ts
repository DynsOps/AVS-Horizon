import { isCompatibilityError, runGraphqlQuery } from './client';
import { env } from '../env';
import { readThroughJsonCache, CacheStatus } from '../cache/cacheAside';

const PAGED_BATCH_SIZE = 500;
const FALLBACK_BATCH_SIZE = 5000;

const GROUP_PROJTABLES_PAGED_QUERY = `
query GroupProjtablesPaged($first: Int!, $after: String) {
  groupProjtables(first: $first, after: $after) {
    items {
      name
      dataareaid
      projid
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

const GROUP_PROJTABLES_FALLBACK_QUERY = `
query GroupProjtablesFallback($first: Int!) {
  groupProjtables(first: $first) {
    items {
      name
      dataareaid
      projid
    }
  }
}
`;

const GROUP_PROJTABLES_LEGACY_QUERY = `
query GroupProjtablesLegacy {
  groupProjtables {
    items {
      name
      dataareaid
      projid
    }
  }
}
`;

type GroupProjtableRaw = {
  name?: string | null;
  dataareaid?: string | null;
  projid?: string | null;
};

type GroupProjtablesPage = {
  items?: GroupProjtableRaw[] | null;
  pageInfo?: {
    hasNextPage?: boolean | null;
    endCursor?: string | null;
  } | null;
};

type GroupProjtablesPagedData = {
  groupProjtables?: GroupProjtablesPage | null;
};

type GroupProjtablesFallbackData = {
  groupProjtables?: {
    items?: GroupProjtableRaw[] | null;
  } | null;
};

export type GroupProjtable = {
  name: string;
  dataareaid: string | null;
  projid: string | null;
};

export type GroupProjtableSearchOptions = {
  query?: string;
  limit?: number;
};

export type GroupProjtableLookupResult = {
  items: GroupProjtable[];
  cacheStatus: CacheStatus;
};

const normalizeGroupProjtableRows = (rows: GroupProjtableRaw[] | null | undefined): GroupProjtable[] => {
  return (rows || [])
    .map((row) => ({
      name: (row.name || '').trim(),
      dataareaid: (row.dataareaid || '').trim() || null,
      projid: (row.projid || '').trim() || null,
    }))
    .filter((row) => row.name && row.projid);
};

const normalizeSearchQuery = (value: string | undefined): string => (value || '').trim().toLowerCase();

const normalizeSearchLimit = (value: number | undefined): number | null => {
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Number(value));
};

const parsePositiveInt = (raw: string, fallback: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const matchesGroupProjtableQuery = (row: GroupProjtable, query: string): boolean => {
  if (!query) return true;
  return row.name.toLowerCase().includes(query);
};

const mergeUniqueGroupProjtables = (source: GroupProjtable[], target: GroupProjtable[]): void => {
  const existing = new Set(target.map((row) => `${row.name}|${row.dataareaid || ''}|${row.projid || ''}`));

  for (const row of source) {
    const key = `${row.name}|${row.dataareaid || ''}|${row.projid || ''}`;
    if (existing.has(key)) continue;
    target.push(row);
    existing.add(key);
  }
};

const applyGroupProjtablesSearch = (
  source: GroupProjtable[],
  query: string,
  limit: number | null
): GroupProjtable[] => {
  const filtered = source.filter((row) => matchesGroupProjtableQuery(row, query));
  if (limit === null) return filtered;
  return filtered.slice(0, limit);
};

const fetchPagedGroupProjtables = async (): Promise<GroupProjtable[]> => {
  const rows: GroupProjtable[] = [];
  let after: string | null = null;

  while (true) {
    const data = await runGraphqlQuery<GroupProjtablesPagedData>(GROUP_PROJTABLES_PAGED_QUERY, {
      first: PAGED_BATCH_SIZE,
      after,
    });
    const page = data.groupProjtables;
    const normalizedRows = normalizeGroupProjtableRows(page?.items);
    mergeUniqueGroupProjtables(normalizedRows, rows);

    const hasNext = Boolean(page?.pageInfo?.hasNextPage);
    const cursor = (page?.pageInfo?.endCursor || '').trim();
    if (!hasNext || !cursor) break;
    after = cursor;
  }

  return rows;
};

const fetchFallbackGroupProjtables = async (): Promise<GroupProjtable[]> => {
  const data = await runGraphqlQuery<GroupProjtablesFallbackData>(GROUP_PROJTABLES_FALLBACK_QUERY, {
    first: FALLBACK_BATCH_SIZE,
  });
  return normalizeGroupProjtableRows(data.groupProjtables?.items);
};

const fetchLegacyGroupProjtables = async (): Promise<GroupProjtable[]> => {
  const data = await runGraphqlQuery<GroupProjtablesFallbackData>(GROUP_PROJTABLES_LEGACY_QUERY);
  return normalizeGroupProjtableRows(data.groupProjtables?.items);
};

const fetchGroupProjtablesUncached = async (): Promise<GroupProjtable[]> => {
  try {
    return await fetchPagedGroupProjtables();
  } catch (error) {
    const canFallbackToFirstOnly = isCompatibilityError(error, ['pageinfo', 'after']);
    if (!canFallbackToFirstOnly) throw error;
  }

  try {
    return await fetchFallbackGroupProjtables();
  } catch (error) {
    const canFallbackToLegacy = isCompatibilityError(error, ['argument "first"', 'unknown argument']);
    if (!canFallbackToLegacy) throw error;
  }

  return fetchLegacyGroupProjtables();
};

export const fetchAllGroupProjtablesWithCache = async (
  options?: GroupProjtableSearchOptions
): Promise<GroupProjtableLookupResult> => {
  const query = normalizeSearchQuery(options?.query);
  const limit = normalizeSearchLimit(options?.limit);
  const ttlSeconds = parsePositiveInt(env.fabricCacheGroupProjtablesTtlSecondsRaw, 604800);

  const cached = await readThroughJsonCache<GroupProjtable[]>({
    key: 'fabric:group-projtables:all',
    ttlSeconds,
    load: () => fetchGroupProjtablesUncached(),
  });

  return {
    items: applyGroupProjtablesSearch(cached.value, query, limit),
    cacheStatus: cached.cacheStatus,
  };
};

export const fetchAllGroupProjtables = async (options?: GroupProjtableSearchOptions): Promise<GroupProjtable[]> => {
  const result = await fetchAllGroupProjtablesWithCache(options);
  return result.items;
};
