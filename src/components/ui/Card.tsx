import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  action?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, title, className = '', action, noPadding = false }) => {
  return (
    <div className={`
      relative overflow-hidden
      bg-white/80 dark:bg-slate-900 
      backdrop-blur-xl
      border border-gray-200/60 dark:border-slate-800
      shadow-sm dark:shadow-lg dark:shadow-black/20
      rounded-xl transition-all duration-300
      ${className}
    `}>
      {/* Subtle top highlight for depth */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-blue-500/10 to-transparent opacity-50" />

      {(title || action) && (
        <div className="px-6 py-4 border-b border-gray-100/10 dark:border-slate-800/50 flex justify-between items-center bg-gray-50/30 dark:bg-slate-800/30">
          {title && <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-wide uppercase">{title}</h3>}
          {action && <div className="text-sm">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
};

export const KPICard: React.FC<{ kpi: any }> = ({ kpi }) => {
    const isPositive = kpi.status === 'up';
    const isNeutral = kpi.status === 'neutral';
    
    return (
        <div className={`
            group
            relative overflow-hidden
            bg-white/90 dark:bg-slate-900 
            backdrop-blur-lg
            p-5 rounded-xl 
            border border-gray-200/60 dark:border-slate-800
            shadow-sm hover:shadow-md dark:shadow-slate-900/30
            transition-all duration-300
        `}>
            {/* Hover Glow Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-10 transition duration-500 blur-lg"></div>

            <div className="relative z-10 flex flex-col">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{kpi.label}</span>
                <div className="flex items-end justify-between mt-3">
                    <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{kpi.value}</span>
                    <div className={`
                        flex items-center text-xs font-bold px-2 py-1 rounded-full
                        ${isNeutral 
                            ? 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400' 
                            : isPositive 
                                ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
                                : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}
                    `}>
                        <span>{kpi.trend > 0 ? '+' : ''}{kpi.trend}%</span>
                    </div>
                </div>
            </div>
        </div>
    )
}