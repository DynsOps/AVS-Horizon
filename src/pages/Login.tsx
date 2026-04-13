import React, { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { Anchor, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { externalLocalLoginRequest, federatedMicrosoftLoginRequest, isExternalLocalAuthConfigured } from '../auth/authConfig';
import { clearPendingHostedSignInProvider, setPendingHostedSignInProvider } from '../auth/providerSession';
import { useAuthStore } from '../store/authStore';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [error, setError] = useState('');
  const { instance } = useMsal();
  const { authStatus, authError, clearAuthFeedback } = useAuthStore();
  const isResolvingRedirect = authStatus === 'resolving';

  const continueWithHostedSignIn = async (mode: 'microsoft' | 'local') => {
    setError('');
    clearAuthFeedback();
    if (mode === 'microsoft') {
      setIsMicrosoftLoading(true);
    } else {
      setIsLocalLoading(true);
    }

    try {
      if (mode === 'local') {
        if (!isExternalLocalAuthConfigured) {
          throw new Error('Local account sign-in is not configured yet. Complete the External ID authority settings first.');
        }
        setPendingHostedSignInProvider('external_local');
        await instance.loginRedirect({
          ...externalLocalLoginRequest,
          ...(email.trim() ? { loginHint: email.trim() } : {}),
        });
      } else {
        setPendingHostedSignInProvider('microsoft_federated');
        await instance.loginRedirect({
          ...federatedMicrosoftLoginRequest,
          ...(email.trim() ? { loginHint: email.trim() } : {}),
          prompt: 'select_account',
        });
      }
    } catch (err) {
      clearPendingHostedSignInProvider();
      const message = err instanceof Error ? err.message : 'Entra authentication failed.';
      setError(message);
      setIsMicrosoftLoading(false);
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
            <div className="rounded-md bg-gradient-to-tr from-emerald-500 to-cyan-500 p-1.5">
              <Anchor className="h-4 w-4 text-white" strokeWidth={1.8} />
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
              onClick={() => void continueWithHostedSignIn('local')}
              disabled={isLocalLoading || isResolvingRedirect || !isExternalLocalAuthConfigured}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#1f8f7b] py-3 text-sm font-semibold tracking-wide text-white transition-all duration-200 hover:bg-[#197666] disabled:opacity-70"
            >
              {isLocalLoading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <LockKeyhole className="h-4 w-4" strokeWidth={1.8} />}
              Sign in
            </button>
            {!isExternalLocalAuthConfigured && (
              <p className="text-center text-[11px] text-slate-500">
                Local account sign-in will be available after External ID authority settings are completed.
              </p>
            )}

            <div className="relative py-1">
              <div className="h-px bg-slate-700" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 px-2 text-[11px] text-slate-500">or</span>
            </div>

            <button
              type="button"
              onClick={() => void continueWithHostedSignIn('microsoft')}
              disabled={isMicrosoftLoading || isResolvingRedirect}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-600 bg-slate-800/70 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:opacity-70"
            >
              <span className="grid grid-cols-2 gap-[2px]">
                <span className="h-2 w-2 bg-[#f25022]" />
                <span className="h-2 w-2 bg-[#7fba00]" />
                <span className="h-2 w-2 bg-[#00a4ef]" />
                <span className="h-2 w-2 bg-[#ffb900]" />
              </span>
              {isMicrosoftLoading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : 'Continue with Microsoft'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
