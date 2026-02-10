
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
import { CustomerOrders } from './src/pages/customer/Orders';
import { Fleet } from './src/pages/customer/Fleet';
import { Shipments } from './src/pages/customer/Shipments';
import { Finance } from './src/pages/customer/Finance';
import { Analytics } from './src/pages/customer/Analytics';

// Supplier Pages
import { SupplierDashboard } from './src/pages/supplier/Dashboard';
import { SupplierLogistics } from './src/pages/supplier/Logistics';

// Admin Pages
import { SystemHealth } from './src/pages/admin/SystemHealth';
import { Security } from './src/pages/admin/Security';
import { UserManagement } from './src/pages/admin/UserManagement';
import { CompanyManagement } from './src/pages/admin/CompanyManagement';

// Guard Component
const ProtectedRoute = ({ children, allowedRoles }: { children?: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If no specific roles are required (e.g., Profile page available to all authenticated users)
  if (!allowedRoles || allowedRoles.length === 0) {
      return <>{children}</>;
  }

  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'Customer') return <Navigate to="/customer/dashboard" replace />;
    if (user.role === 'Supplier') return <Navigate to="/supplier/dashboard" replace />;
    if (user.role === 'Admin') return <Navigate to="/admin/system-health" replace />;
    return <Navigate to="/login" replace />;
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
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected App Shell */}
        <Route element={<AppShell />}>
          
          {/* Common Routes */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Customer Routes */}
          <Route path="/customer">
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['Customer']}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="fleet" element={<ProtectedRoute allowedRoles={['Customer']}><Fleet /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute allowedRoles={['Customer']}><CustomerOrders /></ProtectedRoute>} />
            <Route path="shipments" element={<ProtectedRoute allowedRoles={['Customer']}><Shipments /></ProtectedRoute>} />
            <Route path="finance" element={<ProtectedRoute allowedRoles={['Customer']}><Finance /></ProtectedRoute>} />
            <Route path="sustainability" element={<ProtectedRoute allowedRoles={['Customer']}><div className="p-6">Sustainability Module (Coming Soon)</div></ProtectedRoute>} />
            <Route path="analytics" element={<ProtectedRoute allowedRoles={['Customer']}><Analytics /></ProtectedRoute>} />
          </Route>

          {/* Supplier Routes */}
          <Route path="/supplier">
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['Supplier']}><SupplierDashboard /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute allowedRoles={['Supplier']}><div className="p-6">Supplier Orders View</div></ProtectedRoute>} />
            <Route path="logistics" element={<ProtectedRoute allowedRoles={['Supplier']}><SupplierLogistics /></ProtectedRoute>} />
            <Route path="performance" element={<ProtectedRoute allowedRoles={['Supplier']}><div className="p-6">Performance Scorecards</div></ProtectedRoute>} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin">
            <Route path="security" element={<ProtectedRoute allowedRoles={['Admin']}><Security /></ProtectedRoute>} />
            <Route path="system-health" element={<ProtectedRoute allowedRoles={['Admin']}><SystemHealth /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute allowedRoles={['Admin']}><UserManagement /></ProtectedRoute>} />
            <Route path="companies" element={<ProtectedRoute allowedRoles={['Admin']}><CompanyManagement /></ProtectedRoute>} />
            <Route path="feature-flags" element={<ProtectedRoute allowedRoles={['Admin']}><div className="p-6">Feature Flags Management</div></ProtectedRoute>} />
          </Route>

        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
