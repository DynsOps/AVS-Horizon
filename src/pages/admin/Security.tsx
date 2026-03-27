import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { LogEntry } from '../../types';
import { Card } from '../../components/ui/Card';
import { ShieldAlert, RefreshCw, Search } from 'lucide-react';

export const Security: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    void loadLogs();
  }, []);

  const loadLogs = async () => {
    const entries = await api.admin.getSystemLogs();
    setLogs(entries);
  };

  const filteredLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return logs;

    return logs.filter((log) => {
      return (
        log.level.toLowerCase().includes(query) ||
        log.message.toLowerCase().includes(query) ||
        log.service.toLowerCase().includes(query)
      );
    });
  }, [logs, searchTerm]);

  const levelClass = (level: LogEntry['level']) => {
    if (level === 'ERROR') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
    if (level === 'WARN') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-red-50 p-2 dark:bg-red-900/20">
            <ShieldAlert size={18} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Security Logs</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Audit and runtime security related events.</p>
          </div>
        </div>

        <button
          onClick={() => void loadLogs()}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <Card className="overflow-hidden" noPadding>
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recent Events</div>
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search level, service, message..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        </div>

        <table className="w-full border-collapse text-left">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Timestamp</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Level</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Service</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-6 py-3 text-xs font-mono text-slate-600 dark:text-slate-300">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-6 py-3">
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${levelClass(log.level)}`}>
                    {log.level}
                  </span>
                </td>
                <td className="px-6 py-3 text-xs text-slate-600 dark:text-slate-300">{log.service}</td>
                <td className="px-6 py-3 text-sm text-slate-700 dark:text-slate-200">{log.message}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
