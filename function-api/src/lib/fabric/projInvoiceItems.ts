import { runGraphqlQuery } from './client';
import { env } from '../env';
import { readThroughJsonCache, CacheStatus } from '../cache/cacheAside';
import { parsePositiveInt } from './utils';

const PROJ_INVOICE_ITEMS_QUERY = `
query ProjInvoiceItems($projPairs: [String!]!) {
  projInvoiceItems(filter: { projid_dataareaid: { in: $projPairs } }) {
    items {
      lineamount
      invoicedate
    }
  }
}
`;

type ProjInvoiceItemRow = {
  lineamount?: number | string | null;
  invoicedate?: string | null;
};

type ProjInvoiceItemsData = {
  projInvoiceItems?: {
    items?: ProjInvoiceItemRow[] | null;
  } | null;
};

export type InvoiceRecord = {
  lineamount: number;
  year: number;
  month: number; // 1–12
};

export type InvoiceLookupResult = {
  items: InvoiceRecord[];
  cacheStatus: CacheStatus;
};

const normalizeRows = (rows: ProjInvoiceItemRow[] | null | undefined): InvoiceRecord[] => {
  const result: InvoiceRecord[] = [];
  for (const row of rows || []) {
    const lineamount = Number(row.lineamount ?? 0);
    if (isNaN(lineamount) || !row.invoicedate) continue;

    const d = new Date(row.invoicedate);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    if (isNaN(year) || year < 2000 || year > 2100 || month < 1 || month > 12) continue;

    result.push({ lineamount, year, month });
  }
  return result;
};

export const fetchProjInvoiceItemsWithCache = async (
  topProjectIdDataAreaId: string,
  projPairs: string[]
): Promise<InvoiceLookupResult> => {
  if (projPairs.length === 0) {
    return { items: [], cacheStatus: 'bypass' };
  }

  const ttlSeconds = parsePositiveInt(env.fabricCacheProjInvoiceItemsTtlSecondsRaw, 3600);
  const key = `fabric:proj-invoice-items:top:${topProjectIdDataAreaId}`;

  const cached = await readThroughJsonCache<InvoiceRecord[]>({
    key,
    ttlSeconds,
    load: async () => {
      const data = await runGraphqlQuery<ProjInvoiceItemsData>(PROJ_INVOICE_ITEMS_QUERY, { projPairs });
      return normalizeRows(data.projInvoiceItems?.items);
    },
  });

  return {
    items: cached.value,
    cacheStatus: cached.cacheStatus,
  };
};
