'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { UserIP } from '@/lib/security/types';

// Dynamic imports for Leaflet components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false }) as any;
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false }) as any;
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false }) as any;
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false }) as any;

// Dynamic import for LiveMapController to avoid SSR issues with useMap
const LiveMapController = dynamic(() => import('./LiveMapController'), { ssr: false });

interface LiveMapProps {
  ips: UserIP[];
  focusedUserId?: string | null;
}

export default function LiveMap({ ips, focusedUserId }: LiveMapProps) {
  const [mounted, setMounted] = useState(false);
  const [icons, setIcons] = useState<{ gps: any; ip: any } | null>(null);

  useEffect(() => {
    // Fix for Leaflet default icon not showing
    const fixLeafletIcon = async () => {
      try {
        const L = (await import('leaflet')).default;
        
        // Define custom icons
        const gpsIcon = L.divIcon({
          className: 'custom-gps-icon',
          html: `<div style="background-color: #22c55e; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.3);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          popupAnchor: [0, -10]
        });

        const ipIcon = L.divIcon({
          className: 'custom-ip-icon',
          html: `<div style="background-color: #64748b; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
          popupAnchor: [0, -10]
        });

        setIcons({ gps: gpsIcon, ip: ipIcon });

        // @ts-ignore
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });
      } catch (e) {
        console.error('Leaflet icon fix failed', e);
      }
    };
    
    fixLeafletIcon();
    setMounted(true);
  }, []);

  if (!mounted || !icons) return <div className="h-96 w-full animate-pulse bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">Cargando mapa...</div>;

  // Filter IPs with valid coordinates
  const validIps = ips.filter(ip => ip.latitude && ip.longitude);
  const gpsCount = validIps.filter(ip => !ip.is_approximate).length;
  // Default center: Xalapa, Veracruz (requested by user)
  const defaultCenter: [number, number] = [19.5438, -96.9102];

  // Determine target center and zoom based on focused user
  const focusedIp = focusedUserId ? validIps.find(ip => ip.user_id === focusedUserId) : null;
  // If focused, fly to user. If not focused, fly back to default center (Mexico view)
  const targetCenter: [number, number] | null = focusedIp 
    ? [focusedIp.latitude!, focusedIp.longitude!] 
    : defaultCenter;
  const targetZoom = focusedIp ? 15 : 4;

  return (
    <div className="flex flex-col gap-2">
      <div className="h-96 w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm relative z-0">
        <MapContainer center={defaultCenter} zoom={4} style={{ height: '100%', width: '100%' }}>
          <LiveMapController center={targetCenter} zoom={targetZoom} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {/* Direct mapping without cluster for stability */}
          {validIps.map((ip) => {
            // If a user is focused, ONLY show that user. Otherwise show all.
            if (focusedUserId && ip.user_id !== focusedUserId) return null;

            const isFocused = focusedUserId === ip.user_id;

            return (
            <Marker 
              key={ip.id} 
              position={[ip.latitude!, ip.longitude!]}
              icon={ip.is_approximate ? icons.ip : icons.gps}
              zIndexOffset={ip.is_approximate ? 0 : 1000} // Ensure GPS is always on top
              eventHandlers={{
                add: (e) => {
                  if (isFocused) e.target.openPopup();
                }
              }}
            >
              <Popup>
                <div className="text-xs font-sans">
                  <strong className="block text-sm mb-1 flex items-center gap-2">
                    <span>{ip.city || 'Desconocido'}, {ip.country}</span>
                    {ip.is_approximate ? (
                      <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800 border border-yellow-200">
                        Aprox
                      </span>
                    ) : (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800 border border-green-200 flex items-center gap-1">
                        📍 GPS
                      </span>
                    )}
                  </strong>
                  {ip.is_approximate && (
                    <span className="block mb-1 text-[10px] text-gray-500 italic">
                      Ubicación basada en dirección del perfil o IP
                    </span>
                  )}
                  {!ip.is_approximate && (
                    <span className="block mb-1 text-[10px] text-green-600 font-medium">
                      Ubicación precisa verificada por navegador
                    </span>
                  )}
                  <span className="block text-gray-600">IP: {ip.ip_address}</span>
                  <span className="block text-gray-600">ISP: {ip.isp || 'N/A'}</span>
                  <span className="block text-gray-500 text-[10px] mt-1">{new Date(ip.detected_at).toLocaleString()}</span>
                  <a href={`/admin/usuarios?q=${ip.user_id}`} target="_blank" className="block mt-2 text-blue-600 hover:underline">Ver Usuario</a>
                </div>
              </Popup>
            </Marker>
            );
          })}
        </MapContainer>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white0 border border-green-600"></div>
          <span>GPS ({gpsCount})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-600"></div>
          <span>IP Aprox ({validIps.length - gpsCount})</span>
        </div>
        <div className="ml-auto">
          Total visibles: {validIps.length} / {ips.length} activos
        </div>
      </div>
    </div>
  );
}
