import React, { useEffect, useMemo, useState } from 'react';
import { AsyncActionButton } from '../../components/ui/AsyncActionButton';
import { Card } from '../../components/ui/Card';
import { api } from '../../services/api';
import { BootstrapCredentials, Company } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { Plus, Edit2, Trash2, Building2, Mail, Tag, KeyRound, Copy, Eye, EyeOff, X, Search } from 'lucide-react';
import { getDefaultPermissionsForRole } from '../../utils/rbac';
import {
  useCompanies,
  useCompanyTemplateId,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  useAssignCompanyTemplate,
} from '../../hooks/queries/useCompanies';
import { useTemplates } from '../../hooks/queries/useTemplates';

type GroupProjtableOption = {
  name: string;
  dataAreaId: string;
  projId: string;
};

type CreateEntityPayload = Omit<Company, 'id'> & {
  createCompanyAdmin?: boolean;
  adminName?: string;
  adminEmail?: string;
};

export const EntityManagement: React.FC = () => {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [newAdminCredentials, setNewAdminCredentials] = useState<BootstrapCredentials | null>(null);
  const [showNewAdminCredentialPassword, setShowNewAdminCredentialPassword] = useState(false);
  const { addToast, openDrawer, closeDrawer, openConfirmDialog } = useUIStore();

  const { data: companies = [], isLoading } = useCompanies();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  const createEntity = async (payload: CreateEntityPayload) => {
    const { createCompanyAdmin, adminName, adminEmail, ...companyPayload } = payload;
    try {
      const createdCompany = await createCompany.mutateAsync(companyPayload);
      addToast({ title: 'Entity Created', message: `${companyPayload.name} added successfully.`, type: 'success' });

      if (createCompanyAdmin) {
        try {
          const { bootstrapCredentials, notifications } = await api.admin.createUser({
            name: (adminName || '').trim(),
            email: (adminEmail || '').trim().toLowerCase(),
            role: 'admin',
            companyId: createdCompany.id,
            isGuest: false,
            status: 'Active',
            permissions: getDefaultPermissionsForRole('admin'),
            showOnlyCoreAdminPermissions: false,
            provisioningSource: 'external_local_account',
          });
          setNewAdminCredentials(bootstrapCredentials || null);
          setShowNewAdminCredentialPassword(false);
          const welcomeEmail = notifications?.welcomeEmail;
          addToast({
            title: welcomeEmail?.sent === false ? 'Company Admin Created, Email Failed' : 'Company Admin Created',
            message: welcomeEmail?.sent === false
              ? `Company admin was created, but the welcome email could not be sent: ${welcomeEmail.error || 'Unknown mail error.'}`
              : 'Company admin local account created. Share the one-time temporary password securely.',
            type: welcomeEmail?.sent === false ? 'info' : 'success',
          });
        } catch (adminError) {
          const adminMessage = adminError instanceof Error ? adminError.message : 'Company admin create failed.';
          addToast({
            title: 'Entity Created, Admin Failed',
            message: `${createdCompany.name} created but admin user could not be created: ${adminMessage}`,
            type: 'error',
          });
        }
      }

      closeDrawer();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Entity create failed.';
      addToast({ title: 'Error', message, type: 'error' });
    }
  };

  const editEntity = async (company: Company, payload: Partial<Company>) => {
    const nextName = payload.name?.trim() || company.name;
    const confirmed = await openConfirmDialog({
      title: 'Update Entity',
      message: `Are you sure you want to update ${nextName}?`,
      confirmLabel: 'Update',
    });
    if (!confirmed) return;
    try {
      await updateCompany.mutateAsync({ id: company.id, updates: payload });
      addToast({ title: 'Entity Updated', message: `${payload.name || company.name} updated successfully.`, type: 'success' });
      closeDrawer();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Entity update failed.';
      addToast({ title: 'Error', message, type: 'error' });
    }
  };

  const deleteEntity = async (company: Company) => {
    setPendingDeleteId(company.id);
    const confirmed = await openConfirmDialog({
      title: 'Delete Entity',
      message: `${company.name} entity will be deleted. Continue?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) {
      setPendingDeleteId(null);
      return;
    }
    try {
      await deleteCompany.mutateAsync(company.id);
      addToast({ title: 'Entity Deleted', message: `${company.name} removed.`, type: 'info' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Entity delete failed.';
      addToast({ title: 'Error', message, type: 'error' });
    } finally {
      setPendingDeleteId(null);
    }
  };

  const openEntityDrawer = (company?: Company) => {
    openDrawer(
      <EntityForm
        company={company}
        onCancel={closeDrawer}
        onSave={async (payload) => {
          if (company) {
            await editEntity(company, payload);
            return;
          }
          await createEntity(payload as CreateEntityPayload);
        }}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Entity Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Supadmin can manage customer/supplier entities from database-backed records.
          </p>
        </div>
        <button
          onClick={() => openEntityDrawer()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Entity
        </button>
      </div>

      {newAdminCredentials && (
        <Card className="border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50 dark:border-amber-700/50 dark:from-amber-950/30 dark:to-orange-950/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                <KeyRound size={16} className="text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Company Admin Temporary Password</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium">{newAdminCredentials.email}</span> is now an External ID local account. Share this one-time password securely.
                </p>
                <code className="mt-2 inline-block rounded border border-amber-300/70 bg-white/70 px-2 py-1 text-sm font-semibold tracking-wide text-amber-800 dark:border-amber-700/60 dark:bg-slate-900 dark:text-amber-300">
                  {showNewAdminCredentialPassword ? newAdminCredentials.temporaryPassword : '**********'}
                </code>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewAdminCredentialPassword((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
              >
                {showNewAdminCredentialPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                {showNewAdminCredentialPassword ? 'Hide Password' : 'Show Password'}
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(newAdminCredentials.temporaryPassword);
                    addToast({ title: 'Copied', message: 'Temporary password copied.', type: 'success' });
                  } catch {
                    addToast({ title: 'Copy Failed', message: 'Clipboard access not available.', type: 'error' });
                  }
                }}
                className="flex items-center gap-2 rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
              >
                <Copy size={14} />
                Copy Password
              </button>
              <button
                onClick={() => setNewAdminCredentials(null)}
                className="rounded-lg border border-amber-300/80 bg-white p-2 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden" noPadding>
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Entity</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">DataArea</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {companies.map((company) => (
              <tr key={company.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{company.name}</p>
                  <p className="text-xs text-slate-500">{company.id}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{company.dataAreaId || '-'}</td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{company.type}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    company.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                  }`}>
                    {company.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => openEntityDrawer(company)} className="text-blue-500 hover:text-blue-600">
                    <Edit2 size={15} />
                  </button>
                  <AsyncActionButton
                    onClick={() => { void deleteEntity(company); }}
                    isPending={pendingDeleteId === company.id}
                    loadingMode="spinner-only"
                    className="text-red-500 hover:text-red-600"
                    title="Delete entity"
                  >
                    <Trash2 size={15} />
                  </AsyncActionButton>
                </td>
              </tr>
            ))}
            {!isLoading && companies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No entities found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const CompanyTemplateSection: React.FC<{ companyId: string }> = ({ companyId }) => {
  const { addToast } = useUIStore();

  const { data: templates = [] } = useTemplates('global');
  const { data: assignedId = '' } = useCompanyTemplateId(companyId);
  const assignCompanyTemplate = useAssignCompanyTemplate();

  const [localAssignedId, setLocalAssignedId] = useState<string>('');

  // Sync localAssignedId from query data
  useEffect(() => {
    if (assignedId) setLocalAssignedId(assignedId);
  }, [assignedId]);

  const assign = (templateId: string) => {
    setLocalAssignedId(templateId);
    assignCompanyTemplate.mutate(
      { companyId, templateId },
      {
        onSuccess: () => {
          addToast({ title: 'Template Assigned', message: 'Company template updated.', type: 'success' });
        },
        onError: (error) => {
          setLocalAssignedId(assignedId || '');
          addToast({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to assign template.', type: 'error' });
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Permission Template</p>
      <select
        value={localAssignedId}
        onChange={(e) => { assign(e.target.value); }}
        disabled={assignCompanyTemplate.isPending || !templates.length}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:opacity-60"
      >
        <option value="">— No template assigned —</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      {!templates.length && (
        <p className="mt-1 text-xs text-slate-500">No global templates available. Create one in Template Management.</p>
      )}
    </div>
  );
};

type EntityFormProps = {
  company?: Company;
  onSave: (data: Partial<Company> | CreateEntityPayload) => Promise<void>;
  onCancel: () => void;
};

const EntityForm: React.FC<EntityFormProps> = ({ company, onSave, onCancel }) => {
  const [name, setName] = useState(company?.name || '');
  const [type, setType] = useState<Company['type']>(company?.type || 'Customer');
  const [status, setStatus] = useState<Company['status']>(company?.status || 'Active');
  const [dataAreaId, setDataAreaId] = useState(company?.dataAreaId || '');
  const [projId, setProjId] = useState(company?.projId || '');
  const [groupProjtableOptions, setGroupProjtableOptions] = useState<GroupProjtableOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [createCompanyAdmin, setCreateCompanyAdmin] = useState(!company);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useUIStore();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setIsLoadingOptions(true);
      void api.admin
        .getGroupProjtables({ query: name, limit: 25 })
        .then((rows) => {
          if (!cancelled) {
            setGroupProjtableOptions(rows);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            const message = error instanceof Error ? error.message : 'Failed to search entity names.';
            addToast({ title: 'Lookup Error', message, type: 'error' });
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingOptions(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addToast, name]);

  const filteredOptions = useMemo(() => {
    return groupProjtableOptions.slice(0, 25);
  }, [groupProjtableOptions]);

  useEffect(() => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) {
      if (!company) {
        setDataAreaId('');
        setProjId('');
      }
      return;
    }

    const matched = groupProjtableOptions.find((option) => option.name.toLowerCase() === normalized);
    if (matched) {
      setDataAreaId(matched.dataAreaId);
      setProjId(matched.projId);
      return;
    }

    const isEditingCurrentCompany = Boolean(
      company && company.name.trim().toLowerCase() === normalized && company.dataAreaId && company.projId
    );
    if (!isEditingCurrentCompany) {
      setDataAreaId('');
      setProjId('');
    }
  }, [company, groupProjtableOptions, name]);

  const selectOption = (option: GroupProjtableOption) => {
    setName(option.name);
    setDataAreaId(option.dataAreaId);
    setProjId(option.projId);
    setShowOptions(false);
  };

  const handleNameChange = (value: string) => {
    setName(value);
  };

  const submit = async () => {
    if (!name.trim()) {
      addToast({ title: 'Validation Error', message: 'Entity name is required.', type: 'error' });
      return;
    }
    if (!dataAreaId || !projId) {
      addToast({ title: 'Validation Error', message: 'Select entity name from GraphQL list.', type: 'error' });
      return;
    }

    const payload: CreateEntityPayload = {
      name: name.trim(),
      dataAreaId,
      projId,
      type,
      status,
      createCompanyAdmin: !company ? createCompanyAdmin : undefined,
      adminName: !company ? adminName.trim() : undefined,
      adminEmail: !company ? adminEmail.trim().toLowerCase() : undefined,
    };

    if (!company && createCompanyAdmin) {
      if (!payload.adminName) {
        addToast({ title: 'Validation Error', message: 'Company admin full name is required.', type: 'error' });
        return;
      }
      if (!payload.adminEmail) {
        addToast({ title: 'Validation Error', message: 'Company admin email is required.', type: 'error' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.adminEmail)) {
        addToast({ title: 'Validation Error', message: 'Please enter a valid company admin email.', type: 'error' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSave(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {company ? 'Edit Entity' : 'Add Entity'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {company ? 'Update entity details and status.' : 'Create a new customer or supplier entity.'}
        </p>
      </div>

      <div className="grid gap-4">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Entity Name (GraphQL)</span>
          <div className="relative">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <Search size={14} className="text-slate-400" />
              <input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => setShowOptions(true)}
                onBlur={() => setTimeout(() => setShowOptions(false), 120)}
                className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                placeholder="Type to search firm name..."
              />
            </div>
            {isLoadingOptions && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Searching...</p>
            )}
            {showOptions && filteredOptions.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {filteredOptions.map((option) => (
                  <button
                    key={`${option.name}-${option.projId}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectOption(option);
                    }}
                    className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <div className="font-medium">{option.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      DataArea: {option.dataAreaId}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">DataAreaId</span>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <Tag size={14} className="text-slate-400" />
            <input
              value={dataAreaId}
              readOnly
              className="w-full bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200"
              placeholder="Select entity name first"
            />
          </div>
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Type</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <Tag size={14} className="text-slate-400" />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Company['type'])}
                className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
              >
                <option value="Customer">Customer</option>
                <option value="Supplier">Supplier</option>
              </select>
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Company['status'])}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </div>

        {company && <CompanyTemplateSection companyId={company.id} />}

        {!company && (
          <div className="rounded-xl border border-blue-200/70 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={createCompanyAdmin}
                onChange={(e) => setCreateCompanyAdmin(e.target.checked)}
              />
              Create company admin user
            </label>

            {createCompanyAdmin && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Admin Full Name</span>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <Building2 size={14} className="text-slate-400" />
                    <input
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                      placeholder="Entity Admin"
                    />
                  </div>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Admin Email</span>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <Mail size={14} className="text-slate-400" />
                    <input
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                      placeholder="admin@company.com"
                    />
                  </div>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <AsyncActionButton
          onClick={submit}
          isPending={isSubmitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {company ? 'Save Changes' : 'Create Entity'}
        </AsyncActionButton>
      </div>
    </div>
  );
};
