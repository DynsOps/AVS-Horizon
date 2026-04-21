import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { fetchAllGroupProjtablesWithCache } from '../lib/fabricGraphql';
import { errorResponse, ok } from '../lib/http';

export async function groupProjtablesLookup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('manage:companies')) {
      return errorResponse(403, 'Missing permission: manage:companies');
    }

    const q = (request.query.get('q') || '').trim();
    const rawLimit = Number(request.query.get('limit') || '');
    const result = await fetchAllGroupProjtablesWithCache({
      query: q || undefined,
      limit: Number.isFinite(rawLimit) ? rawLimit : undefined,
    });
    return ok(
      { items: result.items },
      { 'x-cache': result.cacheStatus }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('fabric/group-projtables failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('fabric-group-projtables', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'fabric/group-projtables',
  handler: groupProjtablesLookup,
});
