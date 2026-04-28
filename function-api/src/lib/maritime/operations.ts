export interface VesselOperationRecord {
  id: string;
  vesselId: string;
  imo: string;
  port: string;
  operationType: 'Bunkering' | 'Provisioning' | 'Maintenance' | 'Port Fees' | 'Crew Change';
  operationDate: string;
  totalAmount: number | null;
  currency: string;
}

export interface VesselOperationsResult {
  operations: VesselOperationRecord[];
  cacheStatus: 'hit' | 'miss' | 'bypass';
}

// TODO: Implement when Fabric vessel-operations entity is confirmed.
// Will use runGraphqlQuery from lib/fabric/client.ts with
// cache key `fabric:vessel-operations:top:${topProjectIdDataAreaId}` (TTL: FABRIC_CACHE_VESSEL_OPERATIONS_TTL_SECONDS, default 86400s).
export async function fetchVesselOperationsFromFabric(
  _topProjectIdDataAreaId: string,
  _imos: string[],
): Promise<VesselOperationsResult> {
  return { operations: [], cacheStatus: 'miss' };
}
