import { request } from '../../lib/apiClient';
import type { Vessel, VesselPosition, VesselRoute, VesselOperation } from '../../types';

type MapPayload = { vessels: Vessel[]; positions: VesselPosition[]; routes: VesselRoute[] };

export const maritime = {
  getMapPayload: (): Promise<MapPayload> =>
    request<MapPayload>('api/customer/maritime/positions'),

  getOperations: async (): Promise<VesselOperation[]> => {
    const r = await request<{ operations: VesselOperation[] }>('api/customer/maritime/operations');
    return r.operations;
  },

  getVessels: async (): Promise<Vessel[]> => {
    const { vessels } = await request<MapPayload>('api/customer/maritime/positions');
    return vessels;
  },

  getVesselPositions: async (): Promise<VesselPosition[]> => {
    const { positions } = await request<MapPayload>('api/customer/maritime/positions');
    return positions;
  },

  getVesselRoutes: async (vesselId: string): Promise<VesselRoute[]> => {
    const { routes } = await request<MapPayload>('api/customer/maritime/positions');
    return routes
      .filter((r) => r.vesselId === vesselId)
      .sort((a, b) => (b.departureDate ?? '').localeCompare(a.departureDate ?? ''));
  },

  getVesselOperations: async (vesselId: string): Promise<VesselOperation[]> => {
    const ops = await maritime.getOperations();
    return ops
      .filter((o) => o.vesselId === vesselId)
      .sort((a, b) => b.operationDate.localeCompare(a.operationDate));
  },

  getVesselPosition: async (vesselId: string): Promise<VesselPosition | null> => {
    const { positions } = await request<MapPayload>('api/customer/maritime/positions');
    return positions.find((p) => p.vesselId === vesselId) ?? null;
  },

  getVessel: async (id: string): Promise<Vessel> => {
    const { vessels } = await request<MapPayload>('api/customer/maritime/positions');
    const vessel = vessels.find((v) => v.id === id);
    if (!vessel) throw new Error(`Vessel not found: ${id}`);
    return vessel;
  },

  createVessel: (_vessel: Omit<Vessel, 'id'>): Promise<Vessel> => {
    throw new Error('api.maritime.createVessel: admin endpoint not yet implemented');
  },

  updateVessel: (_id: string, _updates: Partial<Vessel>): Promise<Vessel> => {
    throw new Error('api.maritime.updateVessel: admin endpoint not yet implemented');
  },

  deleteVessel: (_id: string): Promise<void> => {
    throw new Error('api.maritime.deleteVessel: admin endpoint not yet implemented');
  },
};
