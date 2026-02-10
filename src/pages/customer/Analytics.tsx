import React from 'react';
import { Card } from '../../components/ui/Card';
import { Filter, BarChart } from 'lucide-react';

export const Analytics: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Advanced Analytics</h1>
                <button className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 px-4 py-2 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <Filter size={16} strokeWidth={1.5} />
                    <span>Filter Context</span>
                </button>
            </div>
            
            <Card className="h-[600px] flex items-center justify-center bg-gray-50/50 dark:bg-slate-900 relative border-dashed border-2 border-gray-300 dark:border-slate-700">
                <div className="text-center p-8 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-gray-100 dark:border-slate-700 max-w-lg">
                    <div className="w-20 h-20 mx-auto mb-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl flex items-center justify-center">
                         <BarChart className="w-10 h-10 text-yellow-600 dark:text-yellow-500" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Power BI Integration</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        Secure embedded analytics container. Row-Level Security (RLS) is automatically enforced based on the authenticated entity ID <span className="font-mono text-xs bg-gray-100 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">C-001</span>.
                    </p>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20">
                        Load Report
                    </button>
                </div>
            </Card>
        </div>
    );
};