
import React, { Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './src/store/authStore';
import { useThemeStore } from './src/store/themeStore';
import { Login } from './src/pages/Login';
import { AppShell } from './src/layouts/AppShell';
import { Permission, UserRole } from './src/types';
import { getDefaultRouteForUser, hasPermissions, hasRoleAccess, isPendingAccessUser } from './src/utils/rbac';
import { MsalAuthBridge } from './src/auth/MsalAuthBridge';
import { SCREEN_REGISTRY } from './src/screenRegistry';

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

        <Route element={<AppShell />}>
          {SCREEN_REGISTRY.map((entry) => {
            const PageComponent = entry.component;
            return (
              <Route
                key={entry.id}
                path={entry.path}
                element={
                  <ProtectedRoute
                    allowedRoles={entry.allowedRoles}
                    requiredPermissions={entry.permissions.length > 0 ? entry.permissions : undefined}
                  >
                    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
                      <PageComponent />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
            );
          })}

          {/* Legacy redirect */}
          <Route path="/customer/analytics" element={<Navigate to="/customer/reports/analysis" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
