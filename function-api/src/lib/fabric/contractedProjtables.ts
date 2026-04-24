import { runGraphqlQuery } from './client';
import { env } from '../env';
import { readThroughJsonCache, CacheStatus } from '../cache/cacheAside';
import { parsePositiveInt } from './utils';

const CONTRACTED_PROJTABLES_QUERY = `
query ContractedProjtables($topId: String!) {
  projtables(filter: { TopProjectId_dataAreaId: { eq: $topId }, projgroupid: { eq: "CONTRACTED" } }) {
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
  name: string | null;
  dataAreaId: string | null;
  projIdDataAreaIds: string[];
};

export type ContractedVesselsLookupResult = {
  items: ContractedVessel[];
  cacheStatus: CacheStatus;
};

const groupContractedVesselRows = (rows: ProjtableRow[] | null | undefined): ContractedVessel[] => {
  const grouped = new Map<string, ProjtableRow[]>();

  for (const row of rows || []) {
    const imo = (row.avscarriercode || '').trim();
    if (!imo) continue;

    const bucket = grouped.get(imo) ?? [];
    grouped.set(imo, bucket);
    bucket.push(row);
  }

  const result: ContractedVessel[] = [];

  for (const [imo, groupRows] of grouped) {
    const name =
      groupRows
        .map((r) => (r.refShippingCarriername || '').trim())
        .find((n) => n !== '') ?? null;

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
        topId: topProjectIdDataAreaId,
      });
      return groupContractedVesselRows(data.projtables?.items);
    },
  });

  return {
    items: cached.value,
    cacheStatus: cached.cacheStatus,
  };
};
