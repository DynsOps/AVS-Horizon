import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { KPI } from '../../types';
import { KPICard, Card } from '../../components/ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Area, AreaChart } from 'recharts';
import { useThemeStore } from '../../store/themeStore';

const SPEND_DATA = [
  { name: 'Spare Parts', value: 400 },
  { name: 'Provisions', value: 300 },
  { name: 'Fuel', value: 900 },
  { name: 'Port Fees', value: 200 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
const DARK_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171'];

const ORDER_TREND = [
  { name: 'Jan', orders: 40 }, { name: 'Feb', orders: 30 }, { name: 'Mar', orders: 55 },
  { name: 'Apr', orders: 45 }, { name: 'May', orders: 60 }, { name: 'Jun', orders: 75 },
];

export const CustomerDashboard: React.FC = () => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    api.customer.getKPIs().then(setKpis);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time logistics and financial insights.</p>
        </div>
        <div className="flex space-x-2">
           <span className="text-sm text-slate-500 dark:text-slate-400 self-center bg-white/50 dark:bg-slate-900/50 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-800">Last updated: Today, 09:41 AM</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => <KPICard key={idx} kpi={kpi} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Spend by Category">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={SPEND_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke={isDarkMode ? '#0f172a' : '#fff'}
                  strokeWidth={2}
                >
                  {SPEND_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={isDarkMode ? DARK_COLORS[index % DARK_COLORS.length] : COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    itemStyle={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}
                />
                <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Order Volume Trend">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ORDER_TREND} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#e2e8f0'} />
                <XAxis 
                    dataKey="name" 
                    stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                />
                <YAxis 
                    stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                />
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e293b' : '#fff',
                        borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                />
                <Area 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorOrders)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};