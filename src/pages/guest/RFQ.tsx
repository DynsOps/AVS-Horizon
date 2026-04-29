import React, { useState } from 'react';
import { AsyncActionButton } from '../../components/ui/AsyncActionButton';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { RFQAttachment, SuggestedItem } from '../../types';
import { FilePlus2, Sparkles, Trash2, Plus, Paperclip } from 'lucide-react';
import { useMyRFQs, useSubmitRFQ, useGenerateSuggestedProducts } from '../../hooks/queries/useGuestRFQ';

export const GuestRFQPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [vesselName, setVesselName] = useState('');
  const [port, setPort] = useState('');
  const [details, setDetails] = useState('');
  const [suggestedItems, setSuggestedItems] = useState<SuggestedItem[]>([]);
  const [attachments, setAttachments] = useState<RFQAttachment[]>([]);

  const { data: rfqs = [] } = useMyRFQs();
  const submitRFQ = useSubmitRFQ();
  const generateSuggestedProducts = useGenerateSuggestedProducts();

  const generateSuggestions = async () => {
    if (!vesselName.trim() || !port.trim() || !details.trim()) {
      addToast({ title: 'Validation Error', message: 'Fill vessel, port and details before generating suggestions.', type: 'error' });
      return;
    }
    try {
      const items = await generateSuggestedProducts.mutateAsync({
        vesselName: vesselName.trim(),
        port: port.trim(),
        details: details.trim(),
      });
      setSuggestedItems(items);
      addToast({ title: 'Suggestions Ready', message: `${items.length} suggested items generated.`, type: 'success' });
    } catch {
      // errors handled by useApiMutation
    }
  };

  const handleSubmitRFQ = async () => {
    if (!user?.id) return;
    if (!vesselName.trim() || !port.trim() || !details.trim()) {
      addToast({ title: 'Validation Error', message: 'All fields are required.', type: 'error' });
      return;
    }
    try {
      await submitRFQ.mutateAsync({
        createdByUserId: user.id,
        createdByEmail: user.email,
        vesselName: vesselName.trim(),
        port: port.trim(),
        details: details.trim(),
        suggestedItems: suggestedItems.map((item) => `${item.name} x${item.quantity}`),
        attachments,
      });
      setVesselName('');
      setPort('');
      setDetails('');
      setSuggestedItems([]);
      setAttachments([]);
      addToast({ title: 'RFQ Submitted', message: 'Guest RFQ has been submitted.', type: 'success' });
    } catch {
      // errors handled by useApiMutation
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FilePlus2 size={20} className="text-blue-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Guest RFQ Submission</h1>
      </div>

      <Card title="Create RFQ">
        <div className="space-y-3">
          <input
            value={vesselName}
            onChange={(e) => setVesselName(e.target.value)}
            placeholder="Vessel name"
            className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          />
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="Port"
            className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          />
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            placeholder="Requested items / scope..."
            className="w-full px-3 py-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          />
          <AsyncActionButton
            onClick={() => void generateSuggestions()}
            isPending={generateSuggestedProducts.isPending}
            className="inline-flex items-center gap-2 rounded border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-70"
          >
            <Sparkles size={14} />
            Generate Suggested Products
          </AsyncActionButton>

          <div className="space-y-2 rounded border border-gray-200 dark:border-slate-700 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Suggested Items</p>
              <button
                onClick={() => setSuggestedItems((prev) => [...prev, { id: `manual-${Date.now()}`, name: '', quantity: 1, reason: 'Manual entry' }])}
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-300"
              >
                <Plus size={12} /> Add Item
              </button>
            </div>
            {suggestedItems.length === 0 && (
              <p className="text-xs text-slate-500">No suggestions yet.</p>
            )}
            {suggestedItems.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <input
                  value={item.name}
                  onChange={(e) =>
                    setSuggestedItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)))
                  }
                  placeholder="Item name"
                  className="col-span-7 px-2 py-1 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    setSuggestedItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, quantity: Number(e.target.value || 1) } : x)))
                  }
                  className="col-span-3 px-2 py-1 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
                <button
                  onClick={() => setSuggestedItems((prev) => prev.filter((x) => x.id !== item.id))}
                  className="col-span-2 inline-flex items-center justify-center text-red-500 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded border border-gray-200 dark:border-slate-700 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Attachments (Image/Video)</p>
              <label className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-300 cursor-pointer">
                <Paperclip size={12} />
                Add Files
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []) as File[];
                    const mapped = files.map((file) => ({
                      name: file.name,
                      mimeType: file.type || 'application/octet-stream',
                      sizeKb: Math.max(1, Math.round(file.size / 1024)),
                    }));
                    setAttachments((prev) => [...prev, ...mapped]);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {attachments.length === 0 && (
              <p className="text-xs text-slate-500">No attachments yet.</p>
            )}
            {attachments.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-7 text-sm text-slate-700 dark:text-slate-200 truncate">{file.name}</div>
                <div className="col-span-3 text-xs text-slate-500">{file.sizeKb} KB</div>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="col-span-2 inline-flex items-center justify-center text-red-500 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <AsyncActionButton
            onClick={() => void handleSubmitRFQ()}
            isPending={submitRFQ.isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
          >
            Submit RFQ
          </AsyncActionButton>
        </div>
      </Card>

      <Card title="My RFQs" noPadding>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3">RFQ ID</th>
              <th className="px-6 py-3">Vessel</th>
              <th className="px-6 py-3">Port</th>
              <th className="px-6 py-3">Suggested Items</th>
              <th className="px-6 py-3">Attachments</th>
              <th className="px-6 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {rfqs.map((rfq) => (
              <tr key={rfq.id} className="text-sm">
                <td className="px-6 py-3 font-mono text-slate-700 dark:text-slate-200">{rfq.id}</td>
                <td className="px-6 py-3 text-slate-700 dark:text-slate-200">{rfq.vesselName}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{rfq.port}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{rfq.suggestedItems?.length || 0}</td>
                <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{rfq.attachments?.length || 0}</td>
                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{new Date(rfq.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {rfqs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-sm text-slate-500">
                  No RFQ submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
