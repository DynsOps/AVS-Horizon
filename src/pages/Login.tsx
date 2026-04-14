import React, { useState } from 'react';
import { Loader2, LockKeyhole, Mail } from 'lucide-react';
import {
  externalLocalLoginRequest,
  isExternalLocalAuthConfigured,
} from '../auth/authConfig';
import { externalMsalInstance } from '../auth/msalInstance';
import { useAuthStore } from '../store/authStore';
import avsLogo from '../assets/avslogo.png';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [error, setError] = useState('');
  const { authStatus, authError, clearAuthFeedback } = useAuthStore();
  const isResolvingRedirect = authStatus === 'resolving';

  const continueWithHostedSignIn = async () => {
    setError('');
    clearAuthFeedback();
    setIsLocalLoading(true);

    try {
      if (!isExternalLocalAuthConfigured) {
        throw new Error('External ID sign-in is not configured yet. Complete the External ID authority settings first.');
      }
      await externalMsalInstance.loginRedirect({
        ...externalLocalLoginRequest,
        ...(email.trim() ? { loginHint: email.trim() } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Entra authentication failed.';
      setError(message);
      setIsLocalLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 h-[30rem] w-[30rem] rounded-full bg-blue-500/20 blur-[110px]" />
        <div className="absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-[110px]" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 md:px-8">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl md:p-10">
          <div className="mb-10 flex items-center gap-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-1">
              <img src={avsLogo} alt="AVS Logo" className="h-8 w-8 rounded object-cover" />
            </div>
            <p className="font-display text-sm font-semibold tracking-[0.38em] text-slate-100">AVS HORIZON</p>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-tight text-white">Secure sign-in</h1>

          <div className="mt-8 space-y-6">
            {isResolvingRedirect && (
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-4 text-center text-sm text-cyan-100">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                  Completing sign-in...
                </div>
              </div>
            )}

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Mail size={13} />
                Email
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3">
                <LockKeyhole size={16} className="text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  placeholder="johndoe@company.com"
                />
              </div>
            </label>

            {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs font-medium text-red-300">{error}</div>}
            {authError && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-200">{authError}</div>}

            <button
              type="button"
              onClick={() => void continueWithHostedSignIn()}
              disabled={isLocalLoading || isResolvingRedirect || !isExternalLocalAuthConfigured}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#1f8f7b] py-3 text-sm font-semibold tracking-wide text-white transition-all duration-200 hover:bg-[#197666] disabled:opacity-70"
            >
              {isLocalLoading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <LockKeyhole className="h-4 w-4" strokeWidth={1.8} />}
              Sign in
            </button>
            {!isExternalLocalAuthConfigured && (
              <p className="text-center text-[11px] text-slate-500">
                External ID sign-in will be available after authority settings are completed.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
