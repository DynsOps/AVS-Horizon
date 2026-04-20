import React, { useEffect, useState } from 'react';
import { AsyncActionButton } from '../../components/ui/AsyncActionButton';
import { Card } from '../../components/ui/Card';
import { api } from '../../services/api';
import { Company, Vessel } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { Plus, Edit2, Trash2, Ship, Anchor, Flag, Hash } from 'lucide-react';

export const VesselManagement: React.FC = () => {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { addToast, openDrawer, closeDrawer, openConfirmDialog } = useUIStore();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [vesselRows, companyRows] = await Promise.all([
        api.maritime.getVessels(),
        api.admin.getCompanies(),
      ]);
      setVessels(vesselRows);
      setCompanies(companyRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load vessels.';
      addToast({ title: 'Error', message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return '—';
    return companies.find((c) => c.id === companyId)?.name || companyId;
  };

  const deleteVessel = async (vessel: Vessel) => {
    setPendingDeleteId(vessel.id);
    const confirmed = await openConfirmDialog({
      title: 'Delete Vessel',
      message: `${vessel.name} (IMO: ${vessel.imo}) will be deleted along with its positions, routes and operations. Continue?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) {
      setPendingDeleteId(null);
      return;
    }
    try {
      await api.maritime.deleteVessel(vessel.id);
      addToast({ title: 'Vessel Deleted', message: `${vessel.name} removed.`, type: 'info' });
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vessel delete failed.';
      addToast({ title: 'Error', message, type: 'error' });
    } finally {
      setPendingDeleteId(null);
    }
  };

  const openVesselDrawer = (vessel?: Vessel) => {
    openDrawer(
      <VesselForm
        vessel={vessel}
        companies={companies}
        onCancel={closeDrawer}
        onSave={async (payload) => {
          try {
            if (vessel) {
              const confirmed = await openConfirmDialog({
                title: 'Update Vessel',
                message: `Are you sure you want to update ${payload.name || vessel.name}?`,
                confirmLabel: 'Update',
              });
              if (!confirmed) return;
              await api.maritime.updateVessel(vessel.id, payload);
              addToast({ title: 'Vessel Updated', message: `${payload.name || vessel.name} updated successfully.`, type: 'success' });
            } else {
              await api.maritime.createVessel(payload as Omit<Vessel, 'id'>);
              addToast({ title: 'Vessel Created', message: `${payload.name} added successfully.`, type: 'success' });
            }
            await loadData();
            closeDrawer();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Vessel save failed.';
            addToast({ title: 'Error', message, type: 'error' });
          }
        }}
      />
    );
  };

  const statusColor = (status?: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'Under Repair': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'Laid Up': return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
      case 'Scrapped': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      default: return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vessel Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Register and manage vessels linked to companies.
          </p>
        </div>
        <button
          onClick={() => openVesselDrawer()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Vessel
        </button>
      </div>

      <Card className="overflow-hidden" noPadding>
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Vessel</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">IMO</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Company</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Flag</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {vessels.map((vessel) => (
              <tr key={vessel.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{vessel.name}</p>
                  <p className="text-xs text-slate-500">{vessel.id}</p>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-slate-700 dark:text-slate-200">{vessel.imo}</td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{vessel.type}</td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{getCompanyName(vessel.companyId)}</td>
                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{vessel.flagCountry || '—'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(vessel.vesselStatus)}`}>
                    {vessel.vesselStatus || 'Active'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => openVesselDrawer(vessel)} className="text-blue-500 hover:text-blue-600">
                    <Edit2 size={15} />
                  </button>
                  <AsyncActionButton
                    onClick={() => { void deleteVessel(vessel); }}
                    isPending={pendingDeleteId === vessel.id}
                    loadingMode="spinner-only"
                    className="text-red-500 hover:text-red-600"
                    title="Delete vessel"
                  >
                    <Trash2 size={15} />
                  </AsyncActionButton>
                </td>
              </tr>
            ))}
            {!isLoading && vessels.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No vessels found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

type VesselFormProps = {
  vessel?: Vessel;
  companies: Company[];
  onSave: (data: Partial<Vessel>) => Promise<void>;
  onCancel: () => void;
};

const VESSEL_TYPES = ['Container', 'Bulker', 'Tanker', 'General Cargo', 'RoRo'];
const VESSEL_STATUSES: NonNullable<Vessel['vesselStatus']>[] = ['Active', 'Laid Up', 'Under Repair', 'Scrapped'];

const VesselForm: React.FC<VesselFormProps> = ({ vessel, companies, onSave, onCancel }) => {
  const [name, setName] = useState(vessel?.name || '');
  const [imo, setImo] = useState(vessel?.imo || '');
  const [type, setType] = useState(vessel?.type || 'Container');
  const [companyId, setCompanyId] = useState(vessel?.companyId || '');
  const [flagCountry, setFlagCountry] = useState(vessel?.flagCountry || '');
  const [builtYear, setBuiltYear] = useState(vessel?.builtYear?.toString() || '');
  const [dwt, setDwt] = useState(vessel?.dwt?.toString() || '');
  const [vesselStatus, setVesselStatus] = useState<NonNullable<Vessel['vesselStatus']>>(vessel?.vesselStatus || 'Active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useUIStore();

  const submit = async () => {
    if (!name.trim()) {
      addToast({ title: 'Validation Error', message: 'Vessel name is required.', type: 'error' });
      return;
    }
    if (!imo.trim()) {
      addToast({ title: 'Validation Error', message: 'IMO number is required.', type: 'error' });
      return;
    }
    if (!companyId) {
      addToast({ title: 'Validation Error', message: 'Company is required.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        imo: imo.trim(),
        type,
        companyId,
        flagCountry: flagCountry.trim() || undefined,
        builtYear: builtYear ? parseInt(builtYear, 10) : undefined,
        dwt: dwt ? parseFloat(dwt) : undefined,
        vesselStatus,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {vessel ? 'Edit Vessel' : 'Add Vessel'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {vessel ? 'Update vessel details.' : 'Register a new vessel linked to a company.'}
        </p>
      </div>

      <div className="grid gap-4">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Vessel Name</span>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <Ship size={14} className="text-slate-400" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
              placeholder="Nordic Aurora"
            />
          </div>
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">IMO Number</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <Hash size={14} className="text-slate-400" />
              <input
                value={imo}
                onChange={(e) => setImo(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                placeholder="9876543"
              />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Type</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <Anchor size={14} className="text-slate-400" />
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
              >
                {VESSEL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Company</span>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Select a company...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Flag Country</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <Flag size={14} className="text-slate-400" />
              <input
                value={flagCountry}
                onChange={(e) => setFlagCountry(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                placeholder="Panama"
              />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</span>
            <select
              value={vesselStatus}
              onChange={(e) => setVesselStatus(e.target.value as NonNullable<Vessel['vesselStatus']>)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {VESSEL_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Built Year</span>
            <input
              type="number"
              value={builtYear}
              onChange={(e) => setBuiltYear(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="2019"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">DWT (Deadweight Tonnage)</span>
            <input
              type="number"
              value={dwt}
              onChange={(e) => setDwt(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="65000"
            />
          </label>
        </div>
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
          {vessel ? 'Save Changes' : 'Create Vessel'}
        </AsyncActionButton>
      </div>
    </div>
  );
};
