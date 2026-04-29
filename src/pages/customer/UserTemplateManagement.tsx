
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AsyncActionButton } from '../../components/ui/AsyncActionButton';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { CheckSquare, Edit2, LayoutGrid, Plus, Trash2, X } from 'lucide-react';
import { useTemplates, usePermissionsCatalog, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '../../hooks/queries/useTemplates';

type PermissionEntry = { key: string; label: string; kind: string };
type PermissionCatalog = Record<string, PermissionEntry[]>;

type Template = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  companyId: string | null;
  permissions: string[];
  isActive: boolean;
};

const EMPTY_FORM = { name: '', description: '', permissions: [] as string[] };

export const UserTemplateManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const { addToast, openConfirmDialog } = useUIStore();

  const { data: templates = [], isLoading } = useTemplates('company');
  const { data: catalogRaw = {} } = usePermissionsCatalog();
  const catalog = catalogRaw as PermissionCatalog;

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  // admin can only grant permissions they themselves hold
  const adminPermissions = new Set<string>(user?.permissions ?? []);

  const visibleGroups = Object.entries(catalog)
    .map(([group, entries]) => ({
      group,
      entries: entries.filter((e) => adminPermissions.has(e.key)),
    }))
    .filter(({ entries }) => entries.length > 0);

  const togglePermission = (key: string) => {
    if (!adminPermissions.has(key)) return;
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const toggleGroup = (groupKeys: string[]) => {
    const allowed = groupKeys.filter((k) => adminPermissions.has(k));
    const allSelected = allowed.every((k) => form.permissions.includes(k));
    setForm((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((p) => !allowed.includes(p))
        : [...new Set([...prev.permissions, ...allowed])],
    }));
  };

  const selectAll = () => {
    const allowed = visibleGroups.flatMap(({ entries }) => entries.map((e) => e.key));
    setForm((prev) => ({ ...prev, permissions: allowed }));
  };
  const selectNone = () => setForm((prev) => ({ ...prev, permissions: [] }));

  const openAdd = () => {
    setModalMode('add');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (tpl: Template) => {
    setModalMode('edit');
    setEditingId(tpl.id);
    setForm({
      name: tpl.name,
      description: tpl.description || '',
      permissions: tpl.permissions.filter((p) => adminPermissions.has(p)),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      addToast({ title: 'Validation Error', message: 'Template name is required.', type: 'error' });
      return;
    }
    try {
      if (modalMode === 'add') {
        await createTemplate.mutateAsync({ name, description: form.description || undefined, scope: 'company', permissions: form.permissions });
        addToast({ title: 'Template Created', message: `"${name}" created.`, type: 'success' });
      } else if (editingId) {
        await updateTemplate.mutateAsync({ id: editingId, updates: { name, description: form.description || undefined, permissions: form.permissions } });
        addToast({ title: 'Template Updated', message: `"${name}" saved.`, type: 'success' });
      }
      closeModal();
    } catch {
      // errors handled by useApiMutation
    }
  };

  const handleDeleteTemplate = async (tpl: Template) => {
    setPendingDeleteId(tpl.id);
    const confirmed = await openConfirmDialog({
      title: 'Delete User Template',
      message: `Delete "${tpl.name}"? Users assigned this template will lose their permissions.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) { setPendingDeleteId(null); return; }
    try {
      await deleteTemplate.mutateAsync(tpl.id);
      addToast({ title: 'Template Deleted', message: `"${tpl.name}" removed.`, type: 'info' });
    } catch {
      // errors handled by useApiMutation
    } finally {
      setPendingDeleteId(null);
    }
  };

  const isSubmitting = createTemplate.isPending || updateTemplate.isPending;
  const selectedCount = form.permissions.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Templates</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Define permission templates for your company users. You can only grant permissions you hold yourself.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={14} />
          New Template
        </button>
      </div>

      <Card title="User Templates">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-slate-700"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tpl.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tpl.description || <span className="italic">No description</span>} &mdash; {tpl.permissions.length} permissions
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(tpl)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    title="Edit template"
                  >
                    <Edit2 size={15} />
                  </button>
                  <AsyncActionButton
                    onClick={() => void handleDeleteTemplate(tpl)}
                    isPending={pendingDeleteId === tpl.id}
                    loadingMode="spinner-only"
                    className="rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                    title="Delete template"
                  >
                    <Trash2 size={15} />
                  </AsyncActionButton>
                </div>
              </div>
            ))}
            {!templates.length && (
              <p className="text-sm text-slate-500">No user templates yet. Create one to assign to your users.</p>
            )}
          </div>
        )}
      </Card>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[2147483646] flex items-start justify-center overflow-y-auto bg-white/75 p-4 backdrop-blur-sm dark:bg-black/75 md:p-6">
          <div className="relative z-[2147483647] my-2 w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:my-4">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {modalMode === 'edit' ? 'Edit User Template' : 'New User Template'}
              </h2>
              <button
                onClick={closeModal}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-5 py-4">
              <div className="grid gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Template Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Finance Team Access"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Description</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Permissions{' '}
                      <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {selectedCount}
                      </span>
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button onClick={selectAll} className="flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400">
                        <CheckSquare size={11} /> All
                      </button>
                      <button onClick={selectNone} className="flex items-center gap-1 font-semibold text-slate-500 hover:underline dark:text-slate-400">
                        <LayoutGrid size={11} /> None
                      </button>
                    </div>
                  </div>
                  <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                    Only permissions you hold are shown. You cannot grant more than your own access.
                  </p>

                  <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-slate-700">
                    {visibleGroups.map(({ group, entries }) => {
                      const groupKeys = entries.map((e) => e.key);
                      const allSelected = groupKeys.every((k) => form.permissions.includes(k));
                      const someSelected = groupKeys.some((k) => form.permissions.includes(k));
                      return (
                        <div key={group}>
                          <div className="mb-1.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleGroup(groupKeys)}
                              className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
                                allSelected ? 'text-blue-600 dark:text-blue-400' : someSelected ? 'text-blue-400 dark:text-blue-500' : 'text-slate-400 dark:text-slate-500'
                              } hover:text-blue-600`}
                            >
                              {group}
                            </button>
                            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {entries.map((entry) => (
                              <label key={entry.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                                <input
                                  type="checkbox"
                                  checked={form.permissions.includes(entry.key)}
                                  onChange={() => togglePermission(entry.key)}
                                  className="h-3.5 w-3.5 rounded accent-blue-600"
                                />
                                <span className="text-slate-700 dark:text-slate-300">{entry.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {!visibleGroups.length && (
                      <p className="text-sm text-slate-500">No permissions available. Contact supadmin to assign a company template first.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-slate-800">
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <AsyncActionButton
                onClick={() => void save()}
                isPending={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {modalMode === 'edit' ? 'Save Changes' : 'Create Template'}
              </AsyncActionButton>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
