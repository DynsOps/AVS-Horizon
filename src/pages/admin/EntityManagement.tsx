import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { api } from '../../services/api';
import { BootstrapCredentials, Company } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { Plus, Edit2, Trash2, Building2, Mail, Globe, Tag, KeyRound, Copy, Eye, EyeOff, X } from 'lucide-react';
import { getDefaultPermissionsForRole } from '../../utils/rbac';

type CreateEntityPayload = Omit<Company, 'id'> & {
  createCompanyAdmin?: boolean;
  adminName?: string;
  adminEmail?: string;
  adminProvisioningMode?: 'corporate_precreated' | 'external_local_account';
};

const PERSONAL_EMAIL_PATTERN = /@(gmail|googlemail|hotmail|outlook|live|msn|icloud|me|yahoo|yandex|protonmail|proton)\./i;

const getDefaultProvisioningSource = (email?: string): 'corporate_precreated' | 'external_local_account' =>
  email && PERSONAL_EMAIL_PATTERN.test(email) ? 'external_local_account' : 'corporate_precreated';

export const EntityManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newAdminCredentials, setNewAdminCredentials] = useState<BootstrapCredentials | null>(null);
  const [showNewAdminCredentialPassword, setShowNewAdminCredentialPassword] = useState(false);
  const { addToast, openDrawer, closeDrawer, openConfirmDialog } = useUIStore();

  const loadCompanies = async () => {
    setIsLoading(true);
    try {
      const rows = await api.admin.getCompanies();
      setCompanies(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load entities.';
      addToast({ title: 'Error', message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
  }, []);

  const createEntity = async (payload: CreateEntityPayload) => {
    const { createCompanyAdmin, adminName, adminEmail, ...companyPayload } = payload;
    try {
      const createdCompany = await api.admin.createCompany(companyPayload);
      addToast({ title: 'Entity Created', message: `${companyPayload.name} added successfully.`, type: 'success' });

      if (createCompanyAdmin) {
        try {
          const adminProvisioningMode =
            payload.adminProvisioningMode ||
            getDefaultProvisioningSource(adminEmail);
          const { bootstrapCredentials } = await api.admin.createUser({
            name: (adminName || '').trim(),
            email: (adminEmail || '').trim().toLowerCase(),
            role: 'admin',
            companyId: createdCompany.id,
            isGuest: false,
            status: 'Active',
            permissions: getDefaultPermissionsForRole('admin'),
            showOnlyCoreAdminPermissions: false,
            provisioningSource: adminProvisioningMode,
          });
          setNewAdminCredentials(bootstrapCredentials || null);
          setShowNewAdminCredentialPassword(false);
          addToast({
            title: 'Company Admin Created',
            message: adminProvisioningMode === 'external_local_account'
              ? 'Company admin local account created. Share the one-time temporary password securely.'
              : 'Company admin created. First sign-in will be completed through Entra.',
            type: 'success',
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

      await loadCompanies();
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
      await api.admin.updateCompany(company.id, payload);
      addToast({ title: 'Entity Updated', message: `${payload.name || company.name} updated successfully.`, type: 'success' });
      await loadCompanies();
      closeDrawer();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Entity update failed.';
      addToast({ title: 'Error', message, type: 'error' });
    }
  };

  const deleteEntity = async (company: Company) => {
    const confirmed = await openConfirmDialog({
      title: 'Delete Entity',
      message: `${company.name} entity will be deleted. Continue?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await api.admin.deleteCompany(company.id);
      addToast({ title: 'Entity Deleted', message: `${company.name} removed.`, type: 'info' });
      await loadCompanies();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Entity delete failed.';
      addToast({ title: 'Error', message, type: 'error' });
    }
  };

  const openEntityDrawer = (company?: Company) => {
    openDrawer(
      <EntityForm
        company={company}
        onCancel={closeDrawer}
        onSave={(payload) => {
          if (company) {
            void editEntity(company, payload);
          } else {
            void createEntity(payload as CreateEntityPayload);
          }
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
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Country</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contact</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Domains</th>
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
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{company.type}</td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{company.country}</td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{company.contactEmail}</td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                  {company.domains && company.domains.length > 0 ? company.domains.join(', ') : 'No allowlist'}
                </td>
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
                  <button onClick={() => { void deleteEntity(company); }} className="text-red-500 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && companies.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
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

type EntityFormProps = {
  company?: Company;
  onSave: (data: Partial<Company> | CreateEntityPayload) => void;
  onCancel: () => void;
};

const EntityForm: React.FC<EntityFormProps> = ({ company, onSave, onCancel }) => {
  const [name, setName] = useState(company?.name || '');
  const [type, setType] = useState<Company['type']>(company?.type || 'Customer');
  const [country, setCountry] = useState(company?.country || 'Germany');
  const [contactEmail, setContactEmail] = useState(company?.contactEmail || '');
  const [status, setStatus] = useState<Company['status']>(company?.status || 'Active');
  const [domainsText, setDomainsText] = useState((company?.domains || []).join(', '));
  const [createCompanyAdmin, setCreateCompanyAdmin] = useState(!company);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const { addToast } = useUIStore();

  const submit = () => {
    const normalizedEmail = contactEmail.trim().toLowerCase();
    if (!name.trim()) {
      addToast({ title: 'Validation Error', message: 'Entity name is required.', type: 'error' });
      return;
    }
    if (!country.trim()) {
      addToast({ title: 'Validation Error', message: 'Country is required.', type: 'error' });
      return;
    }
    if (!normalizedEmail) {
      addToast({ title: 'Validation Error', message: 'Contact email is required.', type: 'error' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      addToast({ title: 'Validation Error', message: 'Please enter a valid email.', type: 'error' });
      return;
    }

    const payload: CreateEntityPayload = {
      name: name.trim(),
      type,
      country: country.trim(),
      contactEmail: normalizedEmail,
      status,
      domains: domainsText.split(',').map((item) => item.trim().toLowerCase().replace(/^@+/, '')).filter(Boolean),
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

    onSave(payload);
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
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Entity Name</span>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <Building2 size={14} className="text-slate-400" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
              placeholder="NORDIC HAMBURG"
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

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Country</span>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <Globe size={14} className="text-slate-400" />
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
              placeholder="Germany"
            />
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Contact Email</span>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <Mail size={14} className="text-slate-400" />
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
              placeholder="ops@company.com"
            />
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Allowlisted Domains</span>
          <textarea
            value={domainsText}
            onChange={(e) => setDomainsText(e.target.value)}
            className="min-h-[88px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            placeholder="arkas.com.tr, sub.arkas.com.tr"
          />
          <p className="text-[11px] text-slate-500">
            Corporate users from these domains can be auto-created with pending access on first Microsoft sign-in.
          </p>
        </label>

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
        <button
          onClick={submit}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {company ? 'Save Changes' : 'Create Entity'}
        </button>
      </div>
    </div>
  );
};
