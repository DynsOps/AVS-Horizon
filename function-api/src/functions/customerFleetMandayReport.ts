import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authenticateRequest } from '../lib/auth';
import { fetchContractedVesselsWithCache, fetchMergedMandaysWithCache, FabricGraphqlError } from '../lib/fabricGraphql';
import { errorResponse, ok } from '../lib/http';

export async function customerFleetMandayReport(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const actor = await authenticateRequest(request);

    if (!actor.permissions.includes('view:fleet')) {
      return errorResponse(403, 'Missing permission: view:fleet');
    }

    if (!actor.activeProjId || !actor.activeDataAreaId) {
      return errorResponse(400, 'Active company has no projId/dataAreaId configured.');
    }

    const topProjectIdDataAreaId = `${actor.activeProjId},${actor.activeDataAreaId}`;

    // Parse + validate year/month query params (default: current UTC month)
    const now = new Date();
    const rawYear = request.query.get('year') ?? String(now.getUTCFullYear());
    const rawMonth = request.query.get('month') ?? String(now.getUTCMonth() + 1);
    const year = parseInt(rawYear, 10);
    const month = parseInt(rawMonth, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return errorResponse(400, 'Invalid year or month. month must be 1–12.');
    }

    // Step 1: get contracted vessels (from cache)
    const vessels = await fetchContractedVesselsWithCache(topProjectIdDataAreaId);

    // Build pairs: "${imo},${dataAreaId}" — skip vessels without dataAreaId
    const pairs = vessels.items
      .filter((v) => v.imo && v.dataAreaId)
      .map((v) => `${v.imo},${v.dataAreaId}`);

    // Build a name lookup from contracted vessels for fallback
    const vesselNameByImo = new Map<string, string | null>(
      vessels.items.map((v) => [v.imo, v.name]),
    );

    // Step 2: get mergedMandays (from cache)
    const mandays = await fetchMergedMandaysWithCache(topProjectIdDataAreaId, pairs);

    // Filter to requested year + month
    const filtered = mandays.items.filter((r) => r.year === year && r.month === month);

    // Aggregate per vessel
    type VesselAgg = {
      imo: string;
      vesselName: string;
      budget: number;
      actual: number;
    };

    const agg = new Map<string, VesselAgg>();
    for (const row of filtered) {
      const existing = agg.get(row.imo);
      if (existing) {
        existing.budget += row.budgetPpd;
        existing.actual += row.manday;
      } else {
        const name =
          (row.vesselName || '').trim() ||
          vesselNameByImo.get(row.imo) ||
          row.imo;
        agg.set(row.imo, {
          imo: row.imo,
          vesselName: name,
          budget: row.budgetPpd,
          actual: row.manday,
        });
      }
    }

    // Build vessel rows
    const vesselRows = Array.from(agg.values()).map((v) => {
      const variancePct = v.budget > 0 ? ((v.actual - v.budget) / v.budget) * 100 : 0;
      const exceeded = v.actual > v.budget;
      return {
        imo: v.imo,
        vesselName: v.vesselName,
        budget: v.budget,
        actual: v.actual,
        variancePct,
        exceeded,
      };
    });

    // Sort vessels by variancePct descending (worst first)
    vesselRows.sort((a, b) => b.variancePct - a.variancePct);

    // Build exception alerts (exceeded vessels, sorted by variancePct desc — already sorted)
    const exceptions = vesselRows
      .filter((v) => v.exceeded)
      .map((v) => ({
        imo: v.imo,
        vesselName: v.vesselName,
        mandayRate: v.actual,
        overPct: Math.round(v.variancePct),
        severity: (v.variancePct >= 15 ? 'high' : 'medium') as 'high' | 'medium',
      }));

    // Build KPIs (backend computes; frontend does NOT render in this iteration)
    const totalBudget = vesselRows.reduce((s, v) => s + v.budget, 0);
    const totalSpendMtd = vesselRows.reduce((s, v) => s + v.actual, 0);
    const totalMandays = filtered.reduce((s, r) => s + r.manday, 0);
    const avgCostPerManday = totalMandays > 0 ? totalSpendMtd / totalMandays : 0;
    const kpis = {
      totalSpendMtd,
      totalBudget,
      avgCostPerManday,
      targetCostPerManday: null as number | null,
      vesselsExceeded: vesselRows.filter((v) => v.exceeded).length,
      vesselsTotal: vesselRows.length,
    };

    return ok(
      { year, month, kpis, exceptions, vessels: vesselRows },
      { 'x-cache': mandays.cacheStatus },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.error('customer/fleet-manday-report failed', message);
    if (error instanceof FabricGraphqlError) {
      return errorResponse(error.status, message);
    }
    const status =
      message.includes('Missing bearer token') || message.includes('No access record') ? 401 : 500;
    return errorResponse(status, message);
  }
}

app.http('customer-fleet-manday-report', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'customer/fleet-manday-report',
  handler: customerFleetMandayReport,
});
