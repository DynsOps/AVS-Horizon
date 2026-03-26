import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { Anchor, Loader2 } from 'lucide-react';
import { getDefaultRouteForUser } from '../utils/rbac';
import { useUIStore } from '../store/uiStore';
import { loginRequest } from '../auth/authConfig';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const { addToast } = useUIStore();
  const navigate = useNavigate();
  const { instance } = useMsal();

  const submitPassword = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const user = await api.auth.loginWithPassword(email, password);
      login(user);
      navigate(getDefaultRouteForUser(user));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const submitMicrosoft = async () => {
    setIsMicrosoftLoading(true);
    setError('');
    
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microsoft authentication failed.';
      setError(message);
      setIsMicrosoftLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 h-[30rem] w-[30rem] rounded-full bg-blue-500/20 blur-[110px]" />
        <div className="absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-[110px]" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 md:px-8">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl md:p-10">
            <div className="mb-10 flex items-center gap-2">
              <div className="rounded-md bg-gradient-to-tr from-emerald-500 to-cyan-500 p-1.5">
                <Anchor className="h-4 w-4 text-white" strokeWidth={1.8} />
              </div>
              <p className="font-display text-sm font-semibold tracking-[0.38em] text-slate-100">AVS HORIZON</p>
            </div>

            <h1 className="font-display text-4xl font-bold tracking-tight text-white">Log in</h1>

            <form onSubmit={(e) => { e.preventDefault(); void submitPassword(); }} className="mt-8 space-y-6">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">Business email</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-0 border-b border-slate-600 bg-transparent px-0 py-2 text-slate-100 placeholder-slate-500 outline-none focus:border-blue-400 focus:ring-0"
                  placeholder="johndoe@company.com"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => addToast({ title: 'Forgot Password', message: 'Password reset flow will be enabled with backend email service.', type: 'info' })}
                    className="text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-0 border-b border-slate-600 bg-transparent px-0 py-2 text-slate-100 placeholder-slate-500 outline-none focus:border-blue-400 focus:ring-0"
                  placeholder="johndoe123!"
                />
              </div>

              {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs font-medium text-red-300">{error}</div>}

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-full bg-[#34386c] py-3 text-sm font-semibold tracking-wide text-white transition-all duration-200 hover:bg-[#2a2d59] disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : 'Log in'}
              </button>

              <div className="relative py-1">
                <div className="h-px bg-slate-700" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 px-2 text-[11px] text-slate-500">or</span>
              </div>

              <button
                type="button"
                onClick={() => void submitMicrosoft()}
                disabled={isMicrosoftLoading}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-600 bg-slate-800/70 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:opacity-70"
              >
                <span className="grid grid-cols-2 gap-[2px]">
                  <span className="h-2 w-2 bg-[#f25022]" />
                  <span className="h-2 w-2 bg-[#7fba00]" />
                  <span className="h-2 w-2 bg-[#00a4ef]" />
                  <span className="h-2 w-2 bg-[#ffb900]" />
                </span>
                {isMicrosoftLoading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : 'Sign in with Microsoft'}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-700 pt-4">
              <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Quick Fill</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
                <button type="button" className="rounded-md border border-slate-600 bg-slate-800/70 px-2 py-1.5 hover:border-blue-400/50 hover:bg-slate-800" onClick={() => { setEmail('ops@nordic-hamburg.com'); setPassword('AVS-NORDIC-USER-INIT'); }}>nordic user</button>
                <button type="button" className="rounded-md border border-slate-600 bg-slate-800/70 px-2 py-1.5 hover:border-blue-400/50 hover:bg-slate-800" onClick={() => { setEmail('admin@nordic-hamburg.com'); setPassword('AVS-NORDIC-ADMIN-INIT'); }}>nordic admin</button>
                <button type="button" className="rounded-md border border-slate-600 bg-slate-800/70 px-2 py-1.5 hover:border-blue-400/50 hover:bg-slate-800" onClick={() => { setEmail('admin@avs.com'); setPassword('AVS-ADMIN-INIT'); }}>portal admin</button>
                <button type="button" className="rounded-md border border-slate-600 bg-slate-800/70 px-2 py-1.5 hover:border-blue-400/50 hover:bg-slate-800" onClick={() => { setEmail('supadmin@avs.com'); setPassword('AVS-SUPADMIN-INIT'); }}>supadmin</button>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};
