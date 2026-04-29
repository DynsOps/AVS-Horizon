import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { qk } from '../../lib/queryKeys';
import { useApiMutation } from '../useApiMutation';

export function useTemplates(scope: string) {
  return useQuery({
    queryKey: qk.templates.list(scope),
    queryFn: () => api.admin.getTemplates(scope as 'global' | 'company'),
  });
}

export function usePermissionsCatalog() {
  return useQuery({
    queryKey: qk.templates.permissionsCatalog(),
    queryFn: () => api.admin.getPermissionsCatalog(),
  });
}

const templateInvalidates = [qk.templates.list('global'), qk.templates.list('company')] as const;

export function useCreateTemplate() {
  return useApiMutation(
    (template: Parameters<typeof api.admin.createTemplate>[0]) =>
      api.admin.createTemplate(template),
    {
      invalidates: templateInvalidates,
    },
  );
}

export function useUpdateTemplate() {
  return useApiMutation(
    ({ id, updates }: { id: string; updates: Parameters<typeof api.admin.updateTemplate>[1] }) =>
      api.admin.updateTemplate(id, updates),
    {
      invalidates: templateInvalidates,
    },
  );
}

export function useDeleteTemplate() {
  return useApiMutation(
    (id: string) => api.admin.deleteTemplate(id),
    {
      invalidates: templateInvalidates,
    },
  );
}
