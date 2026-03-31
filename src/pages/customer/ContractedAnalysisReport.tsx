import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useUIStore } from '../../store/uiStore';

type AnalysisRow = { category: string; value: number };

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626'];

export const ContractedAnalysisReport: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboardCompanyId } = useUIStore();
  const [data, setData] = useState<AnalysisRow[]>([]);
  const effectiveCompanyId = dashboardCompanyId || user?.companyId;

  useEffect(() => {
    api.customer.getContractedAnalysisReport(effectiveCompanyId).then(setData);
  }, [effectiveCompanyId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contracted Analysis Report</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Category distribution for contracted usage. Company: {effectiveCompanyId || 'N/A'}.</p>
      </div>
      <Card title="Category Analysis">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="category" innerRadius={70} outerRadius={100}>
                {data.map((entry, index) => (
                  <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
