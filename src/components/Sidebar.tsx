
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  LayoutDashboard, Ship, Package, DollarSign, Leaf, BarChart2, 
  Truck, ShieldAlert, Activity, Settings, LogOut, Anchor, Users, Building, UserCircle
} from 'lucide-react';

const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => 
      `group flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 mb-1 relative overflow-hidden ${
        isActive 
          ? 'text-white shadow-lg shadow-blue-500/20' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
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
  const role = user?.role;

  return (
    <div className={`
        h-screen w-64 flex flex-col flex-shrink-0 transition-all duration-300
        bg-slate-900 dark:bg-slate-900 border-r border-slate-800
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
        {role === 'Customer' && (
          <>
            <div className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Operations</div>
            <NavItem to="/customer/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/customer/fleet" icon={Ship} label="Fleet Management" />
            <NavItem to="/customer/orders" icon={Package} label="Orders" />
            <NavItem to="/customer/shipments" icon={Truck} label="Shipments" />
            
            <div className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-8">Business</div>
            <NavItem to="/customer/finance" icon={DollarSign} label="Finance" />
            <NavItem to="/customer/sustainability" icon={Leaf} label="Sustainability" />
            <NavItem to="/customer/analytics" icon={BarChart2} label="Analytics" />
          </>
        )}

        {role === 'Supplier' && (
          <>
            <div className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Vendor Portal</div>
            <NavItem to="/supplier/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/supplier/orders" icon={Package} label="Orders" />
            <NavItem to="/supplier/logistics" icon={Truck} label="Logistics" />
            <NavItem to="/supplier/performance" icon={BarChart2} label="Performance" />
          </>
        )}

        {role === 'Admin' && (
          <>
            <div className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Administration</div>
            <NavItem to="/admin/system-health" icon={Activity} label="System Health" />
            <NavItem to="/admin/users" icon={Users} label="User Management" />
            <NavItem to="/admin/companies" icon={Building} label="Entity Management" />
            <NavItem to="/admin/security" icon={ShieldAlert} label="Security Logs" />
            <NavItem to="/admin/feature-flags" icon={Settings} label="Feature Flags" />
          </>
        )}

        {/* Profile Link for All Roles */}
         <div className="mt-8">
            <NavItem to="/profile" icon={UserCircle} label="My Profile" />
         </div>

      </nav>

      <div className="p-4 border-t border-slate-800/50 relative z-10 bg-slate-900/50 backdrop-blur-md">
        <button 
          onClick={logout}
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
