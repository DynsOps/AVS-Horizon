import React from 'react';
import { Card } from '../../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useThemeStore } from '../../store/themeStore';

const PERFORMANCE_DATA = [
    { port: 'Istanbul (IST)', performance: 92 },
    { port: 'Dubai (DXB)', performance: 88 },
    { port: 'Copenhagen (CPH)', performance: 98 },
    { port: 'Singapore (SIN)', performance: 95 },
];

export const SupplierLogistics: React.FC = () => {
    const { isDarkMode } = useThemeStore();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Logistics Performance</h1>
            
            <Card title="Delivery Performance by Port (Last 90 Days)">
                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={PERFORMANCE_DATA} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#e2e8f0'} />
                            <XAxis 
                                dataKey="port" 
                                stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                                dy={10}
                            />
                            <YAxis 
                                unit="%" 
                                stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                            />
                            <Tooltip 
                                cursor={{fill: isDarkMode ? '#1e293b' : '#f8fafc'}}
                                contentStyle={{ 
                                    backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                                    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                                    color: isDarkMode ? '#f8fafc' : '#0f172a',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Bar 
                                dataKey="performance" 
                                fill="#3b82f6" 
                                radius={[4, 4, 0, 0]} 
                                barSize={60}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-6 flex items-center justify-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span>Percentage of deliveries completed On-Time-In-Full (OTIF)</span>
                </div>
            </Card>
        </div>
    );
};