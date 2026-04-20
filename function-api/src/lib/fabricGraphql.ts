import { env } from './env';
import { getFabricAccessToken } from './powerbi';

const PAGED_BATCH_SIZE = 500;
const FALLBACK_BATCH_SIZE = 5000;
const GROUP_PROJTABLES_LIMIT_DEFAULT = 25;
const GROUP_PROJTABLES_LIMIT_MAX = 200;

const COMPANY_CHAINS_PAGED_QUERY = `
query CompanyChainsPaged($first: Int!, $after: String) {
  companyChains(first: $first, after: $after) {
    items {
      chainid
      dataareaid
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

const COMPANY_CHAINS_FALLBACK_QUERY = `
query CompanyChainsFallback($first: Int!) {
  companyChains(first: $first) {
    items {
      chainid
      dataareaid
    }
  }
}
`;

const COMPANY_CHAINS_LEGACY_QUERY = `
query CompanyChainsLegacy {
  companyChains {
    items {
      chainid
      dataareaid
    }
  }
}
`;

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

type GraphqlErrorItem = {
  message?: string;
};

type GraphqlEnvelope<TData> = {
  data?: TData;
  errors?: GraphqlErrorItem[];
};

type CompanyChainRaw = {
  chainid?: string | null;
  dataareaid?: string | null;
};

type CompanyChainsPage = {
  items?: CompanyChainRaw[] | null;
  pageInfo?: {
    hasNextPage?: boolean | null;
    endCursor?: string | null;
  } | null;
};

type CompanyChainsPagedData = {
  companyChains?: CompanyChainsPage | null;
};

type CompanyChainsFallbackData = {
  companyChains?: {
    items?: CompanyChainRaw[] | null;
  } | null;
};

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

export type CompanyChain = {
  chainid: string;
  dataareaid: string | null;
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

export class FabricGraphqlError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'FabricGraphqlError';
    this.status = status;
  }
}

const normalizeChainRows = (rows: CompanyChainRaw[] | null | undefined): CompanyChain[] => {
  return (rows || [])
    .map((row) => ({
      chainid: (row.chainid || '').trim(),
      dataareaid: (row.dataareaid || '').trim() || null,
    }))
    .filter((row) => row.chainid);
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

const getGraphqlErrorMessage = (payload: Partial<GraphqlEnvelope<unknown>>): string => {
  const messages = (payload.errors || []).map((item) => (item.message || '').trim()).filter(Boolean);
  if (messages.length === 0) return 'Fabric GraphQL request failed.';
  return messages.join(' | ');
};

const isCompatibilityError = (error: unknown, tokens: string[]): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return tokens.some((token) => message.includes(token.toLowerCase()));
};

export const runGraphqlQuery = async <TData>(query: string, variables?: Record<string, unknown>): Promise<TData> => {
  if (!env.fabricGraphqlEndpoint) {
    throw new Error('Missing FABRIC_GRAPHQL_ENDPOINT');
  }

  const timeoutMs = Number.isFinite(env.fabricGraphqlTimeoutMs) && env.fabricGraphqlTimeoutMs > 0
    ? env.fabricGraphqlTimeoutMs
    : 10000;
  const accessToken = await getFabricAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(env.fabricGraphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query,
        variables: variables || {},
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as GraphqlEnvelope<TData>;
    if (!response.ok) {
      const message = getGraphqlErrorMessage(payload);
      throw new FabricGraphqlError(`Fabric GraphQL request failed (${response.status}): ${message}`);
    }
    if (payload.errors && payload.errors.length > 0) {
      throw new FabricGraphqlError(getGraphqlErrorMessage(payload));
    }
    if (!payload.data) {
      throw new FabricGraphqlError('Fabric GraphQL response did not include a data payload.');
    }

    return payload.data;
  } catch (error) {
    if (error instanceof FabricGraphqlError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FabricGraphqlError(`Fabric GraphQL request timed out after ${timeoutMs}ms.`, 504);
    }
    const message = error instanceof Error ? error.message : 'Unknown Fabric GraphQL request error.';
    throw new FabricGraphqlError(message);
  } finally {
    clearTimeout(timer);
  }
};

const fetchPagedCompanyChains = async (): Promise<CompanyChain[]> => {
  const items: CompanyChain[] = [];
  let after: string | null = null;

  while (true) {
    const data = await runGraphqlQuery<CompanyChainsPagedData>(COMPANY_CHAINS_PAGED_QUERY, {
      first: PAGED_BATCH_SIZE,
      after,
    });
    const page = data.companyChains;
    items.push(...normalizeChainRows(page?.items));

    const hasNext = Boolean(page?.pageInfo?.hasNextPage);
    const cursor = (page?.pageInfo?.endCursor || '').trim();
    if (!hasNext || !cursor) break;
    after = cursor;
  }

  return items;
};

const fetchFallbackCompanyChains = async (): Promise<CompanyChain[]> => {
  const data = await runGraphqlQuery<CompanyChainsFallbackData>(COMPANY_CHAINS_FALLBACK_QUERY, {
    first: FALLBACK_BATCH_SIZE,
  });
  return normalizeChainRows(data.companyChains?.items);
};

const fetchLegacyCompanyChains = async (): Promise<CompanyChain[]> => {
  const data = await runGraphqlQuery<CompanyChainsFallbackData>(COMPANY_CHAINS_LEGACY_QUERY);
  return normalizeChainRows(data.companyChains?.items);
};

export const fetchAllCompanyChains = async (): Promise<CompanyChain[]> => {
  try {
    return await fetchPagedCompanyChains();
  } catch (error) {
    const canFallbackToFirstOnly = isCompatibilityError(error, ['pageinfo', 'after']);
    if (!canFallbackToFirstOnly) throw error;
  }

  try {
    return await fetchFallbackCompanyChains();
  } catch (error) {
    const canFallbackToLegacy = isCompatibilityError(error, ['argument "first"', 'unknown argument']);
    if (!canFallbackToLegacy) throw error;
  }

  return fetchLegacyCompanyChains();
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
