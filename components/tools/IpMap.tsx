'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// Dynamic imports for Leaflet components
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false }) as any;
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false }) as any;
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false }) as any;
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false }) as any;

// Dynamic import for MapController to avoid SSR issues with useMap
const MapController = dynamic(() => import('./MapController'), { ssr: false });

interface IpMapProps {
  lat: number;
  lon: number;
  ip: string;
  city: string;
  country: string;
}

export default function IpMap({ lat, lon, ip, city, country }: IpMapProps) {
  const [icon, setIcon] = useState<any>(null);

  useEffect(() => {
    const fixLeafletIcon = async () => {
      try {
        const L = (await import('leaflet')).default;
        
        // Custom Pulse Icon
        const customIcon = L.divIcon({
          className: 'custom-gps-icon',
          html: `<div style="
            background-color: #ef4444; 
            width: 16px; 
            height: 16px; 
            border-radius: 50%; 
            border: 2px solid white; 
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3);
            animation: pulse 2s infinite;
          "></div>
          <style>
            @keyframes pulse {
              0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
              70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
              100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
          </style>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          popupAnchor: [0, -10]
        });

        setIcon(customIcon);
      } catch (e) {
        console.error('Leaflet icon fix failed', e);
      }
    };

    fixLeafletIcon();
  }, []);

  if (!icon) return <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400">Cargando mapa...</div>;

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden shadow-lg border border-gray-200 z-0 relative">
      <MapContainer
        center={[lat, lon]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <MapController center={[lat, lon]} zoom={13} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lon]} icon={icon}>
          <Popup>
            <div className="text-center">
              <div className="font-bold text-lg">{ip}</div>
              <div className="text-gray-600">{city}, {country}</div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
