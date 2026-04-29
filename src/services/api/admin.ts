import { request } from '../../lib/apiClient';
import type {
  User,
  Company,
  AnalysisReport,
  LogEntry,
  UserCreateResponse,
  SystemHealthPayload,
  Permission,
} from '../../types';
import { useAuthStore } from '../../store/authStore';

type TemplateShape = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  companyId: string | null;
  permissions: string[];
  isActive: boolean;
};

const getActorUser = (): User | null => useAuthStore.getState().user;

export const admin = {
  getUsers: async (): Promise<User[]> => {
    const payload = await request<{ users: User[] }>('api/identity/users');
    return payload.users;
  },

  createUser: async (user: Omit<User, 'id'>): Promise<UserCreateResponse> => {
    const actor = getActorUser();
    const actorRole = actor?.role;

    let body: Record<string, unknown> = { ...user };

    if (actorRole === 'admin') {
      // Normalize for admin-managed creation
      const { provisioningSource, ...rest } = user as User & { provisioningSource?: string };
      body = {
        ...rest,
        role: 'user',
        companyId: actor?.companyId || user.companyId || '',
        isGuest: false,
        ...(provisioningSource ? { provisioningMode: provisioningSource } : {}),
      };
    } else {
      const { provisioningSource, ...rest } = user as User & { provisioningSource?: string };
      body = {
        ...rest,
        ...(provisioningSource ? { provisioningMode: provisioningSource } : {}),
      };
    }

    return request<UserCreateResponse>('api/identity/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
    const actor = getActorUser();
    let body: Record<string, unknown>;

    if (actor?.role === 'admin') {
      const { provisioningSource, ...rest } = updates as Partial<User> & { provisioningSource?: string };
      body = {
        ...updates,
        ...rest,
        role: 'user',
        companyId: actor.companyId || updates.companyId || '',
        isGuest: false,
        ...(provisioningSource ? { provisioningMode: provisioningSource } : {}),
      };
    } else {
      const { provisioningSource, ...rest } = updates as Partial<User> & { provisioningSource?: string };
      body = {
        ...updates,
        ...rest,
        ...(provisioningSource ? { provisioningMode: provisioningSource } : {}),
      };
    }

    await request<{ success: boolean }>(`api/identity/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    const refreshed = await admin.getUsers();
    const updated = refreshed.find((u) => u.id === id);
    if (!updated) throw new Error('User not found after update.');
    return updated;
  },

  deleteUser: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`api/identity/users/${id}`, { method: 'DELETE' });
  },

  getAdminUserCompanies: async (userId: string): Promise<string[]> => {
    const payload = await request<{ companyIds: string[] }>(`api/identity/users/${userId}/companies`);
    return payload.companyIds;
  },

  setAdminUserCompanies: async (userId: string, companyIds: string[]): Promise<void> => {
    await request<{ success: boolean }>(`api/identity/users/${userId}/companies`, {
      method: 'PUT',
      body: JSON.stringify({ companyIds }),
    });
  },

  getGroupProjtables: async (params?: {
    query?: string;
    limit?: number;
  }): Promise<Array<{ name: string; dataAreaId: string; projId: string }>> => {
    const query = (params?.query || '').trim();
    const limit = Number.isFinite(params?.limit) ? Math.max(1, Math.min(200, Number(params?.limit))) : 25;
    const searchParams = new URLSearchParams();
    if (query) searchParams.set('q', query);
    searchParams.set('limit', String(limit));
    const payload = await request<{
      items: Array<{ name: string; dataareaid: string | null; projid: string | null }>;
    }>(`api/fabric/group-projtables?${searchParams.toString()}`);
    return payload.items
      .map((item) => ({
        name: (item.name || '').trim(),
        dataAreaId: (item.dataareaid || '').trim(),
        projId: (item.projid || '').trim(),
      }))
      .filter((item) => item.name && item.dataAreaId && item.projId)
      .slice(0, limit);
  },

  getCompanies: async (): Promise<Company[]> => {
    const payload = await request<{ companies: Company[] }>('api/identity/companies');
    return payload.companies;
  },

  createCompany: async (company: Omit<Company, 'id'>): Promise<Company> => {
    const actor = getActorUser();
    if (actor?.role === 'admin') {
      throw new Error('Admin cannot create companies.');
    }
    const payload = await request<{ company: Company }>('api/identity/companies', {
      method: 'POST',
      body: JSON.stringify(company),
    });
    return payload.company;
  },

  updateCompany: async (id: string, updates: Partial<Company>): Promise<Company> => {
    const actor = getActorUser();
    if (actor?.role === 'admin' && actor.companyId !== id) {
      throw new Error('Admin can only manage their own company.');
    }
    await request<{ success: boolean }>(`api/identity/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    const refreshed = await admin.getCompanies();
    const updated = refreshed.find((c) => c.id === id);
    if (!updated) throw new Error('Company not found after update.');
    return updated;
  },

  deleteCompany: async (id: string): Promise<void> => {
    const actor = getActorUser();
    if (actor?.role === 'admin') {
      throw new Error('Admin cannot delete companies.');
    }
    await request<{ success: boolean }>(`api/identity/companies/${id}`, { method: 'DELETE' });
  },

  getAnalysisReports: async (): Promise<AnalysisReport[]> => {
    const payload = await request<{ reports: AnalysisReport[] }>('api/identity/reports');
    return payload.reports;
  },

  createAnalysisReport: async (body: {
    name: string;
    description?: string;
    embedUrl?: string;
    workspaceId?: string;
    reportId?: string;
    datasetId?: string;
    defaultRoles?: string[];
  }): Promise<AnalysisReport> => {
    const created = await request<{ report: AnalysisReport }>('api/identity/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return created.report;
  },

  updateAnalysisReport: async (
    id: string,
    body: {
      name: string;
      description?: string;
      embedUrl?: string;
      workspaceId?: string;
      reportId?: string;
      datasetId?: string;
      defaultRoles?: string[];
    },
  ): Promise<AnalysisReport> => {
    const updated = await request<{ report: AnalysisReport }>(`api/identity/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return updated.report;
  },

  deleteAnalysisReport: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`api/identity/reports/${id}`, { method: 'DELETE' });
  },

  getPermissionsCatalog: async (): Promise<Record<string, { key: string; label: string; kind: string }[]>> => {
    const payload = await request<{ groups: Record<string, { key: string; label: string; kind: string }[]> }>(
      'api/identity/permissions/catalog',
    );
    return payload.groups;
  },

  getTemplates: async (scope?: 'global' | 'company', companyId?: string): Promise<TemplateShape[]> => {
    const params = new URLSearchParams();
    if (scope) params.set('scope', scope);
    if (companyId) params.set('company_id', companyId);
    const qs = params.toString();
    const payload = await request<{ templates: TemplateShape[] }>(
      `api/identity/templates${qs ? `?${qs}` : ''}`,
    );
    return payload.templates;
  },

  createTemplate: async (body: {
    name: string;
    description?: string;
    scope: 'global' | 'company';
    companyId?: string;
    permissions: string[];
  }): Promise<TemplateShape> => {
    const payload = await request<{ template: TemplateShape }>('api/identity/templates', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return payload.template;
  },

  updateTemplate: async (
    id: string,
    body: { name?: string; description?: string; permissions?: string[] },
  ): Promise<TemplateShape> => {
    const payload = await request<{ template: TemplateShape }>(`api/identity/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return payload.template;
  },

  deleteTemplate: async (id: string): Promise<void> => {
    await request<{ success: boolean }>(`api/identity/templates/${id}`, { method: 'DELETE' });
  },

  getUserTemplateId: async (userId: string): Promise<string | null> => {
    const payload = await request<{ templateId: string | null }>(`api/identity/users/${userId}/template`);
    return payload.templateId;
  },

  assignUserTemplate: async (userId: string, templateId: string): Promise<void> => {
    await request<{ success: boolean }>(`api/identity/users/${userId}/template`, {
      method: 'PUT',
      body: JSON.stringify({ templateId }),
    });
  },

  getCompanyTemplateId: async (companyId: string): Promise<string | null> => {
    const payload = await request<{ templateId: string | null }>(
      `api/identity/companies/${companyId}/template`,
    );
    return payload.templateId;
  },

  assignCompanyTemplate: async (companyId: string, templateId: string): Promise<void> => {
    await request<{ success: boolean }>(`api/identity/companies/${companyId}/template`, {
      method: 'PUT',
      body: JSON.stringify({ templateId }),
    });
  },

  getUserReports: async (userId: string): Promise<string[]> => {
    const payload = await request<{ reportIds: string[] }>(`api/identity/users/${userId}/reports`);
    return payload.reportIds;
  },

  setUserReports: async (userId: string, reportIds: string[]): Promise<void> => {
    await request<{ success: boolean }>(`api/identity/users/${userId}/reports`, {
      method: 'PUT',
      body: JSON.stringify({ reportIds }),
    });
  },

  getSystemHealth: (): Promise<SystemHealthPayload> =>
    request<SystemHealthPayload>('api/system-health'),

  getSystemLogs: async (): Promise<LogEntry[]> => {
    const payload = await admin.getSystemHealth();
    return payload.logs;
  },
};

// Suppress unused import warning — Permission is used via types above
export type { Permission };
