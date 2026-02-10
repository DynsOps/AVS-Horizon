import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useUIStore } from '../store/uiStore';
import { X } from 'lucide-react';

export const AppShell: React.FC = () => {
  const { isDrawerOpen, drawerContent, closeDrawer, toasts, removeToast } = useUIStore();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Subtle Ambient Gradient Mesh for Depth */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-40 dark:opacity-10">
            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] left-[10%] w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[100px]"></div>
        </div>

        <Header />
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth z-10 relative">
          <Outlet />
        </main>
      </div>

      {/* Right Drawer Overlay */}
      {isDrawerOpen && (
        <div className="absolute inset-0 z-40 flex justify-end">
          <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/50 backdrop-blur-sm transition-opacity" onClick={closeDrawer}></div>
          <div className="relative w-[450px] bg-white dark:bg-slate-900 shadow-2xl h-full z-50 transform transition-transform duration-300 ease-out border-l border-gray-200 dark:border-slate-800 flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Details</h2>
              <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300">
              {drawerContent}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={`
                flex items-start p-4 rounded-xl shadow-lg shadow-black/10 text-white w-96 
                transform transition-all duration-300 backdrop-blur-md
                border border-white/10
                ${
                    toast.type === 'success' ? 'bg-green-600/90' : 
                    toast.type === 'error' ? 'bg-red-600/90' : 'bg-blue-600/90'
                }
            `}
          >
            <div className="flex-1">
              <h4 className="font-bold text-sm">{toast.title}</h4>
              <p className="text-xs mt-1 opacity-90 leading-relaxed">{toast.message}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="ml-3 text-white/70 hover:text-white transition-opacity">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};