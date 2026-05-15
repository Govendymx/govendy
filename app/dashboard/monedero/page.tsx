'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Wallet, WalletTransaction } from '@/lib/types/wallet.types';
import { calculateMercadoPagoFee } from '@/lib/fees';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useImpersonation } from '@/components/ImpersonationProvider';

function formatMoney(amount: number) {
  return amount.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MonederoPage() {
  const { isImpersonating, targetUserId, targetData } = useImpersonation();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [pendingTopups, setPendingTopups] = useState<any[]>([]); // Recargas pendientes (Offline)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('Miembro GoVendy');

  // Topup State
  const [topupAmount, setTopupAmount] = useState('');
  const [isTopupLoading, setIsTopupLoading] = useState(false);
  const [calculatedTotal, setCalculatedTotal] = useState<{ fee: number; total: number } | null>(null);

  // New States
  const [paymentMethod, setPaymentMethod] = useState<'mercadopago' | 'bank_transfer' | 'bank_deposit' | 'oxxo'>('bank_transfer');
  const [offlineSuccessId, setOfflineSuccessId] = useState<string | null>(null);
  const [banner, setBanner] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  // Withdraw State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);

  // Transfer State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRecipientName, setTransferRecipientName] = useState('');
  const [transferConcept, setTransferConcept] = useState('');
  const [transferReference, setTransferReference] = useState('');

  // Gift Card Redeem State
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [redeemError, setRedeemError] = useState('');

  // All methods enabled for Topups
  const enabledMethods = ['mercadopago', 'bank_transfer', 'bank_deposit', 'oxxo'];

  const currentInstruction = useMemo(() => {
    if (!settings?.payment_methods) return '';
    const pm = settings.payment_methods;
    let config = null;

    if (paymentMethod === 'bank_transfer') config = pm.bank_transfer;
    else if (paymentMethod === 'bank_deposit') config = pm.bank_deposit;
    else if (paymentMethod === 'oxxo') config = pm.oxxo;

    if (!config) return '';

    const parts = [];
    if (config.bank_name) parts.push(`Banco: ${config.bank_name}`);
    if (config.account_holder) parts.push(`Beneficiario: ${config.account_holder}`);
    if (config.clabe) parts.push(`CLABE: ${config.clabe}`);
    if (config.account_number) parts.push(`Cuenta: ${config.account_number}`);

    const details = parts.join('\n');
    const text = config.instructions || '';

    // Evitar duplicados si el texto ya contiene los detalles
    if (text.includes('Banco:') && text.includes(config.bank_name)) {
      return text;
    }

    return [details, text].filter(Boolean).join('\n\n');
  }, [settings, paymentMethod]);

  useEffect(() => {
    // Fetch Monedero Banner
    const fetchBanner = async () => {
      try {
        const { data } = await supabase
          .from('home_banners')
          .select('*')
          .eq('placement', 'monedero')
          .eq('is_active', true)
          .single();
        if (data) setBanner(data);
      } catch (err) {
        console.error('Error fetching banner:', err);
      }
    };
    fetchBanner();
  }, []);

  useEffect(() => {
    const amount = Number(topupAmount);
    if (!isNaN(amount) && amount > 0) {
      const { fee, total } = calculateMercadoPagoFee(amount);
      setCalculatedTotal({ fee, total });
    } else {
      setCalculatedTotal(null);
    }
  }, [topupAmount]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImpersonating, targetUserId]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // ── IMPERSONATION MODE ──
      if (isImpersonating && targetUserId && targetData) {
        // Wallet del usuario impersonado (ya está en targetData)
        const w = targetData.wallet;
        if (w) {
          setWallet(w as any);
        } else {
          setWallet(null);
        }

        // Transacciones precargadas (últimas 50)
        const txs = (targetData.wallet_transactions ?? []) as WalletTransaction[];
        setTransactions(txs);

        // Sin recargas pendientes en modo espejo (datos sensibles / privados)
        setPendingTopups([]);

        // Nombre del usuario
        const prof = targetData.profile;
        const displayName = prof?.full_name || prof?.nickname || targetData.user?.email || 'Usuario';
        setUserName(displayName);

        setLoading(false);
        return;
      }

      // ── NORMAL MODE ──
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const token = session.access_token;

      // Fetch Wallet Balance
      const walletRes = await fetch('/api/wallet/balance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!walletRes.ok) throw new Error('Error al cargar el monedero');
      const walletData = await walletRes.json();
      setWallet(walletData);

      // Fetch Transactions
      const txRes = await fetch('/api/wallet/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!txRes.ok) throw new Error('Error al cargar las transacciones');
      const txData = await txRes.json();
      setTransactions(txData.transactions || []);

      const topupsRes = await fetch('/api/wallet/pending-topups', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (topupsRes.ok) {
        const topupsJson = await topupsRes.json().catch(() => ({}));
        const list = (topupsJson?.topups as any[]) ?? [];
        setPendingTopups(list);
      } else {
        setPendingTopups([]);
      }

      // Fetch App Settings for payment methods
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('payment_methods')
        .eq('id', 1)
        .single();
      if (settingsData) {
        setSettings(settingsData);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function generateTransactionReceipt(tx: any) {
    const w = window.open('', '_blank');
    if (!w) return;

    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante #${tx.id.slice(0, 8)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
              background: #f5f5f5;
              padding: 30px 15px;
              color: #1a1a1a;
            }
            .container {
              max-width: 700px;
              margin: 0 auto;
              background: white;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #E91E63 0%, #C2185B 100%);
              padding: 40px;
              position: relative;
              overflow: hidden;
            }
            .header::before {
              content: '';
              position: absolute;
              top: -50%;
              right: -10%;
              width: 300px;
              height: 300px;
              background: rgba(255,255,255,0.1);
              border-radius: 50%;
            }
            .header-content { position: relative; z-index: 1; }
            .logo {
              font-size: 36px;
              font-weight: 900;
              color: white;
              letter-spacing: -1px;
              margin-bottom: 8px;
            }
            .subtitle {
              font-size: 13px;
              color: rgba(255,255,255,0.9);
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .amount-hero {
              background: ${tx.type === 'credit' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'};
              padding: 50px 40px;
              text-align: center;
              margin-top: -20px;
              border-radius: 20px 20px 0 0;
            }
            .amount-label {
              font-size: 12px;
              font-weight: 600;
              color: rgba(255,255,255,0.9);
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-bottom: 12px;
            }
            .amount-value {
              font-size: 56px;
              font-weight: 900;
              color: white;
              letter-spacing: -2px;
            }
            .content { padding: 40px; }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 40px;
            }
            .info-item h3 {
              font-size: 10px;
              font-weight: 700;
              color: #9ca3af;
              text-transform: uppercase;
              letter-spacing: 1.2px;
              margin-bottom: 8px;
            }
            .info-item p {
              font-size: 15px;
              font-weight: 600;
              color: #1f2937;
              word-break: break-word;
            }
            .info-item.right { text-align: right; }
            .details {
              background: #f9fafb;
              border-radius: 12px;
              padding: 24px;
              border: 1px solid #e5e7eb;
            }
            .section-title {
              font-size: 13px;
              font-weight: 700;
              color: #374151;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 20px;
              padding-bottom: 12px;
              border-bottom: 2px solid #e5e7eb;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 16px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .row:last-child { border-bottom: none; padding-bottom: 0; }
            .label { font-size: 14px; color: #6b7280; font-weight: 500; }
            .value {
              font-size: 14px;
              font-weight: 700;
              color: #111827;
              text-align: right;
              max-width: 60%;
            }
            .value.mono {
              font-family: monospace;
              font-size: 12px;
              background: #f3f4f6;
              padding: 4px 8px;
              border-radius: 4px;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              background: #d1fae5;
              color: #065f46;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 700;
            }
            .badge::before {
              content: '✓';
              width: 16px;
              height: 16px;
              background: #10b981;
              color: white;
              border-radius: 50%;
              text-align: center;
              line-height: 16px;
              font-size: 10px;
            }
            .footer {
              padding: 30px 40px;
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
              text-align: center;
            }
            .footer p {
              font-size: 11px;
              color: #9ca3af;
              line-height: 1.8;
              margin-bottom: 8px;
            }
            .footer-logo {
              margin-top: 20px;
              font-size: 11px;
              font-weight: 700;
              color: #d1d5db;
              letter-spacing: 2px;
            }
            @media print {
              body { background: white; padding: 0; }
              .container { box-shadow: none; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="header-content">
                <div class="logo">POCKET</div>
                <div class="subtitle">Comprobante de Operación</div>
              </div>
            </div>
            <div class="amount-hero">
              <div class="amount-label">${tx.type === 'credit' ? 'Monto Recibido' : 'Monto Enviado'}</div>
              <div class="amount-value">${tx.type === 'credit' ? '+' : '-'}$${Number(tx.amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="content">
              <div class="info-grid">
                <div class="info-item">
                  <h3>ID Transacción</h3>
                  <p>#${tx.id.slice(0, 8)}...</p>
                </div>
                <div class="info-item right">
                  <h3>Fecha y Hora</h3>
                  <p>${new Date(tx.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div class="details">
                <div class="section-title">Detalles de la Operación</div>
                <div class="row">
                  <span class="label">Concepto</span>
                  <span class="value">${tx.concept}</span>
                </div>
                <div class="row">
                  <span class="label">Tipo de Operación</span>
                  <span class="value">${tx.reference_type === 'p2p_transfer' ? 'Transferencia P2P' : tx.reference_type === 'order' ? 'Compra' : tx.reference_type === 'topup' ? 'Recarga' : tx.reference_type === 'payout' ? 'Retiro' : tx.reference_type === 'live_hours' ? 'Compra de Horas Live' : 'Ajuste'}</span>
                </div>
                ${tx.reference_id ? `
                <div class="row">
                  <span class="label">Referencia</span>
                  <span class="value mono">${tx.reference_id.slice(0, 20)}...</span>
                </div>
                ` : ''}
                <div class="row">
                  <span class="label">Estado</span>
                  <span class="badge">Completado</span>
                </div>
              </div>
            </div>
            <div class="footer">
              <p>Este comprobante es un registro digital de tu operación en PocketApp.</p>
              <p>Para cualquier duda o aclaración, contacta a soporte con tu ID de transacción.</p>
              <div class="footer-logo">POCKETAPP</div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  }

  function generateOfflinePaymentNote(topupId: string, amount: number, method: string, instructions: string) {
    const w = window.open('', '_blank');
    if (!w) return;

    let methodName = 'Transferencia SPEI';
    if (method === 'oxxo') methodName = 'Pago en OXXO';
    if (method === 'bank_deposit') methodName = 'Depósito Bancario';

    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Orden de Pago #${topupId.slice(0, 8)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
              background: #f5f5f5;
              padding: 30px 15px;
              color: #1a1a1a;
            }
            .container {
              max-width: 700px;
              margin: 0 auto;
              background: white;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #E91E63 0%, #C2185B 100%);
              padding: 40px;
              position: relative;
              overflow: hidden;
            }
            .header::before {
              content: '';
              position: absolute;
              top: -50%;
              right: -10%;
              width: 300px;
              height: 300px;
              background: rgba(255,255,255,0.1);
              border-radius: 50%;
            }
            .header-content { position: relative; z-index: 1; }
            .logo {
              font-size: 36px;
              font-weight: 900;
              color: white;
              letter-spacing: -1px;
              margin-bottom: 8px;
            }
            .subtitle {
              font-size: 13px;
              color: rgba(255,255,255,0.9);
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .amount-hero {
              background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
              padding: 50px 40px;
              text-align: center;
              margin-top: -20px;
              border-radius: 20px 20px 0 0;
            }
            .amount-label {
              font-size: 12px;
              font-weight: 600;
              color: rgba(255,255,255,0.9);
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-bottom: 12px;
            }
            .amount-value {
              font-size: 56px;
              font-weight: 900;
              color: white;
              letter-spacing: -2px;
            }
            .content { padding: 40px; }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 40px;
            }
            .info-item h3 {
              font-size: 10px;
              font-weight: 700;
              color: #9ca3af;
              text-transform: uppercase;
              letter-spacing: 1.2px;
              margin-bottom: 8px;
            }
            .info-item p {
              font-size: 15px;
              font-weight: 600;
              color: #1f2937;
              word-break: break-word;
            }
            .info-item.right { text-align: right; }
            .payment-details {
              background: #f9fafb;
              border-radius: 12px;
              padding: 24px;
              border: 1px solid #e5e7eb;
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 13px;
              font-weight: 700;
              color: #374151;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 20px;
              padding-bottom: 12px;
              border-bottom: 2px solid #e5e7eb;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 16px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .row:last-child { border-bottom: none; padding-bottom: 0; }
            .label { font-size: 14px; color: #6b7280; font-weight: 500; }
            .value {
              font-size: 14px;
              font-weight: 700;
              color: #111827;
              text-align: right;
            }
            .value.mono {
              font-family: monospace;
              font-size: 12px;
              background: #f3f4f6;
              padding: 4px 8px;
              border-radius: 4px;
            }
            .instructions-box {
              background: #fef3c7;
              border: 2px solid #fbbf24;
              border-radius: 12px;
              padding: 24px;
              margin-bottom: 30px;
            }
            .instructions-title {
              font-size: 14px;
              font-weight: 700;
              color: #92400e;
              margin-bottom: 12px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .instructions-title::before {
              content: '⚠';
              font-size: 18px;
            }
            .instructions-text {
              font-size: 13px;
              line-height: 1.8;
              color: #78350f;
              white-space: pre-wrap;
            }
            .footer {
              padding: 30px 40px;
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer-steps {
              list-style: none;
              counter-reset: step-counter;
            }
            .footer-steps li {
              counter-increment: step-counter;
              font-size: 12px;
              color: #6b7280;
              line-height: 1.8;
              margin-bottom: 8px;
              padding-left: 30px;
              position: relative;
            }
            .footer-steps li::before {
              content: counter(step-counter);
              position: absolute;
              left: 0;
              top: 0;
              width: 20px;
              height: 20px;
              background: #E91E63;
              color: white;
              border-radius: 50%;
              text-align: center;
              line-height: 20px;
              font-size: 11px;
              font-weight: 700;
            }
            .footer-logo {
              margin-top: 20px;
              text-align: center;
              font-size: 11px;
              font-weight: 700;
              color: #d1d5db;
              letter-spacing: 2px;
            }
            @media print {
              body { background: white; padding: 0; }
              .container { box-shadow: none; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="header-content">
                <div class="logo">POCKET</div>
                <div class="subtitle">Orden de Pago</div>
              </div>
            </div>
            <div class="amount-hero">
              <div class="amount-label">Total a Pagar</div>
              <div class="amount-value">$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="content">
              <div class="info-grid">
                <div class="info-item">
                  <h3>ID Operación</h3>
                  <p>#${topupId.slice(0, 8)}...</p>
                </div>
                <div class="info-item right">
                  <h3>Fecha de Emisión</h3>
                  <p>${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div class="payment-details">
                <div class="section-title">Detalles del Pago</div>
                <div class="row">
                  <span class="label">Método de Pago</span>
                  <span class="value">${methodName}</span>
                </div>
                ${wallet?.pocket_cash_number ? `
                <div class="row">
                  <span class="label">ID PocketCash</span>
                  <span class="value mono">${wallet.pocket_cash_number}</span>
                </div>
                ` : ''}
                <div class="row">
                  <span class="label">Monto Total</span>
                  <span class="value" style="color: #E91E63; font-size: 18px;">$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div class="instructions-box">
                <div class="instructions-title">Instrucciones de Pago</div>
                <div class="instructions-text">${instructions}</div>
              </div>
            </div>
            <div class="footer">
              <ul class="footer-steps">
                <li>Esta orden de pago es válida únicamente para el monto especificado.</li>
                <li>Conserva este comprobante hasta que tu saldo sea acreditado.</li>
                <li>Sube tu comprobante en la sección "Mis Compras" o "Monedero".</li>
              </ul>
              <div class="footer-logo">POCKETAPP</div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  }

  async function handleTopup() {
    try {
      setIsTopupLoading(true);
      setError(null);

      const amount = parseFloat(topupAmount);
      if (isNaN(amount) || amount < 10) {
        throw new Error('El monto mínimo es $10.00');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          amount,
          payment_method: paymentMethod,
          instruction: currentInstruction // Enviar instrucciones al backend
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar recarga');
      }

      if (data.init_point) {
        window.location.href = data.init_point;
      } else if (data.topup_id) {
        // Generar PDF automáticamente para métodos offline
        if (paymentMethod !== 'mercadopago') {
          generateOfflinePaymentNote(data.topup_id, amount, paymentMethod, currentInstruction);
        }

        setOfflineSuccessId(data.topup_id);
        setTopupAmount('');
        // Refresh pending list
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsTopupLoading(false);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    try {
      setTransferLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          recipient_card_number: transferRecipient,
          amount: Number(transferAmount),
          concept: transferConcept || undefined,
          reference: transferReference || undefined,
          recipient_name: transferRecipientName || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error en la transferencia');
      }

      const key = data?.tracking_key || null;
      alert(`Transferencia exitosa${key ? `\nClave de rastreo: ${key}` : ''}`);
      setIsTransferModalOpen(false);
      setTransferRecipient('');
      setTransferAmount('');
      setTransferRecipientName('');
      setTransferConcept('');
      setTransferReference('');
      fetchData(); // Refresh balance
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTransferLoading(false);
    }
  }

  async function handleWithdraw() {
    try {
      setIsWithdrawLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch('/api/payouts/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          source: 'wallet',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al solicitar retiro');
      }

      // Success
      setIsWithdrawModalOpen(false);
      alert('Solicitud de retiro recibida exitosamente.');

      // Refresh data
      fetchData();

    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setIsWithdrawModalOpen(false);
    } finally {
      setIsWithdrawLoading(false);
    }
  }

  // Helper para extraer instrucciones de metadata string
  function getInstructionFromMetadata(metadata: any): string {
    try {
      if (typeof metadata === 'string') {
        const parsed = JSON.parse(metadata);
        return parsed.instruction || '';
      }
      return '';
    } catch {
      return '';
    }
  }

  function getMethodFromMetadata(metadata: any): string {
    try {
      if (typeof metadata === 'string') {
        const parsed = JSON.parse(metadata);
        return parsed.payment_method || 'offline';
      }
      return 'offline';
    } catch {
      return 'offline';
    }
  }

  function formatCardNumber(num: string | undefined) {
    if (!num) return '•••• •••• •••• ••••';
    return num.replace(/(\d{4})/g, '$1 ').trim();
  }

  function downloadWalletStatement() {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const marginX = 40;
      const marginY = 40;
      const titleY = marginY + 10;
      const brand = 'GoVendy · PocketCash';
      const today = new Date().toLocaleString('es-MX');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Estado de Cuenta PocketCash', marginX, titleY);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(brand, marginX, titleY + 16);
      doc.text(`Fecha de emisión: ${today}`, marginX, titleY + 30);

      // Datos de cuenta (estilo bancario)
      const accY = titleY + 60;
      const holder = userName || 'Miembro GoVendy';
      const card = formatCardNumber(wallet?.pocket_cash_number || '');
      const balanceText = (wallet?.balance ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

      doc.setFont('helvetica', 'bold');
      doc.text('Datos de la cuenta', marginX, accY);
      doc.setFont('helvetica', 'normal');
      doc.text(`Titular: ${holder}`, marginX, accY + 16);
      doc.text(`ID PocketCash: ${card}`, marginX, accY + 32);
      doc.text(`Saldo actual: ${balanceText}`, marginX, accY + 48);
      doc.text('Periodo: Últimos movimientos', marginX, accY + 64);

      // Tabla de movimientos
      const rows = [...transactions]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((t) => {
          const fecha = new Date(t.created_at).toLocaleString('es-MX');
          const concepto = t.concept || (t.type === 'credit' ? 'Abono' : 'Cargo');
          const abono = t.type === 'credit' ? (Number(t.amount) || 0) : 0;
          const cargo = t.type === 'debit' ? (Number(t.amount) || 0) : 0;
          return [fecha, concepto, abono ? abono.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '', cargo ? cargo.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : ''];
        });

      autoTable(doc, {
        startY: accY + 80,
        head: [['Fecha', 'Concepto', 'Abono', 'Cargo']],
        body: rows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [233, 30, 99], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 250 },
          2: { halign: 'right' },
          3: { halign: 'right' },
        } as any,
        margin: { left: marginX, right: marginX },
      });

      // Pie
      const finalY = (doc as any).lastAutoTable?.finalY || accY + 80;
      doc.setFontSize(9);
      doc.text('Este documento es un estado informativo de movimientos PocketCash.', marginX, finalY + 24);
      doc.text('Para aclaraciones, contacta soporte desde tu cuenta.', marginX, finalY + 38);

      const dateSlug = new Date().toISOString().slice(0, 10);
      doc.save(`PocketCash-Estado-${dateSlug}.pdf`);
    } catch (e) {
      console.error(e);
      alert('No se pudo generar el estado de cuenta.');
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi PocketCash</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona tu saldo, recargas y historial de movimientos.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
        >
          ← Volver
        </Link>
      </div>

      {/* Banner Promocional */}
      {banner ? (
        <div className="mb-8 overflow-hidden rounded-3xl bg-gray-900 shadow-lg ring-1 ring-white/10 relative">
          {banner.image_url && (
            <div className="absolute inset-0">
              <img src={banner.image_url} alt="" className="h-full w-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 to-transparent"></div>
            </div>
          )}
          {!banner.image_url && (
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-800">
              <div className="absolute right-0 top-0 h-full w-1/2 translate-x-1/3 transform bg-gradient-to-l from-brand-emerald/20 to-transparent blur-3xl"></div>
            </div>
          )}

          <div className="relative z-10 px-6 py-8 sm:px-12 sm:py-10 max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {banner.title}
            </h2>
            {banner.subtitle && (
              <p className="mt-3 text-lg text-gray-300">
                {banner.subtitle}
              </p>
            )}
            {banner.cta_text && banner.cta_href && (
              <Link href={banner.cta_href} className="mt-6 inline-block rounded-xl bg-white px-5 py-2 text-sm font-bold text-gray-900 transition hover:bg-gray-100">
                {banner.cta_text}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-gray-900 to-gray-800 shadow-lg ring-1 ring-white/10">
          <div className="relative px-6 py-8 sm:px-12 sm:py-10">
            <div className="absolute right-0 top-0 h-full w-1/2 translate-x-1/3 transform bg-gradient-to-l from-brand-emerald/20 to-transparent blur-3xl"></div>
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                ¡Tu dinero, más seguro y rápido!
              </h2>
              <p className="mt-3 text-lg text-gray-300">
                Usa tu tarjeta PocketCash para comprar y vender sin comisiones bancarias extras.
                Obtén cashback en compras seleccionadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-emerald border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-4 text-red-600">
          Error: {error}
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Balance Card */}
          <div className="lg:col-span-1">
            <div className="group relative h-56 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-emerald to-emerald-600 p-6 text-white shadow-xl transition-all hover:scale-[1.02] hover:shadow-2xl">
              {/* Decorative Elements */}
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
              <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-emerald-900/20 blur-3xl"></div>

              {/* Card Header */}
              <div className="relative z-10 flex items-start justify-between">
                <div className="h-9 w-12 rounded-lg bg-yellow-200/90 shadow-inner ring-1 ring-yellow-400/50 backdrop-blur-sm">
                  <div className="grid h-full w-full grid-cols-2 gap-1 p-2 opacity-60">
                    <div className="rounded-[1px] border border-yellow-700/40"></div>
                    <div className="rounded-[1px] border border-yellow-700/40"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold italic tracking-wider">PocketCash</div>
                  <div className="text-[10px] font-medium opacity-80">DEBIT</div>
                </div>
              </div>

              {/* Balance Section */}
              <div className="relative z-10 mt-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium opacity-80">Saldo Disponible</span>
                  {wallet?.balance !== undefined && (
                    <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
                      MXN
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-3xl font-bold tracking-tight text-white drop-shadow-sm">
                  {formatMoney(wallet?.balance || 0)}
                </div>
              </div>

              {/* Card Number Display */}
              <div className="relative z-10 mt-6">
                <div className="flex items-center gap-2 group/copy">
                  <div className="font-mono text-xs tracking-[0.12em] text-white drop-shadow-md select-all whitespace-nowrap flex-shrink-0">
                    {formatCardNumber(wallet?.pocket_cash_number)}
                  </div>
                  {wallet?.pocket_cash_number && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(wallet.pocket_cash_number!);
                      }}
                      className="opacity-0 group-hover/copy:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded flex-shrink-0"
                      title="Copiar ID"
                    >
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-widest opacity-60 mt-1.5">
                  ID POCKETCASH
                </div>
              </div>

              {/* Card Footer */}
              <div className="relative z-10 mt-8 flex items-end justify-between">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">TITULAR</div>
                  <div className="max-w-[180px] truncate font-medium uppercase tracking-wide text-white/90">
                    {userName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">EXPIRA</div>
                  <div className="font-mono text-sm font-medium text-white/90">12/30</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="group relative flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 px-4 py-5 text-white shadow-lg ring-1 ring-white/10 transition-all hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-emerald/20 ring-1 ring-brand-emerald/30 transition group-hover:bg-brand-emerald/30">
                  <svg className="h-5 w-5 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <span className="text-sm font-bold">Transferir</span>
                <span className="text-[10px] text-gray-400">Enviar saldo a otro usuario</span>
              </button>
              <button
                onClick={downloadWalletStatement}
                className="group relative flex flex-col items-center gap-2 rounded-2xl bg-white px-4 py-5 text-gray-900 shadow-lg ring-1 ring-black/5 transition-all hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
                title="Estado de cuenta (PDF)"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-200 transition group-hover:bg-emerald-100">
                  <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </div>
                <span className="text-sm font-bold">Descargar Estado de Cuenta</span>
                <span className="text-[10px] text-gray-400">Exportar PDF</span>
              </button>
            </div>
            {/* Botón oculto: Retirar (deshabilitado temporalmente — descomentar cuando se necesite)
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-gray-900 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50 hover:shadow-md"
            >
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Retirar
            </button>
            */}

            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h3 className="text-lg font-bold text-gray-900">Recargar Saldo</h3>
              <p className="mt-1 text-sm text-gray-500">
                Elige tu método de pago y monto para agregar saldo.
              </p>

              {offlineSuccessId ? (
                <div className="mt-4 rounded-xl bg-green-50 p-4 border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-green-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-green-900">Solicitud creada con éxito</h4>
                      <p className="mt-1 text-sm text-green-700">
                        Tu solicitud de recarga ha sido registrada.
                        Ve a &quot;Mis Compras&quot; para subir tu comprobante y completar el proceso.
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <Link href="/dashboard/compras" className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-green-700">
                          Ir a Mis Compras →
                        </Link>
                        <button
                          onClick={() => setOfflineSuccessId(null)}
                          className="text-sm text-green-600 hover:text-green-800 underline"
                        >
                          Nueva recarga
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Método de pago ── */}
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Método de pago</p>
                    <div className="flex rounded-xl bg-gray-100 p-1">
                      {enabledMethods.includes('mercadopago') && (
                        <button
                          onClick={() => setPaymentMethod('mercadopago')}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${paymentMethod === 'mercadopago'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                          <span className="text-base">💳</span>
                          MercadoPago
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const first = enabledMethods.find(m => m !== 'mercadopago') as 'bank_transfer' | 'bank_deposit' | 'oxxo' | undefined;
                          if (first) setPaymentMethod(first);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${paymentMethod !== 'mercadopago'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        <span className="text-base">🏦</span>
                        Pago Manual
                      </button>
                    </div>
                  </div>

                  {/* Sub-opciones de pago manual */}
                  {paymentMethod !== 'mercadopago' && (
                    <div className="mt-3 flex gap-2">
                      {enabledMethods.includes('bank_transfer') && (
                        <button
                          onClick={() => setPaymentMethod('bank_transfer')}
                          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition border ${paymentMethod === 'bank_transfer'
                            ? 'bg-blue-50 border-blue-400 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300'
                            }`}
                        >
                          🏦 Transferencia
                        </button>
                      )}
                      {enabledMethods.includes('bank_deposit') && (
                        <button
                          onClick={() => setPaymentMethod('bank_deposit')}
                          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition border ${paymentMethod === 'bank_deposit'
                            ? 'bg-purple-50 border-purple-400 text-purple-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-purple-300'
                            }`}
                        >
                          📍 Depósito
                        </button>
                      )}
                      {enabledMethods.includes('oxxo') && (
                        <button
                          onClick={() => setPaymentMethod('oxxo')}
                          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition border ${paymentMethod === 'oxxo'
                            ? 'bg-red-50 border-red-400 text-red-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-red-300'
                            }`}
                        >
                          🏪 OXXO
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Monto ── */}
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Monto a recargar</p>

                    {/* Botones de monto rápido */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[50, 100, 200, 500].map(amt => (
                        <button
                          key={amt}
                          onClick={() => setTopupAmount(String(amt))}
                          className={`rounded-lg py-2 text-sm font-bold transition border ${String(amt) === topupAmount
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                            }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>

                    {/* Input personalizado */}
                    <div className="relative rounded-xl shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <span className="text-gray-400 font-bold text-lg">$</span>
                      </div>
                      <input
                        type="number"
                        name="amount"
                        id="amount"
                        className="block w-full rounded-xl border-gray-300 pl-9 pr-4 py-3 text-lg font-bold text-gray-900 focus:border-brand-emerald focus:ring-brand-emerald"
                        placeholder="Otro monto..."
                        min="10"
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Desglose de Comisión (Solo MercadoPago) */}
                  {paymentMethod === 'mercadopago' && calculatedTotal && (
                    <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm border border-gray-100">
                      <div className="flex justify-between mb-1 text-gray-600">
                        <span>Monto a recargar:</span>
                        <span className="font-medium">{formatMoney(Number(topupAmount))}</span>
                      </div>
                      <div className="flex justify-between mb-1 text-orange-600 text-xs">
                        <span>Comisión MercadoPago:</span>
                        <span className="font-medium">+{formatMoney(calculatedTotal.fee)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-gray-900">
                        <span>Total a pagar:</span>
                        <span>{formatMoney(calculatedTotal.total)}</span>
                      </div>
                    </div>
                  )}

                  {/* Info de método manual */}
                  {paymentMethod !== 'mercadopago' && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl bg-blue-50/70 p-3 border border-blue-100">
                      <span className="text-blue-500 mt-0.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <p className="text-xs text-blue-700">
                        Al hacer clic se generará una ficha con los datos de pago ({paymentMethod === 'oxxo' ? 'código OXXO' : paymentMethod === 'bank_deposit' ? 'cuenta para depósito' : 'CLABE para transferencia'}).
                        Sube tu comprobante después para acreditar el saldo (1-24 hrs).
                      </p>
                    </div>
                  )}

                  {/* Botón principal */}
                  <button
                    onClick={handleTopup}
                    disabled={isTopupLoading || !topupAmount}
                    className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${paymentMethod === 'mercadopago'
                      ? 'bg-[#009ee3] text-white hover:bg-[#0087c9] shadow-blue-200'
                      : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-200'
                      }`}
                  >
                    {isTopupLoading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : paymentMethod === 'mercadopago' ? (
                      <>
                        <span>💳</span>
                        Pagar con MercadoPago
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Generar Orden de Pago
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* ═══ Canjear Tarjeta de Regalo ═══ */}
            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🎁</span>
                <h3 className="text-lg font-bold text-gray-900">Canjear Tarjeta de Regalo</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">Ingresa el código de tu tarjeta para acreditar el saldo.</p>

              {redeemResult ? (
                <div className={`rounded-xl p-4 border ${redeemResult.ok
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                  <p className="font-medium text-sm">{redeemResult.ok ? '✅' : '❌'} {redeemResult.message}</p>
                  <button
                    onClick={() => { setRedeemResult(null); setRedeemCode(''); setRedeemError(''); }}
                    className="mt-2 text-sm underline opacity-70 hover:opacity-100"
                  >
                    {redeemResult.ok ? 'Canjear otra' : 'Intentar de nuevo'}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={redeemCode}
                    onChange={(e) => {
                      let v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                      // Auto-format: GP-XXXX-XXXX-XXXX
                      if (v.length === 2 && !v.includes('-')) v = v + '-';
                      if (v.length === 7 && v.charAt(6) !== '-') v = v.slice(0, 7) + '-' + v.slice(7);
                      if (v.length === 12 && v.charAt(11) !== '-') v = v.slice(0, 12) + '-' + v.slice(12);
                      setRedeemCode(v.slice(0, 17));
                      setRedeemError('');
                    }}
                    placeholder="GP-XXXX-XXXX-XXXX"
                    maxLength={17}
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-mono text-lg tracking-wider text-center focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none uppercase"
                  />
                  <button
                    onClick={async () => {
                      if (redeemLoading || redeemCode.length < 17) return;
                      setRedeemLoading(true);
                      setRedeemError('');
                      try {
                        const { data: session } = await supabase.auth.getSession();
                        const token = session?.session?.access_token;
                        if (!token) throw new Error('Inicia sesión');
                        const res = await fetch('/api/gift-cards/redeem', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
                          body: JSON.stringify({ code: redeemCode }),
                        });
                        const json = await res.json();
                        if (res.ok && json.ok) {
                          setRedeemResult({ ok: true, message: json.message || '¡Saldo acreditado!' });
                          // Refresh wallet balance
                          const supa = supabase;
                          const { data: { user: u } } = await supa.auth.getUser();
                          if (u) {
                            const { data: w } = await supa.from('wallets').select('*').eq('user_id', u.id).maybeSingle();
                            if (w) setWallet(w as any);
                          }
                        } else {
                          setRedeemResult({ ok: false, message: json.error || 'Error al canjear' });
                        }
                      } catch (err: any) {
                        setRedeemResult({ ok: false, message: err.message || 'Error inesperado' });
                      } finally {
                        setRedeemLoading(false);
                      }
                    }}
                    disabled={redeemLoading || redeemCode.length < 17}
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {redeemLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </span>
                    ) : 'Canjear'}
                  </button>
                </div>
              )}
              {redeemError && <p className="text-sm text-red-500 mt-2">{redeemError}</p>}
              <p className="text-xs text-gray-400 mt-3">¿No tienes uno? <a href="/gift-cards" className="text-orange-500 hover:underline font-medium">Compra una tarjeta de regalo →</a></p>
            </div>

            <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h3 className="font-semibold text-gray-900">Información Importante</h3>
              <ul className="mt-4 space-y-3 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="text-brand-emerald font-bold">!</span>
                  <span className="font-medium text-gray-900">
                    No se permiten pagos mixtos.
                  </span>
                </li>
                <li className="ml-4 text-xs text-gray-500 mb-2">
                  Debes cubrir el 100% del costo con PocketCash o el 100% con otro método (depósito/tarjeta).
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-emerald">•</span>
                  Gana PocketCash con cada compra completada.
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-emerald">•</span>
                  Tu PocketCash no vence mientras tu cuenta esté activa.
                </li>
              </ul>
            </div>
          </div>

          {/* Transactions List */}
          <div className="lg:col-span-2 space-y-8">
            {/* Pending Topups List */}
            {pendingTopups.length > 0 && (
              <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="border-b border-gray-100 px-6 py-4 bg-yellow-50/50">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                    </span>
                    Recargas Pendientes
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {pendingTopups.map((topup) => (
                    <div key={topup.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-4 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-4">
                        <div className="rounded-full p-2 bg-yellow-100 text-yellow-600">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            Recarga por {getMethodFromMetadata(topup.mercadopago_preference_id) === 'oxxo' ? 'OXXO' : 'Transferencia/Depósito'}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID: {topup.id.slice(0, 8)} • {formatDate(topup.created_at)}
                          </p>
                          {topup.status === 'pending_proof' && (
                            <span className="mt-1 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                              Esperando Comprobante
                            </span>
                          )}
                          {topup.status === 'pending_approval' && (
                            <span className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                              Revisando Comprobante
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <div className="font-bold text-gray-900">+{formatMoney(topup.amount)}</div>
                          <button
                            onClick={() => generateOfflinePaymentNote(topup.id, topup.amount, getMethodFromMetadata(topup.mercadopago_preference_id), getInstructionFromMetadata(topup.mercadopago_preference_id))}
                            className="text-xs font-medium text-brand-emerald hover:text-emerald-700 underline"
                          >
                            Descargar Ficha
                          </button>
                        </div>
                        <Link
                          href="/dashboard/compras"
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                        >
                          Subir Comprobante
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="border-b border-gray-100 px-6 py-4">
                <h3 className="font-bold text-gray-900">Historial de Movimientos</h3>
              </div>

              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-gray-50 p-4">
                    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="mt-4 text-gray-500">No tienes movimientos recientes.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-6 transition hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className={`rounded-full p-2 ${tx.reference_type === 'live_hours' ? 'bg-purple-100 text-purple-600' : tx.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                          {tx.reference_type === 'live_hours' ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          ) : tx.type === 'credit' ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{tx.concept}</p>
                          <p className="text-xs text-gray-500">{formatDate(tx.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${tx.type === 'credit' ? 'text-green-600' : 'text-gray-900'
                          }`}>
                          {tx.type === 'credit' ? '+' : '-'}{formatMoney(tx.amount)}
                        </div>
                        <button
                          onClick={() => generateTransactionReceipt(tx)}
                          className="mt-1 text-xs font-medium text-brand-emerald hover:text-emerald-700 underline flex items-center justify-end gap-1 ml-auto"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Comprobante
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Withdraw Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Retirar Fondos</h3>
            </div>

            <div className="p-6">
              <div className="mb-6 flex flex-col items-center justify-center rounded-xl bg-brand-emerald/5 p-6 border border-brand-emerald/10">
                <span className="text-sm font-medium text-gray-500">Saldo Disponible</span>
                <span className="mt-1 text-3xl font-bold text-brand-emerald">
                  {formatMoney(wallet?.balance || 0)}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-6 text-center">
                Se solicitará el retiro del <strong>100%</strong> de tu saldo disponible en PocketCash.
                Los fondos serán transferidos a tu cuenta configurada.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsWithdrawModalOpen(false)}
                  disabled={isWithdrawLoading}
                  className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawLoading || (wallet?.balance || 0) < 0.01}
                  className="flex-1 rounded-xl bg-brand-emerald px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand-emerald/20 transition hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isWithdrawLoading ? 'Procesando...' : 'Confirmar Retiro'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Transferir Fondos</h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">ID PocketCash Destinatario</label>
                <div className="relative">
                  <input
                    type="text"
                    value={transferRecipient}
                    onChange={(e) => {
                      // Formato XXXX XXXX XXXX XXXX
                      let v = e.target.value.replace(/\D/g, '').slice(0, 16);
                      v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
                      setTransferRecipient(v);
                    }}
                    placeholder="0000 0000 0000 0000"
                    className="w-full rounded-xl border-gray-300 pl-10 focus:border-brand-emerald focus:ring-brand-emerald font-mono tracking-wider"
                    required
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0c0 .884-.896 1.75-2.129 1.75H9.371C8.143 7.75 7.25 6.884 7.25 6s.893-1.75 2.121-1.75h4.258c1.228 0 2.121.866 2.121 1.75" />
                    </svg>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">Ingresa los 16 dígitos de la tarjeta PocketCash.</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Destinatario (opcional)</label>
                <input
                  type="text"
                  value={transferRecipientName}
                  onChange={(e) => setTransferRecipientName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  maxLength={80}
                  className="w-full rounded-xl border-gray-300 focus:border-brand-emerald focus:ring-brand-emerald"
                />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">Monto a Transferir</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-bold">$</span>
                  </div>
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    min="1"
                    step="0.01"
                    className="w-full rounded-xl border-gray-300 pl-8 focus:border-brand-emerald focus:ring-brand-emerald text-lg font-bold"
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 text-right">Saldo disponible: {formatMoney(wallet?.balance || 0)}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Concepto (opcional)</label>
                <input
                  type="text"
                  value={transferConcept}
                  onChange={(e) => setTransferConcept(e.target.value)}
                  placeholder="Ej. Pago de servicio"
                  maxLength={100}
                  className="w-full rounded-xl border-gray-300 focus:border-brand-emerald focus:ring-brand-emerald"
                />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">Referencia (opcional)</label>
                <input
                  type="text"
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  placeholder="Ej. ABC123"
                  maxLength={50}
                  className="w-full rounded-xl border-gray-300 focus:border-brand-emerald focus:ring-brand-emerald"
                />
                <p className="mt-1 text-xs text-gray-500">Se incluirá en tu comprobante y estado de cuenta.</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={transferLoading}
                  className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={transferLoading || !transferRecipient || !transferAmount}
                  className="flex-1 rounded-xl bg-brand-emerald px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand-emerald/20 transition hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {transferLoading ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : 'Enviar Dinero'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Force deploy update
