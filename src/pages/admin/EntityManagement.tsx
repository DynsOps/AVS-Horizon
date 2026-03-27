import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { api } from '../../services/api';
import { Company } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { Plus, Edit2, Trash2, Building2, Mail, Globe, Tag } from 'lucide-react';

export const EntityManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast, openDrawer, closeDrawer } = useUIStore();

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

  const createEntity = async (payload: Omit<Company, 'id'>) => {
    try {
      await api.admin.createCompany(payload);
      addToast({ title: 'Entity Created', message: `${payload.name} added successfully.`, type: 'success' });
      await loadCompanies();
      closeDrawer();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Entity create failed.';
      addToast({ title: 'Error', message, type: 'error' });
    }
  };

  const editEntity = async (company: Company, payload: Partial<Company>) => {
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
    if (!window.confirm(`${company.name} entity will be deleted. Continue?`)) return;
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
            void createEntity(payload as Omit<Company, 'id'>);
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

      <Card className="overflow-hidden" noPadding>
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Entity</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Country</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Contact</th>
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
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
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
  onSave: (data: Partial<Company>) => void;
  onCancel: () => void;
};

const EntityForm: React.FC<EntityFormProps> = ({ company, onSave, onCancel }) => {
  const [name, setName] = useState(company?.name || '');
  const [type, setType] = useState<Company['type']>(company?.type || 'Customer');
  const [country, setCountry] = useState(company?.country || 'Germany');
  const [contactEmail, setContactEmail] = useState(company?.contactEmail || '');
  const [status, setStatus] = useState<Company['status']>(company?.status || 'Active');
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

    onSave({
      name: name.trim(),
      type,
      country: country.trim(),
      contactEmail: normalizedEmail,
      status,
    });
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
