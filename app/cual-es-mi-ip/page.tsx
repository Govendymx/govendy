'use client';

import { useEffect, useState } from 'react';
import IpMap from '@/components/tools/IpMap';
import { Globe, ShieldCheck, Server, MapPin, Wifi } from 'lucide-react';

interface IpData {
  ip: string;
  city: string;
  region: string;
  country_name: string;
  postal: string;
  latitude: number;
  longitude: number;
  org: string;
  asn: string;
}

export default function CualEsMiIpPage() {
  const [data, setData] = useState<IpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) throw new Error('Error al obtener datos de IP');
        const jsonData = await res.json();
        setData(jsonData);
      } catch (err) {
        setError('No pudimos detectar tu IP automáticamente.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchIp();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            ¿Cuál es mi <span className="text-pink-600">IP</span>?
          </h1>
          <p className="mt-4 text-xl text-gray-500">
            Herramienta de geolocalización y diagnóstico de red
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-pink-600 mb-4"></div>
            <p className="text-gray-600">Rastreando señal...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Main IP Card */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all hover:scale-[1.01]">
              <div className="bg-gradient-to-r from-pink-600 to-purple-600 p-8 text-white text-center">
                <div className="text-sm font-medium opacity-90 uppercase tracking-wider mb-2">Tu Dirección IP Pública es</div>
                <div className="text-5xl md:text-6xl font-black font-mono tracking-tight">{data.ip}</div>
                <div className="mt-4 flex items-center justify-center space-x-2 bg-white/20 rounded-full px-4 py-1 w-fit mx-auto backdrop-blur-sm">
                  <ShieldCheck size={18} />
                  <span className="font-medium">Conexión Segura Detectada</span>
                </div>
              </div>
              
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Map Section */}
                  <div className="rounded-xl overflow-hidden border border-gray-100 shadow-inner">
                    <IpMap 
                      lat={data.latitude} 
                      lon={data.longitude} 
                      ip={data.ip} 
                      city={data.city} 
                      country={data.country_name} 
                    />
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 gap-4 content-center">
                    <InfoCard 
                      icon={<MapPin className="text-pink-500" />} 
                      label="Ubicación" 
                      value={`${data.city}, ${data.region}`} 
                      subValue={data.country_name}
                    />
                    <InfoCard 
                      icon={<Wifi className="text-blue-500" />} 
                      label="Proveedor (ISP)" 
                      value={data.org} 
                      subValue={data.asn}
                    />
                    <InfoCard 
                      icon={<Globe className="text-green-500" />} 
                      label="Coordenadas" 
                      value={`${data.latitude}, ${data.longitude}`} 
                      subValue="Latitud / Longitud"
                    />
                    <InfoCard 
                      icon={<Server className="text-purple-500" />} 
                      label="Código Postal" 
                      value={data.postal || 'No disponible'} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-2">¿Qué es una IP?</h3>
                <p className="text-sm text-gray-600">Es tu identificador único en internet, similar a una dirección postal digital que permite recibir información.</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-2">Privacidad</h3>
                <p className="text-sm text-gray-600">Esta información es pública. Para ocultarla, te recomendamos usar una VPN segura.</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-2">Precisión</h3>
                <p className="text-sm text-gray-600">La geolocalización por IP es aproximada y generalmente apunta a la central de tu proveedor de internet.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value, subValue }: { icon: any, label: string, value: string, subValue?: string }) {
  return (
    <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="p-2 bg-white rounded-lg shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        {subValue && <p className="text-sm text-gray-500">{subValue}</p>}
      </div>
    </div>
  );
}
