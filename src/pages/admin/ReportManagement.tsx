import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AsyncActionButton } from '../../components/ui/AsyncActionButton';
import { Card } from '../../components/ui/Card';
import { AnalysisReport } from '../../types';
import { useUIStore } from '../../store/uiStore';
import { CircleHelp, Edit2, Plus, Trash2, X } from 'lucide-react';
import {
  useAdminAnalysisReports,
  useCreateAnalysisReport,
  useUpdateAnalysisReport,
  useDeleteAnalysisReport,
} from '../../hooks/queries/useAnalysisReports';

export const ReportManagement: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [reportId, setReportId] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [defaultRolesInput, setDefaultRolesInput] = useState('Customer');
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { addToast, openConfirmDialog } = useUIStore();

  const { data: reports = [] } = useAdminAnalysisReports();
  const createReport = useCreateAnalysisReport();
  const updateReport = useUpdateAnalysisReport();
  const deleteReport = useDeleteAnalysisReport();

  const isSubmitting = createReport.isPending || updateReport.isPending;

  const parsePowerBiEmbedUrl = (rawUrl: string): { workspaceId?: string; reportId?: string } => {
    try {
      const url = new URL(rawUrl.trim());
      const groupId = url.searchParams.get('groupId') || url.pathname.match(/\/groups\/([^/]+)/i)?.[1] || '';
      const reportIdFromParam = url.searchParams.get('reportId') || '';
      const reportIdFromPath = url.pathname.match(/\/reports\/([^/]+)/i)?.[1] || '';
      const reportId = reportIdFromParam || reportIdFromPath;
      return {
        workspaceId: groupId || undefined,
        reportId: reportId || undefined,
      };
    } catch {
      return {};
    }
  };

  const autofillIdsFromEmbedUrl = () => {
    const parsed = parsePowerBiEmbedUrl(embedUrl);
    if (parsed.workspaceId) setWorkspaceId(parsed.workspaceId);
    if (parsed.reportId) setReportId(parsed.reportId);
    if (!parsed.workspaceId && !parsed.reportId && embedUrl.trim()) {
      addToast({
        title: 'URL Parse Warning',
        message: 'Embed URL içinden Workspace/Report ID çıkarılamadı.',
        type: 'info',
      });
    }
  };

  const resetForm = () => {
    setEditingReportId(null);
    setName('');
    setDescription('');
    setEmbedUrl('');
    setWorkspaceId('');
    setReportId('');
    setDatasetId('');
    setDefaultRolesInput('Customer');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
    setModalMode('add');
  };

  const openAddModal = () => {
    setModalMode('add');
    resetForm();
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    if (!name.trim()) {
      addToast({ title: 'Validation Error', message: 'Report name is required.', type: 'error' });
      return;
    }
    createReport.mutate(
      {
        name,
        description,
        embedUrl,
        workspaceId,
        reportId,
        datasetId,
        defaultRoles: defaultRolesInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      },
      {
        onSuccess: () => {
          closeModal();
          addToast({ title: 'Report Created', message: 'Analysis report added successfully.', type: 'success' });
        },
        onError: (error) => {
          addToast({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to create report.', type: 'error' });
        },
      },
    );
  };

  const startEdit = (report: AnalysisReport) => {
    setModalMode('edit');
    setEditingReportId(report.id);
    setName(report.name);
    setDescription(report.description || '');
    setEmbedUrl(report.embedUrl || '');
    setWorkspaceId(report.workspaceId || '');
    setReportId(report.reportId || '');
    setDatasetId(report.datasetId || '');
    setDefaultRolesInput((report.defaultRoles || []).join(', ') || 'Customer');
    setIsModalOpen(true);
  };

  const handleUpdate = () => {
    if (!editingReportId) return;
    if (!name.trim()) {
      addToast({ title: 'Validation Error', message: 'Report name is required.', type: 'error' });
      return;
    }
    updateReport.mutate(
      {
        id: editingReportId,
        updates: {
          name,
          description,
          embedUrl,
          workspaceId,
          reportId,
          datasetId,
          defaultRoles: defaultRolesInput
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          closeModal();
          addToast({ title: 'Report Updated', message: 'Analysis report updated successfully.', type: 'success' });
        },
        onError: (error) => {
          addToast({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to update report.', type: 'error' });
        },
      },
    );
  };

  const handleDelete = async (report: AnalysisReport) => {
    setPendingDeleteId(report.id);
    const confirmed = await openConfirmDialog({
      title: 'Delete Report',
      message: `Delete "${report.name}" report? This will remove its permission from users.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) {
      setPendingDeleteId(null);
      return;
    }

    deleteReport.mutate(report.id, {
      onSuccess: () => {
        addToast({ title: 'Report Deleted', message: `${report.name} removed.`, type: 'info' });
        setPendingDeleteId(null);
      },
      onError: (error) => {
        addToast({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to delete report.', type: 'error' });
        setPendingDeleteId(null);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Report Management</h1>
        <div className="flex items-center gap-3">
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add, edit or remove analysis reports. Each report creates a dedicated user permission.</p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={14} />
            Add Report
          </button>
        </div>
      </div>

      <Card title="Existing Reports">
        <div className="space-y-2">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-slate-700"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{report.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{report.permissionKey}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(report)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  title="Edit report"
                >
                  <Edit2 size={15} />
                </button>
                <AsyncActionButton
                  onClick={() => void handleDelete(report)}
                  isPending={pendingDeleteId === report.id}
                  loadingMode="spinner-only"
                  className="rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                  title="Delete report"
                >
                  <Trash2 size={15} />
                </AsyncActionButton>
              </div>
            </div>
          ))}
          {!reports.length && <p className="text-sm text-slate-500">No reports configured.</p>}
        </div>
      </Card>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[2147483646] flex items-start justify-center overflow-y-auto bg-white/75 p-4 backdrop-blur-sm dark:bg-black/75 md:p-6">
          <div className="relative z-[2147483647] my-2 w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-visible rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:my-4 md:max-h-[calc(100vh-3rem)]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {modalMode === 'edit' ? 'Edit Report' : 'Add Report'}
              </h2>
              <button
                onClick={closeModal}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-visible px-5 py-4">
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Report Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Catering Analysis Report"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional report description"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Power BI Embed URL</label>
                  <button
                    type="button"
                    onClick={autofillIdsFromEmbedUrl}
                    className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    URL'den ID doldur
                  </button>
                </div>
                <input
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  onBlur={autofillIdsFromEmbedUrl}
                  placeholder="https://app.powerbi.com/reportEmbed?reportId=...&groupId=..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Optional. Token-based embed uses IDs below.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Workspace ID (Group ID)</label>
                <input
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  placeholder="Ex: c3caf2ac-32d0-4dfa-a227-8461df9bf2d4"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Report ID</label>
                <input
                  value={reportId}
                  onChange={(e) => setReportId(e.target.value)}
                  placeholder="Ex: c4645e94-322a-4cac-90ce-bee4a1c5540a"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Dataset ID</label>
                  <div className="relative group">
                    <button
                      type="button"
                      className="inline-flex items-center text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
                      title="Dataset ID nasıl bulunur?"
                    >
                      <CircleHelp size={14} />
                    </button>
                    <div className="pointer-events-none absolute left-1/2 top-full z-[2147483647] mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 shadow-lg group-hover:block group-focus-within:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                      <p className="font-semibold">Dataset ID nasıl bulunur?</p>
                      <p className="mt-1">1. Power BI Service'te reportu aç.</p>
                      <p>2. Workspace içindeki Dataset (Semantic model) detayına gir.</p>
                      <p>3. Dataset ayarları veya URL/API üzerinden GUID değerini kopyala.</p>
                      <a
                        href="https://learn.microsoft.com/power-bi/developer/embedded/embed-customer-app#how-to-get-the-power-bi-objects"
                        target="_blank"
                        rel="noreferrer"
                        className="pointer-events-auto mt-2 inline-block font-semibold text-blue-700 hover:underline dark:text-blue-300"
                      >
                        Microsoft Docs: Dataset/Report/Workspace IDs
                      </a>
                    </div>
                  </div>
                </div>
                <input
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  placeholder="Required for RLS token generation"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Default RLS Roles</label>
                <input
                  value={defaultRolesInput}
                  onChange={(e) => setDefaultRolesInput(e.target.value)}
                  placeholder="Ex: Customer or Customer,Admin"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Comma-separated role list used in Power BI RLS identities.
                </p>
              </div>
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                IDs bulma rehberi:{' '}
                <a
                  href="https://learn.microsoft.com/power-bi/developer/embedded/embed-customer-app#how-to-get-the-power-bi-objects"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Power BI Objects (Workspace/Report/Dataset)
                </a>
                {' '}|{' '}
                <a
                  href="https://learn.microsoft.com/power-bi/developer/embedded/embedded-row-level-security"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  RLS Setup Guide
                </a>
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
                onClick={() => void (modalMode === 'edit' ? handleUpdate() : handleCreate())}
                isPending={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Plus size={14} />
                {modalMode === 'edit' ? 'Save Changes' : 'Add Report'}
              </AsyncActionButton>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
