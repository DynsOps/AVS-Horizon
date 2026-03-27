import React from 'react';
import { Card } from '../../components/ui/Card';

export const Business: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Business Module</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Business module visibility and route access are protected by `view:business`.
        </p>
      </div>
      <Card>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Commercial planning and business-specific tooling will be available here.
        </p>
      </Card>
    </div>
  );
};
