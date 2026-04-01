import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { KPI, Order } from '../../types';
import { Card } from '../../components/ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Area, AreaChart } from 'recharts';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'analytics'>('reports');
  const { isDarkMode } = useThemeStore();
  const { user } = useAuthStore();
  const { dashboardCompanyId } = useUIStore();
  const isCustomerRole = Boolean(user?.role === 'user' && !user?.isGuest && user?.companyId?.startsWith('C-'));
  const hideDashboardCards = isCustomerRole;
  const canAccessBi = Boolean(user?.permissions?.includes('view:analytics'));
  const effectiveCompanyId = dashboardCompanyId || user?.companyId || '';

  useEffect(() => {
    if (!effectiveCompanyId) return;
    Promise.all([
      api.customer.getKPIs(effectiveCompanyId),
      api.customer.getOrders(effectiveCompanyId),
    ]).then(([kpiData, orderData]) => {
      setKpis(kpiData);
      setOrders(orderData);
    });
  }, [effectiveCompanyId]);

  const topPorts = Object.entries(
    orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.port] = (acc[order.port] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([port, count]) => ({ port, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Operational snapshot for selected entity: {effectiveCompanyId || 'N/A'}.</p>
        </div>
        <div className="flex space-x-2">
           <span className="text-sm text-slate-500 dark:text-slate-400 self-center bg-white/50 dark:bg-slate-900/50 px-3 py-1 rounded-full border border-gray-200 dark:border-slate-800">Last updated: Today, 09:41 AM</span>
        </div>
      </div>

      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        <button
          onClick={() => setActiveTab('reports')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'reports'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Reports
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'analytics'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Analytics
        </button>
      </div>

      {activeTab === 'reports' && (
        <>
          {!hideDashboardCards && kpis.length > 0 && (
            <Card className="bg-blue-50/70 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Open Orders: <span className="font-semibold">{kpis[1]?.value ?? '-'}</span> | Active Shipments:{' '}
                <span className="font-semibold">{kpis[2]?.value ?? '-'}</span>
              </p>
            </Card>
          )}

          {!hideDashboardCards && (
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
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                        itemStyle={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
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
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
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
          )}

          {hideDashboardCards && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300">
              Dashboard cards are hidden for Customer role by policy.
            </div>
          )}
        </>
      )}

      {activeTab === 'analytics' && (
        <Card className="bg-indigo-50/60 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Power BI Reports</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Power BI and analysis tabs are available inside Analysis Report.
              </p>
            </div>
            <Link
              to="/customer/reports/analysis"
              className={`rounded-lg px-3 py-2 text-xs font-semibold border ${
                canAccessBi
                  ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                  : 'bg-slate-100 text-slate-500 border-slate-200 pointer-events-none'
              }`}
            >
              Open Analysis Report
            </Link>
          </div>
        </Card>
      )}

      <Card title="Top Purchased Ports">
        <div className="space-y-2">
          {topPorts.length > 0 ? topPorts.map((item) => (
            <div key={item.port} className="flex items-center justify-between rounded border border-gray-200 dark:border-slate-800 px-3 py-2">
              <span className="text-sm text-slate-700 dark:text-slate-200">{item.port}</span>
              <span className="text-xs font-semibold rounded-full px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
                {item.count} orders
              </span>
            </div>
          )) : (
            <p className="text-sm text-slate-500">No port purchase data available.</p>
          )}
        </div>
      </Card>
    </div>
  );
};
