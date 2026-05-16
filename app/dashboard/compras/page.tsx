'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { calculateMercadoPagoFee } from '@/lib/fees';
import { OrderChatFloating } from '@/components/OrderChatFloating';
import { PageTour } from '@/components/PageTour';
import { pageTours } from '@/lib/tours/config';
import { SectionMessage } from '@/components/SectionMessage';
import { SellerDisplay } from '@/components/SellerDisplay';
import { AuctionDeadline } from '@/components/orders/AuctionDeadline';
import PaymentDeadlineWarning from '@/components/common/PaymentDeadlineWarning';
import { DigitalDeliveryBuyer } from '@/components/orders/DigitalDeliverySection';
import jsPDF from 'jspdf';
import { ReviewForm } from '@/components/listings/ReviewForm';
import { ShippingBadge, OrderSourceChip } from '@/components/ui/ShippingBadge';
import { payoutNet } from '@/lib/payouts/calc';
import { useImpersonation } from '@/components/ImpersonationProvider';

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function toNumber(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function formatMoney(v: any) {
  return toNumber(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
function formatDateTime(input: string | null | undefined) {
  if (!input) return '�';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '�';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

function generatePaymentPDF(topupId: string, amount: number, method: string, instructions: string) {
  const doc = new jsPDF();

  // Configurar fuente
  doc.setFont('helvetica');

  // Header
  doc.setFontSize(24);
  doc.setTextColor(255, 0, 128); // Brand Pink
  doc.text('GOPOCKET', 105, 20, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Orden de Pago', 105, 30, { align: 'center' });

  // L�nea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 35, 190, 35);

  // Detalles
  doc.setFontSize(12);
  doc.text('Detalles de la Operaci�n:', 20, 45);

  doc.setFontSize(10);
  doc.text(`ID de Operaci�n: ${topupId}`, 20, 55);
  doc.text(`Fecha de Emisi�n: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`, 20, 62);

  let methodName = 'Transferencia SPEI';
  if (method === 'oxxo') methodName = 'Pago en OXXO';
  if (method === 'bank_deposit') methodName = 'Dep�sito Bancario';

  doc.text(`M�todo de Pago: ${methodName}`, 20, 69);

  // Monto
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Monto a Pagar: $${amount.toFixed(2)} MXN`, 20, 85);
  doc.setFont(undefined, 'normal');

  // Instrucciones
  doc.line(20, 90, 190, 90);
  doc.setFontSize(12);
  doc.text('Instrucciones para realizar el pago:', 20, 100);

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const splitText = doc.splitTextToSize(instructions, 170);
  doc.text(splitText, 20, 110);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('IMPORTANTE:', 20, 250);
  doc.text('1. Realiza el pago por el monto exacto.', 20, 256);
  doc.text('2. Conserva tu comprobante de pago.', 20, 262);
  doc.text('3. Sube el comprobante en la plataforma para acreditar tu saldo.', 20, 268);

  doc.save(`gopocket-orden-${topupId}.pdf`);
}

export default function DashboardComprasPage() {
  const router = useRouter();
  const { isImpersonating, targetUserId, queryAsUser } = useImpersonation();
  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, any[]>>({});
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [sellerStateById, setSellerStateById] = useState<Record<string, string | null>>({});
  const [sellerCityById, setSellerCityById] = useState<Record<string, string | null>>({});
  const [sellerOperationsById, setSellerOperationsById] = useState<Record<string, number>>({});
  const [sellerLogoById, setSellerLogoById] = useState<Record<string, string | null>>({});
  const [sellerPlanById, setSellerPlanById] = useState<Record<string, string>>({});
  const [thumbByListingId, setThumbByListingId] = useState<Record<string, string>>({});
  const [titleByListingId, setTitleByListingId] = useState<Record<string, string>>({});
  const [weightByListingId, setWeightByListingId] = useState<Record<string, number>>({});
  const [productTypeByListingId, setProductTypeByListingId] = useState<Record<string, string>>({});
  const [dimsByListingId, setDimsByListingId] = useState<Record<string, { length_cm: number; width_cm: number; height_cm: number }>>({});
  const [weightByOrderId, setWeightByOrderId] = useState<Record<string, number>>({});
  const [dimsByOrderId, setDimsByOrderId] = useState<Record<string, { length_cm: number; width_cm: number; height_cm: number }>>({});

  const [chatOpen, setChatOpen] = useState(false);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [hasUnreadByOrderId, setHasUnreadByOrderId] = useState<Record<string, boolean>>({});

  const [rateOpen, setRateOpen] = useState(false);
  const [rateOrderId, setRateOrderId] = useState<string | null>(null);
  const [rateSellerId, setRateSellerId] = useState<string | null>(null);
  const [rateStars, setRateStars] = useState<number>(10);
  const [rateComment, setRateComment] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratedByOrderId, setRatedByOrderId] = useState<Record<string, boolean>>({});
  const [bothRatedByOrderId, setBothRatedByOrderId] = useState<Record<string, boolean>>({});

  // Scroll autom�tico cuando se abre el modal de calificaci�n
  useEffect(() => {
    if (rateOpen) {
      // Peque�o delay para asegurar que el modal est� renderizado
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [rateOpen]);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payOrderData, setPayOrderData] = useState<{ id: string; total: number } | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('mercadopago');
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [shippingMode, setShippingMode] = useState<'gopocket' | 'pickup'>('gopocket');
  const [isUpdatingShipping, setIsUpdatingShipping] = useState(false);

  const paymentCalculations = useMemo(() => {
    if (!payOrderData) return { total: 0, fee: 0, finalTotal: 0 };
    const total = payOrderData.total;
    if (selectedMethod === 'mercadopago') {
      const { fee, total: finalTotal } = calculateMercadoPagoFee(total);
      return { total, fee, finalTotal };
    }
    return { total, fee: 0, finalTotal: total };
  }, [payOrderData, selectedMethod]);

  const [checkoutSessionByOrderId, setCheckoutSessionByOrderId] = useState<Record<string, string>>({});

  // Recargas pendientes (Offline)
  const [pendingTopups, setPendingTopups] = useState<any[]>([]);
  const [uploadingProofId, setUploadingProofId] = useState<string | null>(null);
  const [selectedTopupForInfo, setSelectedTopupForInfo] = useState<any | null>(null);

  // Gu�as Estafeta
  const [estafetaQuotes, setEstafetaQuotes] = useState<any[]>([]);

  // Disputas
  const [disputeByOrderId, setDisputeByOrderId] = useState<Record<string, string>>({});
  const [disputeInfoByOrderId, setDisputeInfoByOrderId] = useState<Record<string, { id: string; status: string; created_at: string; admin_decision?: string | null; admin_note?: string | null }>>({});
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeOrderId, setDisputeOrderId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState<'not_received' | 'damaged' | 'not_as_described' | 'missing_items' | 'other'>(
    'not_received',
  );
  const [disputeText, setDisputeText] = useState('');
  const [isOpeningDispute, setIsOpeningDispute] = useState(false);

  // Filtros y b�squeda
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [comprasPage, setComprasPage] = useState(1);
  const [appSettings, setAppSettings] = useState<any>(null);
  // Rese�a de producto
  const [reviewListingId, setReviewListingId] = useState<string | null>(null);
  const [reviewedListingIds, setReviewedListingIds] = useState<Set<string>>(new Set());

  // Fetch user's existing reviews on mount to block duplicate submissions
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data: existingReviews } = await supabase
          .from('product_reviews')
          .select('listing_id')
          .eq('user_id', session.user.id);
        if (existingReviews && existingReviews.length > 0) {
          setReviewedListingIds(new Set(existingReviews.map((r: any) => r.listing_id)));
        }
      } catch { }
    })();
  }, []);

  // Pesta�as principales
  const [comprasTab, setComprasTab] = useState<'compras' | 'estafeta' | 'pocketcash'>('compras');

  // ALL wallet topups (for PocketCash tab)
  const [allTopups, setAllTopups] = useState<any[]>([]);

  // Contador de tiempo para actualizar cada segundo
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function generatePaymentPDF(topupId: string, amount: number, method: string, instructions: string) {
    const doc = new jsPDF();

    // Configurar fuente
    doc.setFont('helvetica');

    // Logo Simulation (Brand Pink Background with White Text)
    doc.setFillColor(255, 0, 128); // Brand Pink
    doc.roundedRect(20, 15, 50, 15, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('GOPOCKET', 45, 24, { align: 'center' });

    // Header Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(20);
    doc.text('ORDEN DE PAGO', 190, 24, { align: 'right' });

    // L�nea separadora
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);

    // Detalles de la Operaci�n
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('ID DE OPERACI�N', 20, 45);
    doc.text('FECHA DE EMISI�N', 190, 45, { align: 'right' });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.text(topupId, 20, 52);
    doc.text(`${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`, 190, 52, { align: 'right' });

    // M�todo y Monto Box
    doc.setFillColor(249, 250, 251); // Gray 50
    doc.setDrawColor(229, 231, 235); // Gray 200
    doc.roundedRect(20, 65, 170, 40, 3, 3, 'FD');

    let methodName = 'Transferencia SPEI';
    if (method === 'oxxo') methodName = 'Pago en OXXO';
    if (method === 'bank_deposit') methodName = 'Dep�sito Bancario';

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('M�TODO DE PAGO', 30, 75);
    doc.text('MONTO A PAGAR', 180, 75, { align: 'right' });

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text(methodName, 30, 85);
    doc.text(`$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`, 180, 85, { align: 'right' });

    doc.setFontSize(9);
    doc.setTextColor(255, 0, 128); // Brand Pink
    doc.text('Importante: Paga exactamente esta cantidad.', 180, 95, { align: 'right' });

    // Instrucciones
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text('Instrucciones de Pago', 20, 120);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(50, 50, 50);

    // Split text handles newlines automatically if formatted correctly, but we might need to be careful
    const splitText = doc.splitTextToSize(instructions, 170);
    doc.text(splitText, 20, 130);

    // Footer / Disclaimer
    const pageHeight = doc.internal.pageSize.height;
    doc.setDrawColor(230, 230, 230);
    doc.line(20, pageHeight - 40, 190, pageHeight - 40);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('1. Esta orden de pago es v�lida �nicamente para el monto especificado.', 20, pageHeight - 30);
    doc.text('2. Conserva este comprobante hasta que tu saldo sea acreditado.', 20, pageHeight - 25);
    doc.text('3. Si tienes dudas, contacta a soporte con tu ID de Operaci�n.', 20, pageHeight - 20);

    doc.save(`gopocket-orden-${topupId}.pdf`);
  }


  function generateOrderNote(order: any, items: any[], sellerName: string) {
    const w = window.open('', '_blank');
    if (!w) return;

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <div style="font-weight: bold; font-size: 14px; color: #333;">${item.listing_title || 'Producto'}</div>
          <div style="font-size: 12px; color: #777; margin-top: 4px;">
            ${item.selected_size ? `Talla: ${item.selected_size} ` : ''}
            ${item.selected_color ? `Color: ${item.selected_color}` : ''}
          </div>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${formatMoney(item.unit_price)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${formatMoney(item.line_total)}</td>
      </tr>
    `).join('');

    function translateStatus(status: string) {
      const map: Record<string, string> = {
        'pending': 'Pendiente',
        'paid': 'Pagado',
        'processing': 'Procesando',
        'shipped': 'Enviado',
        'delivered': 'Entregado',
        'completed': 'Completado',
        'cancelled': 'Cancelado',
        'refunded': 'Reembolsado'
      };
      return map[status?.toLowerCase()] || status?.toUpperCase() || 'DESCONOCIDO';
    }

    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orden de Compra #${order.id.slice(0, 8)}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 30px; margin-bottom: 40px; }
            .logo { font-size: 24px; font-weight: 900; color: #E91E63; letter-spacing: -1px; }
            .invoice-title { font-size: 24px; font-weight: 300; color: #888; text-transform: uppercase; letter-spacing: 2px; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 50px; }
            .info-col h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 8px; font-weight: 600; }
            .info-col p { font-size: 15px; font-weight: 500; margin: 0; color: #111; }
            .status-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #f0f0f0; color: #555; text-transform: uppercase; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th { text-align: left; padding: 12px; background: #f9f9f9; border-bottom: 2px solid #eee; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 600; }
            
            .summary { display: flex; justify-content: flex-end; }
            .summary-box { width: 300px; }
            .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
            .summary-row.total { border-bottom: none; border-top: 2px solid #333; font-weight: 900; font-size: 18px; margin-top: 10px; padding-top: 20px; }
            
            .footer { margin-top: 80px; padding-top: 30px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa; }
            
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">POCKET</div>
            <div class="invoice-title">Orden de Compra</div>
          </div>

          <div class="info-grid">
            <div class="info-col">
              <h3>Orden</h3>
              <p>#${order.id.slice(0, 8).toUpperCase()}</p>
              <div style="margin-top: 20px;">
                <h3>Fecha</h3>
                <p>${new Date(order.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <div class="info-col" style="text-align: right;">
              <h3>Vendedor</h3>
              <p>${sellerName || 'Vendedor Pocket'}</p>
              <div style="margin-top: 20px;">
                <h3>Estado</h3>
                <span class="status-badge">${translateStatus(order.status).toUpperCase()}</span>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th width="50%">Producto</th>
                <th width="15%" style="text-align: center;">Cant.</th>
                <th width="15%" style="text-align: right;">Precio</th>
                <th width="20%" style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-box">
              <div class="summary-row">
                <span>Subtotal</span>
                <span>${formatMoney(order.subtotal || order.total - order.shipping_fee)}</span>
              </div>
              <div class="summary-row">
                <span>Env�o</span>
                <span>${formatMoney(order.shipping_fee)}</span>
              </div>
              <div class="summary-row total">
                <span>Total</span>
                <span>${formatMoney(order.total)}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Gracias por tu compra en Pocket.</p>
            <p>ID Completo: ${order.id}</p>
            <p>Este documento es un comprobante digital generado autom�ticamente.</p>
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  }

  const handleUploadProof = async (topupId: string, file: File) => {
    if (!file) return;
    try {
      setUploadingProofId(topupId);
      setError(null);

      // 1. Subir archivo
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', 'payment_proof');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData, // No headers, browser sets boundary
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadJson.error || 'Error al subir comprobante');
      const proofUrl = uploadJson.url;

      // 2. Confirmar topup
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No sesi�n');

      const confirmRes = await fetch('/api/wallet/topup/confirm-offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ topup_id: topupId, proof_url: proofUrl }),
      });
      const confirmJson = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmJson.error || 'Error al confirmar recarga');

      // 3. Actualizar UI
      setSuccess('Comprobante subido. Tu recarga est� pendiente de aprobaci�n.');
      setPendingTopups((prev) => prev.map(t => t.id === topupId ? { ...t, status: 'pending_approval' } : t));

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al subir el comprobante');
    } finally {
      setUploadingProofId(null);
    }
  };

  // Filtrar �rdenes seg�n el filtro activo y b�squeda
  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return orders.filter((o) => {
      const status = String(o?.status || '').trim();
      const orderId = String(o?.id || '').trim();
      const tracking = String(o?.tracking_number || '').trim();
      const sellerId = String(o?.seller_id || '');
      const sellerName = sellerId ? (sellerNames[sellerId] || '').toLowerCase() : '';
      const alreadyRated = Boolean(ratedByOrderId[orderId]);
      const isCompleted = status === 'completed' || status === 'delivered';
      const isShipped = status === 'shipped' || Boolean(tracking);
      const isPaid = status === 'paid' || isShipped || isCompleted;

      // Aplicar filtro de estado
      let matchesFilter = true;
      switch (activeFilter) {
        case 'pending_payment':
          matchesFilter = status === 'pending_payment' || status === 'awaiting_voucher' || status === 'verifying_payment';
          break;
        case 'paid':
          matchesFilter = status === 'paid';
          break;
        case 'shipped':
          matchesFilter = isShipped;
          break;
        case 'delivered':
          matchesFilter = status === 'delivered' || status === 'completed';
          break;
        case 'rated':
          matchesFilter = isCompleted && alreadyRated;
          break;
        case 'not_rated':
          matchesFilter = isCompleted && !alreadyRated;
          break;
        case 'with_dispute':
          matchesFilter = Boolean(disputeByOrderId[orderId]);
          break;
        default:
          matchesFilter = true; // 'all'
      }

      if (!matchesFilter) return false;

      // Aplicar b�squeda si hay query
      if (query) {
        const orderIdLower = orderId.toLowerCase();
        const trackingLower = tracking.toLowerCase();

        // Buscar en: ID de orden, nombre del vendedor, tracking
        const matchesSearch =
          orderIdLower.includes(query) ||
          sellerName.includes(query) ||
          trackingLower.includes(query);

        return matchesSearch;
      }

      return true;
    });
  }, [orders, activeFilter, ratedByOrderId, searchQuery, sellerNames, disputeByOrderId]);

  // Contadores por filtro
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: orders.length,
      pending_payment: 0,
      paid: 0,
      shipped: 0,
      delivered: 0,
      rated: 0,
      not_rated: 0,
      with_dispute: 0,
    };

    for (const o of orders) {
      const status = String(o?.status || '').trim();
      const orderId = String(o?.id || '').trim();
      const tracking = String(o?.tracking_number || '').trim();
      const alreadyRated = Boolean(ratedByOrderId[orderId]);
      const isCompleted = status === 'completed' || status === 'delivered';
      const isShipped = status === 'shipped' || Boolean(tracking);

      if (status === 'pending_payment' || status === 'awaiting_voucher' || status === 'verifying_payment') counts.pending_payment++;
      if (status === 'paid') counts.paid++;
      if (isShipped) counts.shipped++;
      if (isCompleted) counts.delivered++;
      if (isCompleted && alreadyRated) counts.rated++;
      if (isCompleted && !alreadyRated) counts.not_rated++;
      if (disputeByOrderId[orderId]) counts.with_dispute++;
    }

    return counts;
  }, [orders, ratedByOrderId, disputeByOrderId]);

  const COMPRAS_PAGE_SIZE = 10;
  const comprasTotalPages = Math.max(1, Math.ceil(filteredOrders.length / COMPRAS_PAGE_SIZE));
  const comprasPaginated = useMemo(() => {
    const page = Math.min(Math.max(1, comprasPage), comprasTotalPages);
    const start = (page - 1) * COMPRAS_PAGE_SIZE;
    return filteredOrders.slice(start, start + COMPRAS_PAGE_SIZE);
  }, [filteredOrders, comprasPage, comprasTotalPages]);

  useEffect(() => {
    setComprasPage(1);
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    if (comprasPage > comprasTotalPages && comprasTotalPages >= 1) setComprasPage(1);
  }, [comprasTotalPages, comprasPage]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setIsBooting(true);
        setError(null);
        setSuccess(null);

        // -- IMPERSONATION MODE --
        if (isImpersonating && targetUserId) {
          const result = await queryAsUser({
            table: 'orders',
            select: 'id,status,total,subtotal,shipping_fee,commission_fee,coupon_discount,shipping_option_id,shipping_carrier,shipping_by_seller,created_at,updated_at,seller_id,buyer_id,paid_at,tracking_number,shipping_label_url,shipping_method,order_source',
            filters: { userColumn: 'buyer_id' },
            order: { column: 'created_at', ascending: false },
            limit: 500,
          });
          const next = (result.data as any[]) ?? [];
          if (cancelled) return;
          setOrders(next);
          if (!cancelled) setIsBooting(false);
          return;
        }

        // -- NORMAL MODE --
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          window.location.href = '/login';
          return;
        }

        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error('Auth session missing');

        // -- FASE 1: Cargar �rdenes --
        const res = await fetch(`/api/orders/buyer-dashboard?limit=500&t=${Date.now()}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !(json as any)?.ok) {
          throw new Error((json as any)?.error || 'No se pudieron cargar tus compras.');
        }

        const next = ((json as any)?.orders as any[]) ?? [];
        if (cancelled) return;
        setOrders(next);

        // Pre-cargar im�genes y t�tulos de listings directamente desde buyer-dashboard
        // Esto funciona SIEMPRE porque buyer-dashboard usa admin client (bypasea RLS)
        const serverThumbs = (json as any)?.thumbsByListingId as Record<string, string> | undefined;
        const serverTitles = (json as any)?.titlesByListingId as Record<string, string> | undefined;
        if (serverThumbs && Object.keys(serverThumbs).length > 0) {
          setThumbByListingId((prev) => ({ ...prev, ...serverThumbs }));
        }
        if (serverTitles && Object.keys(serverTitles).length > 0) {
          setTitleByListingId((prev) => ({ ...prev, ...serverTitles }));
        }

        // Reconciliar PocketCash en BACKGROUND (no bloquear la UI)
        fetch('/api/wallet/reconcile-orders', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        }).then(async (recon) => {
          const reconJson = await recon.json().catch(() => ({}));
          if (recon.ok && Array.isArray(reconJson?.updated) && reconJson.updated.length > 0) {
            const res2 = await fetch(`/api/orders/buyer-dashboard?limit=500&t=${Date.now()}`, {
              headers: { authorization: `Bearer ${token}` },
              cache: 'no-store',
            });
            const json2 = await res2.json().catch(() => ({}));
            if (res2.ok && json2?.ok && Array.isArray(json2?.orders)) {
              if (!cancelled) setOrders(json2.orders);
            }
          }
        }).catch(() => { });

        const ids = next.map((o) => String(o?.id || '')).filter(Boolean);

        // ��������� FASE 2: Todo lo dem�s EN PARALELO ���������
        const chunk = <T,>(arr: T[], size: number) => {
          const out: T[][] = [];
          for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
          return out;
        };
        const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

        // Funci�n para obtener �tems de orden + datos de listings
        const loadItemsAndListings = async () => {
          if (ids.length === 0) return;
          const idChunks = chunk(ids, 25);
          const allItems: any[] = [];
          for (const batch of idChunks) {
            try {
              // Query simple sin join a listings (el join falla con 400 por RLS en listings vendidos/pausados)
              // Los datos de listings se cargan despu�s v�a /api/listings/by-ids (admin, bypasea RLS)
              let part: any = await supabase
                .from('order_items')
                .select('order_id,listing_id,title,quantity,line_total,selected_size,selected_color')
                .in('order_id', batch);
              if (part.error) {
                // Fallback sin columnas opcionales
                part = await supabase
                  .from('order_items')
                  .select('order_id,listing_id,quantity,line_total')
                  .in('order_id', batch);
              }
              if (!part.error && Array.isArray(part.data)) {
                allItems.push(...part.data);
              }
            } catch (e) {
              console.error('[COMPRAS] Error cargando order_items batch:', e);
            }
          }
          if (allItems.length > 0) {
            const map: Record<string, any[]> = {};
            for (const it of allItems as any[]) {
              const oid = String(it?.order_id || '');
              if (!oid) continue;
              if (!map[oid]) map[oid] = [];
              map[oid].push(it);
            }
            setItemsByOrder(map);

            const listingIds = Array.from(new Set(allItems.map((it: any) => String(it?.listing_id || '')).filter(Boolean)));
            if (listingIds.length > 0) {
              const uuids = listingIds.filter(isUuid);
              const publics = listingIds.filter((x) => !isUuid(x));

              const results: any[] = [];
              // Use server-side API (admin client) to bypass RLS for sold/paused listings
              try {
                const listingRes = await fetch('/api/listings/by-ids', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ ids: listingIds }),
                });
                const listingJson = await listingRes.json().catch(() => ({}));
                if (listingJson?.ok && Array.isArray(listingJson?.listings)) {
                  results.push(...listingJson.listings);
                }
              } catch (e) {
                console.error('[COMPRAS] Error en by-ids:', e);
              }

              if (results.length > 0) {
                const m: Record<string, string> = {};
                const t: Record<string, string> = {};
                const w: Record<string, number> = {};
                const d: Record<string, { length_cm: number; width_cm: number; height_cm: number }> = {};
                for (const r of results as any[]) {
                  const id1 = String(r?.id || '').trim();
                  const id2 = String(r?.public_id || '').trim();
                  let imgs: string[] = [];
                  const raw = (r as any)?.images;
                  if (Array.isArray(raw)) {
                    imgs = raw.map((x: any) => String(x || '').trim()).filter(Boolean);
                  } else if (typeof raw === 'string') {
                    const s = raw.trim();
                    try {
                      const parsed = JSON.parse(s);
                      if (Array.isArray(parsed)) imgs = parsed.map((x: any) => String(x || '').trim()).filter(Boolean);
                    } catch {
                      if (s.startsWith('http') || s.startsWith('/')) imgs = [s];
                    }
                  }
                  const first = imgs[0] || '';
                  if (first) {
                    if (id1) m[id1] = first;
                    if (id2) m[id2] = first;
                  }
                  const tt = String((r as any)?.title || '').trim();
                  if (tt) {
                    if (id1) t[id1] = tt;
                    if (id2) t[id2] = tt;
                  }
                  const wv = Number((r as any)?.weight_kg || 0);
                  const lv = Number((r as any)?.length_cm || 0);
                  const wcm = Number((r as any)?.width_cm || 0);
                  const hv = Number((r as any)?.height_cm || 0);
                  if (id1) {
                    w[id1] = wv;
                    d[id1] = { length_cm: lv, width_cm: wcm, height_cm: hv };
                  }
                  if (id2) {
                    w[id2] = wv;
                    d[id2] = { length_cm: lv, width_cm: wcm, height_cm: hv };
                  }
                }
                if (Object.keys(m).length > 0) setThumbByListingId((prev) => ({ ...prev, ...m }));
                if (Object.keys(t).length > 0) setTitleByListingId((prev) => ({ ...prev, ...t }));
                if (Object.keys(w).length > 0) setWeightByListingId((prev) => ({ ...prev, ...w }));
                const pt: Record<string, string> = {};
                for (const r of results as any[]) {
                  const id1 = String(r?.id || '').trim();
                  const id2 = String(r?.public_id || '').trim();
                  const ptype = String((r as any)?.product_type || 'physical').toLowerCase();
                  if (id1) pt[id1] = ptype;
                  if (id2) pt[id2] = ptype;
                }
                if (Object.keys(pt).length > 0) setProductTypeByListingId((prev) => ({ ...prev, ...pt }));
                if (Object.keys(d).length > 0) setDimsByListingId((prev) => ({ ...prev, ...d }));
              }

              // Enrich (best-effort, no bloquear)
              try {
                const resp = await fetch('/api/orders/enrich-items', {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${token}`,
                  },
                  credentials: 'include',
                  cache: 'no-store',
                  body: JSON.stringify({ orderIds: ids, listingIds }),
                });
                if (resp.ok) {
                  const json = await resp.json().catch(() => ({}));
                  const titles = (json?.titles || {}) as Record<string, string>;
                  const thumbs = (json?.thumbs || {}) as Record<string, string>;
                  if (Object.keys(thumbs).length > 0) setThumbByListingId((prev) => ({ ...prev, ...thumbs }));
                  if (Object.keys(titles).length > 0) setTitleByListingId((prev) => ({ ...prev, ...titles }));
                }
              } catch { }
            }

            // Calcular peso/dims por orden usando datos YA cargados (sin re-query)
            const wByOrder: Record<string, number> = {};
            const dimsByOrder: Record<string, { length_cm: number; width_cm: number; height_cm: number }> = {};
            for (const it of allItems as any[]) {
              const oid = String(it?.order_id || '').trim();
              const lid = String(it?.listing_id || '').trim();
              if (!oid || !lid) continue;
              // Lookup from state that was just set (use the local variable instead)
              // We already have w and d from the results processing above
              const qty = Number(it?.quantity || 1);
              wByOrder[oid] = (wByOrder[oid] || 0); // Will be populated from local data
              const prev = dimsByOrder[oid] || { length_cm: 0, width_cm: 0, height_cm: 0 };
              dimsByOrder[oid] = prev;
            }
            setWeightByOrderId(wByOrder);
            setDimsByOrderId(dimsByOrder);
          }
        };

        // Funci�n para cargar pendingTopups
        const loadPendingTopups = async () => {
          try {
            const res = await fetch('/api/wallet/pending-topups', {
              headers: { authorization: `Bearer ${token}` },
              cache: 'no-store',
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok && (json as any)?.ok) {
              const list = ((json as any)?.topups as any[]) ?? [];
              if (!cancelled) setPendingTopups(list);
            }
            // Also load ALL topups for PocketCash tab
            const allRes = await supabase
              .from('wallet_topups')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(100);
            if (!allRes.error && Array.isArray(allRes.data)) {
              if (!cancelled) setAllTopups(allRes.data);
            }
          } catch (err) {
            console.error('[COMPRAS] Error loading pending topups:', err);
          }
        };

        // Funci�n para cargar offlineSessions
        const loadOfflineSessions = async () => {
          try {
            const res = await fetch('/api/offline-payment/pending-sessions', {
              headers: { authorization: `Bearer ${token}` },
              cache: 'no-store',
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok && (json as any)?.ok) {
              const byOrder = ((json as any)?.byOrderId || {}) as Record<string, string>;
              if (!cancelled) setCheckoutSessionByOrderId(byOrder);
            }
          } catch (err) {
            console.error('[COMPRAS] Error loading offline sessions:', err);
          }
        };

        // Funci�n para cargar disputas
        const loadDisputes = async (orderIds: string[]) => {
          try {
            const res = await fetch(`/api/disputes/list?limit=200&t=${Date.now()}`, {
              headers: { authorization: `Bearer ${token}` },
              cache: 'no-store',
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) return;
            const list = (json?.disputes ?? []) as any[];
            const wanted = new Set(orderIds.map(String));
            const map: Record<string, string> = {};
            const infoMap: Record<string, { id: string; status: string; created_at: string; admin_decision?: string | null; admin_note?: string | null }> = {};
            for (const d of list) {
              const oid = String(d?.order_id || '').trim();
              const did = String(d?.id || '').trim();
              const status = String(d?.status || 'open').trim();
              const created_at = String(d?.created_at || '').trim();
              const admin_decision = d?.admin_decision ? String(d.admin_decision).trim() : null;
              const admin_note = d?.admin_note ? String(d.admin_note).trim() : null;
              if (oid && did && wanted.has(oid)) {
                map[oid] = did;
                infoMap[oid] = { id: did, status, created_at, admin_decision, admin_note };
              }
            }
            if (!cancelled) {
              setDisputeByOrderId(map);
              setDisputeInfoByOrderId(infoMap);
            }
          } catch (err) {
            console.error('[COMPRAS] Error al cargar disputas:', err);
          }
        };

        // Funci�n para cargar perfiles de vendedores
        const loadSellerProfiles = async () => {
          const sellerIds = Array.from(new Set(next.map((o) => String(o?.seller_id || '')).filter(Boolean)));
          if (sellerIds.length === 0) return;

          let profRes: any = await supabase
            .from('profiles')
            .select('id,full_name,nickname,username,state,city,store_logo_url,plan_type')
            .in('id', sellerIds);
          if (profRes.error) {
            const code = String((profRes.error as any)?.code || '');
            const msg = String((profRes.error as any)?.message || '').toLowerCase();
            if (code === '42703' || msg.includes('does not exist') || msg.includes('column') || code === '400') {
              profRes = await supabase.from('profiles').select('id,full_name,state,city').in('id', sellerIds);
              if (profRes.error) profRes = await supabase.from('profiles').select('id,full_name').in('id', sellerIds);
            }
          }
          if (!profRes.error && Array.isArray(profRes.data)) {
            const map: Record<string, string> = {};
            const stateMap: Record<string, string | null> = {};
            const cityMap: Record<string, string | null> = {};
            const logoMap: Record<string, string | null> = {};
            const planMap: Record<string, string> = {};

            for (const p of profRes.data as any[]) {
              const id = String(p?.id || '').trim();
              if (!id) continue;
              const name =
                String(p?.full_name || '').trim() ||
                String(p?.nickname || '').trim() ||
                String(p?.username || '').trim() ||
                `${id.slice(0, 6)}...`;
              map[id] = name;
              const st = typeof (p as any).state === 'string' ? String((p as any).state).trim() || null : null;
              const ct = typeof (p as any).city === 'string' ? String((p as any).city).trim() || null : null;
              stateMap[id] = st || null;
              cityMap[id] = ct || null;
              logoMap[id] = (p as any).store_logo_url || null;
              planMap[id] = (p as any).plan_type || 'basic';
            }
            setSellerNames(map);
            setSellerStateById(stateMap);
            setSellerCityById(cityMap);
            setSellerLogoById(logoMap);
            setSellerPlanById(planMap);
          }

          // Operaciones de vendedores en paralelo
          const opsMap: Record<string, number> = {};
          await Promise.allSettled(
            sellerIds.map(async (id) => {
              try {
                const r = await fetch(`/api/sellers/${encodeURIComponent(id)}`, { cache: 'no-store' });
                const j = await r.json().catch(() => ({}));
                if (r.ok && typeof (j as any)?.operations_count === 'number') opsMap[id] = (j as any).operations_count;
              } catch { }
            }),
          );
          if (!cancelled) setSellerOperationsById(opsMap);
        };

        // Funci�n para cargar chat unread
        const loadChatUnread = async () => {
          if (ids.length === 0) return;
          try {
            const resUnread = await fetch('/api/chat/unread-batch', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`,
              },
              cache: 'no-store',
              body: JSON.stringify({ orderIds: ids }),
            });
            const jsonUnread = await resUnread.json().catch(() => ({}));
            if (resUnread.ok && (jsonUnread as any)?.ok && jsonUnread.hasUnreadByOrderId) {
              setHasUnreadByOrderId(jsonUnread.hasUnreadByOrderId as Record<string, boolean>);
            }
          } catch (err) {
            console.error('[COMPRAS] Error cargando estado de chat (unread):', err);
          }
        };

        // Funci�n para cargar ratings
        const loadRatings = async () => {
          if (ids.length === 0) return;
          try {
            const resRatings = await fetch('/api/ratings/status-batch', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`,
              },
              cache: 'no-store',
              body: JSON.stringify({ orderIds: ids, mode: 'buyer' }),
            });
            const jsonRatings = await resRatings.json().catch(() => ({}));
            if (resRatings.ok && (jsonRatings as any)?.ok) {
              const rated = (jsonRatings as any)?.rated as Record<string, boolean>;
              const bothRated = (jsonRatings as any)?.bothRated as Record<string, boolean>;
              if (rated && typeof rated === 'object') setRatedByOrderId(rated);
              if (bothRated && typeof bothRated === 'object') setBothRatedByOrderId(bothRated);
            }
          } catch (err) {
            console.error('[COMPRAS] Error cargando estado de calificaciones:', err);
          }
        };

        // Funci�n para cargar estafeta + settings + wallet
        const loadSettingsAndExtras = async () => {
          const [settingsRes, walletRes, estafetaRes, appSettingsRes] = await Promise.all([
            supabase.from('app_settings').select('payment_methods').eq('id', 1).maybeSingle(),
            supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
            supabase.from('estafeta_quotes').select('*').eq('user_id', user.id).in('status', ['paid', 'processing', 'completed']).order('created_at', { ascending: false }).limit(100),
            supabase.from('app_settings').select('payment_methods').eq('id', 1).maybeSingle(),
          ]);
          if (settingsRes.data) setPaymentSettings((settingsRes.data as any).payment_methods || {});
          if (walletRes.data) setWalletBalance(Number((walletRes.data as any).balance) || 0);
          if (!estafetaRes?.error && Array.isArray(estafetaRes?.data)) setEstafetaQuotes(estafetaRes.data);
          if (appSettingsRes.data) setAppSettings(appSettingsRes.data);
        };

        // ��������� EJECUTAR TODO EN PARALELO ���������
        await Promise.allSettled([
          loadItemsAndListings(),
          loadPendingTopups(),
          loadOfflineSessions(),
          loadSellerProfiles(),
          loadChatUnread(),
          loadRatings(),
          ids.length > 0 ? loadDisputes(ids) : Promise.resolve(),
          loadSettingsAndExtras(),
        ]);

      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'No se pudieron cargar tus compras.';
          if (msg.includes('Auth session missing')) {
            window.location.href = '/login';
          } else {
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const [isPaying, setIsPaying] = useState<Record<string, boolean>>({});

  const handlePayOrder = (orderId: string, total: number) => {
    const oid = String(orderId || '').trim();
    const order = orders.find((o) => String(o?.id || '').trim() === oid) || null;
    if (order) {
      const opt = String((order as any)?.shipping_option_id || '').toLowerCase();
      const car = String((order as any)?.shipping_carrier || '').trim().toLowerCase();
      const isPickup = opt === 'pickup' || car === 'pickup';
      setShippingMode(isPickup ? 'pickup' : 'gopocket');
    } else {
      setShippingMode('gopocket');
    }
    setPayOrderData({ id: oid, total });
    setPayModalOpen(true);
    setSelectedMethod('mercadopago');
    setError(null);
    setSuccess(null);
  };

  const confirmPayment = async () => {
    if (!payOrderData) return;
    const { id: orderId, total } = payOrderData;

    try {
      setIsPaying((prev) => ({ ...prev, [orderId]: true }));
      setError(null);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesi�n activa');

      if (selectedMethod === 'mercadopago') {
        // Pago con Tarjeta (MercadoPago)
        const res = await fetch('/api/mercadopago/preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orderIds: [orderId], amount: total }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al iniciar el pago');
        if (json.init_point) {
          window.location.href = json.init_point;
        } else {
          throw new Error('No se recibi� el link de pago de MercadoPago');
        }

      } else if (selectedMethod === 'pocketcash') {
        const res = await fetch('/api/wallet/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orderIds: [orderId] }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al procesar el pago con PocketCash');

        setSuccess('�Pago realizado con �xito usando PocketCash!');
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'paid' } : o));
        setPayModalOpen(false);
        setPayOrderData(null);
        setWalletBalance(() => {
          const nb = Number(json.new_balance);
          if (Number.isFinite(nb)) return nb;
          return Math.max(0, walletBalance - total);
        });

      } else {
        // Pagos Offline (Transferencia, Dep�sito, OXXO)
        const res = await fetch('/api/offline-payment/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            orderIds: [orderId],
            amount: total, // Opcional, el backend recalcula
            payment_method: selectedMethod,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al crear la referencia de pago');

        // �xito: mostrar instrucciones o redirigir
        // Por simplicidad, recargamos la p�gina o actualizamos el estado para mostrar "Pendiente de pago" con referencia
        // Pero lo mejor es redirigir a una p�gina de �xito o mostrar el modal de instrucciones.
        // Dado que el usuario est� en "Compras", podemos simplemente cerrar el modal y mostrar un mensaje.
        setSuccess(`Referencia de pago creada (${json.reference_code}). Revisa tu correo o el detalle de la orden.`);
        setCheckoutSessionByOrderId(prev => ({ ...prev, [orderId]: json.checkoutId }));
        setPayModalOpen(false);
        setPayOrderData(null);

        // Redirigir a la p�gina de instrucciones
        router.push(`/pago/${json.checkoutId}`);
      }

    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Error al procesar el pago';
      setError(msg);
      // No cerramos el modal si hay error, para que pueda reintentar
    } finally {
      setIsPaying((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleSelectPickupShipping = async () => {
    if (!payOrderData) return;
    const orderId = String(payOrderData.id || '').trim();
    if (!orderId || !isUuid(orderId)) return;

    try {
      setIsUpdatingShipping(true);
      setError(null);
      setSuccess(null);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesi�n activa');

      const res = await fetch('/api/orders/update-shipping-mode', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, mode: 'pickup' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || 'No se pudo cambiar a entrega personal');
      }

      const newTotal = Number(json.order?.total ?? payOrderData.total);
      const newShippingFee = Number(json.order?.shipping_fee ?? 0);

      setPayOrderData({ id: orderId, total: newTotal });
      setOrders((prev) =>
        prev.map((o) =>
          String(o?.id || '').trim() === orderId
            ? {
              ...o,
              total: newTotal,
              shipping_fee: newShippingFee,
              shipping_carrier: json.order?.shipping_carrier ?? (o as any).shipping_carrier,
              shipping_option_id: json.order?.shipping_option_id ?? (o as any).shipping_option_id,
            }
            : o,
        ),
      );
      setShippingMode('pickup');
      setSuccess('Listo: seleccionaste entrega personal para esta subasta. El env�o ser� gratis.');
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo cambiar a entrega personal');
    } finally {
      setIsUpdatingShipping(false);
    }
  };

  const handleSelectGoVendyShipping = async () => {
    if (!payOrderData) return;
    const orderId = String(payOrderData.id || '').trim();
    if (!orderId || !isUuid(orderId)) return;

    try {
      setIsUpdatingShipping(true);
      setError(null);
      setSuccess(null);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesi�n activa');

      const res = await fetch('/api/orders/update-shipping-mode', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, mode: 'gopocket' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || 'No se pudo cambiar a env�o GoVendy');
      }

      const newTotal = Number(json.order?.total ?? payOrderData.total);
      const newShippingFee = Number(json.order?.shipping_fee ?? 0);

      setPayOrderData({ id: orderId, total: newTotal });
      setOrders((prev) =>
        prev.map((o) =>
          String(o?.id || '').trim() === orderId
            ? {
              ...o,
              total: newTotal,
              shipping_fee: newShippingFee,
              shipping_carrier: json.order?.shipping_carrier ?? (o as any).shipping_carrier,
              shipping_option_id: json.order?.shipping_option_id ?? (o as any).shipping_option_id,
            }
            : o,
        ),
      );
      setShippingMode('gopocket');
      setSuccess(`Listo: seleccionaste env�o GoVendy. Costo de env�o: $${newShippingFee.toFixed(2)}`);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo cambiar a env�o GoVendy');
    } finally {
      setIsUpdatingShipping(false);
    }
  };

  const submitReceivedAndRate = async () => {
    setError(null);
    setSuccess(null);
    const orderId = String(rateOrderId || '').trim();
    const sellerId = String(rateSellerId || '').trim();
    if (!orderId || !sellerId || !isUuid(orderId)) return;

    try {
      setIsSubmittingRating(true);
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const token = sess.session?.access_token;
      if (!token) throw new Error('Auth session missing');

      const path = ['refunded', 'cancelled', 'canceled'].includes(
        String(orders.find((o) => String(o?.id || '') === orderId)?.status || '').trim().toLowerCase(),
      )
        ? '/api/orders/rate-seller'
        : '/api/orders/confirm-received';

      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, stars: rateStars, comment: rateComment }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo confirmar recepci�n.');

      if (path === '/api/orders/confirm-received') {
        setOrders((prev) => prev.map((o) => (String(o?.id || '') === orderId ? { ...o, status: 'completed' } : o)));
      }
      setRatedByOrderId((p) => ({ ...p, [orderId]: true }));
      if (json.both_rated) {
        setBothRatedByOrderId((p) => ({ ...p, [orderId]: true }));
      }
      setSuccess(
        path === '/api/orders/confirm-received'
          ? 'Listo: confirmaste recepci�n. Se liber� el pago y se envi� tu calificaci�n.'
          : 'Listo: se guard� tu calificaci�n de esta compra.',
      );
      setRateOpen(false);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo confirmar recepci�n.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const currentOrderForPayment =
    payOrderData && payOrderData.id
      ? orders.find((o) => String(o?.id || '').trim() === String(payOrderData.id || '').trim()) || null
      : null;

  const itemsForPayment =
    payOrderData && payOrderData.id ? itemsByOrder[String(payOrderData.id || '')] ?? [] : [];

  const listingsForPayment = (itemsForPayment as any[]).map((it) => (it as any)?.listings || null).filter(Boolean);

  const shippingSnapshotPayment = currentOrderForPayment
    ? (((currentOrderForPayment as any).shipping_snapshot as any) || null)
    : null;

  const isAuctionPayment =
    String((currentOrderForPayment as any)?.order_source || '').toLowerCase() === 'auction' ||
    String((shippingSnapshotPayment as any)?.sale_type || '') === 'auction' ||
    listingsForPayment.some((l: any) => String(l?.sale_type || '') === 'auction');

  const allowPersonalDeliveryPayment =
    Boolean((shippingSnapshotPayment as any)?.allow_personal_delivery) ||
    listingsForPayment.some((l: any) => Boolean(l?.allow_personal_delivery));

  const isSellerShippingPayment =
    Boolean((shippingSnapshotPayment as any)?.shipping_by_seller) ||
    listingsForPayment.some((l: any) => Boolean(l?.shipping_by_seller));

  const isFreeShippingPayment =
    Boolean((shippingSnapshotPayment as any)?.free_shipping) ||
    listingsForPayment.some((l: any) => Boolean(l?.free_shipping));

  const shippingFeePayment = currentOrderForPayment ? Number((currentOrderForPayment as any)?.shipping_fee || 0) : 0;

  const isPickupPaymentOrder = currentOrderForPayment
    ? (() => {
      const opt = String((currentOrderForPayment as any)?.shipping_option_id || '').toLowerCase();
      const car = String((currentOrderForPayment as any)?.shipping_carrier || '').trim().toLowerCase();
      return opt === 'pickup' || car === 'pickup';
    })()
    : false;

  const showAuctionShippingChoice = Boolean(
    currentOrderForPayment && isAuctionPayment,
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Compras</div>
              <div className="text-xs text-gray-500">Seguimiento de tus compras</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sell" className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Vender
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Volver
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <PageTour steps={pageTours.compras || []} pageId="compras" />
        <SectionMessage section="compras" />
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {success && <div className="mb-6 rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm text-green-800">{success}</div>}

        {/* --- PESTA�AS PRINCIPALES --- */}
        <div className="mb-6 flex gap-1 rounded-2xl bg-gray-100 p-1 ring-1 ring-black/5">
          <button
            onClick={() => setComprasTab('compras')}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${comprasTab === 'compras'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            ??? Mis Compras
            {orders.length > 0 && (
              <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${comprasTab === 'compras' ? 'bg-brand-emerald text-white' : 'bg-gray-200 text-gray-600'
                }`}>{orders.length}</span>
            )}
          </button>
          <button
            onClick={() => setComprasTab('estafeta')}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${comprasTab === 'estafeta'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            ?? Gu�as Estafeta
            {estafetaQuotes.length > 0 && (
              <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${comprasTab === 'estafeta' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>{estafetaQuotes.length}</span>
            )}
          </button>
          <button
            onClick={() => setComprasTab('pocketcash')}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${comprasTab === 'pocketcash'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            ?? PocketCash
            {allTopups.length > 0 && (
              <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${comprasTab === 'pocketcash' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>{allTopups.length}</span>
            )}
          </button>
        </div>

        {/* --- TAB: COMPRAS --- */}
        {comprasTab === 'compras' && (<>
          {/* Recargas Pendientes */}
          {pendingTopups.length > 0 && (
            <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="text-lg font-bold text-gray-900">Recargas en Proceso</div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800 ring-1 ring-amber-200">
                  PENDIENTE
                </span>
              </div>
              <div className="space-y-4">
                {pendingTopups.map((topup) => (
                  <div key={topup.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div>
                      <div className="font-bold text-gray-900">Recarga de Saldo</div>
                      <div className="text-sm text-gray-600">
                        Monto: <span className="font-semibold text-gray-900">{formatMoney(topup.amount)}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Creado el: {formatDateTime(topup.created_at)}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        Operaci�n: {topup.id.slice(0, 8)}...
                      </div>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-xs font-medium shadow-sm ring-1 ring-black/5">
                        {topup.status === 'pending_proof' ? (
                          <span className="text-orange-600">Esperando comprobante</span>
                        ) : (
                          <span className="text-blue-600">Revisi�n pendiente</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Bot�n de Continuar Pago / Ver Instrucciones */}
                      <button
                        onClick={() => setSelectedTopupForInfo(topup)}
                        className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                      >
                        {topup.payment_method === 'mercadopago' ? 'Pagar Ahora' : 'Ver Instrucciones'}
                      </button>

                      {/* Bot�n de Descargar Nota */}
                      <button
                        onClick={() => {
                          const w = window.open('', '_blank');
                          if (w) {
                            w.document.write(`
                               <!DOCTYPE html>
                               <html>
                                 <head>
                                   <title>Orden de Compra - PocketCash</title>
                                   <style>
                                     body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
                                     .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 40px; }
                                     .logo { font-size: 24px; font-weight: bold; color: #E91E63; }
                                     .invoice-title { font-size: 28px; font-weight: 300; color: #555; text-align: right; }
                                     .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
                                     .detail-group h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 5px; }
                                     .detail-group p { font-size: 16px; font-weight: 500; margin: 0; }
                                     .table-container { margin-bottom: 40px; }
                                     table { width: 100%; border-collapse: collapse; }
                                     th { text-align: left; padding: 15px; background: #f9f9f9; border-bottom: 1px solid #eee; font-size: 12px; text-transform: uppercase; color: #777; }
                                     td { padding: 15px; border-bottom: 1px solid #eee; }
                                     .total-row td { border-bottom: none; font-weight: bold; font-size: 18px; padding-top: 20px; }
                                     .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999; }
                                     .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; background: #eee; }
                                   </style>
                                 </head>
                                 <body>
                                   <div class="header">
                                     <div class="logo">POCKET</div>
                                     <div class="invoice-title">ORDEN DE RECARGA</div>
                                   </div>

                                   <div class="details-grid">
                                     <div class="detail-group">
                                       <h3>Operaci�n</h3>
                                       <p>#${topup.id.slice(0, 8).toUpperCase()}</p>
                                     </div>
                                     <div class="detail-group" style="text-align: right;">
                                       <h3>Fecha</h3>
                                       <p>${new Date(topup.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                     </div>
                                     <div class="detail-group">
                                       <h3>Cliente</h3>
                                       <p>Usuario Pocket</p>
                                     </div>
                                     <div class="detail-group" style="text-align: right;">
                                       <h3>Estado</h3>
                                       <span class="status-badge">${topup.status.toUpperCase()}</span>
                                     </div>
                                   </div>

                                   <div class="table-container">
                                     <table>
                                       <thead>
                                         <tr>
                                           <th>Concepto</th>
                                           <th style="text-align: right;">Importe</th>
                                         </tr>
                                       </thead>
                                       <tbody>
                                         <tr>
                                           <td>Recarga de Saldo PocketCash</td>
                                           <td style="text-align: right;">${formatMoney(topup.amount)}</td>
                                         </tr>
                                         <tr class="total-row">
                                           <td style="text-align: right;">Total</td>
                                           <td style="text-align: right;">${formatMoney(topup.amount)}</td>
                                         </tr>
                                       </tbody>
                                     </table>
                                   </div>

                                   <div class="footer">
                                     <p>Gracias por usar Pocket. Este comprobante es digital.</p>
                                     <p>ID Completo: ${topup.id}</p>
                                   </div>

                                   <script>window.print();</script>
                                 </body>
                               </html>
                             `);
                            w.document.close();
                          }
                        }}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                      >
                        Descargar Nota
                      </button>

                      {topup.status === 'pending_proof' && (
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            disabled={uploadingProofId === topup.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadProof(topup.id, file);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <button
                            disabled={uploadingProofId === topup.id}
                            className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                          >
                            {uploadingProofId === topup.id ? 'Subiendo...' : 'Subir Comprobante'}
                          </button>
                        </div>
                      )}
                      {topup.status === 'pending_approval' && (
                        <div className="text-sm font-medium text-gray-500 italic">
                          Tu comprobante est� siendo revisado.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-bold text-gray-900">Historial de compras</div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-800 ring-1 ring-blue-200">
                    T� COMPRASTE
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600">Aqu� ver�s tus compras: vendedor, art�culos y estatus del env�o.</div>
              </div>
            </div>

            {!isBooting && orders.length > 0 ? (
              <div className="mt-4">
                {/* Buscador y Filtros */}
                <div className="mb-4" data-tour="filters">
                  <div className="relative">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por c�digo de orden, vendedor o n�mero de rastreo..."
                      className="w-full rounded-xl border border-gray-300 bg-white px-10 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/20"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="Limpiar b�squeda"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
                  {/* Filtro activo siempre visible */}
                  {(() => {
                    const filterConfig: Record<string, { label: string; count: number; color: string }> = {
                      all: { label: 'Todas', count: filterCounts.all, color: 'bg-brand-emerald text-white shadow-sm' },
                      pending_payment: { label: 'Pendiente de pago', count: filterCounts.pending_payment, color: 'bg-red-100 text-red-700 ring-1 ring-red-200' },
                      paid: { label: 'Pagadas', count: filterCounts.paid, color: 'bg-green-100 text-green-700 ring-1 ring-green-200' },
                      shipped: { label: 'Enviadas', count: filterCounts.shipped, color: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' },
                      delivered: { label: 'Entregadas', count: filterCounts.delivered, color: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
                      rated: { label: 'Calificadas', count: filterCounts.rated, color: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
                      not_rated: { label: 'Sin calificar', count: filterCounts.not_rated, color: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' },
                      with_dispute: { label: 'Con disputa', count: filterCounts.with_dispute, color: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
                    };
                    const active = filterConfig[activeFilter] || filterConfig.all;
                    return (
                      <button
                        type="button"
                        onClick={() => setActiveFilter('all')}
                        className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition ${active.color}`}
                      >
                        {active.label} {active.count > 0 ? `(${active.count})` : ''}
                      </button>
                    );
                  })()}

                  {/* Bot�n para expandir/colapsar */}
                  <button
                    type="button"
                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
                    aria-label={filtersExpanded ? 'Colapsar filtros' : 'Expandir filtros'}
                  >
                    {filtersExpanded ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                        Menos
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                        M�s filtros
                      </>
                    )}
                  </button>

                  {/* Filtros adicionales (colapsables) */}
                  {filtersExpanded && (
                    <div className="flex flex-wrap gap-2 w-full mt-2">
                      {activeFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilter('all');
                            setFiltersExpanded(false);
                          }}
                          className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100"
                        >
                          Todas {filterCounts.all > 0 ? `(${filterCounts.all})` : ''}
                        </button>
                      )}
                      {activeFilter !== 'pending_payment' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilter('pending_payment');
                            setFiltersExpanded(false);
                          }}
                          className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100"
                        >
                          Pendiente de pago {filterCounts.pending_payment > 0 ? `(${filterCounts.pending_payment})` : ''}
                        </button>
                      )}
                      {activeFilter !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilter('paid');
                            setFiltersExpanded(false);
                          }}
                          className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100"
                        >
                          Pagadas {filterCounts.paid > 0 ? `(${filterCounts.paid})` : ''}
                        </button>
                      )}
                      {activeFilter !== 'shipped' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilter('shipped');
                            setFiltersExpanded(false);
                          }}
                          className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100"
                        >
                          Enviadas {filterCounts.shipped > 0 ? `(${filterCounts.shipped})` : ''}
                        </button>
                      )}
                      {activeFilter !== 'delivered' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilter('delivered');
                            setFiltersExpanded(false);
                          }}
                          className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100"
                        >
                          Entregadas {filterCounts.delivered > 0 ? `(${filterCounts.delivered})` : ''}
                        </button>
                      )}
                      {activeFilter !== 'rated' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilter('rated');
                            setFiltersExpanded(false);
                          }}
                          className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100"
                        >
                          Calificadas {filterCounts.rated > 0 ? `(${filterCounts.rated})` : ''}
                        </button>
                      )}
                      {activeFilter !== 'not_rated' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilter('not_rated');
                            setFiltersExpanded(false);
                          }}
                          className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100"
                        >
                          Sin calificar {filterCounts.not_rated > 0 ? `(${filterCounts.not_rated})` : ''}
                        </button>
                      )}
                      {activeFilter !== 'with_dispute' && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveFilter('with_dispute');
                            setFiltersExpanded(false);
                          }}
                          className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition bg-gray-50 text-gray-700 hover:bg-gray-100"
                        >
                          Con disputa {filterCounts.with_dispute > 0 ? `(${filterCounts.with_dispute})` : ''}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {isBooting ? (
              <div className="mt-6 text-sm text-gray-600">Cargando...</div>
            ) : orders.length === 0 ? (
              <div className="mt-6 text-sm text-gray-600">A�n no tienes compras.</div>
            ) : filteredOrders.length === 0 ? (
              <div className="mt-6 text-sm text-gray-600">No hay compras que coincidan con este filtro o b�squeda.</div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="text-[11px] font-bold uppercase text-gray-500">Compras</span>
                  <span className="text-xs text-gray-600">Filtra y usa Anterior/Siguiente para buscar. No se borra ninguna operaci�n.</span>
                </div>
                <div className="mt-4 space-y-3" data-tour="orders-list">
                  {comprasPaginated.map((o) => {
                    const sellerId = String(o?.seller_id || '');
                    const seller = sellerId ? sellerNames[sellerId] || `${sellerId.slice(0, 6)}...` : '�';
                    const items = itemsByOrder[String(o?.id || '')] ?? [];
                    const isAuction = String((o as any)?.order_source || '').toLowerCase() === 'auction' || items.some((it: any) => (it.listings as any)?.sale_type === 'auction');
                    const orderId = String(o?.id || '').trim();
                    const firstItemForType = items[0];
                    const firstListingId = String(firstItemForType?.listing_id || '').trim();
                    const isDigitalOrder = items.some((it: any) => {
                      const lid = String(it?.listing_id || '').trim();
                      const lj = (it as any)?.listings || null;
                      if (String(lj?.product_type || '').toLowerCase() === 'digital') return true;
                      if (String(productTypeByListingId[lid] || '').toLowerCase() === 'digital') return true;
                      return false;
                    }) || String((o as any)?.product_type || '').toLowerCase() === 'digital'
                      || String((o as any)?.shipping_method || '').trim().toLowerCase() === 'digital'
                      || String((o as any)?.shipping_snapshot?.product_type || '').toLowerCase() === 'digital'
                      || String((o as any)?.shipping_option_id || '').trim().toLowerCase() === 'digital';

                    const status = String(o?.status || '').trim();
                    const tracking = String(o?.tracking_number || '').trim();
                    const carrier = String(o?.shipping_carrier || '').trim();
                    const shippedAt = String(o?.shipped_at || '').trim();
                    const selfEvidence = String(o?.self_ship_evidence_url || '').trim();
                    const proofUrl = String(o?.delivery_proof_url || '').trim();
                    const hasUnread = Boolean(hasUnreadByOrderId[orderId]);
                    const alreadyRated = Boolean(ratedByOrderId[orderId]);
                    const bothRated = Boolean(bothRatedByOrderId[orderId]);
                    const isPickup = (
                      String(o?.shipping_option_id || '').toLowerCase() === 'pickup' ||
                      String(o?.shipping_carrier || '').trim().toLowerCase() === 'pickup'
                    );

                    const canConfirmReceived = Boolean(
                      orderId &&
                      sellerId &&
                      !alreadyRated &&
                      (
                        status === 'shipped' ||
                        status === 'delivered' ||
                        status === 'completed' ||
                        (status === 'paid' && (isPickup || tracking || selfEvidence || proofUrl || shippedAt))
                      )
                    );
                    const canRateWithoutConfirm = Boolean(
                      orderId &&
                      sellerId &&
                      !alreadyRated &&
                      (
                        status === 'refunded' ||
                        status === 'cancelled' ||
                        status === 'canceled'
                      )
                    );
                    const isPickupPendingConfirm = (status === 'delivered' || status === 'paid') && isPickup && !alreadyRated;
                    const isPaid = status === 'paid' || status === 'shipped' || status === 'delivered' || status === 'completed';
                    const isCompleted = status === 'completed' || status === 'delivered';
                    const disputeId = orderId ? disputeByOrderId[orderId] : '';
                    const canOpenDispute = Boolean(orderId && isPaid && !disputeId);
                    console.log('[COMPRAS] Renderizando orden:', {
                      orderId,
                      disputeId,
                      hasDispute: Boolean(disputeId),
                      disputeInfo: disputeId ? disputeInfoByOrderId[orderId] : null,
                    });
                    return (
                      <div key={String(o?.id || Math.random())} className={`rounded-xl border-2 border-blue-200 bg-white p-3 shadow-sm ring-1 ring-blue-100 hover:shadow-md hover:border-blue-300 transition-all ${hasUnread ? 'bg-blue-50/30 border-blue-300' : ''}`}>
                        <div className="border-l-4 border-blue-500 pl-3 -ml-3">
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-extrabold text-white uppercase">
                                  Tu Compra
                                </span>
                                <OrderSourceChip isAuction={isAuction} />
                                <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                  <span className="font-mono">{String(o?.id || '')}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const txt = String(o?.id || '').trim();
                                      if (txt) navigator.clipboard?.writeText(txt).catch(() => { });
                                    }}
                                    className="ml-1 rounded bg-gray-200 px-1 py-[1px] text-[10px] font-extrabold text-gray-800 hover:bg-gray-300 active:scale-95"
                                    aria-label="Copiar ID"
                                    title="Copiar ID"
                                  >
                                    Copiar
                                  </button>
                                </div>
                                {status === 'pending_payment' || status === 'awaiting_voucher' || status === 'verifying_payment' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 ring-1 ring-red-300">
                                    PENDIENTE PAGO
                                  </span>
                                ) : status === 'paid' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-extrabold text-green-800 ring-1 ring-green-300">
                                    PAGADO
                                  </span>
                                ) : status === 'shipped' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 ring-1 ring-blue-300">
                                    ENVIADO
                                  </span>
                                ) : status === 'delivered' || status === 'completed' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 ring-1 ring-purple-300">
                                    COMPLETADO
                                  </span>
                                ) : status === 'cancelled' ? (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
                                    Cancelado
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                                    {status?.toUpperCase() || '�'}
                                  </span>
                                )}
                                {(o as any)?.payment_method === 'mercadopago' && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 ring-1 ring-sky-300">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M12 5l7 7-7 7" /></svg>
                                    MercadoPago
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">{formatDateTime(o?.created_at)}</span>
                                {disputeId ? (() => {
                                  const di = disputeInfoByOrderId[orderId];
                                  const open = di?.status === 'open';
                                  const start = di?.created_at ? new Date(di.created_at).getTime() : 0;
                                  const ok = Number.isFinite(start) && start > 0;
                                  const end = ok ? start + 72 * 60 * 60 * 1000 : 0;
                                  const d = ok ? end - currentTime.getTime() : -1;
                                  const ex = d <= 0;
                                  const h = Math.max(0, Math.floor(d / (1000 * 60 * 60)));
                                  const m = Math.max(0, Math.floor((d % (1000 * 60 * 60)) / (1000 * 60)));
                                  const s = Math.max(0, Math.floor((d % (1000 * 60)) / 1000));
                                  if (!open) return null;
                                  return (
                                    <Link
                                      href={`/dashboard/disputas/${disputeId}`}
                                      className="inline-flex items-center gap-1.5 rounded-full border-2 border-red-400 bg-red-50 px-2.5 py-0.5 text-xs font-extrabold text-red-900 shadow-sm hover:bg-red-100"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                      </svg>
                                      {ok && !ex ? (
                                        <span>Disputa � {h}h {m}m {s}s</span>
                                      ) : (
                                        <span>Disputa � Admin revisar�</span>
                                      )}
                                    </Link>
                                  );
                                })() : status === 'disputed' ? (
                                  <Link
                                    href="/dashboard/devoluciones"
                                    className="inline-flex items-center gap-1.5 rounded-full border-2 border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-extrabold text-red-900 shadow-sm hover:bg-red-100"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10" />
                                      <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span>Ver disputa</span>
                                  </Link>
                                ) : null}
                              </div>

                              <div className="mt-3 mb-2 flex flex-col gap-1">
                                {(() => {
                                  const sm = String((o as any)?.shipping_method || '').trim();
                                  const carrierVal = String(o?.shipping_carrier || '').trim();
                                  const optId = String(o?.shipping_option_id || '').trim().toLowerCase();
                                  const orderProductType = String((o as any)?.product_type || '').toLowerCase();
                                  const snapProductType = String((o as any)?.shipping_snapshot?.product_type || '').toLowerCase();
                                  const isDigital = isDigitalOrder || sm === 'digital' || optId === 'digital' || carrierVal.toLowerCase() === 'digital' || orderProductType === 'digital' || snapProductType === 'digital';
                                  const isPersonalDeliveryChip = optId === 'pickup' || sm === 'personal_delivery' || carrierVal.toLowerCase() === 'pickup';
                                  const isT1 = sm === 't1';
                                  const isGoVendy = !isDigital && (sm === 'gopocket' || sm === 't1' || (!sm && optId !== 'pickup' && !Boolean((o as any)?.shipping_by_seller)));

                                  return (
                                    <>
                                      <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">{isDigital ? 'Tipo de Entrega:' : 'M�todo de Env�o:'}</span>
                                      {isDigital ? (
                                        <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200 shadow-sm w-fit">
                                          ?? PRODUCTO DIGITAL
                                        </div>
                                      ) : isPersonalDeliveryChip ? (
                                        <div className="inline-flex items-center gap-2 rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-800 ring-1 ring-purple-600/20 shadow-sm w-fit">
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                          ENTREGA PERSONAL
                                        </div>
                                      ) : isGoVendy ? (
                                        isT1 ? (
                                          <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-1.5 text-xs font-bold text-orange-800 ring-1 ring-orange-300 shadow-sm w-fit">
                                            ?? GOPOCKET PREMIUM {carrierVal ? `� ${carrierVal}` : ''}
                                          </div>
                                        ) : (
                                          <div className="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-800 ring-1 ring-blue-700/20 shadow-sm w-fit">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                            ENVIADO POR GOPOCKET
                                          </div>
                                        )
                                      ) : o?.self_ship_evidence_url ? (
                                        <div className="inline-flex items-center gap-2 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800 ring-1 ring-green-600/20 shadow-sm w-fit">
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                          ENV�O GESTIONADO
                                        </div>
                                      ) : (
                                        <div className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 ring-1 ring-amber-600/30 shadow-sm w-fit">
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.19" /><line x1="15" y1="9" x2="15.01" y2="9" /><line x1="19" y1="9" x2="19.01" y2="9" /><line x1="23" y1="9" x2="23.01" y2="9" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
                                          ENV�O POR VENDEDOR
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>

                              {/* Contador 7 d�as Subasta */}
                              {isAuction && !shippedAt && (status === 'pending_payment' || status === 'awaiting_voucher' || status === 'verifying_payment' || status === 'paid') && (
                                <div className="mb-2">
                                  <AuctionDeadline createdAt={o?.created_at} orderStatus={o?.status} />
                                </div>
                              )}

                              <div className="mt-1.5 flex flex-col items-start gap-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                                <span className="text-[10px] font-bold uppercase text-blue-800">Comprado a:</span>
                                {sellerId ? (
                                  <SellerDisplay
                                    sellerId={sellerId}
                                    sellerName={seller}
                                    state={sellerStateById[sellerId] ?? null}
                                    city={sellerCityById[sellerId] ?? null}
                                    operationsCount={sellerOperationsById[sellerId] ?? null}
                                    size="md"
                                    storeLogoUrl={sellerLogoById[sellerId] ?? null}
                                    planType={sellerPlanById[sellerId] ?? 'basic'}
                                  />
                                ) : (
                                  <span className="text-[10px] text-gray-600">�</span>
                                )}
                              </div>
                              {/* Art�culos: lista compacta con miniaturas */}
                              {items.length > 0 ? (
                                <div className="mt-2 space-y-1.5">
                                  {items.slice(0, 5).map((it: any, idx: number) => {
                                    const lid = String(it?.listing_id || '').trim();
                                    const t = (lid && titleByListingId[lid]) ? titleByListingId[lid] : String(it?.title || 'Art�culo');
                                    const img = lid ? thumbByListingId[lid] : '';
                                    const quantity = Number(it.quantity ?? 1) || 1;
                                    return (
                                      <div key={idx} className="flex gap-2 rounded-lg border border-gray-200 bg-white p-2 ring-1 ring-black/5 hover:bg-gray-50">
                                        {img ? (
                                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100 ring-1 ring-black/5">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={img} alt={t} className="h-full w-full object-cover" />
                                          </div>
                                        ) : (
                                          <div className="h-12 w-12 shrink-0 rounded-md bg-gray-100 ring-1 ring-black/5" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <Link
                                            href={`/listings/${String(it.listing_id)}`}
                                            className="text-sm font-extrabold text-gray-900 hover:text-brand-emerald hover:underline line-clamp-2"
                                          >
                                            {t}
                                          </Link>
                                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                                            <span className="font-semibold">Cantidad: x{quantity}</span>
                                            {it.selected_size && (
                                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 text-[10px] font-semibold">Talla: {it.selected_size}</span>
                                            )}
                                            {it.selected_color && (
                                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800 text-[10px] font-semibold">Color: {it.selected_color}</span>
                                            )}
                                          </div>
                                          {it.line_total && (
                                            <div className="mt-1 text-xs font-extrabold text-brand-emerald">
                                              {formatMoney(it.line_total)}
                                            </div>
                                          )}
                                          {/* Bot�n rese�a solo para �rdenes completadas/entregadas */}
                                          {(status === 'completed' || status === 'delivered') && lid && !reviewedListingIds.has(lid) && (
                                            <button
                                              type="button"
                                              onClick={() => setReviewListingId(lid)}
                                              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                                            >
                                              ? Dejar rese�a
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {items.length > 5 && (
                                    <div className="text-[11px] text-gray-500 py-1">
                                      +{items.length - 5} art�culo{items.length - 5 !== 1 ? 's' : ''} m�s
                                    </div>
                                  )}
                                </div>
                              ) : null}

                              {/* Entrega Digital � datos del producto */}
                              {isDigitalOrder && status !== 'pending_payment' ? (
                                <div className="mt-3">
                                  <DigitalDeliveryBuyer orderId={orderId} />
                                </div>
                              ) : null}

                              {/* Informaci�n de estado de pago y producto enviado */}
                              {status === 'pending_payment' || status === 'awaiting_voucher' || status === 'verifying_payment' ? (
                                <div className="mt-3 space-y-2">
                                  <div className="rounded-lg border border-emerald-200 bg-white/80 p-2.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div className="flex items-start gap-2">
                                        <span className="text-lg">??</span>
                                        <div>
                                          <h4 className="text-[11px] font-bold text-emerald-900">Finaliza tu compra</h4>
                                          <p className="text-[10px] text-emerald-800/80 leading-snug max-w-md">
                                            Orden reservada. Paga para que te env�en tus productos.
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex flex-col sm:flex-row gap-2">
                                        {status === 'pending_payment' && (
                                          <button
                                            type="button"
                                            onClick={() => handlePayOrder(orderId, Number(o?.total || 0))}
                                            disabled={isPaying[orderId]}
                                            className="shrink-0 rounded-md bg-brand-emerald px-4 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-brand-emerald/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                          >
                                            {isPaying[orderId] ? (
                                              <>
                                                <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Procesando...
                                              </>
                                            ) : (
                                              <>
                                                <span>Pagar ahora</span>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M5 12h14" />
                                                  <path d="M12 5l7 7-7 7" />
                                                </svg>
                                              </>
                                            )}
                                          </button>
                                        )}
                                        {status === 'pending_payment' && checkoutSessionByOrderId[orderId] && (
                                          <Link
                                            href={`/pago/${checkoutSessionByOrderId[orderId]}`}
                                            className="shrink-0 rounded-md bg-white border border-brand-emerald px-4 py-1.5 text-[11px] font-bold text-brand-emerald shadow-sm hover:bg-white flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                          >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                              <polyline points="17 8 12 3 7 8" />
                                              <line x1="12" y1="3" x2="12" y2="15" />
                                            </svg>
                                            Pagar en Línea
                                          </Link>
                                        )}
                                        {(status === 'awaiting_voucher' || status === 'verifying_payment') && (
                                          <Link
                                            href={`/orders/${orderId}/pay`}
                                            className="shrink-0 rounded-md bg-white border border-brand-emerald px-4 py-1.5 text-[11px] font-bold text-brand-emerald shadow-sm hover:bg-white flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                          >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                              <polyline points="17 8 12 3 7 8" />
                                              <line x1="12" y1="3" x2="12" y2="15" />
                                            </svg>
                                            {status === 'awaiting_voucher' ? 'Subir Comprobante' : 'Ver Comprobante'}
                                          </Link>
                                        )}
                                      </div>
                                    </div>
                                    <p className="mt-2 text-[9px] text-emerald-700/50 flex items-center gap-1">
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                      </svg>
                                      Pago seguro v�a MercadoPago. El chat se activa al acreditarse.
                                    </p>
                                  </div>
                                  {/* Contador de 48 horas - Reemplazado por componente estandarizado */}
                                  {isAuction ? (
                                    <AuctionDeadline createdAt={o?.created_at} orderStatus={o?.status} />
                                  ) : (
                                    <PaymentDeadlineWarning createdAt={o?.created_at} className="mt-2 text-xs" />
                                  )}
                                </div>
                              ) : (isPaid || status === 'shipped') ? (
                                <>
                                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    {isPaid ? (
                                      <div className="flex-1 rounded-lg border border-green-200 bg-white px-3 py-2">
                                        <div className="text-xs font-extrabold text-green-900">Tu compra est� protegida</div>
                                        <div className="mt-1 text-[11px] text-green-800/80">
                                          El dinero se le libera al vendedor hasta que confirmes de Recibido.
                                        </div>
                                      </div>
                                    ) : null}
                                    {status === 'shipped' ? (
                                      <div className="flex-1 rounded-xl border border-green-200 bg-white px-3 py-2">
                                        <div className="text-xs font-extrabold text-green-900">? Producto enviado</div>
                                        <div className="mt-1 text-[11px] text-green-800/80">
                                          Aseg�rate de tomar evidencias del art�culo que recibiste en caso de abrir una disputa.
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                  {isAuction && !shippedAt && (
                                    <AuctionDeadline createdAt={o?.created_at} orderStatus={o?.status} />
                                  )}
                                </>
                              ) : null}
                            </div>
                            <div className="shrink-0 rounded-xl bg-gray-50 px-4 py-3 text-sm ring-1 ring-black/5 w-full sm:w-auto sm:min-w-[240px]">
                              <div className="flex flex-col items-start gap-0">
                                <span className="text-xs font-bold text-gray-600">Total</span>
                                <span className="text-3xl font-black text-gray-900 tracking-tight">{formatMoney(o?.total)}</span>
                              </div>
                              <div className="mt-1.5 space-y-1.5 text-[10px] text-gray-700">
                                <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-1">
                                  <span className="text-gray-500">Subtotal</span>
                                  <span className="font-medium text-gray-900">{formatMoney(o?.subtotal || (toNumber(o?.total) - toNumber(o?.shipping_fee)))}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-gray-600">Env�o</span>
                                  <span className="font-semibold text-gray-900">
                                    {(o?.shipping_option_id === 'pickup' || o?.shipping_carrier === 'pickup')
                                      ? 'Entrega Personal (Gratis)'
                                      : (() => {
                                        const fee = Number(o?.shipping_fee || 0);
                                        if (fee === 0) {
                                          return <span className="text-green-600 font-bold">Gratis</span>;
                                        }
                                        return formatMoney(fee);
                                      })()
                                    }
                                  </span>
                                </div>
                                {toNumber(o?.coupon_discount) > 0 && (
                                  <div className="flex items-center justify-between gap-2 text-brand-emerald font-bold">
                                    <span>Cupn/Descuento</span>
                                    <span>-{formatMoney(o.coupon_discount)}</span>
                                  </div>
                                )}
                              </div>



                              {/* Peso y Dimensiones � compact */}
                              {(() => {
                                const oid = String(o?.id || '').trim();
                                const w = Number(weightByOrderId[oid] || 0);
                                const dims = dimsByOrderId[oid];
                                const hasWeight = w > 0;
                                const hasDims = dims && (dims.length_cm > 0 || dims.width_cm > 0 || dims.height_cm > 0);
                                if (!hasWeight && !hasDims) return null;
                                return (
                                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-500">
                                    <svg className="h-3 w-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    {hasWeight && <span className="font-semibold text-gray-700">{w.toFixed(2)} kg</span>}
                                    {hasWeight && hasDims && <span className="text-gray-300">�</span>}
                                    {hasDims && <span className="font-semibold text-gray-700">{Number(dims!.length_cm || 0)}x{Number(dims!.width_cm || 0)}x{Number(dims!.height_cm || 0)} cm</span>}
                                  </div>
                                );
                              })()}

                              {!isDigitalOrder && tracking ? (
                                <div className="mt-2 rounded-lg bg-white px-2.5 py-2 text-[10px] ring-1 ring-black/5">
                                  <div className="font-semibold text-gray-900 mb-1">Rastreo</div>
                                  <div className="space-y-0.5 text-gray-700">
                                    <div><span className="text-gray-500">Paq:</span> <span className="font-semibold">{carrier || '�'}</span></div>
                                    <div className="truncate"><span className="text-gray-500">C�d:</span> <span className="font-semibold">{tracking}</span></div>
                                    <div className="text-gray-500 text-[9px]">{formatDateTime(shippedAt)}</div>
                                  </div>
                                </div>
                              ) : !isDigitalOrder ? (
                                <div className="mt-2 text-[10px] text-gray-500">Sin rastreo a�n</div>
                              ) : null}

                              {/* Contador de 48h para confirmar recepci�n/calificar */}
                              {status === 'delivered' && !isCompleted && (
                                <PaymentDeadlineWarning createdAt={o.delivered_at} className="mt-2 text-xs" />
                              )}

                              {orderId ? (
                                <div className="mt-3 flex flex-col gap-2">
                                  {alreadyRated && sellerId ? (
                                    <Link
                                      href={`/tienda/${sellerId}`}
                                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-2.5 py-2.5 text-[11px] font-semibold text-sky-600 shadow-sm ring-1 ring-sky-200 hover:bg-sky-50"
                                    >
                                      Visita tienda
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setChatOrderId(orderId);
                                        setChatOpen(true);
                                        setHasUnreadByOrderId((p) => ({ ...p, [orderId]: false }));
                                      }}
                                      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-[11px] font-bold shadow-sm ring-1 transition-all ${
                                        hasUnread 
                                          ? 'bg-brand-emerald text-white ring-brand-emerald hover:opacity-90 animate-pulse' 
                                          : 'bg-brand-emerald text-white ring-brand-emerald hover:opacity-90'
                                      }`}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                      </svg>
                                      Contactar Vendedor
                                      {hasUnread ? <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-extrabold text-brand-emerald">NUEVO</span> : null}
                                    </button>
                                  )}

                                  {!disputeId && canOpenDispute && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDisputeOrderId(orderId);
                                        setDisputeReason('not_received');
                                        setDisputeText('');
                                        setDisputeOpen(true);
                                      }}
                                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-50 px-2.5 py-2.5 text-[11px] font-bold text-amber-900 shadow-sm ring-1 ring-amber-200 hover:bg-amber-100 transition-all active:scale-95"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                      </svg>
                                      Abrir disputa
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => generateOrderNote(o, items, sellerNames[o.seller_id])}
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-2.5 py-2.5 text-[11px] font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
                                  >
                                    Descargar Nota
                                  </button>

                                  {canConfirmReceived && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRateOrderId(orderId);
                                        setRateSellerId(sellerId);
                                        setRateStars(10);
                                        setRateComment('');
                                        setRateOpen(true);
                                      }}
                                      className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-4 py-3.5 text-xs font-extrabold text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/40 active:scale-95 animate-pulse"
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-200%] group-hover:animate-[shimmer_1.5s_infinite]" />
                                      <div className="flex items-center justify-center gap-2">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span className="tracking-wide drop-shadow-sm">YA RECIB� - CALIFICAR</span>
                                      </div>
                                    </button>
                                  )}

                                  {canRateWithoutConfirm && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRateOrderId(orderId);
                                        setRateSellerId(sellerId);
                                        setRateStars(10);
                                        setRateComment('');
                                        setRateOpen(true);
                                      }}
                                      className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-4 py-3.5 text-xs font-extrabold text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/40 active:scale-95"
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-200%] group-hover:animate-[shimmer_1.5s_infinite]" />
                                      <div className="flex items-center justify-center gap-2">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span className="tracking-wide drop-shadow-sm">CALIFICAR VENDEDOR</span>
                                      </div>
                                    </button>
                                  )}

                                  {!canConfirmReceived && alreadyRated ? (
                                    <div className="space-y-1">
                                      <span className="inline-flex w-full items-center justify-center rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-green-800 ring-1 ring-green-100">
                                        ? Calificado
                                      </span>
                                      {bothRated && (
                                        <div className="rounded-lg border border-green-300 bg-green-100 px-2.5 py-1.5">
                                          <div className="text-[10px] font-extrabold text-green-900">? Excelente</div>
                                        </div>
                                      )}
                                    </div>
                                  ) : status === 'completed' ? (
                                    <span className="inline-flex w-full items-center justify-center rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-green-800 ring-1 ring-green-100">
                                      Confirmado
                                    </span>
                                  ) : null}

                                  {disputeId ? (() => {
                                    const disputeInfo = disputeInfoByOrderId[orderId];
                                    const isOpen = disputeInfo?.status === 'open';
                                    const isResolved = disputeInfo?.status === 'resolved' || disputeInfo?.status === 'closed';
                                    const disputeCreatedAt = disputeInfo?.created_at ? new Date(disputeInfo.created_at).getTime() : 0;
                                    const hasValidStart = Number.isFinite(disputeCreatedAt) && disputeCreatedAt > 0;
                                    const deadline = hasValidStart ? disputeCreatedAt + 72 * 60 * 60 * 1000 : 0;
                                    const diff = hasValidStart ? deadline - currentTime.getTime() : -1;
                                    const expired = diff <= 0;
                                    const hoursRemaining = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
                                    const minutesRemaining = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
                                    const secondsRemaining = Math.max(0, Math.floor((diff % (1000 * 60)) / 1000));

                                    if (isResolved) {
                                      const adminDecision = disputeInfo?.admin_decision;
                                      const adminNote = disputeInfo?.admin_note;

                                      // Funci�n para obtener el label de la decisi�n
                                      const getDecisionLabel = (decision: string | null | undefined): string => {
                                        if (!decision) return 'Resuelta';
                                        const d = String(decision).toLowerCase();
                                        if (d === 'release') return 'Pago liberado al vendedor';
                                        if (d === 'refund') return 'Reembolso al comprador';
                                        if (d === 'close') return 'Disputa cerrada';
                                        if (d === 'assign_return_tracking' || d === 'assign_guide_charged_buyer' || d === 'assign_guide_charged_seller') return 'Gu�a de devoluci�n asignada';
                                        if (d === 'keep_money_seller') return 'Dinero mantenido al vendedor';
                                        if (d === 'partial_refund_seller') return 'Reembolso parcial al vendedor';
                                        if (d === 'partial_refund_buyer') return 'Reembolso parcial al comprador';
                                        if (d === 'refund_buyer_minus_fees') return 'Reembolso al comprador (menos comisiones)';
                                        if (d === 'refund_seller_minus_fees') return 'Pago al vendedor (menos comisiones)';
                                        return decision;
                                      };

                                      const decisionLabel = getDecisionLabel(adminDecision);

                                      return (
                                        <div className="space-y-2">
                                          <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 cursor-not-allowed opacity-75">
                                            Disputa
                                          </div>
                                          <div className="rounded-xl border-2 border-green-300 bg-white px-3 py-2 shadow-sm">
                                            <div className="text-xs font-extrabold text-green-900">
                                              Disputa resuelta: {decisionLabel}
                                            </div>
                                            {adminNote && (
                                              <div className="mt-1 text-[10px] text-green-800">
                                                {adminNote}
                                              </div>
                                            )}
                                            <div className="mt-2 text-[10px] font-semibold text-green-900">
                                              Esta disputa se finaliz�. Agradecemos tu apoyo.
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div className="space-y-2">
                                        <Link
                                          href={`/dashboard/disputas/${disputeId}`}
                                          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 ${isOpen ? 'animate-pulse bg-red-600 ring-2 ring-red-400' : 'bg-red-500'
                                            }`}
                                        >
                                          Disputa
                                        </Link>
                                        {isOpen && hasValidStart && !expired ? (
                                          <div className="rounded-xl border-2 border-red-400 bg-red-50 px-3 py-2 shadow-sm">
                                            <div className="flex items-start gap-2">
                                              <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="#dc2626"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="mt-0.5 shrink-0"
                                              >
                                                <circle cx="12" cy="12" r="10" />
                                                <polyline points="12 6 12 12 16 14" />
                                              </svg>
                                              <div className="flex-1">
                                                <div className="text-xs font-extrabold text-red-900">
                                                  Tiempo para resolver: {hoursRemaining}h {minutesRemaining}m {secondsRemaining}s
                                                </div>
                                                <div className="mt-0.5 text-[10px] text-red-800">
                                                  Tienes 72 horas para resolver con el comprador o el vendedor antes de que un mediador vea tu caso y d� una resoluci�n.
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ) : isOpen && (expired || !hasValidStart) ? (
                                          <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2">
                                            <div className="text-xs font-extrabold text-gray-900">
                                              El administrador revisar� tu caso
                                            </div>
                                            <div className="mt-0.5 text-[10px] text-gray-800">
                                              {expired && hasValidStart
                                                ? 'El tiempo para resolver ha expirado. El administrador tomar� una decisi�n definitiva.'
                                                : 'Puedes ver el estado en el chat de la disputa.'}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })() : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-xs text-gray-600">
                    {filteredOrders.length} compra(s) en total � P�gina {Math.min(comprasPage, comprasTotalPages)} de {comprasTotalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setComprasPage((p) => Math.max(1, p - 1))}
                      disabled={comprasPage <= 1}
                      className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setComprasPage((p) => Math.min(comprasTotalPages, p + 1))}
                      disabled={comprasPage >= comprasTotalPages}
                      className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/10 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Secci�n de Gu�as Estafeta - moved to its own tab */}
          </div>
        </>)}

        {/* --- TAB: GU�AS ESTAFETA --- */}
        {comprasTab === 'estafeta' && (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/estafeta-logo.svg"
                  alt="Estafeta"
                  className="h-10 w-auto object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.parentElement) {
                      target.parentElement.innerHTML = `
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 7h12v10H3V7Z" />
                          <path d="M15 10h4l2 3v4h-6v-7Z" />
                          <path d="M7 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
                          <path d="M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
                        </svg>
                      `;
                    }
                  }}
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Gu�as de env�o Estafeta</h2>
                <p className="mt-0.5 text-sm text-gray-600">Tus gu�as de env�o compradas</p>
              </div>
            </div>

            {estafetaQuotes.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3">??</div>
                <div className="text-sm font-semibold text-gray-500">No tienes gu�as de env�o</div>
                <p className="mt-1 text-xs text-gray-400">Cuando compres gu�as Estafeta en la tienda, aparecer�n aqu�</p>
                <Link href="/dashboard/estafeta" className="mt-4 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition">
                  Ir a Tienda Estafeta
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {estafetaQuotes.map((quote) => {
                  const hasGuide = Boolean(quote.guide_file_url);
                  const isProcessing = quote.status === 'processing';

                  return (
                    <div
                      key={quote.id}
                      className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 hover:bg-blue-100/50 transition"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-extrabold text-white uppercase">
                              Gu�a Estafeta
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                              {quote.id.slice(0, 8)}...
                            </span>
                            <span className="text-xs text-gray-500">{formatDateTime(quote.created_at)}</span>
                            {quote.paid_at && (
                              <span className="text-xs text-green-700">Pagado: {formatDateTime(quote.paid_at)}</span>
                            )}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg border border-blue-200 bg-white p-2.5">
                              <div className="text-[10px] font-semibold text-gray-600">Paquete</div>
                              <div className="mt-0.5 text-xs text-gray-900">
                                {quote.weight_kg} kg � {quote.length_cm}x{quote.width_cm}x{quote.height_cm} cm
                              </div>
                              <div className="mt-1 text-sm font-extrabold text-brand-emerald">{formatMoney(quote.calculated_cost)}</div>
                            </div>

                            <div className="rounded-lg border border-blue-200 bg-white p-2.5">
                              <div className="text-[10px] font-semibold text-gray-600">Ruta</div>
                              <div className="mt-0.5 text-xs text-gray-900">
                                {quote.sender_city}, {quote.sender_state} ? {quote.recipient_city}, {quote.recipient_state}
                              </div>
                            </div>
                          </div>

                          {hasGuide && (
                            <div className="mt-3 rounded-lg border-2 border-green-300 bg-white p-3">
                              <div className="flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-700">
                                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div className="flex-1">
                                  <div className="text-xs font-extrabold text-green-900">�Gracias por tu compra!</div>
                                  <div className="mt-0.5 text-[10px] text-green-800">Tu gu�a est� lista para descargar</div>
                                </div>
                                <a
                                  href={quote.guide_file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  className="rounded-lg bg-green-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
                                >
                                  Descargar Gu�a
                                </a>
                              </div>
                            </div>
                          )}

                          {!hasGuide && isProcessing && (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <div className="text-xs font-semibold text-amber-900">? Procesando tu gu�a</div>
                              <div className="mt-0.5 text-[10px] text-amber-800">Estamos preparando tu gu�a. Te notificaremos cuando est� lista.</div>
                            </div>
                          )}

                          {!hasGuide && quote.status === 'paid' && (
                            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                              <div className="text-xs font-semibold text-blue-900">? Pago acreditado</div>
                              <div className="mt-0.5 text-[10px] text-blue-800">Tu gu�a se est� procesando. Estar� disponible pronto.</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- TAB: POCKETCASH --- */}
        {comprasTab === 'pocketcash' && (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white ring-1 ring-green-200">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-700">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Recargas PocketCash</h2>
                <p className="mt-0.5 text-sm text-gray-600">Historial de tus recargas de saldo</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-gray-500">Saldo actual</div>
                <div className="text-lg font-extrabold text-green-700">{formatMoney(walletBalance)}</div>
              </div>
            </div>

            {allTopups.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-4xl mb-3">??</div>
                <div className="text-sm font-semibold text-gray-500">No tienes recargas</div>
                <p className="mt-1 text-xs text-gray-400">Cuando recargues saldo PocketCash, tu historial aparecer� aqu�</p>
                <Link href="/dashboard/pocketcash" className="mt-4 inline-block rounded-xl bg-green-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-green-700 transition">
                  Recargar Saldo
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {allTopups.map((topup) => {
                  const statusConfig: Record<string, { label: string; color: string; bg: string; ring: string }> = {
                    pending_proof: { label: 'Esperando comprobante', color: 'text-orange-800', bg: 'bg-orange-50', ring: 'ring-orange-200' },
                    pending_approval: { label: 'En revisi�n', color: 'text-blue-800', bg: 'bg-blue-50', ring: 'ring-blue-200' },
                    approved: { label: 'Aprobada', color: 'text-green-800', bg: 'bg-white', ring: 'ring-green-200' },
                    completed: { label: 'Completada', color: 'text-green-800', bg: 'bg-white', ring: 'ring-green-200' },
                    rejected: { label: 'Rechazada', color: 'text-red-800', bg: 'bg-red-50', ring: 'ring-red-200' },
                    cancelled: { label: 'Cancelada', color: 'text-gray-800', bg: 'bg-gray-50', ring: 'ring-gray-200' },
                  };
                  const st = statusConfig[topup.status] || { label: topup.status, color: 'text-gray-800', bg: 'bg-gray-50', ring: 'ring-gray-200' };
                  const isPending = topup.status === 'pending_proof' || topup.status === 'pending_approval';

                  return (
                    <div
                      key={topup.id}
                      className={`rounded-2xl border-2 p-4 transition ${isPending ? 'border-amber-200 bg-amber-50/50' : topup.status === 'approved' || topup.status === 'completed' ? 'border-green-200 bg-white/30' : 'border-gray-200 bg-gray-50/50'
                        }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ring-1 ${st.bg} ${st.color} ${st.ring}`}>
                              {st.label}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 font-mono">
                              {topup.id.slice(0, 8)}...
                            </span>
                            <span className="text-xs text-gray-500">{formatDateTime(topup.created_at)}</span>
                          </div>
                          <div className="text-sm font-bold text-gray-900">Recarga de Saldo</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            M�todo: {topup.metadata?.payment_method === 'spei' ? 'SPEI' : topup.metadata?.payment_method === 'oxxo' ? 'OXXO' : topup.metadata?.payment_method === 'mercadopago' ? 'MercadoPago' : topup.metadata?.payment_method || 'N/A'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-extrabold text-gray-900">{formatMoney(topup.amount)}</div>
                          {topup.proof_url && (
                            <a href={topup.proof_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline font-semibold">
                              Ver comprobante
                            </a>
                          )}
                        </div>
                      </div>

                      {topup.status === 'pending_proof' && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              disabled={uploadingProofId === topup.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadProof(topup.id, file);
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <button
                              disabled={uploadingProofId === topup.id}
                              className="w-full rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                            >
                              {uploadingProofId === topup.id ? 'Subiendo...' : '?? Subir Comprobante'}
                            </button>
                          </div>
                          <button
                            onClick={() => setSelectedTopupForInfo(topup)}
                            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                          >
                            Ver Instrucciones
                          </button>
                        </div>
                      )}
                      {topup.status === 'pending_approval' && (
                        <div className="mt-2 text-xs font-medium text-blue-600 italic">
                          Tu comprobante est� siendo revisado por el equipo.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>


      <OrderChatFloating
        open={chatOpen}
        orderId={chatOrderId}
        onClose={() => {
          setChatOpen(false);
        }}
      />

      {
        disputeOpen ? (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/10">
              <div className="border-b border-black/5 px-5 py-4">
                <div className="text-sm font-extrabold text-gray-900">Abrir disputa</div>
                <div className="mt-1 text-xs text-gray-600">
                  Esto abrir� un chat con soporte y notificar� al vendedor. La operaci�n quedar� en revisi�n.
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="text-xs font-semibold text-gray-900">Motivo</div>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value as any)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                >
                  <option value="not_received">No recib� mi pedido</option>
                  <option value="damaged">Lleg� da�ado</option>
                  <option value="not_as_described">No es como se describ�a</option>
                  <option value="missing_items">Faltan art�culos</option>
                  <option value="other">Otro</option>
                </select>

                <div className="mt-4 text-xs font-semibold text-gray-900">Detalle (opcional)</div>
                <textarea
                  value={disputeText}
                  onChange={(e) => setDisputeText(e.target.value)}
                  placeholder="Describe el problema (sin enlaces ni tel�fonos)."
                  className="mt-2 h-28 w-full resize-none rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                />
                <div className="mt-1 text-[11px] text-gray-500">M�x. 600 caracteres.</div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-black/5 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setDisputeOpen(false)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                  disabled={isOpeningDispute}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setError(null);
                    setSuccess(null);
                    const orderId = String(disputeOrderId || '').trim();
                    if (!orderId) return;
                    setIsOpeningDispute(true);
                    try {
                      const { data: sess } = await supabase.auth.getSession();
                      const token = sess.session?.access_token;
                      if (!token) throw new Error('Auth session missing');
                      const res = await fetch('/api/disputes/open', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                        cache: 'no-store',
                        body: JSON.stringify({ orderId, reason_code: disputeReason, reason_text: disputeText }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(json?.error || 'No se pudo abrir la disputa.');
                      const disputeId = String(json?.disputeId || '').trim();
                      if (disputeId) {
                        setDisputeByOrderId((p) => ({ ...p, [orderId]: disputeId }));
                        setDisputeOpen(false);
                        window.location.href = `/dashboard/devoluciones/${disputeId}`;
                        return;
                      }
                      setSuccess('Disputa creada.');
                      setDisputeOpen(false);
                    } catch (e: unknown) {
                      console.error(e);
                      setError(e instanceof Error ? e.message : 'No se pudo abrir la disputa.');
                    } finally {
                      setIsOpeningDispute(false);
                    }
                  }}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
                  disabled={isOpeningDispute || !disputeOrderId}
                >
                  {isOpeningDispute ? 'Abriendo...' : 'Abrir disputa'}
                </button>
              </div>
            </div>
          </div>
        ) : null
      }

      {
        rateOpen ? (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/10">
              <div className="border-b border-black/5 px-5 py-4">
                <div className="text-sm font-extrabold text-gray-900">Confirmar recepci�n</div>
                <div className="mt-1 text-xs text-gray-600">Esto libera el pago y te permite calificar al vendedor.</div>
              </div>

              <div className="px-5 py-4">
                <div className="text-xs font-semibold text-gray-900">Calificaci�n (1 a 10)</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const v = i + 1;
                    const active = v <= rateStars;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRateStars(v)}
                        className={`h-9 w-9 rounded-xl text-sm font-extrabold ring-1 transition ${active ? 'bg-brand-emerald text-white ring-brand-emerald' : 'bg-white text-gray-700 ring-black/10 hover:bg-white'
                          }`}
                        aria-label={`${v} estrellas`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Seleccionado: <span className="font-semibold text-gray-900">{rateStars}/10</span>
                </div>

                <div className="mt-4 text-xs font-semibold text-gray-900">Comentario (opcional)</div>
                <textarea
                  value={rateComment}
                  onChange={(e) => setRateComment(e.target.value)}
                  placeholder="Cuenta tu experiencia (sin enlaces ni tel�fonos)."
                  className="mt-2 h-28 w-full resize-none rounded-2xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                />
                <div className="mt-1 text-[11px] text-gray-500">M�x. 600 caracteres.</div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-black/5 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setRateOpen(false)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                  disabled={isSubmittingRating}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void submitReceivedAndRate()}
                  className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
                  disabled={isSubmittingRating || !rateOrderId || rateStars < 1 || rateStars > 10}
                >
                  {isSubmittingRating ? 'Enviando...' : 'Confirmar y calificar'}
                </button>
              </div>
            </div>
          </div>
        ) : null
      }

      {/* Payment Modal */}
      {
        payModalOpen && payOrderData ? (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/10">
              <div className="border-b border-black/5 px-5 py-4">
                <div className="text-sm font-extrabold text-gray-900">Selecciona m�todo de pago</div>
                <div className="mt-1 text-xs text-gray-600">
                  Total orden: <span className="font-bold text-gray-900">{formatMoney(paymentCalculations.total)}</span>
                  {paymentCalculations.fee > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      <div className="flex justify-between text-gray-500">
                        <span>Comisi�n MP + IVA:</span>
                        <span>+ {formatMoney(paymentCalculations.fee)}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-100 pt-1 text-sm font-extrabold text-blue-600">
                        <span>Total a pagar:</span>
                        <span>{formatMoney(paymentCalculations.finalTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-3">
                {error && (
                  <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <span>??���</span> Error
                    </div>
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-xl bg-white p-3 text-xs text-emerald-700 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <span>?</span> �xito
                    </div>
                    {success}
                  </div>
                )}

                {showAuctionShippingChoice && (
                  <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/60 p-4 shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm">??</div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">M�todo de env�o</div>
                          <div className="text-xs text-gray-500">Elige c�mo recibir tu pedido</div>
                        </div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-bold ${shippingMode === 'pickup'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700'
                        }`}>
                        {shippingMode === 'pickup'
                          ? '?? Entrega personal'
                          : isSellerShippingPayment || isFreeShippingPayment
                            ? '?? Env�o vendedor'
                            : '?? Env�o GoVendy'}
                      </div>
                    </div>

                    {/* Shipping options grid */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* GoVendy option */}
                      <button
                        type="button"
                        onClick={() => {
                          if (shippingMode === 'gopocket' || isUpdatingShipping) return;
                          void handleSelectGoVendyShipping();
                        }}
                        disabled={isUpdatingShipping}
                        className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200 ${shippingMode === 'gopocket'
                          ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100 ring-1 ring-blue-300'
                          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm'
                          } ${isUpdatingShipping ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                      >
                        {shippingMode === 'gopocket' && (
                          <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-xs">?</div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xl">??</span>
                          <span className="text-sm font-bold text-gray-900">
                            {isSellerShippingPayment || isFreeShippingPayment ? 'Env�o vendedor' : 'Env�o GoVendy'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {isSellerShippingPayment || isFreeShippingPayment
                            ? 'El vendedor gestiona el env�o'
                            : 'Estafeta / FedEx � rastreo incluido'}
                        </div>
                        <div className={`text-sm font-extrabold ${shippingFeePayment > 0 ? 'text-blue-700' : 'text-emerald-600'}`}>
                          {shippingFeePayment > 0 ? formatMoney(shippingFeePayment) : '�Gratis!'}
                        </div>
                      </button>

                      {/* Pickup option � only if seller enabled personal delivery */}
                      {allowPersonalDeliveryPayment && (
                        <button
                          type="button"
                          onClick={() => {
                            if (shippingMode === 'pickup' || isUpdatingShipping) return;
                            void handleSelectPickupShipping();
                          }}
                          disabled={isUpdatingShipping}
                          className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200 ${shippingMode === 'pickup'
                            ? 'border-emerald-500 bg-white shadow-md shadow-emerald-100 ring-1 ring-emerald-300'
                            : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-white/50 hover:shadow-sm'
                            } ${isUpdatingShipping ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                        >
                          {shippingMode === 'pickup' && (
                            <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-xs">?</div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-xl">??</span>
                            <span className="text-sm font-bold text-gray-900">Entrega personal</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Coordinas entrega directa con el vendedor
                          </div>
                          <div className="text-sm font-extrabold text-emerald-600">
                            �Gratis!
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Loading indicator */}
                    {isUpdatingShipping && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Actualizando m�todo de entrega...
                      </div>
                    )}
                  </div>
                )}

                {/* Tarjeta / MercadoPago */}
                <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${selectedMethod === 'mercadopago' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="mercadopago"
                    checked={selectedMethod === 'mercadopago'}
                    onChange={() => setSelectedMethod('mercadopago')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900">Tarjeta (MercadoPago)</div>
                    <div className="text-xs text-gray-500">Cr�dito, D�bito, MercadoPago</div>
                  </div>
                </label>

                {/* PocketCash */}
                <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${selectedMethod === 'pocketcash' ? 'border-brand-emerald bg-white ring-1 ring-brand-emerald' : 'border-gray-200 hover:bg-gray-50'} ${walletBalance < payOrderData.total ? 'opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="pocketcash"
                    checked={selectedMethod === 'pocketcash'}
                    onChange={() => walletBalance >= payOrderData.total && setSelectedMethod('pocketcash')}
                    disabled={walletBalance < payOrderData.total}
                    className="h-4 w-4 text-brand-emerald focus:ring-brand-emerald"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-gray-900">PocketCash</div>
                      <div className="text-xs font-bold text-brand-emerald">{formatMoney(walletBalance)}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {walletBalance < payOrderData.total ? 'Saldo insuficiente' : 'Usa tu saldo disponible'}
                    </div>
                  </div>
                </label>

                {/* Transferencia */}
                <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${selectedMethod === 'bank_transfer' ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="bank_transfer"
                    checked={selectedMethod === 'bank_transfer'}
                    onChange={() => setSelectedMethod('bank_transfer')}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900">Transferencia Bancaria (SPEI)</div>
                    <div className="text-xs text-gray-500">Se aprueba en 1-24 horas</div>
                  </div>
                </label>

                {/* Dep�sito */}
                <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${selectedMethod === 'bank_deposit' ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="bank_deposit"
                    checked={selectedMethod === 'bank_deposit'}
                    onChange={() => setSelectedMethod('bank_deposit')}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900">Dep�sito Bancario</div>
                    <div className="text-xs text-gray-500">Practicaja o Ventanilla</div>
                  </div>
                </label>

                {/* OXXO */}
                <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${selectedMethod === 'oxxo' ? 'border-yellow-500 bg-yellow-50 ring-1 ring-yellow-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="payment_method"
                    value="oxxo"
                    checked={selectedMethod === 'oxxo'}
                    onChange={() => setSelectedMethod('oxxo')}
                    className="h-4 w-4 text-yellow-600 focus:ring-yellow-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900">OXXO Pay</div>
                    <div className="text-xs text-gray-500">Paga en efectivo en tienda</div>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-black/5 px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setPayModalOpen(false);
                    setPayOrderData(null);
                  }}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50"
                  disabled={isPaying[payOrderData.id]}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmPayment}
                  disabled={isPaying[payOrderData.id]}
                  className="rounded-xl bg-brand-emerald px-6 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                >
                  {isPaying[payOrderData.id] ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Procesando...
                    </>
                  ) : (
                    'Pagar ahora'
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null
      }

      {/* Topup Info Modal */}
      {
        selectedTopupForInfo && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/10">
              <div className="border-b border-black/5 px-5 py-4 flex justify-between items-center">
                <div>
                  <div className="text-sm font-extrabold text-gray-900">Orden de Pago</div>
                  <div className="mt-1 text-xs text-gray-600">
                    Detalles para realizar tu recarga.
                  </div>
                </div>
                <button onClick={() => setSelectedTopupForInfo(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
                {/* Ticket Preview */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm mb-4">
                  {/* Top Brand Bar */}
                  <div className="bg-gray-900 px-4 py-3 flex justify-between items-center text-white">
                    <span className="font-black tracking-wider text-lg">GOPOCKET</span>
                    <span className="text-[10px] font-medium opacity-80 uppercase bg-white/10 px-2 py-0.5 rounded">
                      {(() => {
                        const m = (selectedTopupForInfo.metadata?.payment_method || selectedTopupForInfo.payment_method || '').replace('bank_', '');
                        return m === 'transfer' ? 'Transferencia' : m === 'deposit' ? 'Dep�sito' : m;
                      })()}
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-bold">Total a Pagar</div>
                      <div className="mt-1 text-3xl font-black text-gray-900">{formatMoney(selectedTopupForInfo.amount || 0)}</div>
                      <div className="mt-1 text-xs text-gray-400">MXN (Pesos Mexicanos)</div>
                    </div>

                    <div className="my-6 border-t-2 border-dashed border-gray-200 relative">
                      <div className="absolute -left-7 -top-3 w-6 h-6 rounded-full bg-white border-r border-gray-200"></div>
                      <div className="absolute -right-7 -top-3 w-6 h-6 rounded-full bg-white border-l border-gray-200"></div>
                    </div>

                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-gray-500 text-xs uppercase">Referencia de Orden</div>
                        <div className="font-mono text-gray-900 font-bold select-all">
                          {selectedTopupForInfo.id?.slice(0, 8).toUpperCase()}
                        </div>
                      </div>

                      {/* Dynamic Instructions Display */}
                      {(() => {
                        const meta = selectedTopupForInfo.metadata || {};
                        const method = meta.payment_method || selectedTopupForInfo.payment_method;
                        const config = appSettings?.payment_methods?.[method];

                        if (config) {
                          return (
                            <div className="rounded-xl bg-gray-50 p-4 space-y-3 border border-gray-100">
                              {config.bank_name && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500 text-xs">Banco</span>
                                  <span className="font-bold text-gray-900 text-right">{config.bank_name}</span>
                                </div>
                              )}
                              {config.account_number && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500 text-xs">Cuenta</span>
                                  <span className="font-mono font-bold text-gray-900 text-right select-all">{config.account_number}</span>
                                </div>
                              )}
                              {config.clabe && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500 text-xs">CLABE</span>
                                  <span className="font-mono font-bold text-gray-900 text-right select-all">{config.clabe}</span>
                                </div>
                              )}
                              {config.account_holder && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500 text-xs">Beneficiario</span>
                                  <span className="font-bold text-gray-900 text-right text-xs max-w-[150px]">{config.account_holder}</span>
                                </div>
                              )}
                              {/* Fallback text if needed */}
                              {config.instructions && !config.bank_name && (
                                <div className="text-xs text-gray-600 whitespace-pre-wrap text-center mt-2">
                                  {config.instructions}
                                </div>
                              )}
                            </div>
                          );
                        }
                        // Fallback if no config (e.g. from metadata text)
                        return (
                          <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap font-mono">
                            {meta.instruction || 'Consulte al administrador para instrucciones detalladas.'}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Reminder Alert */}
                <div className="mb-4 flex gap-3 rounded-xl bg-amber-50 p-4 border border-amber-100">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Importante</h4>
                    <p className="mt-1 text-xs text-amber-700">
                      No te olvides de enviar foto de tu comprobante de pago en <strong>Mis Compras</strong> para validar tu recarga r�pidamente.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const meta = selectedTopupForInfo.metadata || {};
                    const method = meta.payment_method || selectedTopupForInfo.payment_method;
                    const amount = selectedTopupForInfo.amount || 0;

                    let instructions = '';
                    if (appSettings?.payment_methods && appSettings.payment_methods[method]) {
                      const config = appSettings.payment_methods[method];
                      const parts = [];
                      if (config.bank_name) parts.push(`Banco: ${config.bank_name}`);
                      if (config.account_holder) parts.push(`Beneficiario: ${config.account_holder}`);
                      if (config.clabe) parts.push(`CLABE: ${config.clabe}`);
                      if (config.account_number) parts.push(`Cuenta: ${config.account_number}`);
                      const details = parts.join('\n');
                      const text = meta.instruction || config.instructions || '';
                      if (text.includes('Banco:') && text.includes(config.bank_name)) {
                        instructions = text;
                      } else {
                        instructions = [details, text].filter(Boolean).join('\n\n');
                      }
                    } else {
                      instructions = meta.instruction || 'Consulte al administrador para datos de pago.';
                    }

                    generatePaymentPDF(selectedTopupForInfo.id, amount, method, instructions);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 hover:border-gray-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar Comprobante PDF
                </button>
              </div>

              <div className="bg-gray-50 px-5 py-4 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedTopupForInfo(null)}
                  className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-gray-800 transition"
                >
                  Entendido, cerrar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal de rese�a de producto */}
      {reviewListingId && (
        <ReviewForm
          listingId={reviewListingId}
          onClose={() => setReviewListingId(null)}
          onSuccess={() => {
            if (reviewListingId) setReviewedListingIds(prev => new Set(prev).add(reviewListingId));
            setReviewListingId(null);
            setSuccess('�Gracias! Tu rese�a fue enviada.');
          }}
        />
      )}
    </div>
  );
}

