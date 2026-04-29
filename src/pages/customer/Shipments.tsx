import React from 'react';
import { Card } from '../../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { useThemeStore } from '../../store/themeStore';
import { useShipments } from '../../hooks/queries/useShipments';

export const Shipments: React.FC = () => {
    const { isDarkMode } = useThemeStore();
    const { data: shipments = [], isLoading, isError } = useShipments();

    const scorecardData = [
        { name: 'On Time', value: 85 },
        { name: 'Delayed', value: 10 },
        { name: 'Early', value: 5 },
    ];

    const COLORS = ['#22c55e', '#ef4444', '#3b82f6'];

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shipment Tracking</h1>
                <Card title="Active Shipments" noPadding>
                    <div className="p-6 space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        ))}
                    </div>
                </Card>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-6 text-sm text-red-500 dark:text-red-400">
                Failed to load data. Please refresh and try again.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shipment Tracking</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card title="OTIF Scorecard (Yearly)" className="md:col-span-2">
                     <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={scorecardData}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? '#1e293b' : '#e2e8f0'} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12, fill: isDarkMode ? '#94a3b8' : '#64748b'}} interval={0} />
                                <Tooltip
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{
                                        backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                                        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                />
                                <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]}>
                                    {scorecardData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                     </div>
                </Card>
                <Card title="Avg Transit Time">
                    <div className="flex flex-col items-center justify-center h-48">
                        <span className="text-5xl font-bold text-slate-800 dark:text-white">14.2</span>
                        <span className="text-slate-500 dark:text-slate-400 mt-2">Days</span>
                        <span className="text-xs text-green-600 mt-1 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">↓ 1.2 days vs last month</span>
                    </div>
                </Card>
            </div>

            <Card title="Active Shipments" noPadding>
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-3">Shipment ID</th>
                            <th className="px-6 py-3">Route</th>
                            <th className="px-6 py-3">ETA</th>
                            <th className="px-6 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {shipments.map(s => (
                            <tr key={s.id} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 even:bg-slate-50/30 dark:even:bg-slate-900/30 transition-colors">
                                <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{s.id}</td>
                                <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{s.origin} → {s.destination}</td>
                                <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{s.eta}</td>
                                <td className="px-6 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                        s.status === 'On Time' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                        s.status === 'Delayed' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                        'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                                    }`}>
                                        {s.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
};
