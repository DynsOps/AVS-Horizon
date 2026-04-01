import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useUIStore } from '../../store/uiStore';
import { AnalysisReport } from '../../types';
import { factories, models, service } from 'powerbi-client';

type AnalysisRow = { category: string; value: number };

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626'];

export const ContractedAnalysisReport: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboardCompanyId } = useUIStore();
  const [data, setData] = useState<AnalysisRow[]>([]);
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string>('');
  const [embedError, setEmbedError] = useState('');
  const [isEmbedding, setIsEmbedding] = useState(false);
  const embedContainerRef = useRef<HTMLDivElement | null>(null);
  const powerBiServiceRef = useRef<service.Service | null>(null);
  const effectiveCompanyId = dashboardCompanyId || user?.companyId;

  useEffect(() => {
    powerBiServiceRef.current = new service.Service(
      factories.hpmFactory,
      factories.wpmpFactory,
      factories.routerFactory
    );
  }, []);

  useEffect(() => {
    api.customer.getContractedAnalysisReport(effectiveCompanyId).then(setData);
  }, [effectiveCompanyId]);

  useEffect(() => {
    api.customer.getAnalysisReports().then(setReports);
  }, []);

  const visibleReports = useMemo(() => {
    const permissions = user?.permissions || [];
    const canSeeAllReports = user?.role === 'supadmin';
    if (canSeeAllReports) {
      return reports;
    }
    return reports.filter((report) => permissions.includes(report.permissionKey));
  }, [reports, user?.permissions, user?.role]);

  useEffect(() => {
    if (!visibleReports.length) {
      setActiveReportId('');
      return;
    }
    if (!visibleReports.some((r) => r.id === activeReportId)) {
      setActiveReportId(visibleReports[0].id);
    }
  }, [visibleReports, activeReportId]);

  const activeReport = visibleReports.find((report) => report.id === activeReportId);
  const activeIsContracted = activeReport?.permissionKey === 'view:analysis-report:contracted';

  useEffect(() => {
    let cancelled = false;
    const embedReport = async () => {
      if (!powerBiServiceRef.current || !embedContainerRef.current) return;
      powerBiServiceRef.current.reset(embedContainerRef.current);
      setEmbedError('');
      setIsEmbedding(false);

      if (!activeReport || activeIsContracted) return;

      try {
        setIsEmbedding(true);
        const payload = await api.powerbi.getEmbedConfig(activeReport.id);
        if (cancelled || !embedContainerRef.current || !powerBiServiceRef.current) return;

        powerBiServiceRef.current.embed(embedContainerRef.current, {
          type: 'report',
          id: payload.embedConfig.reportId,
          embedUrl: payload.embedConfig.embedUrl,
          accessToken: payload.embedConfig.accessToken,
          tokenType: models.TokenType.Embed,
          settings: {
            panes: {
              filters: { visible: false },
              pageNavigation: { visible: true },
            },
            navContentPaneEnabled: true,
          },
        });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Power BI embed failed.';
          setEmbedError(message);
        }
      } finally {
        if (!cancelled) setIsEmbedding(false);
      }
    };

    void embedReport();
    return () => {
      cancelled = true;
      if (powerBiServiceRef.current && embedContainerRef.current) {
        powerBiServiceRef.current.reset(embedContainerRef.current);
      }
    };
  }, [activeReportId, activeIsContracted, activeReport]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analysis Report</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Company: {effectiveCompanyId || 'N/A'}.</p>
      </div>

      {visibleReports.length > 0 ? (
        <>
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {visibleReports.map((report) => (
              <button
                key={report.id}
                onClick={() => setActiveReportId(report.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  activeReportId === report.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {report.name}
              </button>
            ))}
          </div>

          <Card title={activeReport?.name || 'Analysis'}>
            {activeReport?.description && (
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{activeReport.description}</p>
            )}

            {activeIsContracted ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="category" innerRadius={70} outerRadius={100}>
                      {data.map((entry, index) => (
                        <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="space-y-3">
                {isEmbedding && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300">
                    Loading Power BI report...
                  </div>
                )}
                {embedError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-900/20 dark:text-rose-300">
                    {embedError}
                  </div>
                )}
                <div className="h-[70vh] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  <div ref={embedContainerRef} className="h-full w-full" />
                </div>
                {!isEmbedding && !embedError && !activeReport?.workspaceId && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    Report is missing workspace/report/dataset config. Update it in Report Management.
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
            No analysis report permission is assigned to this user.
          </div>
        </Card>
      )}
    </div>
  );
};
