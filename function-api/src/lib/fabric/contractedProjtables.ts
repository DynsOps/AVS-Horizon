import { runGraphqlQuery } from './client';
import { env } from '../env';
import { readThroughJsonCache, CacheStatus } from '../cache/cacheAside';

const CONTRACTED_PROJTABLES_QUERY = `
query ContractedProjtables($filter: ProjtablesFilter) {
  projtables(filter: $filter) {
    items {
      avscarriercode
      dataareaid
      refShippingCarriername
      ProjId_dataAreaId
    }
  }
}
`;

type ProjtableRow = {
  avscarriercode?: string | null;
  dataareaid?: string | null;
  refShippingCarriername?: string | null;
  ProjId_dataAreaId?: string | null;
};

type ContractedProjtablesData = {
  projtables?: {
    items?: ProjtableRow[] | null;
  } | null;
};

export type ContractedVessel = {
  imo: string;
  name: string;
  dataAreaId: string | null;
  projIdDataAreaIds: string[];
};

export type ContractedVesselsLookupResult = {
  items: ContractedVessel[];
  cacheStatus: CacheStatus;
};

const parsePositiveInt = (raw: string, fallback: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const groupContractedVesselRows = (rows: ProjtableRow[] | null | undefined): ContractedVessel[] => {
  const grouped = new Map<string, ProjtableRow[]>();

  for (const row of rows || []) {
    const imo = (row.avscarriercode || '').trim();
    if (!imo) continue;

    if (!grouped.has(imo)) {
      grouped.set(imo, []);
    }
    grouped.get(imo)!.push(row);
  }

  const result: ContractedVessel[] = [];

  for (const [imo, groupRows] of grouped) {
    const name =
      groupRows
        .map((r) => (r.refShippingCarriername || '').trim())
        .find((n) => n !== '') ?? '';

    const dataAreaId =
      groupRows
        .map((r) => (r.dataareaid || '').trim())
        .find((d) => d !== '') ?? null;

    const seenProjIds = new Set<string>();
    const projIdDataAreaIds: string[] = [];
    for (const row of groupRows) {
      const pid = (row.ProjId_dataAreaId || '').trim();
      if (pid && !seenProjIds.has(pid)) {
        seenProjIds.add(pid);
        projIdDataAreaIds.push(pid);
      }
    }

    result.push({ imo, name, dataAreaId, projIdDataAreaIds });
  }

  return result;
};

export const fetchContractedVesselsWithCache = async (
  topProjectIdDataAreaId: string
): Promise<ContractedVesselsLookupResult> => {
  const ttlSeconds = parsePositiveInt(env.fabricCacheContractedVesselsTtlSecondsRaw, 86400);
  const key = `fabric:contracted-vessels:top:${topProjectIdDataAreaId}`;

  const cached = await readThroughJsonCache<ContractedVessel[]>({
    key,
    ttlSeconds,
    load: async () => {
      const data = await runGraphqlQuery<ContractedProjtablesData>(CONTRACTED_PROJTABLES_QUERY, {
        filter: {
          TopProjectId_dataAreaId: { eq: topProjectIdDataAreaId },
          projgroupid: { eq: 'CONTRACTED' },
        },
      });
      return groupContractedVesselRows(data.projtables?.items);
    },
  });

  return {
    items: cached.value,
    cacheStatus: cached.cacheStatus,
  };
};
