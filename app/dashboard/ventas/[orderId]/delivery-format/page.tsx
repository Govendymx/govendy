'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function DeliveryFormatPage() {
  const params = useParams();
  const orderId = params?.orderId as string;
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [buyer, setBuyer] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!orderId) return;
      try {
        setLoading(true);
        // Fetch order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;
        setOrder(orderData);

        // Fetch items
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderId);

        if (itemsError) throw itemsError;
        setItems(itemsData || []);

        // Fetch buyer
        if (orderData.buyer_id) {
          const { data: buyerData } = await supabase
            .from('profiles')
            .select('full_name, email, city, state')
            .eq('id', orderData.buyer_id)
            .single();
          setBuyer(buyerData);
        }

        // Fetch seller
        if (orderData.seller_id) {
          const { data: sellerData } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', orderData.seller_id)
            .single();
          setSeller(sellerData);
        }

      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId]);

  if (loading) return <div className="p-8 text-center">Cargando formato...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  if (!order) return <div className="p-8 text-center">Orden no encontrada</div>;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('printable-area');
    if (!element) return;
    
    try {
      setGeneratingPdf(true);
      const canvas = await html2canvas(element, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff'
      } as any);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`constancia-entrega-${order.id.slice(0, 8)}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error al generar PDF. Por favor utiliza la opción de Imprimir.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const currentDate = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl bg-white shadow-lg print:shadow-none">
        
        <div id="printable-area" className="p-12">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-6">
            <div className="flex items-center gap-3">
               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-emerald text-white font-bold text-xl print:text-black print:bg-transparent print:border print:border-black">
                 GP
               </div>
               <div>
                 <h1 className="text-xl font-bold text-gray-900">GoVendy</h1>
                 <p className="text-sm text-gray-500">Constancia de Entrega Personal</p>
               </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">Orden #{order.id.slice(0, 8)}</p>
              <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString('es-MX')}</p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6 text-gray-800">
            <p className="text-justify leading-relaxed">
              En la ciudad de <strong>{buyer?.city || '________________'}</strong>, estado de <strong>{buyer?.state || '________________'}</strong>, 
              a los <strong>{new Date().getDate()}</strong> días del mes de <strong>{new Date().toLocaleString('es-MX', { month: 'long' })}</strong> del año <strong>{new Date().getFullYear()}</strong>.
            </p>

            <p className="text-justify leading-relaxed">
              Por medio de la presente, yo <strong>{buyer?.full_name || '(Nombre del Comprador)'}</strong> (Comprador), confirmo haber recibido 
              a mi entera satisfacción los productos descritos a continuación por parte de <strong>{seller?.full_name || '(Nombre del Vendedor)'}</strong> (Vendedor), 
              correspondientes a la transacción realizada a través de la plataforma <strong>GoVendy</strong>.
            </p>

            {/* Items Table */}
            <div className="my-8 overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-900">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold text-center">Cant.</th>
                    <th className="px-4 py-3 font-semibold text-right">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.title}</div>
                        {(item.selected_size || item.selected_color) && (
                          <div className="text-xs text-gray-500">
                            {item.selected_size && `Talla: ${item.selected_size} `}
                            {item.selected_color && `Color: ${item.selected_color}`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        ${(item.line_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold text-gray-900">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right">Total</td>
                    <td className="px-4 py-3 text-right">
                      ${(order.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="text-justify text-sm text-gray-600">
              Al firmar este documento, el Comprador libera al Vendedor y a la plataforma GoVendy de cualquier reclamación futura relacionada con la entrega física de estos productos, 
              aceptando que los mismos se encuentran en las condiciones descritas en la publicación.
            </p>

            {/* Signatures */}
            <div className="mt-16 grid grid-cols-2 gap-12">
              <div className="text-center">
                <div className="mx-auto mb-2 h-24 w-48 border-b border-black"></div>
                <p className="font-bold text-gray-900">{seller?.full_name || 'Vendedor'}</p>
                <p className="text-xs text-gray-500">Firma del Vendedor</p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-2 h-24 w-48 border-b border-black"></div>
                <p className="font-bold text-gray-900">{buyer?.full_name || 'Comprador'}</p>
                <p className="text-xs text-gray-500">Firma del Comprador</p>
              </div>
            </div>

            {/* Legend - NEW */}
            <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 print:border-red-500 print:text-red-900">
              <p className="font-bold mb-1">IMPORTANTE:</p>
              <p>
                Solicita al comprador fotos o copia de su INE de ambos lados; solo de este modo se te liberará el pago. 
                Recuérdale que te califique para evitar demoras en la liberación de tu pago.
              </p>
            </div>

            {/* ID Placeholders */}
            <div className="mt-8 grid grid-cols-2 gap-8 pt-8 border-t border-dashed border-gray-300">
               <div className="aspect-video w-full rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-xs text-center p-4">
                 Espacio para foto de INE/ID Vendedor (Opcional)
               </div>
               <div className="aspect-video w-full rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-xs text-center p-4">
                 Espacio para foto de INE/ID Comprador (Requerido)
               </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-12 pb-12 text-center text-xs text-gray-400 print:hidden flex justify-center gap-4">
          <button
            onClick={handleDownloadPDF}
            disabled={generatingPdf}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-gray-800 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {generatingPdf ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generando PDF...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Descargar PDF
              </>
            )}
          </button>
          
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
