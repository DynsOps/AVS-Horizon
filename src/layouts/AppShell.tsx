import React, { useEffect, useId, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useUIStore } from '../store/uiStore';
import { X, CircleCheck, CircleAlert, Info, AlertTriangle } from 'lucide-react';

export const AppShell: React.FC = () => {
  const {
    isDrawerOpen,
    drawerTitle,
    drawerContent,
    closeDrawer,
    toasts,
    removeToast,
    confirmDialog,
    resolveConfirmDialog,
  } = useUIStore();
  const drawerHeadingId = useId();
  const drawerCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isDrawerOpen) return;

    drawerCloseButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawerOpen, closeDrawer]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-45 dark:opacity-20">
            <div className="absolute top-[-14%] right-[-8%] w-[620px] h-[620px] bg-blue-500/20 rounded-full blur-[130px] anim-float"></div>
            <div className="absolute bottom-[-12%] left-[6%] w-[480px] h-[480px] bg-indigo-500/20 rounded-full blur-[110px]"></div>
        </div>

        <Header />
        <main className="app-main flex-1 overflow-y-auto scroll-smooth z-10 relative">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Right Drawer Overlay */}
      {isDrawerOpen && (
        <div className="absolute inset-0 z-40 flex justify-end">
          <div className="fixed inset-0 bg-slate-900/30 dark:bg-black/55 backdrop-blur-sm transition-opacity" onClick={closeDrawer}></div>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={drawerHeadingId}
            className="relative w-[460px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl h-full z-50 transform transition-transform duration-300 ease-out border-l border-white/40 dark:border-slate-700/60 flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70">
              <h2 id={drawerHeadingId} className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">{drawerTitle}</h2>
              <button
                ref={drawerCloseButtonRef}
                type="button"
                aria-label={`Close ${drawerTitle}`}
                onClick={closeDrawer}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-transparent text-slate-600 dark:text-slate-300">
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
                anim-toast relative overflow-hidden flex items-start gap-3 p-4 rounded-2xl shadow-xl shadow-black/15 text-white w-96 
                transform transition-all duration-300 backdrop-blur-xl
                border border-white/15
                ${
                    toast.type === 'success' ? 'bg-emerald-600/90' : 
                    toast.type === 'error' ? 'bg-rose-600/90' : 'bg-blue-600/90'
                }
            `}
          >
            <div className="mt-0.5">
              {toast.type === 'success' && <CircleCheck size={18} className="text-white" />}
              {toast.type === 'error' && <CircleAlert size={18} className="text-white" />}
              {toast.type === 'info' && <Info size={18} className="text-white" />}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm tracking-tight">{toast.title}</h4>
              <p className="text-xs mt-1 opacity-95 leading-relaxed">{toast.message}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="ml-3 text-white/70 hover:text-white transition-opacity">
              <X size={16} strokeWidth={1.5} />
            </button>
            <div className="absolute bottom-0 left-0 h-0.5 w-full bg-white/25">
              <div className="h-full w-full bg-white/70 origin-left [animation:toast-progress_4.6s_linear_forwards]" />
            </div>
          </div>
        ))}
      </div>

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-white/65 backdrop-blur-sm dark:bg-black/65"
            onClick={() => resolveConfirmDialog(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-start gap-3">
              <div className={`rounded-lg p-2 ${confirmDialog.tone === 'danger' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                <AlertTriangle size={16} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{confirmDialog.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => resolveConfirmDialog(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {confirmDialog.cancelLabel}
              </button>
              <button
                onClick={() => resolveConfirmDialog(true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
