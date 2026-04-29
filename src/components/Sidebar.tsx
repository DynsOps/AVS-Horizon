
import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { externalMsalInstance } from '../auth/msalInstance';
import { AsyncActionButton } from './ui/AsyncActionButton';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { isPendingAccessUser } from '../utils/rbac';
import avsLogo from '../assets/avslogo.png';
import { performSignOut } from './signOut';
import { LogOut, UserCircle, ChevronDown } from 'lucide-react';
import { SCREEN_REGISTRY, type ScreenGroup } from '../screenRegistry';
import { useOpenTicketsCount } from '../hooks/queries/useSupportTickets';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NavItem = ({ to, icon: Icon, label, badge }: { to: string, icon: any, label: string, badge?: number }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `group flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 mb-1 relative overflow-hidden ${
        isActive
          ? 'text-white shadow-lg shadow-blue-500/20'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
      }`
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-100" />
        )}
        <Icon size={18} strokeWidth={1.5} className={`relative z-10 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
        <span className="relative z-10 font-medium text-sm tracking-wide flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span className="relative z-10 ml-auto min-w-[18px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </>
    )}
  </NavLink>
);

const GROUP_HEADER: Record<ScreenGroup, string> = {
  operations: 'Operations',
  supplier: 'Supplier',
  administration: 'Administration',
};

const COLLAPSIBLE_GROUPS: ScreenGroup[] = ['operations', 'supplier'];

const GROUP_ORDER: Record<string, ScreenGroup[]> = {
  supadmin: ['administration', 'operations', 'supplier'],
  admin:    ['operations', 'supplier', 'administration'],
  user:     ['operations', 'supplier'],
};

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();
  const role = user?.role;
  const isPendingUser = Boolean(user && isPendingAccessUser(user));
  const hasHostedSession = externalMsalInstance.getAllAccounts().length > 0;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ScreenGroup>>(new Set());
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { data: openTicketsCount = 0 } = useOpenTicketsCount();

  const toggleGroup = (group: ScreenGroup) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await performSignOut({
        userEmail: user?.email,
        hasHostedSession,
        logout,
        navigate,
        addToast,
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  const visibleByGroup = useMemo<Partial<Record<ScreenGroup, typeof SCREEN_REGISTRY>>>(() => {
    if (!role || isPendingUser) return {};
    const permissions = new Set(user?.permissions ?? []);
    const grouped: Partial<Record<ScreenGroup, typeof SCREEN_REGISTRY>> = {};
    for (const entry of SCREEN_REGISTRY) {
      if (entry.hideInSidebar) continue;
      if (!entry.allowedRoles.includes(role)) continue;
      if (entry.permissions.length > 0 && !entry.permissions.every((p) => permissions.has(p))) continue;
      if (!entry.group) continue;
      if (!grouped[entry.group]) grouped[entry.group] = [];
      grouped[entry.group]!.push(entry);
    }
    return grouped;
  }, [role, user?.permissions, isPendingUser]);

  const groupOrder: ScreenGroup[] = GROUP_ORDER[role ?? ''] ?? [];

  return (
    <div className={`
        h-screen w-64 flex flex-col flex-shrink-0 transition-all duration-300
        bg-slate-900/95 dark:bg-slate-900/95 border-r border-slate-800/80 backdrop-blur-xl
        relative overflow-hidden
    `}>
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[20%] w-[80%] h-[40%] bg-blue-600/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[0%] -right-[20%] w-[60%] h-[40%] bg-indigo-600/5 rounded-full blur-3xl"></div>
      </div>

      <div className="p-6 flex items-center space-x-3 border-b border-slate-800/50 relative z-10 backdrop-blur-sm">
        <div className="bg-white/5 p-1.5 rounded-xl border border-slate-700/60 shadow-lg shadow-black/20">
          <img src={avsLogo} alt="AVS Logo" className="h-9 w-9 rounded-lg object-cover" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">AVS Horizon</h1>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-6 relative z-10 custom-scrollbar">
        {groupOrder.map((group, groupIdx) => {
          const entries = visibleByGroup[group];
          if (!entries || entries.length === 0) return null;

          const isCollapsible = role === 'supadmin' && COLLAPSIBLE_GROUPS.includes(group);
          const isOpen = !collapsedGroups.has(group);
          const headerLabel =
            group === 'administration' && role === 'supadmin'
              ? 'Super Administration'
              : GROUP_HEADER[group];

          return (
            <div key={group} className={groupIdx > 0 ? 'mt-6' : ''}>
              {isCollapsible ? (
                <button
                  onClick={() => toggleGroup(group)}
                  className="mb-3 w-full px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between hover:text-slate-300 transition-colors"
                >
                  <span>{headerLabel}</span>
                  <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <div className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                  {headerLabel}
                </div>
              )}

              {(!isCollapsible || isOpen) && entries.map((entry) => (
                <NavItem
                  key={entry.id}
                  to={entry.path}
                  icon={entry.icon}
                  label={entry.label}
                  badge={entry.badge?.({ openTicketsCount })}
                />
              ))}
            </div>
          );
        })}

        <div className="mt-8 border-t border-slate-800/60 pt-5">
          <NavItem to="/profile" icon={UserCircle} label="My Profile" />
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800/50 relative z-10 bg-slate-900/50 backdrop-blur-md">
        <AsyncActionButton
          onClick={() => { void handleSignOut(); }}
          isPending={isSigningOut}
          className="group w-full flex items-center justify-center space-x-2 px-4 py-2.5
                     bg-slate-800/50 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/50
                     rounded-lg transition-all duration-200 text-sm text-slate-300 hover:text-red-400"
        >
          <LogOut size={16} strokeWidth={1.5} />
          <span>Sign Out</span>
        </AsyncActionButton>
      </div>
    </div>
  );
};
