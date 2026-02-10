import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Invoice } from '../../types';
import { Card } from '../../components/ui/Card';
import { FileText, Download, DollarSign, Calendar } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

export const Finance: React.FC = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const { addToast } = useUIStore();

    useEffect(() => {
        api.customer.getInvoices().then(setInvoices);
    }, []);

    const handleDownload = () => {
        addToast({ title: 'Downloading PDF', message: 'Invoice report download started...', type: 'info' });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financial Documents</h1>
                <div className="flex space-x-3">
                     <div className="px-4 py-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 flex items-center space-x-2">
                         <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Outstanding:</span>
                         <span className="text-sm font-bold text-slate-900 dark:text-white">$27,700</span>
                     </div>
                </div>
            </div>
            
            <Card className="overflow-hidden" noPadding>
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wide">Recent Invoices</h3>
                    <button onClick={handleDownload} className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors">
                        <Download size={16} className="mr-2" strokeWidth={1.5} /> Export Statement
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
                            <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <th className="px-6 py-3">Invoice #</th>
                                <th className="px-6 py-3">PO Ref</th>
                                <th className="px-6 py-3">Due Date</th>
                                <th className="px-6 py-3 text-right">Amount</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                            {invoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors even:bg-slate-50/30 dark:even:bg-slate-900/30">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{inv.id}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{inv.reference}</td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 flex items-center space-x-2">
                                        <Calendar size={14} className="text-slate-400" strokeWidth={1.5} />
                                        <span>{inv.dueDate}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-900 dark:text-slate-200">${inv.amount.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                            inv.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                            inv.status === 'Overdue' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' : 
                                            'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
                                        }`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                            <FileText size={18} strokeWidth={1.5} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};