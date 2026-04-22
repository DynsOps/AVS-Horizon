import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { fetchContractedVesselsWithCache, FabricGraphqlError } from '../lib/fabricGraphql';
import { errorResponse, ok } from '../lib/http';

export async function customerContractedVessels(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('view:fleet')) {
      return errorResponse(403, 'Missing permission: view:fleet');
    }
    if (!actor.activeProjId || !actor.activeDataAreaId) {
      return errorResponse(400, 'Active company has no projId/dataAreaId configured.');
    }
    const topProjectIdDataAreaId = `${actor.activeProjId},${actor.activeDataAreaId}`;
    const result = await fetchContractedVesselsWithCache(topProjectIdDataAreaId);
    return ok({ vessels: result.items }, { 'x-cache': result.cacheStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('customer/contracted-vessels failed', message);
    if (error instanceof FabricGraphqlError) {
      return errorResponse(error.status, message);
    }
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('customer-contracted-vessels', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'customer/contracted-vessels',
  handler: customerContractedVessels,
});
