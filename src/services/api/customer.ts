import { request } from '../../lib/apiClient';
import type {
  AnalysisReport,
  ContractedVessel,
  FleetMandayReport,
  Order,
  Shipment,
  Invoice,
  Vessel,
} from '../../types';

export const customer = {
  getAnalysisReports: async (): Promise<AnalysisReport[]> => {
    const payload = await request<{ reports: AnalysisReport[] }>('api/reports/analysis');
    return payload.reports;
  },

  getContractedVessels: async (): Promise<ContractedVessel[]> => {
    const payload = await request<{ vessels: ContractedVessel[] }>('api/customer/contracted-vessels');
    return payload.vessels;
  },

  getFleetMandayReport: (params: { year: number; month: number }): Promise<FleetMandayReport> => {
    const qs = new URLSearchParams({
      year: String(params.year),
      month: String(params.month),
    });
    return request<FleetMandayReport>(`api/customer/fleet-manday-report?${qs.toString()}`);
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getOrders: async (_companyId?: string): Promise<Order[]> => {
    const payload = await request<{ orders: Order[] }>('api/customer/orders');
    return payload.orders;
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getHistoricalOrders: async (_companyId?: string): Promise<Order[]> => {
    const payload = await request<{ orders: Order[] }>('api/customer/orders/historical');
    return payload.orders;
  },

  createOrder: async (order: Omit<Order, 'id'>): Promise<Order> => {
    const payload = await request<{ order: Order }>('api/customer/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
    return payload.order;
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getFleet: async (_companyId?: string): Promise<Vessel[]> => {
    const payload = await request<{ vessels: Vessel[] }>('api/customer/fleet');
    return payload.vessels;
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getShipments: async (_companyId?: string): Promise<Shipment[]> => {
    const payload = await request<{ shipments: Shipment[] }>('api/customer/shipments');
    return payload.shipments;
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getInvoices: async (_companyId?: string): Promise<Invoice[]> => {
    const payload = await request<{ invoices: Invoice[] }>('api/customer/invoices');
    return payload.invoices;
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPortFees: async (_companyId?: string): Promise<Array<{ port: string; vesselCount: number; totalFee: number; currency: string }>> => {
    const payload = await request<{ portFees: Array<{ port: string; vesselCount: number; totalFee: number; currency: string }> }>(
      'api/customer/port-fees',
    );
    return payload.portFees;
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getContractedConsumptionReport: async (_companyId?: string): Promise<Array<{ month: string; consumed: number; contracted: number }>> => {
    const payload = await request<{ report: Array<{ month: string; consumed: number; contracted: number }> }>(
      'api/customer/contracted-consumption-report',
    );
    return payload.report;
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getContractedAnalysisReport: async (_companyId?: string): Promise<Array<{ category: string; value: number }>> => {
    const payload = await request<{ report: Array<{ category: string; value: number }> }>(
      'api/customer/contracted-analysis-report',
    );
    return payload.report;
  },
};
