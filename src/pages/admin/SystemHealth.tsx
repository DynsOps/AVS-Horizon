import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { LogEntry } from '../../types';
import { Card } from '../../components/ui/Card';
import { Activity, CheckCircle, AlertTriangle, Server, Terminal } from 'lucide-react';

const StatusCard = ({ label, status }: { label: string, status: 'ok' | 'warn' | 'error' }) => (
    <div className="bg-white/80 dark:bg-slate-900 p-5 rounded-xl border border-gray-200/60 dark:border-slate-800 shadow-sm flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${status === 'ok' ? 'bg-green-100 dark:bg-green-900/20' : status === 'warn' ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                <Server className={`${status === 'ok' ? 'text-green-600 dark:text-green-400' : status === 'warn' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`} size={18} strokeWidth={1.5} />
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{label}</span>
        </div>
        {status === 'ok' && <CheckCircle className="text-green-500" size={18} strokeWidth={1.5} />}
        {status === 'warn' && <AlertTriangle className="text-yellow-500" size={18} strokeWidth={1.5} />}
        {status === 'error' && <Activity className="text-red-500" size={18} strokeWidth={1.5} />}
    </div>
);

export const SystemHealth: React.FC = () => {
    const [services, setServices] = useState<Array<{ key: string; label: string; status: 'ok' | 'warn' | 'error' }>>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const health = await api.admin.getSystemHealth();
                setServices(health.services.map((service) => ({
                    key: service.key,
                    label: service.label,
                    status: service.status,
                })));
                setLogs(health.logs);
            } catch {
                try {
                    const fallbackLogs = await api.admin.getSystemLogs();
                    setLogs(fallbackLogs);
                } catch {
                    setServices([
                        { key: 'auth-service', label: 'Auth Service', status: 'warn' },
                        { key: 'core-db', label: 'Core DB', status: 'warn' },
                        { key: 'function-runtime', label: 'Function Runtime', status: 'warn' },
                        { key: 'identity-module', label: 'Identity Module', status: 'warn' },
                    ]);
                    setLogs([{
                        id: `health-fallback-${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        level: 'WARN',
                        service: 'SystemHealth',
                        message: 'Function API token is missing. Complete hosted sign-in or disable forced Function API mode.',
                    }]);
                }
            }
        };
        void fetchHealth();
        const interval = setInterval(() => { void fetchHealth(); }, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">System Health</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(services.length ? services : [
                    { key: 'auth-service', label: 'Auth Service', status: 'warn' as const },
                    { key: 'core-db', label: 'Core DB', status: 'warn' as const },
                    { key: 'function-runtime', label: 'Function Runtime', status: 'warn' as const },
                    { key: 'identity-module', label: 'Identity Module', status: 'warn' as const },
                ]).map((service) => (
                    <StatusCard key={service.key} label={service.label} status={service.status} />
                ))}
            </div>

            <Card className="bg-slate-900 border-slate-800 h-[500px] flex flex-col" noPadding>
                <div className="px-4 py-2 border-b border-slate-800 flex items-center space-x-2 bg-slate-900">
                    <Terminal size={14} className="text-slate-500" strokeWidth={1.5} />
                    <span className="text-xs font-mono text-slate-500 uppercase">Live Log Stream</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 custom-scrollbar">
                     {logs.map(log => (
                         <div key={log.id} className="flex space-x-3 hover:bg-white/5 p-0.5 rounded transition-colors">
                             <span className="text-slate-500 flex-shrink-0">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                             <span className={`w-12 font-bold ${log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARN' ? 'text-yellow-400' : 'text-blue-400'}`}>
                                 {log.level}
                             </span>
                             <span className="text-purple-400 w-24 flex-shrink-0">{log.service}:</span> 
                             <span className="text-slate-300">{log.message}</span>
                         </div>
                     ))}
                     <div className="animate-pulse text-blue-500 mt-2">_</div>
                 </div>
            </Card>
        </div>
    );
};
