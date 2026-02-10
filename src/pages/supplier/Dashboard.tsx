import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { KPI } from '../../types';
import { KPICard, Card } from '../../components/ui/Card';
import { AlertCircle, Calendar, ArrowRight } from 'lucide-react';

export const SupplierDashboard: React.FC = () => {
    const [kpis, setKpis] = useState<KPI[]>([]);

    useEffect(() => {
        api.supplier.getKPIs().then(setKpis);
    }, []);

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vendor Portal</h1>
                <span className="text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                    Supplier ID: S-001
                </span>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {kpis.map((kpi, idx) => <KPICard key={idx} kpi={kpi} />)}
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card title="Pending Actions">
                     <div className="space-y-3">
                         <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-lg flex justify-between items-center group cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors">
                             <div className="flex items-start space-x-3">
                                 <AlertCircle className="text-yellow-600 dark:text-yellow-500 mt-1" size={18} strokeWidth={1.5} />
                                 <div>
                                     <p className="font-semibold text-yellow-900 dark:text-yellow-400 text-sm">Submit Invoice for PO-9928</p>
                                     <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-0.5">Due in 3 days</p>
                                 </div>
                             </div>
                             <ArrowRight size={16} className="text-yellow-600 dark:text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                         </div>
                         <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-lg flex justify-between items-center group cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors">
                             <div className="flex items-start space-x-3">
                                 <Calendar className="text-blue-600 dark:text-blue-500 mt-1" size={18} strokeWidth={1.5} />
                                 <div>
                                     <p className="font-semibold text-blue-900 dark:text-blue-400 text-sm">Confirm delivery date: Avs Neptune</p>
                                     <p className="text-xs text-blue-700 dark:text-blue-500 mt-0.5">Order #ORD-002</p>
                                 </div>
                             </div>
                             <ArrowRight size={16} className="text-blue-600 dark:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                         </div>
                     </div>
                 </Card>
                 <Card title="Recent Announcements">
                     <ul className="space-y-4">
                         <li className="flex items-start space-x-3 text-sm text-slate-600 dark:text-slate-300">
                             <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                             <span>New invoicing guidelines effective Nov 1st. Please review the updated compliance document in the resources section.</span>
                         </li>
                         <li className="flex items-start space-x-3 text-sm text-slate-600 dark:text-slate-300">
                             <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 flex-shrink-0"></span>
                             <span>Port of Houston experiencing minor delays due to congestion. Adjust delivery ETAs accordingly.</span>
                         </li>
                         <li className="flex items-start space-x-3 text-sm text-slate-600 dark:text-slate-300">
                             <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0"></span>
                             <span>Sustainable packaging requirements update: All pallets must now be certified.</span>
                         </li>
                     </ul>
                 </Card>
             </div>
        </div>
    );
};