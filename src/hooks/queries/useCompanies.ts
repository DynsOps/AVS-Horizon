import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';
import { useApiMutation } from '../useApiMutation';
import type { Company } from '../../types';

export function useCompanies() {
  return useQuery({
    queryKey: qk.companies.list(),
    queryFn: () => api.admin.getCompanies(),
  });
}

export function useCompanyTemplateId(companyId: string | null) {
  return useQuery({
    queryKey: qk.companies.templateId(companyId ?? ''),
    queryFn: () => api.admin.getCompanyTemplateId(companyId!),
    enabled: !!companyId,
  });
}

export function useGroupProjtables(scope: string) {
  return useQuery({
    queryKey: qk.companies.groupProjtables(scope),
    queryFn: () => api.admin.getGroupProjtables({ query: scope }),
  });
}

export function useCreateCompany() {
  return useApiMutation(
    (company: Omit<Company, 'id'>) => api.admin.createCompany(company),
    {
      invalidates: [qk.companies.list()],
    },
  );
}

export function useUpdateCompany() {
  return useApiMutation(
    ({ id, updates }: { id: string; updates: Partial<Company> }) => api.admin.updateCompany(id, updates),
    {
      invalidates: [qk.companies.list()],
    },
  );
}

export function useDeleteCompany() {
  return useApiMutation(
    (id: string) => api.admin.deleteCompany(id),
    {
      invalidates: [qk.companies.list()],
    },
  );
}

export function useAssignCompanyTemplate() {
  return useApiMutation(
    ({ companyId, templateId }: { companyId: string; templateId: string }) =>
      api.admin.assignCompanyTemplate(companyId, templateId),
  );
}
