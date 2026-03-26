import React from 'react';
import { Card } from '../../components/ui/Card';
import { Filter, BarChart } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

export const Analytics: React.FC = () => {
    const { user } = useAuthStore();
    const { addToast } = useUIStore();
    const access = user?.powerBiAccess || 'none';
    const canAccess = access !== 'none';
    const workspaceId = user?.powerBiWorkspaceId || 'N/A';
    const reportId = user?.powerBiReportId || 'N/A';
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Advanced Analytics</h1>
                <button
                    onClick={() => addToast({ title: 'Filter Context', message: 'Context filters are ready to be configured.', type: 'info' })}
                    className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                    <Filter size={16} strokeWidth={1.5} />
                    <span>Filter Context</span>
                </button>
            </div>
            
            <Card className="h-[600px] flex items-center justify-center bg-gray-50/50 dark:bg-slate-900 relative border-dashed border-2 border-gray-300 dark:border-slate-700">
                <div className="text-center p-8 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-gray-100 dark:border-slate-700 max-w-lg">
                    <div className="w-20 h-20 mx-auto mb-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl flex items-center justify-center">
                         <BarChart className="w-10 h-10 text-yellow-600 dark:text-yellow-500" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Power BI Report Access</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                        Current level: <span className="font-mono text-xs bg-gray-100 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">{access}</span>.
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        Workspace: <span className="font-mono text-xs bg-gray-100 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">{workspaceId}</span> | Report: <span className="font-mono text-xs bg-gray-100 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">{reportId}</span>
                    </p>
                    <button
                        onClick={() => {
                            if (canAccess) {
                                addToast({ title: 'Power BI', message: 'Embedded report loading flow is triggered.', type: 'success' });
                            } else {
                                addToast({ title: 'Power BI Access', message: 'Access is disabled for this user.', type: 'error' });
                            }
                        }}
                        disabled={!canAccess}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors shadow-lg ${
                            canAccess
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                                : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        {canAccess ? 'Load Report' : 'Power BI Access Disabled'}
                    </button>
                </div>
            </Card>
        </div>
    );
};
