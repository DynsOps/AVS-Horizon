import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { MapWidget } from '../../components/maritime/MapWidget';
import { FleetMandayReportWidget } from '../../components/customer/FleetMandayReportWidget';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const isSupadmin = user?.role === 'supadmin';
  const canViewFleet = user?.permissions?.includes('view:fleet') ?? false;

  return (
    <div className="space-y-6">
      {isSupadmin && <MapWidget />}
      {canViewFleet && <FleetMandayReportWidget />}
    </div>
  );
};
