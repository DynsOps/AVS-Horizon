import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { api } from '../../services/api';
import { Company } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export const EntityManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useUIStore();

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

  const createEntity = async () => {
    const name = window.prompt('Entity name');
    if (!name) return;
    const typeRaw = window.prompt('Type (Customer or Supplier)', 'Customer');
    const type = typeRaw === 'Supplier' ? 'Supplier' : 'Customer';
    const country = window.prompt('Country', 'Germany') || 'Germany';
    const contactEmail = window.prompt('Contact email', 'ops@company.com') || '';
    if (!contactEmail) return;

    try {
      await api.admin.createCompany({
        name: name.trim(),
        type,
        country: country.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        status: 'Active',
      });
      addToast({ title: 'Entity Created', message: `${name} added successfully.`, type: 'success' });
      await loadCompanies();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Entity create failed.';
      addToast({ title: 'Error', message, type: 'error' });
    }
  };

  const editEntity = async (company: Company) => {
    const name = window.prompt('Entity name', company.name);
    if (!name) return;
    const country = window.prompt('Country', company.country);
    if (!country) return;
    const contactEmail = window.prompt('Contact email', company.contactEmail);
    if (!contactEmail) return;
    const statusRaw = window.prompt('Status (Active or Inactive)', company.status);
    const status = statusRaw === 'Inactive' ? 'Inactive' : 'Active';

    try {
      await api.admin.updateCompany(company.id, {
        name: name.trim(),
        country: country.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        status,
      });
      addToast({ title: 'Entity Updated', message: `${name} updated successfully.`, type: 'success' });
      await loadCompanies();
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
          onClick={() => { void createEntity(); }}
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
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{company.status}</td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => { void editEntity(company); }} className="text-blue-500 hover:text-blue-600">
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
