'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell
} from 'recharts';
import { Loader2, Download, TrendingUp, Search, Share2, Heart, Eye, ShoppingBag, User, AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import * as XLSX from 'xlsx';

type Period = '24h' | '7d' | '30d' | 'all';

interface AdvancedMetricsProps {
  initialPeriod?: Period;
}

const COLORS = ['#FF4081', '#F50057', '#C51162', '#880E4F', '#AD1457', '#D81B60'];

const TrendIndicator = ({ value }: { value?: number }) => {
  if (value === undefined || value === null) return <span className="text-gray-300"><Minus className="w-3 h-3" /></span>;
  
  if (value > 0) {
    return (
      <span className="flex items-center text-green-600 text-xs font-medium">
        <ArrowUp className="w-3 h-3 mr-0.5" />
        {value}%
      </span>
    );
  }
  
  if (value < 0) {
    return (
      <span className="flex items-center text-red-500 text-xs font-medium">
        <ArrowDown className="w-3 h-3 mr-0.5" />
        {Math.abs(value)}%
      </span>
    );
  }

  return <span className="text-gray-400 text-xs"><Minus className="w-3 h-3" /></span>;
};

const TrendAlerts = ({ data }: { data: Record<string, any[]> }) => {
  const alerts = useMemo(() => {
    const allAlerts: { type: string; message: string; severity: 'high' | 'medium' }[] = [];
    
    // Check searches
    data.searches?.slice(0, 5).forEach(item => {
      if (item.trend >= 50) {
        allAlerts.push({
          type: 'search',
          message: `Tendencia de búsqueda: "${item.term}" subió un ${item.trend}%`,
          severity: item.trend > 100 ? 'high' : 'medium'
        });
      }
    });

    // Check products
    data.products?.slice(0, 5).forEach(item => {
      if (item.trend >= 50) {
        allAlerts.push({
          type: 'product',
          message: `Ventas disparadas: "${item.name}" subió un ${item.trend}%`,
          severity: item.trend > 100 ? 'high' : 'medium'
        });
      }
    });

    // Check views
    data.views?.slice(0, 5).forEach(item => {
      if (item.trend >= 100) {
        allAlerts.push({
          type: 'view',
          message: `Viral: "${item.name}" aumentó vistas en ${item.trend}%`,
          severity: 'high'
        });
      }
    });

    return allAlerts.slice(0, 4); // Limit to 4 alerts
  }, [data]);

  if (alerts.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {alerts.map((alert, i) => (
        <div key={i} className={`p-3 rounded-lg border flex items-start gap-3 ${
          alert.severity === 'high' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-blue-50 border-blue-100 text-blue-800'
        }`}>
          <TrendingUp className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm font-medium leading-tight">{alert.message}</div>
        </div>
      ))}
    </div>
  );
};

export function AdvancedMetrics({ initialPeriod = '30d' }: AdvancedMetricsProps) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [data, setData] = useState<Record<string, any[]>>({
    searches: [],
    products: [],
    sellers: [],
    views: [],
    shares: [],
    likes: []
  });

  const fetchData = async (type: string, key: string) => {
    // Don't set global loading on refresh to avoid flickering, only on initial load/change
    if (data[key].length === 0) setLoading(prev => ({ ...prev, [key]: true }));
    
    try {
      const res = await fetch(`/api/admin/metrics/advanced?type=${type}&period=${period}&limit=50`);
      const json = await res.json();
      if (json.data) {
        setData(prev => ({ ...prev, [key]: json.data }));
      }
    } catch (err) {
      console.error(`Error fetching ${type}:`, err);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const refreshAll = () => {
    fetchData('top-searches', 'searches');
    fetchData('top-products', 'products');
    fetchData('top-sellers', 'sellers');
    fetchData('most-viewed', 'views');
    fetchData('most-shared', 'shares');
    fetchData('most-liked', 'likes');
    setLastUpdated(new Date());
  };

  useEffect(() => {
    refreshAll();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, [period]);

  const downloadExcel = (data: any[], filename: string) => {
    if (!data || !data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}_${period}.xlsx`);
  };

  const SectionHeader = ({ title, icon: Icon, onExport }: any) => (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
        <Icon className="w-5 h-5 text-brand-orange" />
        {title}
      </h3>
      <button 
        onClick={onExport}
        className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-800 border rounded px-2 py-1 transition-colors"
      >
        <Download className="w-3 h-3" />
        Exportar
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm border border-gray-100 sticky top-4 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-orange/10 rounded-lg">
            <TrendingUp className="w-6 h-6 text-brand-orange" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Métricas Avanzadas</h2>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              Actualizado: {lastUpdated.toLocaleTimeString()}
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1" title="En vivo" />
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
          {(['24h', '7d', '30d', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                period === p 
                  ? 'bg-white text-brand-orange shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {p === '24h' ? '24h' : 
               p === '7d' ? '7 días' : 
               p === '30d' ? '30 días' : 
               'Todo'}
            </button>
          ))}
        </div>
      </div>

      <TrendAlerts data={data} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. Top Searches */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <SectionHeader title="Términos más buscados" icon={Search} onExport={() => downloadExcel(data.searches, 'top_searches')} />
          {loading.searches ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.searches.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="term" type="category" width={100} tick={{fontSize: 12}} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#FF4081" radius={[0, 4, 4, 0]}>
                      {data.searches.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                    <tr>
                      <th className="text-left py-2">Término</th>
                      <th className="text-right py-2">Volumen</th>
                      <th className="text-right py-2">Tendencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.searches.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 text-gray-700">{item.term}</td>
                        <td className="py-2 text-right font-medium">{item.count}</td>
                        <td className="py-2 text-right flex justify-end"><TrendIndicator value={item.trend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* 2. Top Products */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <SectionHeader title="Productos más vendidos" icon={ShoppingBag} onExport={() => downloadExcel(data.products, 'top_products')} />
          {loading.products ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.products.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis />
                    <RechartsTooltip />
                    <Area type="monotone" dataKey="sales" stroke="#F50057" fill="#F50057" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                    <tr>
                      <th className="text-left py-2">Producto</th>
                      <th className="text-right py-2">Ventas</th>
                      <th className="text-right py-2">Ingresos</th>
                      <th className="text-right py-2">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 flex flex-col">
                          <span className="truncate max-w-[150px]" title={item.name}>{item.name}</span>
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            {item.id.slice(0,6)}...
                            <CopyButton text={item.id} size="sm" iconSize={10} />
                          </div>
                        </td>
                        <td className="py-2 text-right font-medium">{item.sales}</td>
                        <td className="py-2 text-right text-green-600">${item.revenue.toLocaleString()}</td>
                        <td className="py-2 text-right flex justify-end"><TrendIndicator value={item.trend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* 3. Top Sellers */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <SectionHeader title="Mejores Vendedores" icon={User} onExport={() => downloadExcel(data.sellers, 'top_sellers')} />
          {loading.sellers ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.sellers.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="revenue" fill="#880E4F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                    <tr>
                      <th className="text-left py-2">Vendedor</th>
                      <th className="text-right py-2">Ventas</th>
                      <th className="text-right py-2">Total</th>
                      <th className="text-right py-2">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sellers.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 flex flex-col">
                          <span className="font-medium">{item.name}</span>
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            {item.id.slice(0,6)}...
                            <CopyButton text={item.id} size="sm" iconSize={10} />
                          </div>
                        </td>
                        <td className="py-2 text-right">{item.sales}</td>
                        <td className="py-2 text-right font-bold text-green-600">${item.revenue.toLocaleString()}</td>
                        <td className="py-2 text-right flex justify-end"><TrendIndicator value={item.trend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* 4. Most Viewed */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <SectionHeader title="Más Vistos" icon={Eye} onExport={() => downloadExcel(data.views, 'most_viewed')} />
          {loading.views ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.views.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="views" stroke="#FF4081" strokeWidth={2} dot={{r: 4}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
               <div className="mt-4 max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                    <tr>
                      <th className="text-left py-2">Producto</th>
                      <th className="text-right py-2">Vistas</th>
                      <th className="text-right py-2">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.views.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 flex flex-col">
                          <span className="truncate max-w-[180px]" title={item.name}>{item.name}</span>
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                             {item.id.slice(0,6)}...
                             <CopyButton text={item.id} size="sm" iconSize={10} />
                          </div>
                        </td>
                        <td className="py-2 text-right font-medium">{item.views}</td>
                        <td className="py-2 text-right flex justify-end"><TrendIndicator value={item.trend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* 5. Most Shared */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <SectionHeader title="Más Compartidos" icon={Share2} onExport={() => downloadExcel(data.shares, 'most_shared')} />
          {loading.shares ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
             <>
               <div className="h-64 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={data.shares.slice(0, 10)}>
                     <CartesianGrid strokeDasharray="3 3" />
                     <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                     <YAxis />
                     <RechartsTooltip />
                     <Bar dataKey="shares" fill="#2196F3" radius={[4, 4, 0, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
               <div className="mt-4 max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                    <tr>
                      <th className="text-left py-2">Producto</th>
                      <th className="text-right py-2">Compartidos</th>
                      <th className="text-right py-2">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shares.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 flex flex-col">
                          <span className="truncate max-w-[180px]" title={item.name}>{item.name}</span>
                           <div className="flex items-center gap-1 text-[10px] text-gray-400">
                             {item.id.slice(0,6)}...
                             <CopyButton text={item.id} size="sm" iconSize={10} />
                           </div>
                        </td>
                        <td className="py-2 text-right font-medium">{item.shares}</td>
                        <td className="py-2 text-right flex justify-end"><TrendIndicator value={item.trend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
             </>
          )}
        </div>

        {/* 6. Most Liked */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <SectionHeader title="Más Favoritos" icon={Heart} onExport={() => downloadExcel(data.likes, 'most_liked')} />
          {loading.likes ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
             <>
               <div className="h-64 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={data.likes.slice(0, 10)}>
                     <CartesianGrid strokeDasharray="3 3" />
                     <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                     <YAxis />
                     <RechartsTooltip />
                     <Bar dataKey="likes" fill="#E91E63" radius={[4, 4, 0, 0]} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
               <div className="mt-4 max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                    <tr>
                      <th className="text-left py-2">Producto</th>
                      <th className="text-right py-2">Likes</th>
                      <th className="text-right py-2">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.likes.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 flex flex-col">
                          <span className="truncate max-w-[180px]" title={item.name}>{item.name}</span>
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                             {item.id.slice(0,6)}...
                             <CopyButton text={item.id} size="sm" iconSize={10} />
                           </div>
                        </td>
                        <td className="py-2 text-right font-medium">{item.likes}</td>
                        <td className="py-2 text-right flex justify-end"><TrendIndicator value={item.trend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
             </>
          )}
        </div>

      </div>
    </div>
  );
}
