import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { fetchContractedVesselsWithCache, FabricGraphqlError } from '../lib/fabricGraphql';
import { fetchVesselPositionsCached, MappedVessel } from '../lib/maritime/positions';
import { MaritimeApiError } from '../lib/maritime/client';
import { errorResponse, ok } from '../lib/http';

export async function customerMaritimePositions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('view:maritime-map')) {
      return errorResponse(403, 'Missing permission: view:maritime-map');
    }
    if (!actor.activeProjId || !actor.activeDataAreaId || !actor.activeCompanyId) {
      return errorResponse(400, 'Active company has no projId/dataAreaId configured.');
    }
    const topProjectIdDataAreaId = `${actor.activeProjId},${actor.activeDataAreaId}`;

    // Get contracted vessels from Fabric — source of truth for which vessels to show
    const contractedResult = await fetchContractedVesselsWithCache(topProjectIdDataAreaId);
    const imos = contractedResult.items.map((v) => v.imo).filter(Boolean);

    // Build baseline vessel list from Fabric data (shown even without Datadocked positions)
    const baselineVessels: MappedVessel[] = contractedResult.items.map((cv) => ({
      id: `imo-${cv.imo}`,
      companyId: actor.activeCompanyId as string,
      name: cv.name ?? cv.imo,
      imo: cv.imo,
      type: 'Unknown',
      flagCountry: '',
    }));

    // Fetch positions with 3-level cache (Redis → DB → Datadocked)
    const posResult = await fetchVesselPositionsCached(topProjectIdDataAreaId, actor.activeCompanyId, imos);

    // Merge: Datadocked/DB vessels override baseline (richer data); fill gaps with Fabric baseline
    const posVesselIds = new Set(posResult.payload.vessels.map((v) => v.id));
    const mergedVessels = [
      ...posResult.payload.vessels,
      ...baselineVessels.filter((bv) => !posVesselIds.has(bv.id)),
    ];

    return ok(
      { vessels: mergedVessels, positions: posResult.payload.positions, routes: posResult.payload.routes },
      { 'x-cache': posResult.cacheStatus },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('customer/maritime/positions failed', message);
    if (error instanceof FabricGraphqlError) {
      return errorResponse(error.status, message);
    }
    if (error instanceof MaritimeApiError) {
      return errorResponse(error.status, message);
    }
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('customer-maritime-positions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'customer/maritime/positions',
  handler: customerMaritimePositions,
});
