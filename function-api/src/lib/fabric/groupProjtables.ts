import { isCompatibilityError, runGraphqlQuery } from './client';

const PAGED_BATCH_SIZE = 500;
const FALLBACK_BATCH_SIZE = 5000;
const GROUP_PROJTABLES_LIMIT_DEFAULT = 25;
const GROUP_PROJTABLES_LIMIT_MAX = 200;

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

const normalizeSearchLimit = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return GROUP_PROJTABLES_LIMIT_DEFAULT;
  return Math.max(1, Math.min(GROUP_PROJTABLES_LIMIT_MAX, Number(value)));
};

const matchesGroupProjtableQuery = (row: GroupProjtable, query: string): boolean => {
  if (!query) return true;
  return row.name.toLowerCase().includes(query);
};

const mergeUniqueGroupProjtables = (
  source: GroupProjtable[],
  target: GroupProjtable[],
  query: string,
  limit: number
): void => {
  const existing = new Set(target.map((row) => `${row.name}|${row.dataareaid || ''}|${row.projid || ''}`));

  for (const row of source) {
    if (!matchesGroupProjtableQuery(row, query)) continue;
    const key = `${row.name}|${row.dataareaid || ''}|${row.projid || ''}`;
    if (existing.has(key)) continue;
    target.push(row);
    existing.add(key);
    if (target.length >= limit) break;
  }
};

const fetchPagedGroupProjtables = async (query: string, limit: number): Promise<GroupProjtable[]> => {
  const matches: GroupProjtable[] = [];
  let after: string | null = null;

  while (true) {
    const data = await runGraphqlQuery<GroupProjtablesPagedData>(GROUP_PROJTABLES_PAGED_QUERY, {
      first: PAGED_BATCH_SIZE,
      after,
    });
    const page = data.groupProjtables;
    const normalizedRows = normalizeGroupProjtableRows(page?.items);
    mergeUniqueGroupProjtables(normalizedRows, matches, query, limit);
    if (matches.length >= limit) break;

    const hasNext = Boolean(page?.pageInfo?.hasNextPage);
    const cursor = (page?.pageInfo?.endCursor || '').trim();
    if (!hasNext || !cursor) break;
    after = cursor;
  }

  return matches;
};

const fetchFallbackGroupProjtables = async (query: string, limit: number): Promise<GroupProjtable[]> => {
  const data = await runGraphqlQuery<GroupProjtablesFallbackData>(GROUP_PROJTABLES_FALLBACK_QUERY, {
    first: FALLBACK_BATCH_SIZE,
  });
  const matches: GroupProjtable[] = [];
  mergeUniqueGroupProjtables(normalizeGroupProjtableRows(data.groupProjtables?.items), matches, query, limit);
  return matches;
};

const fetchLegacyGroupProjtables = async (query: string, limit: number): Promise<GroupProjtable[]> => {
  const data = await runGraphqlQuery<GroupProjtablesFallbackData>(GROUP_PROJTABLES_LEGACY_QUERY);
  const matches: GroupProjtable[] = [];
  mergeUniqueGroupProjtables(normalizeGroupProjtableRows(data.groupProjtables?.items), matches, query, limit);
  return matches;
};

export const fetchAllGroupProjtables = async (options?: GroupProjtableSearchOptions): Promise<GroupProjtable[]> => {
  const query = normalizeSearchQuery(options?.query);
  const limit = normalizeSearchLimit(options?.limit);

  try {
    return await fetchPagedGroupProjtables(query, limit);
  } catch (error) {
    const canFallbackToFirstOnly = isCompatibilityError(error, ['pageinfo', 'after']);
    if (!canFallbackToFirstOnly) throw error;
  }

  try {
    return await fetchFallbackGroupProjtables(query, limit);
  } catch (error) {
    const canFallbackToLegacy = isCompatibilityError(error, ['argument "first"', 'unknown argument']);
    if (!canFallbackToLegacy) throw error;
  }

  return fetchLegacyGroupProjtables(query, limit);
};
