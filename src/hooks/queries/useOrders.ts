import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import { qk } from '../../lib/queryKeys';
import { useApiMutation } from '../useApiMutation';
import type { Order } from '../../types';

export function useOrders() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.orders.list(dashboardCompanyId),
    queryFn: () => api.customer.getOrders(),
    enabled: !!dashboardCompanyId,
  });
}

export function useHistoricalOrders() {
  const { dashboardCompanyId } = useUIStore();
  return useQuery({
    queryKey: qk.orders.history(dashboardCompanyId),
    queryFn: () => api.customer.getHistoricalOrders(),
    enabled: !!dashboardCompanyId,
  });
}

export function useCreateOrder() {
  return useApiMutation(
    (order: Omit<Order, 'id'>) => api.customer.createOrder(order),
    {
      successToast: 'Order created',
      invalidates: [qk.orders.list()],
    },
  );
}
