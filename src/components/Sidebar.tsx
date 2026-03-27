
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { useAuthStore } from '../store/authStore';
import { Permission } from '../types';
import { api } from '../services/api';
import { 
  LayoutDashboard, Ship, Package, ClipboardList, ReceiptText, Landmark,
  Truck, ShieldAlert, Activity, Settings, LogOut, Anchor, Users, UserCircle, LifeBuoy, FilePlus2, BarChart3, Building2
} from 'lucide-react';

const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
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
        {/* Active Gradient Background */}
        {isActive && (
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-100" />
        )}
        
        {/* Icon & Label */}
        <Icon size={18} strokeWidth={1.5} className={`relative z-10 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
        <span className="relative z-10 font-medium text-sm tracking-wide">{label}</span>
      </>
    )}
  </NavLink>
);

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const role = user?.role;
  const hasPermission = (permission: Permission) => Boolean(user?.permissions.includes(permission));
  const canAccessBiReports = Boolean(user?.powerBiAccess && user.powerBiAccess !== 'none');
  const hasMicrosoftSession = accounts.length > 0;

  const handleSignOut = async () => {
    const userEmail = user?.email;
    if (userEmail) {
      await api.auth.clearMicrosoftToken(userEmail);
    } else {
      await api.auth.clearMicrosoftToken();
    }

    logout();

    if (hasMicrosoftSession) {
      await instance.logoutRedirect({
        postLogoutRedirectUri: `${window.location.origin}/#/login`,
      });
      return;
    }

    navigate('/login', { replace: true });
  };

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
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
          <Anchor size={20} className="text-white" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">AVS Horizon</h1>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Logistics Portal</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-6 relative z-10 custom-scrollbar">
        {role === 'user' && (
          <>
            <div className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Operations</div>
            {hasPermission('view:dashboard') && <NavItem to="/customer/dashboard" icon={LayoutDashboard} label="Dashboard" />}
            {hasPermission('view:operational-list') && <NavItem to="/customer/operational-list" icon={ClipboardList} label="Operational List" />}
            {hasPermission('view:invoices') && <NavItem to="/customer/invoices" icon={ReceiptText} label="Invoice List" />}
            {hasPermission('view:port-fees') && <NavItem to="/customer/port-fees" icon={Landmark} label="Port Fee List" />}
            {hasPermission('view:fleet') && <NavItem to="/customer/fleet" icon={Ship} label="Fleet Management" />}
            {hasPermission('view:orders') && <NavItem to="/customer/orders" icon={Package} label="Orders" />}
            {hasPermission('view:orders') && <NavItem to="/customer/historical-orders" icon={ClipboardList} label="Historical Orders" />}
            {hasPermission('view:shipments') && <NavItem to="/customer/shipments" icon={Truck} label="Shipments" />}
            {hasPermission('view:finance') && <NavItem to="/customer/finance" icon={Landmark} label="Finance" />}
            {hasPermission('view:sustainability') && <NavItem to="/customer/sustainability" icon={BarChart3} label="Sustainability" />}
            {hasPermission('view:business') && <NavItem to="/customer/business" icon={Settings} label="Business" />}
            {hasPermission('view:reports') && <NavItem to="/customer/reports/consumption" icon={BarChart3} label="Consumption Report" />}
            {hasPermission('view:reports') && <NavItem to="/customer/reports/analysis" icon={BarChart3} label="Analysis Report" />}
            {(canAccessBiReports || hasPermission('view:analytics')) && <NavItem to="/customer/analytics" icon={BarChart3} label="BI Reports" />}
            {hasPermission('create:support-ticket') && <NavItem to="/support/tickets" icon={LifeBuoy} label="Support Tickets" />}
            {hasPermission('submit:rfq') && <NavItem to="/guest/rfq" icon={FilePlus2} label="Guest RFQ" />}

            {hasPermission('view:supplier') && (
              <>
                <div className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-6">Supplier</div>
                <NavItem to="/supplier/dashboard" icon={LayoutDashboard} label="Supplier Dashboard" />
                <NavItem to="/supplier/orders" icon={Package} label="Supplier Orders" />
                <NavItem to="/supplier/logistics" icon={Truck} label="Supplier Logistics" />
                <NavItem to="/supplier/performance" icon={BarChart3} label="Supplier Performance" />
              </>
            )}
          </>
        )}

        {role === 'admin' && (
          <>
            <div className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Administration</div>
            {hasPermission('system:settings') && <NavItem to="/admin/system-health" icon={Activity} label="System Health" />}
            {hasPermission('manage:users') && <NavItem to="/admin/users" icon={Users} label="User Management" />}
            {hasPermission('system:settings') && <NavItem to="/admin/security" icon={ShieldAlert} label="Security Logs" />}
            {hasPermission('create:support-ticket') && <NavItem to="/support/tickets" icon={LifeBuoy} label="Support Tickets" />}
          </>
        )}

        {role === 'supadmin' && (
          <>
            <div className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Super Administration</div>
            {hasPermission('system:settings') && <NavItem to="/admin/system-health" icon={Activity} label="System Health" />}
            {hasPermission('manage:users') && <NavItem to="/admin/users" icon={Users} label="User Management" />}
            {hasPermission('manage:companies') && <NavItem to="/admin/entities" icon={Building2} label="Entity Management" />}
            {hasPermission('system:settings') && <NavItem to="/admin/security" icon={ShieldAlert} label="Security Logs" />}
            {hasPermission('system:settings') && <NavItem to="/admin/feature-flags" icon={Settings} label="Feature Flags" />}
            {hasPermission('create:support-ticket') && <NavItem to="/support/tickets" icon={LifeBuoy} label="Support Tickets" />}
          </>
        )}

        {/* Profile Link for All Roles */}
         <div className="mt-8 border-t border-slate-800/60 pt-5">
            <NavItem to="/profile" icon={UserCircle} label="My Profile" />
         </div>

      </nav>

      <div className="p-4 border-t border-slate-800/50 relative z-10 bg-slate-900/50 backdrop-blur-md">
        <button 
          onClick={() => { void handleSignOut(); }}
          className="group w-full flex items-center justify-center space-x-2 px-4 py-2.5 
                     bg-slate-800/50 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/50
                     rounded-lg transition-all duration-200 text-sm text-slate-300 hover:text-red-400"
        >
          <LogOut size={16} strokeWidth={1.5} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
