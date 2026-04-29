import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { qk } from '../../lib/queryKeys';

export { useMaritimeMapPayload } from '../useMaritimeMapPayload';

export function useMaritimeOperations() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.maritime.operations(dashboardCompanyId),
    queryFn: () => api.maritime.getOperations(),
    enabled: !!dashboardCompanyId,
  });
}

export function useAdminVessels() {
  return useQuery({
    queryKey: qk.maritime.vessels(),
    queryFn: () => api.maritime.getVessels(),
  });
}

export function useVessel(id: string) {
  return useQuery({
    queryKey: qk.maritime.vessel(id),
    queryFn: () => api.maritime.getVessel(id),
    enabled: !!id,
  });
}

export function useVesselPosition(id: string) {
  return useQuery({
    queryKey: qk.maritime.vesselPosition(id),
    queryFn: () => api.maritime.getVesselPosition(id),
    enabled: !!id,
  });
}

export function useVesselRoutes(id: string) {
  return useQuery({
    queryKey: qk.maritime.vesselRoutes(id),
    queryFn: () => api.maritime.getVesselRoutes(id),
    enabled: !!id,
  });
}

export function useVesselOperations(id: string) {
  return useQuery({
    queryKey: qk.maritime.vesselOperations(id),
    queryFn: () => api.maritime.getVesselOperations(id),
    enabled: !!id,
  });
}
