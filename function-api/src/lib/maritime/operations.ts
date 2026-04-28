import { runGraphqlQuery } from '../fabric/client';
import { env } from '../env';
import { readThroughJsonCache, CacheStatus } from '../cache/cacheAside';
import { parsePositiveInt } from '../fabric/utils';

const VESSEL_OPERATIONS_QUERY = `
query VesselOperations($imos: [String!]!) {
  vesselOperations(filter: { imo: { in: $imos } }) {
    items {
      id
      vesselId
      imo
      port
      operationType
      operationDate
      totalAmount
      currency
    }
  }
}
`;

// Raw row from Fabric
type VesselOperationRow = {
  id?: string | null;
  vesselId?: string | null;
  imo?: string | null;
  port?: string | null;
  operationType?: string | null;
  operationDate?: string | null;
  totalAmount?: number | string | null;
  currency?: string | null;
};

type VesselOperationsData = {
  vesselOperations?: {
    items?: VesselOperationRow[] | null;
  } | null;
};

// Normalized record (this is what goes into Redis and is returned)
export interface VesselOperationRecord {
  id: string;
  vesselId: string; // matches vessel_id from positions, e.g. 'imo-9183855'
  imo: string;
  port: string;
  operationType: 'Bunkering' | 'Provisioning' | 'Maintenance' | 'Port Fees' | 'Crew Change';
  operationDate: string; // ISO 8601 date string
  totalAmount: number | null;
  currency: string;
}

export interface VesselOperationsResult {
  operations: VesselOperationRecord[];
  cacheStatus: CacheStatus;
}

const normalizeRows = (rows: VesselOperationRow[] | null | undefined): VesselOperationRecord[] => {
  const result: VesselOperationRecord[] = [];
  for (const row of rows || []) {
    if (!row.id || !row.vesselId || !row.imo || !row.port || !row.operationType || !row.operationDate || !row.currency) {
      continue;
    }

    const validOperationTypes = ['Bunkering', 'Provisioning', 'Maintenance', 'Port Fees', 'Crew Change'];
    if (!validOperationTypes.includes(String(row.operationType))) {
      continue;
    }

    result.push({
      id: String(row.id),
      vesselId: String(row.vesselId),
      imo: String(row.imo),
      port: String(row.port),
      operationType: String(row.operationType) as 'Bunkering' | 'Provisioning' | 'Maintenance' | 'Port Fees' | 'Crew Change',
      operationDate: String(row.operationDate),
      totalAmount: row.totalAmount !== null ? Number(row.totalAmount) : null,
      currency: String(row.currency),
    });
  }
  return result;
};

export const fetchVesselOperationsFromFabric = async (
  topProjectIdDataAreaId: string,
  imos: string[],
): Promise<VesselOperationsResult> => {
  // TODO: Implement when Fabric vessel-operations entity is confirmed
  // This will use runGraphqlQuery from lib/fabric/client.ts
  // Cache key: `fabric:vessel-operations:top:${topProjectIdDataAreaId}`
  // TTL: parsePositiveInt(env.fabricCacheVesselOperationsTtlSecondsRaw, 86400)
  return { operations: [], cacheStatus: 'miss' };
};
