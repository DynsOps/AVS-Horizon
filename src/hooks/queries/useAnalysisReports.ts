import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';
import { useApiMutation } from '../useApiMutation';
import type { AnalysisReport } from '../../types';

export function useAdminAnalysisReports() {
  return useQuery({
    queryKey: qk.analysisReports.adminList(),
    queryFn: () => api.admin.getAnalysisReports(),
  });
}

export function useCreateAnalysisReport() {
  return useApiMutation(
    (body: Parameters<typeof api.admin.createAnalysisReport>[0]) =>
      api.admin.createAnalysisReport(body),
    {
      invalidates: [qk.analysisReports.adminList()],
    },
  );
}

export function useUpdateAnalysisReport() {
  return useApiMutation(
    ({ id, updates }: { id: string; updates: Parameters<typeof api.admin.updateAnalysisReport>[1] }) =>
      api.admin.updateAnalysisReport(id, updates),
    {
      invalidates: [qk.analysisReports.adminList()],
    },
  );
}

export function useDeleteAnalysisReport() {
  return useApiMutation(
    (id: string) => api.admin.deleteAnalysisReport(id),
    {
      invalidates: [qk.analysisReports.adminList()],
    },
  );
}

// Re-export type for consumers
export type { AnalysisReport };
