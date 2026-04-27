
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './src/store/authStore';
import { useThemeStore } from './src/store/themeStore';
import { Login } from './src/pages/Login';
import { AppShell } from './src/layouts/AppShell';
import { AccessPending } from './src/pages/AccessPending';

// Common Pages
import { Profile } from './src/pages/Profile';

// Customer Pages
import { CustomerDashboard } from './src/pages/customer/Dashboard';
import { OperationalList } from './src/pages/customer/OperationalList';
import { InvoiceList } from './src/pages/customer/InvoiceList';
import { PortFeeList } from './src/pages/customer/PortFeeList';
import { HistoricalOrders } from './src/pages/customer/HistoricalOrders';
import { ContractedAnalysisReport } from './src/pages/customer/ContractedAnalysisReport';
import { CustomerOrders } from './src/pages/customer/Orders';
import { Fleet } from './src/pages/customer/Fleet';
import { Shipments } from './src/pages/customer/Shipments';
import { Finance } from './src/pages/customer/Finance';
import { Sustainability } from './src/pages/customer/Sustainability';
import { Business } from './src/pages/customer/Business';
import { GuestRFQPage } from './src/pages/guest/RFQ';
import { SupportTickets } from './src/pages/shared/SupportTickets';

// Supplier Pages
import { SupplierDashboard } from './src/pages/supplier/Dashboard';
import { SupplierLogistics } from './src/pages/supplier/Logistics';

// Admin Pages
import { SystemHealth } from './src/pages/admin/SystemHealth';
import { Security } from './src/pages/admin/Security';
import { UserManagement } from './src/pages/admin/UserManagement';
import { EntityManagement } from './src/pages/admin/EntityManagement';
import { ReportManagement } from './src/pages/admin/ReportManagement';
import { VesselManagement } from './src/pages/admin/VesselManagement';
import { MaritimeMap } from './src/pages/admin/MaritimeMap';
import { MaritimeOperationDetail } from './src/pages/admin/MaritimeOperationDetail';
import { SupportTicketManagement } from './src/pages/admin/SupportTicketManagement';
import { TemplateManagement } from './src/pages/admin/TemplateManagement';
import { UserTemplateManagement } from './src/pages/customer/UserTemplateManagement';
import { Permission, UserRole } from './src/types';
import { getDefaultRouteForUser, hasPermissions, hasRoleAccess, isPendingAccessUser } from './src/utils/rbac';
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
  const location = useLocation();
  
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname !== '/access-pending' && isPendingAccessUser(user)) {
    return <Navigate to="/access-pending" replace />;
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
          <Route path="/access-pending" element={<ProtectedRoute><AccessPending /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/guest/rfq" element={<ProtectedRoute allowedRoles={['user']} requiredPermissions={['submit:rfq']}><GuestRFQPage /></ProtectedRoute>} />
          <Route path="/support/tickets" element={<ProtectedRoute allowedRoles={['user', 'admin']} requiredPermissions={['create:support-ticket']}><SupportTickets /></ProtectedRoute>} />

          {/* Customer Routes */}
          <Route path="/customer">
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:dashboard']}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="operational-list" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:operational-list']}><OperationalList /></ProtectedRoute>} />
            <Route path="invoices" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:invoices']}><InvoiceList /></ProtectedRoute>} />
            <Route path="port-fees" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:port-fees']}><PortFeeList /></ProtectedRoute>} />
            <Route path="historical-orders" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:orders']}><HistoricalOrders /></ProtectedRoute>} />
            
            <Route path="reports/analysis" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:reports']}><ContractedAnalysisReport /></ProtectedRoute>} />
            <Route path="analytics" element={<Navigate to="/customer/reports/analysis" replace />} />
            <Route path="fleet" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:fleet']}><Fleet /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:orders']}><CustomerOrders /></ProtectedRoute>} />
            <Route path="shipments" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:shipments']}><Shipments /></ProtectedRoute>} />
            <Route path="finance" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:finance']}><Finance /></ProtectedRoute>} />
            <Route path="sustainability" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:sustainability']}><Sustainability /></ProtectedRoute>} />
            <Route path="business" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:business']}><Business /></ProtectedRoute>} />
          </Route>

          {/* Supplier Routes */}
          <Route path="/supplier">
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:supplier']}><SupplierDashboard /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:supplier']}><div className="p-6">Supplier Orders View</div></ProtectedRoute>} />
            <Route path="logistics" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:supplier']}><SupplierLogistics /></ProtectedRoute>} />
            <Route path="performance" element={<ProtectedRoute allowedRoles={['user', 'admin', 'supadmin']} requiredPermissions={['view:supplier']}><div className="p-6">Performance Scorecards</div></ProtectedRoute>} />
          </Route>

          {/* Admin-only customer routes */}
          <Route path="/company/user-templates" element={<ProtectedRoute allowedRoles={['admin']} requiredPermissions={['manage:templates']}><UserTemplateManagement /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin">
            <Route path="security" element={<ProtectedRoute allowedRoles={['admin', 'supadmin']} requiredPermissions={['system:settings']}><Security /></ProtectedRoute>} />
            <Route path="system-health" element={<ProtectedRoute allowedRoles={['admin', 'supadmin']} requiredPermissions={['system:settings']}><SystemHealth /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute allowedRoles={['admin', 'supadmin']} requiredPermissions={['manage:users']}><UserManagement /></ProtectedRoute>} />
            <Route path="entities" element={<ProtectedRoute allowedRoles={['supadmin']} requiredPermissions={['manage:companies']}><EntityManagement /></ProtectedRoute>} />
            <Route path="vessels" element={<ProtectedRoute allowedRoles={['supadmin']} requiredPermissions={['manage:vessels']}><VesselManagement /></ProtectedRoute>} />
            <Route path="maritime-map" element={<ProtectedRoute allowedRoles={['supadmin']} requiredPermissions={['view:maritime-map']}><MaritimeMap /></ProtectedRoute>} />
            <Route path="maritime-map/operations/:vesselId" element={<ProtectedRoute allowedRoles={['supadmin']} requiredPermissions={['view:maritime-map']}><MaritimeOperationDetail /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute allowedRoles={['supadmin']}><ReportManagement /></ProtectedRoute>} />
            <Route path="support-tickets" element={<ProtectedRoute allowedRoles={['supadmin']}><SupportTicketManagement /></ProtectedRoute>} />
            <Route path="templates" element={<ProtectedRoute allowedRoles={['supadmin']} requiredPermissions={['manage:templates']}><TemplateManagement /></ProtectedRoute>} />
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
