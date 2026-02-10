import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { Anchor, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const user = await api.auth.login(email);
      login(user);
      if (user.role === 'Customer') navigate('/customer/dashboard');
      else if (user.role === 'Supplier') navigate('/supplier/dashboard');
      else if (user.role === 'Admin') navigate('/admin/system-health');
    } catch (err) {
      setError('Invalid credentials. Try "admin", "cust", or "supp" in email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden font-sans">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute top-[30%] right-[10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[100px]"></div>
        </div>

      <div className="relative z-10 w-full max-w-md p-4">
          <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 p-8 rounded-2xl shadow-2xl shadow-black/50">
            <div className="flex flex-col items-center mb-8">
                <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-lg shadow-blue-500/20 mb-5 transform hover:scale-105 transition-transform duration-300">
                    <Anchor className="text-white w-8 h-8" strokeWidth={1.5} />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">AVS Horizon</h1>
                <p className="text-slate-400 text-sm mt-2 font-medium tracking-wide">Enterprise Maritime Logistics</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
            <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="admin@avs.com"
                />
            </div>
            <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                <input
                type="password"
                className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="••••••••"
                />
            </div>

            {error && <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/30 p-3 rounded-lg text-center font-medium">{error}</div>}

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3.5 rounded-lg font-semibold shadow-lg shadow-blue-600/20 transition-all duration-200 transform hover:translate-y-[-1px] flex items-center justify-center tracking-wide"
            >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5" strokeWidth={1.5} /> : 'Access Portal'}
            </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-[10px] text-slate-500 mb-3 uppercase tracking-widest font-semibold">Development Access</p>
                <div className="flex justify-center gap-2 text-xs text-slate-400 font-mono">
                    <span className="bg-slate-950/50 px-2 py-1 rounded border border-white/5 hover:border-blue-500/50 cursor-pointer transition-colors" onClick={() => setEmail('cust@shipping.com')}>cust</span>
                    <span className="bg-slate-950/50 px-2 py-1 rounded border border-white/5 hover:border-blue-500/50 cursor-pointer transition-colors" onClick={() => setEmail('supp@vendor.com')}>supp</span>
                    <span className="bg-slate-950/50 px-2 py-1 rounded border border-white/5 hover:border-blue-500/50 cursor-pointer transition-colors" onClick={() => setEmail('admin@avs.com')}>admin</span>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};