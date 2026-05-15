'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function DiagnosticoPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/diagnostico');
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      toast.error('Error cargando diagnóstico: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFix = async () => {
    setFixing(true);
    try {
      const res = await fetch('/api/admin/fix-data', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Reparación completada: ${json.pro_fixed} PROs, ${json.stores_fixed} Tiendas`);
        loadData();
      } else {
        toast.error('Error al reparar: ' + json.error);
      }
    } catch (e: any) {
      toast.error('Error de conexión: ' + e.message);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Diagnóstico de Base de Datos</h1>
      
      <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h2 className="font-semibold text-yellow-800 mb-2">Herramienta de Reparación</h2>
        <p className="text-sm text-yellow-700 mb-4">
          Si los usuarios PRO o Tiendas Oficiales no aparecen, haz clic en el botón de abajo para forzar la actualización de sus estados.
        </p>
        <button
          onClick={handleFix}
          disabled={fixing}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {fixing ? 'Reparando...' : '🔄 Reparar Datos Automáticamente'}
        </button>
      </div>

      {loading ? (
        <div>Cargando diagnóstico...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded border ${data?.checks?.pro_columns === 'OK' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <h3 className="font-bold">Columnas PRO</h3>
              <p>{data?.checks?.pro_columns}</p>
            </div>
            <div className={`p-4 rounded border ${data?.checks?.store_columns === 'OK' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <h3 className="font-bold">Columnas Tiendas</h3>
              <p>{data?.checks?.store_columns}</p>
            </div>
          </div>

          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-[500px]">
            <pre className="text-xs font-mono">{JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
