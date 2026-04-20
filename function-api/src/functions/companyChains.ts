import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { runScopedQuery } from '../lib/db';
import { fetchAllCompanyChains, FabricGraphqlError } from '../lib/fabricGraphql';
import { errorResponse, ok } from '../lib/http';

type CompanyChainsBody = {
  companyId?: string;
  companyName?: string;
};

type CompanyRow = {
  companyId: string;
  companyName: string;
};

type CompanyChainMatch = {
  companyId: string;
  companyName: string;
  chainid: string;
  dataareaid: string | null;
};

const normalizeValue = (value: string): string => value.trim().toLowerCase();

const parseBody = async (request: HttpRequest): Promise<CompanyChainsBody> => {
  try {
    const body = (await request.json()) as CompanyChainsBody;
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
};

const getTargetCompanies = async (
  context: { role: 'supadmin' | 'admin' | 'user'; companyId: string | null; userId: string },
  companyId: string,
  companyName: string
): Promise<CompanyRow[]> => {
  if (companyId) {
    const result = await runScopedQuery<CompanyRow>(
      context,
      `
      SELECT c.id AS companyId, c.name AS companyName
      FROM dbo.companies c
      WHERE c.status = 'Active'
        AND c.id = @companyId
      `,
      { companyId }
    );
    return result.recordset;
  }

  if (companyName) {
    const result = await runScopedQuery<CompanyRow>(
      context,
      `
      SELECT c.id AS companyId, c.name AS companyName
      FROM dbo.companies c
      WHERE c.status = 'Active'
        AND LOWER(LTRIM(RTRIM(c.name))) = LOWER(LTRIM(RTRIM(@companyName)))
      `,
      { companyName }
    );
    return result.recordset;
  }

  const result = await runScopedQuery<CompanyRow>(
    context,
    `
    SELECT c.id AS companyId, c.name AS companyName
    FROM dbo.companies c
    WHERE c.status = 'Active'
    ORDER BY c.name ASC
    `
  );
  return result.recordset;
};

export async function companyChains(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);
    if (!actor.permissions.includes('view:reports')) {
      return errorResponse(403, 'Missing permission: view:reports');
    }

    const body = await parseBody(request);
    const effectiveCompanyId = (body.companyId || '').trim();
    const effectiveCompanyName = (body.companyName || '').trim();
    const targetCompanies = await getTargetCompanies(
      { role: actor.role, companyId: actor.companyId, userId: actor.id },
      effectiveCompanyId,
      effectiveCompanyName
    );

    if (targetCompanies.length === 0) {
      if (effectiveCompanyId) return errorResponse(404, 'No active company found for companyId.');
      if (effectiveCompanyName) return errorResponse(404, 'No active company found for companyName.');
      return ok({
        matches: [],
        unmatched: [],
        meta: {
          totalCompanies: 0,
          matchedCompanies: 0,
          unmatchedCompanies: 0,
          totalMatches: 0,
        },
      });
    }

    const companyChainsRows = await fetchAllCompanyChains();
    const chainsByName = new Map<string, Array<{ chainid: string; dataareaid: string | null }>>();
    companyChainsRows.forEach((row) => {
      const key = normalizeValue(row.chainid);
      const existing = chainsByName.get(key);
      if (existing) {
        existing.push({ chainid: row.chainid, dataareaid: row.dataareaid });
      } else {
        chainsByName.set(key, [{ chainid: row.chainid, dataareaid: row.dataareaid }]);
      }
    });

    const matches: CompanyChainMatch[] = [];
    const unmatched: Array<{ companyId: string; companyName: string }> = [];

    targetCompanies.forEach((company) => {
      const companyNameKey = normalizeValue(company.companyName);
      const nameMatches = chainsByName.get(companyNameKey) || [];
      if (nameMatches.length === 0) {
        unmatched.push({
          companyId: company.companyId,
          companyName: company.companyName,
        });
        return;
      }

      nameMatches.forEach((row) => {
        matches.push({
          companyId: company.companyId,
          companyName: company.companyName,
          chainid: row.chainid,
          dataareaid: row.dataareaid,
        });
      });
    });

    return ok({
      matches,
      unmatched,
      meta: {
        totalCompanies: targetCompanies.length,
        matchedCompanies: targetCompanies.length - unmatched.length,
        unmatchedCompanies: unmatched.length,
        totalMatches: matches.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('powerbi/company-chains failed', message);
    if (error instanceof FabricGraphqlError) {
      return errorResponse(error.status, message);
    }
    const status = message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('powerbi-company-chains', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'powerbi/company-chains',
  handler: companyChains,
});
