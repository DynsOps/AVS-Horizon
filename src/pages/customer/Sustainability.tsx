import React from 'react';
import { Card } from '../../components/ui/Card';

export const Sustainability: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sustainability</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Sustainability insights are restricted by `view:sustainability` permission.
        </p>
      </div>
      <Card>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ESG, emissions and sustainability KPIs will be listed here.
        </p>
      </Card>
    </div>
  );
};
