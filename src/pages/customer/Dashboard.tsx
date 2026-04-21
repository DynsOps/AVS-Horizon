import React from 'react';
import avsLogo from '../../assets/avslogo.png';
import { useAuthStore } from '../../store/authStore';
import { MapWidget } from '../../components/maritime/MapWidget';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const isSupadmin = user?.role === 'supadmin';

  return (
    <div className="space-y-6">
    <div className={`relative ${isSupadmin ? 'min-h-[320px]' : 'min-h-[calc(100vh-9rem)]'} overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-950 via-[#0a2a4d] to-[#0f4979] p-8 shadow-xl dark:border-slate-700/60 md:p-12`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-yellow-300/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.06),transparent_40%)]" />
      </div>

      <div className="relative z-10 flex h-full min-h-[420px] flex-col justify-between gap-8">
        <div className="max-w-2xl">
          <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
            AVS Horizon
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-5xl">
            Welcome to AVS Horizon Portal
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-200 md:text-base">
            Your workspace is ready. Use the navigation panel to access operations, suppliers, reports, and administration tools.
          </p>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-slate-200 backdrop-blur-md md:text-sm">
            Navigate from the left sidebar to continue.
          </div>
          <img
            src={avsLogo}
            alt="AVS Logo"
            className="h-24 w-24 rounded-full border-2 border-white/25 object-cover opacity-80 shadow-xl shadow-black/40 md:h-32 md:w-32"
          />
        </div>
      </div>
    </div>

    {isSupadmin && <MapWidget />}
    </div>
  );
};
