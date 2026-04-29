import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';
import { useApiMutation } from '../useApiMutation';
import type { User } from '../../types';

export function useUsers() {
  return useQuery({
    queryKey: qk.users.list(),
    queryFn: () => api.admin.getUsers(),
  });
}

export function useAdminUserCompanies(userId: string) {
  return useQuery({
    queryKey: qk.users.companies(userId),
    queryFn: () => api.admin.getAdminUserCompanies(userId),
    enabled: !!userId,
  });
}

export function useUserReports(userId: string) {
  return useQuery({
    queryKey: qk.users.reports(userId),
    queryFn: () => api.admin.getUserReports(userId),
    enabled: !!userId,
  });
}

export function useUserTemplateId(userId: string) {
  return useQuery({
    queryKey: qk.users.templateId(userId),
    queryFn: () => api.admin.getUserTemplateId(userId),
    enabled: !!userId,
  });
}

export function useCreateUser() {
  return useApiMutation(
    (user: Omit<User, 'id'>) => api.admin.createUser(user),
    {
      successToast: 'User created',
      invalidates: [qk.users.list()],
    },
  );
}

export function useUpdateUser() {
  return useApiMutation(
    ({ id, updates }: { id: string; updates: Partial<User> }) => api.admin.updateUser(id, updates),
    {
      invalidates: [qk.users.list()],
    },
  );
}

export function useDeleteUser() {
  return useApiMutation(
    (id: string) => api.admin.deleteUser(id),
    {
      successToast: 'User deleted',
      invalidates: [qk.users.list()],
    },
  );
}

export function useSetAdminUserCompanies() {
  return useApiMutation(
    ({ userId, companyIds }: { userId: string; companyIds: string[] }) =>
      api.admin.setAdminUserCompanies(userId, companyIds),
    {
      invalidates: [qk.users.list()],
    },
  );
}

export function useSetUserReports() {
  return useApiMutation(
    ({ userId, reportIds }: { userId: string; reportIds: string[] }) =>
      api.admin.setUserReports(userId, reportIds),
  );
}

export function useAssignUserTemplate() {
  return useApiMutation(
    ({ userId, templateId }: { userId: string; templateId: string }) =>
      api.admin.assignUserTemplate(userId, templateId),
  );
}
