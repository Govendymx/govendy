import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

function formatMoney(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '$0.00';
}

function formatDate(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function GET(req: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { effectiveUserId } = await requireAuth(req);

    const params = await context.params;
    const orderId = params.orderId;
    if (!orderId) return NextResponse.json({ error: 'orderId requerido' }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('seller_id', effectiveUserId)
      .maybeSingle();

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 400 });
    if (!order) return NextResponse.json({ error: 'Orden no encontrada o no autorizada' }, { status: 404 });

    // Obtener items de la orden
    const { data: items, error: itemsErr } = await admin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 });

    // Obtener información del vendedor
    const { data: sellerProfile } = await admin
      .from('profiles')
      .select('full_name, state, city')
      .eq('id', effectiveUserId)
      .maybeSingle();

    const sellerName = sellerProfile?.full_name || 'Vendedor';
    const sellerLocation = [sellerProfile?.city, sellerProfile?.state].filter(Boolean).join(', ') || '';

    // Calcular subtotal
    const subtotal = Number(order.subtotal || 0);
    const shippingFee = Number(order.shipping_fee || 0);
    // Total = subtotal + envío (sin mostrar comisión)
    const total = subtotal + shippingFee;

    // Generar PDF
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let yPos = 40;

    // Header con fondo rosa
    doc.setFillColor(227, 18, 125);
    doc.rect(0, 0, pageWidth, 80, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('GoVendy', margin, 35);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Orden de Compra / Nota de Remisión', margin, 55);

    yPos = 100;

    // Información de la orden
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Información de la Orden', margin, yPos);
    yPos += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Número de Orden: ${orderId.slice(0, 8).toUpperCase()}...`, margin, yPos);
    yPos += 15;
    doc.text(`Fecha: ${formatDate(order.created_at)}`, margin, yPos);
    yPos += 15;
    doc.text(`Estado: ${String(order.status || '—').toUpperCase()}`, margin, yPos);
    yPos += 25;

    // Información del vendedor
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
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
    yPos += 10;

    // Descripción de productos a enviar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Productos a Enviar', margin, yPos);
    yPos += 20;

    // Tabla de productos
    const tableData: any[] = [];
    for (const item of (items || [])) {
      const title = String(item.title || 'Artículo sin nombre');
      const quantity = Number(item.quantity || 1);
      const lineTotal = Number(item.line_total || 0);
      const size = item.selected_size ? `Talla: ${item.selected_size}` : '';
      const color = item.selected_color ? `Color: ${item.selected_color}` : '';
      const variants = [size, color].filter(Boolean).join(', ');
      
      tableData.push([
        title + (variants ? ` (${variants})` : ''),
        `x${quantity}`,
        formatMoney(lineTotal)
      ]);
    }

    autoTable(doc, {
      startY: yPos,
      head: [['Descripción del Producto', 'Cantidad', 'Subtotal']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [227, 18, 125], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 60, halign: 'center' },
        2: { cellWidth: 80, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 20;

    // Desglose de costos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Desglose de Costos', margin, yPos);
    yPos += 20;

    const costData: any[] = [
      ['Concepto', 'Monto'],
      ['Subtotal de productos', formatMoney(subtotal)],
      ['Costo de envío', formatMoney(shippingFee)],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [costData[0]],
      body: costData.slice(1),
      theme: 'plain',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 6 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 100, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(227, 18, 125);
    doc.text(`TOTAL: ${formatMoney(total)}`, pageWidth - margin - 100, yPos);

    yPos += 30;

    // Notas
    if (yPos > 700) {
      doc.addPage();
      yPos = 40;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notas:', margin, yPos);
    yPos += 15;
    const notes = [
      'Esta orden de compra es una nota de remisión para el vendedor.',
      'No incluye datos de contacto del comprador por privacidad.',
      'El vendedor debe enviar los productos según las especificaciones indicadas.',
    ];
    for (const note of notes) {
      doc.text(`• ${note}`, margin + 10, yPos);
      yPos += 12;
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

    // Convertir a buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Retornar PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="orden-compra-${orderId.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e: unknown) {
    console.error('[DOWNLOAD INVOICE] Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al generar el PDF' },
      { status: 500 }
    );
  }
}
