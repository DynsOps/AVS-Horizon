
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './src/store/authStore';
import { useThemeStore } from './src/store/themeStore';
import { Login } from './src/pages/Login';
import { AppShell } from './src/layouts/AppShell';

// Common Pages
import { Profile } from './src/pages/Profile';

// Customer Pages
import { CustomerDashboard } from './src/pages/customer/Dashboard';
import { OperationalList } from './src/pages/customer/OperationalList';
import { InvoiceList } from './src/pages/customer/InvoiceList';
import { PortFeeList } from './src/pages/customer/PortFeeList';
import { HistoricalOrders } from './src/pages/customer/HistoricalOrders';
import { ContractedConsumptionReport } from './src/pages/customer/ContractedConsumptionReport';
import { ContractedAnalysisReport } from './src/pages/customer/ContractedAnalysisReport';
import { Analytics } from './src/pages/customer/Analytics';
import { CustomerOrders } from './src/pages/customer/Orders';
import { Fleet } from './src/pages/customer/Fleet';
import { Shipments } from './src/pages/customer/Shipments';
import { Finance } from './src/pages/customer/Finance';
import { Sustainability } from './src/pages/customer/Sustainability';
import { Business } from './src/pages/customer/Business';
import { SupportTickets } from './src/pages/shared/SupportTickets';
import { GuestRFQPage } from './src/pages/guest/RFQ';

// Supplier Pages
import { SupplierDashboard } from './src/pages/supplier/Dashboard';
import { SupplierLogistics } from './src/pages/supplier/Logistics';

// Admin Pages
import { SystemHealth } from './src/pages/admin/SystemHealth';
import { Security } from './src/pages/admin/Security';
import { UserManagement } from './src/pages/admin/UserManagement';
import { Permission, UserRole } from './src/types';
import { getDefaultRouteForUser, hasPermissions, hasRoleAccess } from './src/utils/rbac';
import { MsalAuthBridge } from './src/auth/MsalAuthBridge';

// Guard Component
const ProtectedRoute = ({
  children,
  allowedRoles,
  requiredPermissions,
}: {
  children?: React.ReactNode,
  allowedRoles?: UserRole[],
  requiredPermissions?: Permission[],
}) => {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRoleAccess(user.role, allowedRoles)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  if (!hasPermissions(user.permissions, requiredPermissions)) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { isDarkMode } = useThemeStore();

  // Effect to apply dark mode class to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <HashRouter>
      <MsalAuthBridge />
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected App Shell */}
        <Route element={<AppShell />}>
          
          {/* Common Routes */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/support/tickets" element={<ProtectedRoute requiredPermissions={['create:support-ticket']}><SupportTickets /></ProtectedRoute>} />
          <Route path="/guest/rfq" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['submit:rfq']}><GuestRFQPage /></ProtectedRoute>} />

          {/* Customer Routes */}
          <Route path="/customer">
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:dashboard']}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="operational-list" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:operational-list']}><OperationalList /></ProtectedRoute>} />
            <Route path="invoices" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:invoices']}><InvoiceList /></ProtectedRoute>} />
            <Route path="port-fees" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:port-fees']}><PortFeeList /></ProtectedRoute>} />
            <Route path="historical-orders" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:orders']}><HistoricalOrders /></ProtectedRoute>} />
            <Route path="reports/consumption" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:reports']}><ContractedConsumptionReport /></ProtectedRoute>} />
            <Route path="reports/analysis" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:reports']}><ContractedAnalysisReport /></ProtectedRoute>} />
            <Route path="analytics" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:reports']}><Analytics /></ProtectedRoute>} />
            <Route path="fleet" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:fleet']}><Fleet /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:orders']}><CustomerOrders /></ProtectedRoute>} />
            <Route path="shipments" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:shipments']}><Shipments /></ProtectedRoute>} />
            <Route path="finance" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:finance']}><Finance /></ProtectedRoute>} />
            <Route path="sustainability" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:sustainability']}><Sustainability /></ProtectedRoute>} />
            <Route path="business" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:business']}><Business /></ProtectedRoute>} />
          </Route>

          {/* Supplier Routes */}
          <Route path="/supplier">
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:supplier']}><SupplierDashboard /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:supplier']}><div className="p-6">Supplier Orders View</div></ProtectedRoute>} />
            <Route path="logistics" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:supplier']}><SupplierLogistics /></ProtectedRoute>} />
            <Route path="performance" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['view:supplier']}><div className="p-6">Performance Scorecards</div></ProtectedRoute>} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin">
            <Route path="security" element={<ProtectedRoute allowedRoles={['admin', 'supadmin']} requiredPermissions={['system:settings']}><Security /></ProtectedRoute>} />
            <Route path="system-health" element={<ProtectedRoute allowedRoles={['admin', 'supadmin']} requiredPermissions={['system:settings']}><SystemHealth /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute allowedRoles={['admin', 'supadmin']} requiredPermissions={['manage:users']}><UserManagement /></ProtectedRoute>} />
            <Route path="feature-flags" element={<ProtectedRoute allowedRoles={['supadmin']} requiredPermissions={['system:settings']}><div className="p-6">Feature Flags Management</div></ProtectedRoute>} />
          </Route>

        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
