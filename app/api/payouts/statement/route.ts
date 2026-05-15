import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { toNumber, payoutNet, isCancelledStatus, isPaidStatus, isReleasedStatus, statusLabel } from '@/lib/payouts/calc';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function formatMoney(v: any) {
  return toNumber(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function formatDate(input: any) {
  const s = String(input || '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

function normStatus(s: any) {
  return String(s || '').trim() || '—';
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();

    // Obtener órdenes del último año
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data: orders, error: ordersErr } = await admin
      .from('orders')
      .select('*')
      .eq('seller_id', userData.user.id)
      .gte('created_at', oneYearAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 400 });

    // Obtener items de las órdenes
    const orderIds = (orders || []).map((o: any) => String(o?.id || '').trim()).filter(Boolean);
    let itemsByOrder: Record<string, any[]> = {};
    if (orderIds.length > 0) {
      const { data: items } = await admin
        .from('order_items')
        .select('order_id,title,quantity,line_total')
        .in('order_id', orderIds);
      
      if (Array.isArray(items)) {
        for (const it of items) {
          const oid = String(it?.order_id || '').trim();
          if (!oid) continue;
          if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
          itemsByOrder[oid].push(it);
        }
      }
    }

    // Obtener información del vendedor
    const { data: sellerProfile } = await admin
      .from('profiles')
      .select('full_name, state, city')
      .eq('id', userData.user.id)
      .maybeSingle();

    const sellerName = sellerProfile?.full_name || 'Vendedor';
    const sellerLocation = [sellerProfile?.city, sellerProfile?.state].filter(Boolean).join(', ') || '';

    // Filtrar órdenes activas y agrupar por mes
    const activeOrders = (orders || []).filter((o: any) => !isCancelledStatus(normStatus(o?.status)));
    const groupedByMonth: Record<string, any[]> = {};

    for (const o of activeOrders) {
      const date = new Date(o?.created_at || '');
      if (Number.isNaN(date.getTime())) continue;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = [];
      groupedByMonth[monthKey].push(o);
    }

    const totalSales = activeOrders.length;
    const released = activeOrders.filter((o: any) => isReleasedStatus(normStatus(o?.status)));
    const toRelease = activeOrders.filter((o: any) => isPaidStatus(normStatus(o?.status)) && !isReleasedStatus(normStatus(o?.status)));
    const sum = (list: any[]) => list.reduce((s, o) => s + payoutNet(o), 0);
    const totalReleased = sum(released);
    const totalToRelease = sum(toRelease);
    const grandTotal = totalReleased + totalToRelease;

    let commissionTotal = 0;
    let shippingSubsidyTotal = 0;
    let couponDiscountTotal = 0;
    for (const o of activeOrders) {
      commissionTotal += toNumber((o as any)?.commission_fee);
      shippingSubsidyTotal += toNumber((o as any)?.shipping_subsidy);
      couponDiscountTotal += toNumber((o as any)?.coupon_discount);
    }

    let guideDeductionTotal = 0;
    try {
      const gRes: any = await admin
        .from('disputes')
        .select('return_guide_cost')
        .eq('seller_id', userData.user.id)
        .eq('status', 'resolved')
        .eq('admin_decision', 'assign_guide_charged_seller');
      if (!gRes?.error && Array.isArray(gRes.data)) {
        for (const r of gRes.data as any[]) {
          const c = toNumber(r?.return_guide_cost);
          if (c > 0) guideDeductionTotal += c;
        }
      }
    } catch {
    }

    const netAfterGuides = Math.max(0, grandTotal - guideDeductionTotal);

    // Generar PDF
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let yPos = 40;

    // Header
    doc.setFillColor(227, 18, 125);
    doc.rect(0, 0, pageWidth, 80, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('GoVendy', margin, 35);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Estado de Cuenta', margin, 55);

    yPos = 100;

    // Información del vendedor
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Vendedor', margin, yPos);
    yPos += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Nombre: ${sellerName}`, margin, yPos);
    yPos += 15;
    if (sellerLocation) {
      doc.text(`Ubicación: ${sellerLocation}`, margin, yPos);
      yPos += 15;
    }
    doc.text(`Período: ${formatDate(oneYearAgo)} - ${formatDate(new Date())}`, margin, yPos);
    yPos += 25;

    // Resumen general
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Resumen General', margin, yPos);
    yPos += 20;

    const summaryData = [
      ['Concepto', 'Cantidad', 'Monto'],
      ['Total de ventas', `${totalSales} órdenes`, '—'],
      ['Órdenes entregadas', `${released.length} órdenes`, formatMoney(totalReleased)],
      ['Órdenes por liberar', `${toRelease.length} órdenes`, formatMoney(totalToRelease)],
      ['TOTAL ESTIMADO', '—', formatMoney(grandTotal)],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [227, 18, 125], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 100, halign: 'center' },
        2: { cellWidth: 100, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 20;

    const chargesRows: any[] = [];
    if (commissionTotal > 0) {
      chargesRows.push(['Comisiones GoVendy descontadas', formatMoney(-commissionTotal)]);
    }
    if (shippingSubsidyTotal > 0) {
      chargesRows.push(['Subsidios de envío cubiertos por ti', formatMoney(-shippingSubsidyTotal)]);
    }
    if (couponDiscountTotal > 0) {
      chargesRows.push(['Descuentos por cupones aplicados', formatMoney(-couponDiscountTotal)]);
    }
    if (guideDeductionTotal > 0) {
      chargesRows.push(['Guías de devolución con cargo al vendedor', formatMoney(-guideDeductionTotal)]);
    }
    if (chargesRows.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Cargos y descuentos del período', margin, yPos);
      yPos += 18;

      autoTable(doc, {
        startY: yPos,
        head: [['Concepto', 'Monto']],
        body: [
          ...chargesRows,
          ['Total neto estimado después de guías', formatMoney(netAfterGuides)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 130, halign: 'right' },
        },
        margin: { left: margin, right: margin },
      });

      yPos = (doc as any).lastAutoTable.finalY + 30;
    }

    const monthKeys = Object.keys(groupedByMonth).sort().reverse();
    for (const monthKey of monthKeys) {
      const monthOrders = groupedByMonth[monthKey];
      const date = new Date(`${monthKey}-01`);
      const monthLabel = date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });

      // Verificar si necesitamos nueva página
      if (yPos > 650) {
        doc.addPage();
        yPos = 40;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(227, 18, 125);
      doc.text(monthLabel.toUpperCase(), margin, yPos);
      yPos += 20;

      const monthTableData: any[] = [];
      let monthTotal = 0;
      let monthReleased = 0;
      let monthToRelease = 0;

      for (const o of monthOrders) {
        const id = String(o?.id || '').trim();
        const st = normStatus(o?.status);
        const net = payoutNet(o);
        const createdAt = formatDate(o?.created_at);
        const items = itemsByOrder[id] || [];
        const itemDesc = items.length > 0 
          ? `${items[0]?.title || 'Artículo'}${items.length > 1 ? ` +${items.length - 1} más` : ''}`
          : 'Sin artículos';
        
        monthTotal += net;
        if (isReleasedStatus(st)) monthReleased += net;
        if (isPaidStatus(st) && !isReleasedStatus(st)) monthToRelease += net;

        monthTableData.push([
          createdAt,
          id.slice(0, 8) + '…',
          statusLabel(st),
          itemDesc,
          formatMoney(net),
        ]);
      }

      autoTable(doc, {
        startY: yPos,
        head: [['Fecha', 'Orden', 'Estado', 'Productos', 'Monto']],
        body: monthTableData,
        theme: 'striped',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 70 },
          2: { cellWidth: 70 },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 80, halign: 'right' },
        },
        margin: { left: margin, right: margin },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Total del mes
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total ${monthLabel}: ${formatMoney(monthTotal)}`, pageWidth - margin - 150, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`(Liberado: ${formatMoney(monthReleased)} · Por liberar: ${formatMoney(monthToRelease)})`, pageWidth - margin - 150, yPos + 12);
      yPos += 30;
    }

    // Footer
    const pageCount = (doc as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Página ${i} de ${pageCount} - Generado el ${new Date().toLocaleDateString('es-MX')}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 20,
        { align: 'center' }
      );
    }

    // Nota final
    if (yPos < 700) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Nota: Los montos son estimados. El saldo liberado está disponible para retiro.', margin, yPos);
      yPos += 15;
      doc.text('Los descuentos, comisiones y subsidios de envío ya están incluidos en los cálculos.', margin, yPos);
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="estado-cuenta-${new Date().toISOString().split('T')[0]}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e: unknown) {
    console.error('[STATEMENT] Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al generar el estado de cuenta' },
      { status: 500 }
    );
  }
}
