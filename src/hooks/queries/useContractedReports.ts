import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { qk } from '../../lib/queryKeys';

export function useCustomerAnalysisReports() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.analysisReports.customerList(dashboardCompanyId),
    queryFn: () => api.customer.getAnalysisReports(),
    enabled: !!dashboardCompanyId,
  });
}

export function useContractedAnalysisReport(reportId: string | null) {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.contractedReports.analysis(dashboardCompanyId, reportId),
    queryFn: () => api.customer.getContractedAnalysisReport(),
    enabled: !!dashboardCompanyId && !!reportId,
  });
}

export function useContractedConsumptionReport() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.contractedReports.consumption(dashboardCompanyId),
    queryFn: () => api.customer.getContractedConsumptionReport(),
    enabled: !!dashboardCompanyId,
  });
}
