import { isCompatibilityError, runGraphqlQuery } from './client';

const PAGED_BATCH_SIZE = 500;
const FALLBACK_BATCH_SIZE = 5000;

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

export type CompanyChain = {
  chainid: string;
  dataareaid: string | null;
};

const normalizeChainRows = (rows: CompanyChainRaw[] | null | undefined): CompanyChain[] => {
  return (rows || [])
    .map((row) => ({
      chainid: (row.chainid || '').trim(),
      dataareaid: (row.dataareaid || '').trim() || null,
    }))
    .filter((row) => row.chainid);
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
