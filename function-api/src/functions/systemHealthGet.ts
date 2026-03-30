import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runQuery } from '../lib/db';
import { env } from '../lib/env';
import { errorResponse, ok } from '../lib/http';

type HealthStatus = 'ok' | 'warn' | 'error';

type HealthService = {
  key: string;
  label: string;
  status: HealthStatus;
  details?: string;
  latencyMs?: number | null;
};

type HealthLog = {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  service: string;
};

const nowIso = (): string => new Date().toISOString();

const levelFromStatus = (status: HealthStatus): 'INFO' | 'WARN' | 'ERROR' => {
  if (status === 'error') return 'ERROR';
  if (status === 'warn') return 'WARN';
  return 'INFO';
};

export async function getSystemHealth(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('system:settings')) {
      return errorResponse(403, 'Missing permission: system:settings');
    }

    const logs: HealthLog[] = [];
    const services: HealthService[] = [];

    const authStatus: HealthStatus = env.azureTenantId && env.azureAudience ? 'ok' : 'warn';
    services.push({
      key: 'auth-service',
      label: 'Auth Service',
      status: authStatus,
      details: authStatus === 'ok' ? 'Azure AD settings configured.' : 'Azure AD env vars incomplete.',
      latencyMs: null,
    });
    logs.push({
      id: `log-auth-${Date.now()}`,
      timestamp: nowIso(),
      level: levelFromStatus(authStatus),
      message: authStatus === 'ok' ? 'Auth configuration loaded.' : 'Auth configuration has missing values.',
      service: 'Auth Service',
    });

    const dbStart = Date.now();
    let dbStatus: HealthStatus = 'ok';
    let dbDetails = 'SQL ping successful.';
    let userCount = 0;
    let companyCount = 0;
    try {
      await runQuery('SELECT 1 AS ping');
      const users = await runQuery<{ count: number }>('SELECT COUNT(1) AS count FROM dbo.users');
      const companies = await runQuery<{ count: number }>('SELECT COUNT(1) AS count FROM dbo.companies');
      userCount = users.recordset[0]?.count || 0;
      companyCount = companies.recordset[0]?.count || 0;
      if (companyCount === 0) {
        dbStatus = 'warn';
        dbDetails = 'Connected, but no companies found.';
      } else {
        dbDetails = `Connected. Users: ${userCount}, Companies: ${companyCount}.`;
      }
    } catch (error) {
      dbStatus = 'error';
      dbDetails = error instanceof Error ? error.message : 'Database query failed.';
    }
    const dbLatency = Date.now() - dbStart;
    services.push({
      key: 'core-db',
      label: 'Core DB',
      status: dbStatus,
      details: dbDetails,
      latencyMs: dbLatency,
    });
    logs.push({
      id: `log-db-${Date.now()}`,
      timestamp: nowIso(),
      level: levelFromStatus(dbStatus),
      message: `${dbDetails} Latency: ${dbLatency}ms`,
      service: 'Core DB',
    });

    const runtimeStatus: HealthStatus = dbStatus === 'error' ? 'warn' : 'ok';
    services.push({
      key: 'function-runtime',
      label: 'Function Runtime',
      status: runtimeStatus,
      details: 'Function app is running and responding.',
      latencyMs: null,
    });
    logs.push({
      id: `log-runtime-${Date.now()}`,
      timestamp: nowIso(),
      level: levelFromStatus(runtimeStatus),
      message: 'Runtime heartbeat is healthy.',
      service: 'Function Runtime',
    });

    const identityStatus: HealthStatus = actor.role === 'supadmin' ? 'ok' : 'warn';
    services.push({
      key: 'identity-module',
      label: 'Identity Module',
      status: identityStatus,
      details: identityStatus === 'ok' ? 'Full admin visibility confirmed.' : 'Authenticated with limited role.',
      latencyMs: null,
    });
    logs.push({
      id: `log-identity-${Date.now()}`,
      timestamp: nowIso(),
      level: levelFromStatus(identityStatus),
      message: identityStatus === 'ok' ? 'Identity module checks passed.' : 'Identity module running with non-supadmin context.',
      service: 'Identity Module',
    });

    return ok({
      generatedAt: nowIso(),
      services,
      logs: logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('system/health failed', message);
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('system-health-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'system-health',
  handler: getSystemHealth,
});
