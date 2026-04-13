import React from 'react';
import { Hourglass, Mail, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Card } from '../components/ui/Card';

export const AccessPending: React.FC = () => {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="overflow-hidden border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-sky-50 dark:border-amber-900/40 dark:from-amber-950/20 dark:via-slate-950 dark:to-sky-950/20">
        <div className="flex flex-col gap-6 p-2 md:flex-row md:items-start">
          <div className="rounded-2xl bg-amber-100 p-4 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Hourglass size={28} strokeWidth={1.6} />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">
                Access Pending
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Your identity is verified, but portal permissions are still pending.
              </h1>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              You successfully authenticated through Entra ID. A company admin must now assign your AVS Horizon permissions before
              operational modules become available.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Signed-in account</p>
                <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">{user.email}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Company scope</p>
                <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">{user.companyId || 'Not linked yet'}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-sky-100 p-3 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">What happens next</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Your company admin can assign role-based permissions from the User Management screen. Once permissions are granted,
                refreshing this session will unlock the relevant modules automatically.
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Need help?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Contact your AVS Horizon company admin first. If your company uses invited personal accounts, make sure the Entra
                invitation has also been accepted before retrying sign-in.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
