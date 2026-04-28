import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { fetchContractedVesselsWithCache, FabricGraphqlError } from '../lib/fabricGraphql';
import { fetchVesselOperationsFromFabric } from '../lib/maritime/operations';
import { MaritimeApiError } from '../lib/maritime/client';
import { errorResponse, ok } from '../lib/http';

export async function customerMaritimeOperations(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('view:maritime-map')) {
      return errorResponse(403, 'Missing permission: view:maritime-map');
    }
    if (!actor.activeProjId || !actor.activeDataAreaId) {
      return errorResponse(400, 'Active company has no projId/dataAreaId configured.');
    }
    const topProjectIdDataAreaId = `${actor.activeProjId},${actor.activeDataAreaId}`;

    const contractedResult = await fetchContractedVesselsWithCache(topProjectIdDataAreaId);
    const imos = contractedResult.items.map((v: any) => v.imo).filter(Boolean);

    const result = await fetchVesselOperationsFromFabric(topProjectIdDataAreaId, imos);

    return ok({ operations: result.operations }, { 'x-cache': result.cacheStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('customer/maritime/operations failed', message);
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

app.http('customer-maritime-operations', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'customer/maritime/operations',
  handler: customerMaritimeOperations,
});
