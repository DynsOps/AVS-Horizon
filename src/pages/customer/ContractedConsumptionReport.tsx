import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

type ConsumptionRow = { month: string; consumed: number; contracted: number };

export const ContractedConsumptionReport: React.FC = () => {
  const { user } = useAuthStore();
  const [data, setData] = useState<ConsumptionRow[]>([]);

  useEffect(() => {
    api.customer.getContractedConsumptionReport(user?.companyId).then(setData);
  }, [user?.companyId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contracted Consumption Report</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Consumption vs contracted values over time.</p>
      </div>
      <Card title="Consumption Trend">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="contracted" stroke="#2563eb" strokeWidth={2} />
              <Line type="monotone" dataKey="consumed" stroke="#16a34a" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
