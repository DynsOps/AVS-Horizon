import React from 'react';
import { CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import { VesselRoute } from '../../types';

type Props = {
  route: VesselRoute;
  departureCoords: [number, number];
  arrivalCoords: [number, number];
  vesselName?: string;
};

const statusStyles: Record<string, { color: string; dashArray?: string }> = {
  'In Progress': { color: '#3b82f6', dashArray: '10 7' },
  Completed: { color: '#6b7280', dashArray: '4 8' },
  Planned: { color: '#f59e0b', dashArray: '8 12' },
  Cancelled: { color: '#ef4444', dashArray: '4 8' },
};

export const RoutePolyline: React.FC<Props> = ({ route, departureCoords, arrivalCoords, vesselName }) => {
  const style = statusStyles[route.status] || statusStyles['In Progress'];

  return (
    <>
      <Polyline
        positions={[departureCoords, arrivalCoords]}
        pathOptions={{
          color: style.color,
          weight: 3,
          opacity: 0.9,
          dashArray: style.dashArray,
        }}
      >
        <Tooltip sticky>
          <div className="text-xs">
            {vesselName && <p className="font-semibold">{vesselName}</p>}
            <p className="font-semibold">{route.departurePort} → {route.arrivalPort}</p>
            <p className="text-slate-500">{route.status}</p>
          </div>
        </Tooltip>
      </Polyline>

      <CircleMarker
        center={departureCoords}
        radius={5}
        pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.95, weight: 2 }}
      >
        <Tooltip direction="top" offset={[0, -8]}>
          <div className="text-xs font-semibold">Departure: {route.departurePort}</div>
        </Tooltip>
      </CircleMarker>

      <CircleMarker
        center={arrivalCoords}
        radius={5}
        pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.95, weight: 2 }}
      >
        <Tooltip direction="top" offset={[0, -8]}>
          <div className="text-xs font-semibold">Arrival: {route.arrivalPort}</div>
        </Tooltip>
      </CircleMarker>
    </>
  );
};
