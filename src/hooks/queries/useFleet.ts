import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { qk } from '../../lib/queryKeys';

export function useFleet() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.fleet.list(dashboardCompanyId),
    queryFn: () => api.customer.getFleet(),
    enabled: !!dashboardCompanyId,
  });
}

export function useContractedVessels() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.fleet.contractedVessels(dashboardCompanyId),
    queryFn: () => api.customer.getContractedVessels(),
    enabled: !!dashboardCompanyId,
  });
}

export function useFleetMandayReport(year: number, month: number) {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.fleet.mandayReport(year, month, dashboardCompanyId),
    queryFn: () => api.customer.getFleetMandayReport({ year, month }),
    enabled: !!dashboardCompanyId,
    placeholderData: keepPreviousData,
  });
}
