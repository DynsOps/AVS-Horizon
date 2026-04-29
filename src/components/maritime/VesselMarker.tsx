import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Vessel, VesselPosition } from '../../types';

type Props = {
  vessel: Vessel;
  position: VesselPosition;
  isSelected: boolean;
  onClick: () => void;
};

const createShipIcon = (heading: number, isSelected: boolean) => {
  const color = '#10b981';
  const size = isSelected ? 34 : 28;
  const ringSize = isSelected ? 44 : 36;

  return L.divIcon({
    className: '',
    iconSize: [ringSize, ringSize],
    iconAnchor: [ringSize / 2, ringSize / 2],
    html: `<div style="position:relative;width:${ringSize}px;height:${ringSize}px;display:flex;align-items:center;justify-content:center;">
      <span style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:${isSelected ? 0.25 : 0.15};${isSelected ? 'animation:avs-pulse 1.6s ease-out infinite;' : ''}"></span>
      <span style="position:absolute;inset:${Math.floor((ringSize - size) / 2)}px;border-radius:50%;background:${color};opacity:0.25;"></span>
      <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
        <svg width="${size - 8}" height="${size - 8}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2 L17 14 L12 12 L7 14 Z" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="12" cy="8" r="1.3" fill="#fff"/>
        </svg>
      </div>
    </div>`,
  });
};

export const VesselMarker: React.FC<Props> = ({ vessel, position, isSelected, onClick }) => {
  const icon = createShipIcon(position.heading, isSelected);

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={icon}
      eventHandlers={{ click: onClick }}
      zIndexOffset={isSelected ? 1000 : 0}
    >
      <Tooltip direction="top" offset={[0, -18]} opacity={0.95}>
        <div className="text-xs">
          <p className="font-semibold">{vessel.name}</p>
          <p>{position.speed > 0 ? `${position.speed} kn · ${position.navStatus}` : position.navStatus}</p>
          {position.destination && <p className="text-slate-500">→ {position.destination}</p>}
        </div>
      </Tooltip>
    </Marker>
  );
};
