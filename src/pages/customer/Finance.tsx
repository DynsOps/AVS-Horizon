import React from 'react';
import { Card } from '../../components/ui/Card';

export const Finance: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finance</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Finance module access is controlled by `view:finance` permission.
        </p>
      </div>
      <Card>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Financial summaries and controls will be rendered here.
        </p>
      </Card>
    </div>
  );
};
