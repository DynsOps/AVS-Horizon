import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, User as UserIcon, Sun, Moon, Sparkles, Building2, ChevronDown, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../store/uiStore';
import { externalMsalInstance } from '../auth/msalInstance';
import { performSignOut } from './signOut';
import { useCompanies } from '../hooks/queries/useCompanies';
import { useNotifications, useMarkNotificationRead, useDeleteNotification } from '../hooks/queries/useNotifications';

const NotificationsDrawerContent: React.FC = () => {
  const { closeDrawer } = useUIStore();
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();

  if (!notifications.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No notifications yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`w-full rounded-2xl border px-4 py-3 transition-colors ${
            notification.isRead
              ? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              : 'border-blue-200 bg-blue-50 text-slate-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-slate-100'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              aria-label={notification.title}
              onClick={() => {
                markRead.mutate(notification.id);
                closeDrawer();
                navigate(notification.targetRoute);
              }}
              className="flex-1 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{notification.title}</p>
                  <p className="mt-1 text-xs leading-relaxed">{notification.message}</p>
                </div>
                {!notification.isRead && (
                  <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                )}
              </div>
            </button>
            <button
              type="button"
              aria-label="Delete notification"
              onClick={() => deleteNotification.mutate(notification.id)}
              className="mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-rose-100 hover:text-rose-500 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export const Header: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const {
    addToast,
    dashboardCompanyId,
    setDashboardCompanyId,
    openDrawer,
  } = useUIStore();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const isSupadmin = user?.role === 'supadmin';
  // companyIds may be absent on stale sessions — fall back to deriving from companyId
  const effectiveCompanyIds = user?.companyIds ?? (user?.companyId ? [user.companyId] : []);
  const isMultiCompanyUser = (user?.role === 'admin' || user?.role === 'user') && effectiveCompanyIds.length > 1;
  const hasHostedSession = externalMsalInstance.getAllAccounts().length > 0;

  const { data: allCompanies = [] } = useCompanies();
  const { data: notifications = [] } = useNotifications();

  const companyOptions = useMemo(() => {
    if (!user) return [];
    if (user.role === 'user' || user.role === 'admin') {
      const ids = effectiveCompanyIds;
      if (ids.length === 0) return [];
      const scoped = allCompanies.filter((c) => ids.includes(c.id));
      return scoped.length ? scoped : ids.map((id) => ({ id, name: id, type: 'Customer' as const, status: 'Active' as const }));
    }
    return allCompanies;
  }, [user, allCompanies, effectiveCompanyIds]);

  const resolvedCompanyId = useMemo(() => {
    if (!companyOptions.length) return '';
    if (dashboardCompanyId && companyOptions.some((company) => company.id === dashboardCompanyId)) {
      return dashboardCompanyId;
    }
    return companyOptions[0].id;
  }, [companyOptions, dashboardCompanyId]);

  useEffect(() => {
    if (resolvedCompanyId && resolvedCompanyId !== dashboardCompanyId) {
      setDashboardCompanyId(resolvedCompanyId);
    }
  }, [resolvedCompanyId, dashboardCompanyId, setDashboardCompanyId]);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  const openNotificationsDrawer = () => {
    openDrawer(<NotificationsDrawerContent />, 'Notifications');
  };

  return (
    <header className={`
        h-16 px-4 md:px-6 sticky top-0 z-30
        flex items-center justify-between
        backdrop-blur-xl transition-colors duration-300
        bg-white/65 dark:bg-slate-900/70
        border-b border-white/60 dark:border-slate-800/60
    `}>
      <div className="flex items-center flex-1 gap-3">
        <div className="hidden lg:flex items-center rounded-full border border-blue-200/70 bg-blue-50/70 px-3 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-900/70 dark:bg-blue-900/20 dark:text-blue-300">
          <Sparkles size={12} className="mr-1.5" />
          Ops Command Center
        </div>
        {companyOptions.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-950/70">
            <Building2 size={15} className="text-slate-500 dark:text-slate-300" />
            <select
              value={resolvedCompanyId}
              onChange={(isSupadmin || isMultiCompanyUser) ? (e) => setDashboardCompanyId(e.target.value) : undefined}
              disabled={!isSupadmin && !isMultiCompanyUser}
              aria-readonly={!isSupadmin && !isMultiCompanyUser}
              className="bg-transparent pr-2 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-80 dark:text-slate-200"
            >
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}{company.dataAreaId ? ` · ${company.dataAreaId}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3">
        {/* Theme Toggle */}
        <button 
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70 rounded-full transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
        >
            {isDarkMode ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-slate-800 mx-2"></div>

        {/*
        {isCustomer && (
          <button
            onClick={() => addToast({ title: 'Cart', message: 'Cart module will open in the next iteration.', type: 'info' })}
            className="relative p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-white/80 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          >
            <ShoppingCart size={20} strokeWidth={1.5} />
            <span className="absolute top-1 right-1 h-2 w-2 bg-blue-600 rounded-full ring-2 ring-white dark:ring-slate-950"></span>
          </button>
        )}
        */}

        <button
          type="button"
          aria-label="Notifications"
          onClick={openNotificationsDrawer}
          className="relative p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-white/80 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
        >
          <Bell size={20} strokeWidth={1.5} />
          {unreadNotificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-950"></span>
          )}
        </button>
        
        <div ref={profileMenuRef} className="relative ml-2 border-l border-gray-200 pl-2 dark:border-slate-800">
          <button
            type="button"
            aria-label={user?.name || 'Profile menu'}
            aria-expanded={isProfileMenuOpen}
            onClick={() => setIsProfileMenuOpen((current) => !current)}
            className="flex items-center space-x-2 rounded-full px-1 py-1 hover:opacity-80 transition-opacity"
          >
            <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 p-[2px] rounded-full">
              <div className="bg-white dark:bg-slate-950 p-0.5 rounded-full">
                <div className="bg-gray-100 dark:bg-slate-800 rounded-full p-1">
                  <UserIcon size={16} className="text-gray-600 dark:text-gray-300" strokeWidth={1.5} />
                </div>
              </div>
            </div>
            <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 md:block">
              {user?.name.split(' ')[0]}
            </span>
            <ChevronDown size={14} className="hidden text-slate-400 md:block" />
          </button>

          {isProfileMenuOpen && (
            <div
              className="absolute right-0 z-40 mt-3 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  navigate('/profile');
                }}
                className="block w-full px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                My Profile
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsProfileMenuOpen(false);
                  await performSignOut({
                    userEmail: user?.email,
                    hasHostedSession,
                    logout,
                    navigate,
                    addToast,
                  });
                }}
                className="block w-full px-4 py-3 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
