'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

/* ═══════════════════════════════════════════
   TEMPLATES
   ═══════════════════════════════════════════ */
const TEMPLATES = [
    {
        id: 'general',
        name: 'Clásica',
        emoji: '🎁',
        gradient: 'from-gray-900 via-gray-800 to-black',
        accent: '#f97316',
        pattern: '✨🎁💎',
        defaultMsg: '¡Disfruta este regalo!',
    },
    {
        id: 'birthday',
        name: 'Cumpleaños',
        emoji: '🎂',
        gradient: 'from-emerald-500 via-rose-500 to-fuchsia-600',
        accent: '#fbbf24',
        pattern: '🎂🎈🎉',
        defaultMsg: '¡Feliz cumpleaños! 🎂🎉',
    },
    {
        id: 'christmas',
        name: 'Navidad',
        emoji: '🎄',
        gradient: 'from-red-700 via-red-600 to-green-700',
        accent: '#fbbf24',
        pattern: '🎄⭐❄️',
        defaultMsg: '¡Feliz Navidad! 🎄✨',
    },
    {
        id: 'valentine',
        name: 'San Valentín',
        emoji: '💕',
        gradient: 'from-rose-400 via-emerald-500 to-red-500',
        accent: '#fff',
        pattern: '💕❤️💖',
        defaultMsg: 'Con todo mi amor 💕',
    },
    {
        id: 'graduation',
        name: 'Graduación',
        emoji: '🎓',
        gradient: 'from-indigo-600 via-blue-600 to-cyan-500',
        accent: '#fbbf24',
        pattern: '🎓📚⭐',
        defaultMsg: '¡Felicidades por tu logro! 🎓',
    },
    {
        id: 'thanks',
        name: 'Gracias',
        emoji: '🙏',
        gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
        accent: '#fff',
        pattern: '🙏🌟💚',
        defaultMsg: '¡Muchas gracias! 🙏✨',
    },
];

const PRESET_MESSAGES = [
    '¡Feliz cumpleaños! 🎂🎉',
    'Te lo mereces ✨',
    'Con mucho cariño 💕',
    '¡Felicidades! 🎉',
    'Para que te compres lo que quieras 🛍️',
    '¡Disfrútalo! 🎁',
    'Un detallito para ti 🌟',
    '¡Feliz Navidad! 🎄',
];

const DENOMINATIONS = [
    { amount: 50, color: 'from-emerald-500 to-teal-600', emoji: '🎁', popular: false },
    { amount: 100, color: 'from-blue-500 to-indigo-600', emoji: '🎉', popular: true },
    { amount: 200, color: 'from-purple-500 to-violet-600', emoji: '🌟', popular: false },
    { amount: 500, color: 'from-orange-500 to-red-500', emoji: '🔥', popular: true },
    { amount: 1000, color: 'from-yellow-500 to-amber-600', emoji: '💎', popular: false },
];

type PaymentMethod = 'pocketcash' | 'mercadopago' | 'bank_transfer' | 'bank_deposit' | 'oxxo';

export default function GiftCardsPage() {
    const [user, setUser] = useState<any>(null);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [forSelf, setForSelf] = useState(true);
    const [recipientEmail, setRecipientEmail] = useState('');
    const [giftMessage, setGiftMessage] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pocketcash');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [myCards, setMyCards] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
    const [step, setStep] = useState<'amount' | 'customize' | 'payment'>('amount');
    const [copySuccess, setCopySuccess] = useState(false);
    const [emailSending, setEmailSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [emailError, setEmailError] = useState('');
    const cardPreviewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user) {
                setUser(data.user);
                loadWalletBalance(data.user.id);
                loadMyCards();
            }
        });
    }, []);

    async function loadWalletBalance(userId: string) {
        const { data } = await supabase.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
        if (data) setWalletBalance(Number(data.balance));
    }

    async function loadMyCards() {
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;
            if (!token) return;
            const res = await fetch('/api/gift-cards/list', {
                headers: { authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.ok) setMyCards([...(json.purchased || []), ...(json.redeemed || [])]);
        } catch { }
    }

    function openPurchaseModal(amount: number) {
        if (!user) {
            window.location.href = '/auth/login?redirect=/gift-cards';
            return;
        }
        setSelectedAmount(amount);
        setError('');
        setResult(null);
        setForSelf(true);
        setRecipientEmail('');
        setGiftMessage('');
        setPaymentMethod('pocketcash');
        setSelectedTemplate(TEMPLATES[0]);
        setStep('customize');
        setShowModal(true);
        setCopySuccess(false);
    }

    async function handlePurchase() {
        if (!selectedAmount || isLoading) return;
        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;
            if (!token) throw new Error('Inicia sesión para continuar');

            const res = await fetch('/api/gift-cards/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    amount: selectedAmount,
                    payment_method: paymentMethod,
                    for_self: forSelf,
                    recipient_email: !forSelf ? recipientEmail : undefined,
                    message: !forSelf ? giftMessage : undefined,
                }),
            });

            const json = await res.json();

            if (!res.ok) {
                setError(json.error || 'Error al procesar la compra');
                return;
            }

            // MercadoPago redirect
            if (json.init_point) {
                window.location.href = json.init_point;
                return;
            }

            setResult(json);
            loadMyCards();
            if (user) loadWalletBalance(user.id);

            // Auto-send email if this is a gift with recipient email
            if (!forSelf && recipientEmail && json.gift_card?.code) {
                try {
                    const { data: sess } = await supabase.auth.getSession();
                    const profile = await supabase.from('profiles').select('full_name, nickname').eq('id', user.id).maybeSingle();
                    const senderName = profile?.data?.full_name || profile?.data?.nickname || 'Alguien especial';

                    await fetch('/api/gift-cards/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: recipientEmail,
                            code: json.gift_card.code,
                            amount: selectedAmount,
                            message: giftMessage,
                            senderName,
                            template: selectedTemplate.id,
                        }),
                    });
                    setEmailSent(true);
                } catch {
                    // Non-critical — user can still share manually
                }
            }
        } catch (err: any) {
            setError(err.message || 'Error inesperado');
        } finally {
            setIsLoading(false);
        }
    }

    function copyCode(code: string) {
        navigator.clipboard.writeText(code);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    }

    function shareWhatsApp(code: string, amount: number) {
        const msg = encodeURIComponent(
            `🎁 ¡Te envío una Tarjeta de Regalo PocketCash por $${amount} MXN!\n\n` +
            `${giftMessage ? `💬 "${giftMessage}"\n\n` : ''}` +
            `Tu código: *${code}*\n\n` +
            `Canjéalo en: https://www.gopocket.com.mx/dashboard/monedero\n\n` +
            `❤️ Enviado con GoVendy`
        );
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    }

    async function shareEmail(code: string, amount: number, targetEmail?: string) {
        const emailTo = targetEmail || recipientEmail;
        if (!emailTo) {
            // If no email provided, prompt for one
            const input = prompt('Ingresa el email del destinatario:');
            if (!input) return;
            return shareEmail(code, amount, input);
        }

        setEmailSending(true);
        setEmailError('');
        try {
            const profile = await supabase.from('profiles').select('full_name, nickname').eq('id', user?.id).maybeSingle();
            const senderName = profile?.data?.full_name || profile?.data?.nickname || 'Alguien especial';

            const res = await fetch('/api/gift-cards/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emailTo,
                    code,
                    amount,
                    message: giftMessage,
                    senderName,
                    template: selectedTemplate.id,
                }),
            });
            const json = await res.json();
            if (json.ok) {
                setEmailSent(true);
            } else {
                setEmailError(json.error || 'No se pudo enviar el email');
            }
        } catch (err: any) {
            setEmailError(err.message || 'Error al enviar email');
        } finally {
            setEmailSending(false);
        }
    }

    function copyShareLink(code: string) {
        const link = `https://www.gopocket.com.mx/dashboard/monedero?redeem=${code}`;
        navigator.clipboard.writeText(link);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    }

    async function downloadCardImage(code: string, amount: number) {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, 800, 500);
        const tpl = selectedTemplate;
        if (tpl.id === 'birthday') { grad.addColorStop(0, '#ec4899'); grad.addColorStop(1, '#a855f7'); }
        else if (tpl.id === 'christmas') { grad.addColorStop(0, '#b91c1c'); grad.addColorStop(1, '#15803d'); }
        else if (tpl.id === 'valentine') { grad.addColorStop(0, '#fb7185'); grad.addColorStop(1, '#ef4444'); }
        else if (tpl.id === 'graduation') { grad.addColorStop(0, '#4f46e5'); grad.addColorStop(1, '#06b6d4'); }
        else if (tpl.id === 'thanks') { grad.addColorStop(0, '#10b981'); grad.addColorStop(1, '#06b6d4'); }
        else { grad.addColorStop(0, '#1f2937'); grad.addColorStop(1, '#000'); }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 800, 500);

        // Rounded corners effect
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(30, 30, 740, 440);

        // Pattern emojis
        ctx.font = '40px serif';
        ctx.globalAlpha = 0.15;
        const emojis = tpl.pattern.split('');
        for (let i = 0; i < 12; i++) {
            ctx.fillText(emojis[i % emojis.length], 50 + (i % 4) * 200, 80 + Math.floor(i / 4) * 160);
        }
        ctx.globalAlpha = 1;

        // GoVendy logo text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText('GoVendy', 60, 80);

        // PocketCash label
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText('Tarjeta de Regalo PocketCash', 60, 110);

        // Big emoji
        ctx.font = '80px serif';
        ctx.fillText(tpl.emoji, 600, 120);

        // Amount
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 72px system-ui, sans-serif';
        ctx.fillText(`$${amount.toLocaleString('es-MX')}`, 60, 260);
        ctx.font = '24px system-ui, sans-serif';
        ctx.fillText('MXN', 60 + ctx.measureText(`$${amount.toLocaleString('es-MX')}`).width + 15, 260);

        // Message
        if (giftMessage) {
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = 'italic 22px system-ui, sans-serif';
            const maxW = 680;
            const msg = `"${giftMessage}"`;
            if (ctx.measureText(msg).width > maxW) {
                ctx.fillText(msg.slice(0, 60) + '…"', 60, 320);
            } else {
                ctx.fillText(msg, 60, 320);
            }
        }

        // Code
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(50, 370, 700, 60);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px monospace';
        ctx.fillText(code, 80, 410);

        // Footer
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText('Canjea en gopocket.com.mx/dashboard/monedero', 60, 460);

        // Download
        const link = document.createElement('a');
        link.download = `GoVendy-GiftCard-${code}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    const statusUrl = typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('status') : null;

    const tpl = selectedTemplate;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero */}
            <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 text-8xl animate-pulse">🎁</div>
                    <div className="absolute top-20 right-20 text-6xl animate-bounce" style={{ animationDelay: '0.5s' }}>💳</div>
                    <div className="absolute bottom-10 left-1/3 text-7xl animate-pulse" style={{ animationDelay: '1s' }}>✨</div>
                </div>
                <div className="max-w-6xl mx-auto px-4 py-16 sm:py-24 relative z-10">
                    <div className="text-center">
                        <p className="text-orange-400 font-semibold mb-3 tracking-wider uppercase text-sm">Tienda Oficial GoVendy</p>
                        <h1 className="text-4xl sm:text-6xl font-black mb-4">
                            Tarjetas de Regalo
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">
                                PocketCash
                            </span>
                        </h1>
                        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
                            Regala saldo PocketCash con plantillas personalizadas. Comparte por WhatsApp, Email o descarga la imagen.
                        </p>
                        <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
                            <span className="flex items-center gap-1">🔒 Códigos seguros</span>
                            <span className="flex items-center gap-1">⚡ Canje instantáneo</span>
                            <span className="flex items-center gap-1">📱 Compartir fácil</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* MercadoPago Status Banner */}
            {statusUrl && (
                <div className="max-w-6xl mx-auto px-4 mt-6">
                    <div className={`rounded-xl p-4 text-center font-medium ${statusUrl === 'success' ? 'bg-green-100 text-green-800' :
                        statusUrl === 'failure' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                        {statusUrl === 'success' && '✅ ¡Pago exitoso! Tu tarjeta de regalo ha sido procesada.'}
                        {statusUrl === 'failure' && '❌ El pago no se completó. Intenta de nuevo.'}
                        {statusUrl === 'pending' && '⏳ Tu pago está pendiente de confirmación.'}
                    </div>
                </div>
            )}

            {/* Denomination Cards */}
            <div className="max-w-6xl mx-auto px-4 py-12">
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Elige una denominación</h2>
                <p className="text-gray-500 text-center mb-10">Selecciona el monto que deseas regalar o agregar a tu cuenta</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                    {DENOMINATIONS.map((d) => (
                        <button
                            key={d.amount}
                            onClick={() => openPurchaseModal(d.amount)}
                            className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95"
                        >
                            {d.popular && (
                                <div className="absolute top-2 right-2 z-10 bg-white/90 text-xs font-bold px-2 py-0.5 rounded-full text-orange-600">
                                    Popular
                                </div>
                            )}
                            <div className={`bg-gradient-to-br ${d.color} p-6 sm:p-8 text-white`}>
                                <div className="text-3xl sm:text-4xl mb-3">{d.emoji}</div>
                                <div className="text-3xl sm:text-4xl font-black mb-1">
                                    ${d.amount.toLocaleString('es-MX')}
                                </div>
                                <div className="text-sm opacity-80">MXN</div>
                            </div>
                            <div className="bg-white p-3 text-center">
                                <span className="text-sm font-semibold text-gray-700 group-hover:text-orange-600 transition-colors">
                                    Comprar →
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* How it works */}
            <div className="bg-white py-12 border-t">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">¿Cómo funciona?</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
                        {[
                            { step: '1', icon: '🛒', title: 'Compra', desc: 'Elige monto y método de pago' },
                            { step: '2', icon: '🎨', title: 'Personaliza', desc: 'Elige plantilla y escribe un mensaje' },
                            { step: '3', icon: '📱', title: 'Comparte', desc: 'Envía por WhatsApp, Email o descarga' },
                            { step: '4', icon: '💰', title: 'Canjea', desc: 'El destinatario ingresa el código y recibe saldo' },
                        ].map((s) => (
                            <div key={s.step} className="text-center">
                                <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-3xl mx-auto mb-4">
                                    {s.icon}
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                                <p className="text-gray-500 text-sm">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* My Cards History */}
            {user && myCards.length > 0 && (
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4 hover:text-orange-600 transition-colors"
                    >
                        🎴 Mis Tarjetas ({myCards.length})
                        <span className={`text-sm transition-transform ${showHistory ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {showHistory && (
                        <div className="space-y-3">
                            {myCards.map((card: any) => (
                                <div key={card.id} className="bg-white rounded-xl p-4 border flex items-center justify-between">
                                    <div>
                                        <span className="font-mono font-bold text-gray-900">{card.code}</span>
                                        <div className="text-sm text-gray-500 mt-1">
                                            ${Number(card.amount).toLocaleString('es-MX')} MXN — {new Date(card.created_at).toLocaleDateString('es-MX')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${card.status === 'active' && card.payment_status === 'paid'
                                            ? 'bg-green-100 text-green-700'
                                            : card.status === 'redeemed'
                                                ? 'bg-blue-100 text-blue-700'
                                                : card.payment_status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {card.status === 'active' && card.payment_status === 'paid'
                                                ? 'Activa'
                                                : card.status === 'redeemed'
                                                    ? 'Canjeada'
                                                    : card.payment_status === 'pending'
                                                        ? 'Pago Pendiente'
                                                        : card.status}
                                        </span>
                                        {card.status === 'active' && card.payment_status === 'paid' && (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => copyCode(card.code)}
                                                    className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                                                    title="Copiar código"
                                                >
                                                    📋
                                                </button>
                                                <button
                                                    onClick={() => shareWhatsApp(card.code, Number(card.amount))}
                                                    className="text-xs bg-green-100 hover:bg-green-200 px-2 py-1 rounded transition-colors"
                                                    title="Compartir por WhatsApp"
                                                >
                                                    📱
                                                </button>
                                                <button
                                                    onClick={() => shareEmail(card.code, Number(card.amount))}
                                                    className="text-xs bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded transition-colors"
                                                    title="Compartir por Email"
                                                >
                                                    📧
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Footer CTA */}
            <div className="bg-gradient-to-r from-gray-900 to-black text-white py-12 text-center">
                <p className="text-gray-400 text-sm mb-2">¿Ya tienes un código?</p>
                <Link
                    href="/dashboard/monedero"
                    className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl transition-all hover:scale-105"
                >
                    💳 Canjear en mi Monedero
                </Link>
            </div>

            {/* ═══ PREMIUM PURCHASE MODAL ═══ */}
            {showModal && selectedAmount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !isLoading && setShowModal(false)}>
                    <div
                        className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ── RESULT SCREEN ── */}
                        {result && (
                            <div className="p-6">
                                {/* Card Preview */}
                                <div ref={cardPreviewRef} className={`bg-gradient-to-br ${tpl.gradient} rounded-2xl p-6 text-white mb-6 relative overflow-hidden`}>
                                    <div className="absolute inset-0 opacity-10 text-6xl flex flex-wrap justify-center items-center gap-6 pointer-events-none">
                                        {Array(6).fill(tpl.pattern).map((p, i) => <span key={i}>{p}</span>)}
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-sm opacity-70">Tarjeta de Regalo</p>
                                                <p className="font-bold text-lg">GoVendy PocketCash</p>
                                            </div>
                                            <span className="text-4xl">{tpl.emoji}</span>
                                        </div>
                                        <p className="text-4xl font-black mb-3">${selectedAmount.toLocaleString('es-MX')} MXN</p>
                                        {giftMessage && (
                                            <p className="italic opacity-90 text-sm mb-3">&ldquo;{giftMessage}&rdquo;</p>
                                        )}
                                        {result.gift_card?.code && (
                                            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 font-mono text-xl font-bold tracking-wider text-center">
                                                {result.gift_card.code}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-center mb-6">
                                    <div className="text-4xl mb-2">🎉</div>
                                    <p className="font-bold text-lg text-gray-900">{result.message}</p>
                                </div>

                                {/* Share Buttons */}
                                {result.gift_card?.code && !forSelf && (
                                    <div className="space-y-2 mb-6">
                                        {/* Auto-sent confirmation */}
                                        {emailSent && recipientEmail && (
                                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center mb-2">
                                                <p className="text-sm text-green-700 font-semibold">✅ Email enviado a {recipientEmail}</p>
                                                <p className="text-xs text-green-600 mt-1">Desde regalos@gopocket.com.mx</p>
                                            </div>
                                        )}
                                        {emailError && (
                                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center mb-2">
                                                <p className="text-sm text-red-700">{emailError}</p>
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider text-center mb-3">Compartir tarjeta</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => shareWhatsApp(result.gift_card.code, selectedAmount)}
                                                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95"
                                            >
                                                <span className="text-xl">📱</span> WhatsApp
                                            </button>
                                            <button
                                                onClick={() => shareEmail(result.gift_card.code, selectedAmount)}
                                                disabled={emailSending}
                                                className={`flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95 ${emailSent
                                                        ? 'bg-green-500 hover:bg-green-600 text-white'
                                                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                                                    } disabled:opacity-60`}
                                            >
                                                {emailSending ? (
                                                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
                                                ) : emailSent ? (
                                                    <><span className="text-xl">✅</span> Enviado</>
                                                ) : (
                                                    <><span className="text-xl">📧</span> Enviar Email</>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => copyShareLink(result.gift_card.code)}
                                                className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95"
                                            >
                                                <span className="text-xl">{copySuccess ? '✅' : '📋'}</span> {copySuccess ? 'Copiado!' : 'Copiar enlace'}
                                            </button>
                                            <button
                                                onClick={() => downloadCardImage(result.gift_card.code, selectedAmount)}
                                                className="flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95"
                                            >
                                                <span className="text-xl">📥</span> Descargar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Code Display for self */}
                                {result.gift_card?.code && forSelf && (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center mb-4">
                                        <p className="text-sm text-green-700">¡Saldo acreditado a tu PocketCash!</p>
                                    </div>
                                )}

                                {/* Pending Payment */}
                                {result.status === 'pending_payment' && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center mb-4">
                                        <p className="text-sm text-yellow-800">⏳ Una vez verificado tu pago, la tarjeta se activará automáticamente.</p>
                                    </div>
                                )}

                                <button
                                    onClick={() => { setShowModal(false); setResult(null); setStep('amount'); }}
                                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        )}

                        {/* ── CUSTOMIZE STEP ── */}
                        {!result && step === 'customize' && (
                            <div>
                                {/* Header with preview */}
                                <div className={`bg-gradient-to-br ${tpl.gradient} rounded-t-3xl p-6 text-white relative overflow-hidden`}>
                                    <div className="absolute inset-0 opacity-10 text-5xl flex flex-wrap justify-center items-center gap-4 pointer-events-none">
                                        {Array(4).fill(tpl.pattern).map((p, i) => <span key={i}>{p}</span>)}
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm opacity-60">Tarjeta de Regalo</p>
                                                <p className="text-3xl font-black">${selectedAmount.toLocaleString('es-MX')} <span className="text-lg font-normal">MXN</span></p>
                                            </div>
                                            <button onClick={() => !isLoading && setShowModal(false)} className="text-white/60 hover:text-white text-2xl">✕</button>
                                        </div>
                                        {giftMessage && (
                                            <p className="mt-3 italic opacity-80 text-sm">&ldquo;{giftMessage}&rdquo;</p>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6 space-y-5">
                                    {/* Template Selection */}
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 block mb-3">🎨 Plantilla</label>
                                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                            {TEMPLATES.map((t) => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setSelectedTemplate(t)}
                                                    className={`relative rounded-xl p-3 transition-all text-center ${selectedTemplate.id === t.id
                                                        ? 'ring-2 ring-orange-500 ring-offset-2 scale-105'
                                                        : 'ring-1 ring-gray-200 hover:ring-gray-300'
                                                        }`}
                                                >
                                                    <div className="text-2xl mb-1">{t.emoji}</div>
                                                    <div className="text-[10px] font-medium text-gray-600 leading-tight">{t.name}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* For Self / Gift Toggle */}
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 block mb-2">¿Para quién es?</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setForSelf(true)}
                                                className={`py-3 rounded-xl text-sm font-semibold transition-all ${forSelf ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                            >
                                                👤 Para mí
                                            </button>
                                            <button
                                                onClick={() => setForSelf(false)}
                                                className={`py-3 rounded-xl text-sm font-semibold transition-all ${!forSelf ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                            >
                                                🎁 Regalar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Gift Fields */}
                                    {!forSelf && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-sm font-medium text-gray-600 block mb-1">Email del destinatario (opcional)</label>
                                                <input
                                                    type="email"
                                                    value={recipientEmail}
                                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                                    placeholder="amigo@email.com"
                                                    className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-600 block mb-1">💬 Mensaje personalizado</label>
                                                <textarea
                                                    value={giftMessage}
                                                    onChange={(e) => setGiftMessage(e.target.value)}
                                                    placeholder={tpl.defaultMsg}
                                                    rows={2}
                                                    maxLength={500}
                                                    className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                                                />
                                                {/* Preset messages */}
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {PRESET_MESSAGES.map((m) => (
                                                        <button
                                                            key={m}
                                                            onClick={() => setGiftMessage(m)}
                                                            className={`text-xs px-2.5 py-1 rounded-full transition-all ${giftMessage === m
                                                                ? 'bg-orange-500 text-white'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                                                }`}
                                                        >
                                                            {m}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Next Step */}
                                    <button
                                        onClick={() => setStep('payment')}
                                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-3.5 rounded-xl text-lg transition-all hover:shadow-lg active:scale-[0.98]"
                                    >
                                        Continuar al pago →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── PAYMENT STEP ── */}
                        {!result && step === 'payment' && (
                            <div>
                                {/* Mini preview header */}
                                <div className={`bg-gradient-to-br ${tpl.gradient} rounded-t-3xl p-4 text-white flex items-center justify-between`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{tpl.emoji}</span>
                                        <div>
                                            <p className="text-xs opacity-60">Tarjeta {tpl.name}</p>
                                            <p className="text-xl font-black">${selectedAmount.toLocaleString('es-MX')} MXN</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setStep('customize')} className="text-white/60 hover:text-white text-sm underline">← Volver</button>
                                </div>

                                <div className="p-6 space-y-5">
                                    {/* Payment Method */}
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 block mb-2">Método de pago</label>
                                        <div className="space-y-2">
                                            {([
                                                { id: 'pocketcash' as PaymentMethod, label: 'PocketCash', icon: '💰', desc: walletBalance !== null ? `Saldo: $${walletBalance.toLocaleString('es-MX')}` : 'Saldo disponible' },
                                                { id: 'mercadopago' as PaymentMethod, label: 'MercadoPago', icon: '💳', desc: 'Tarjeta de crédito/débito' },
                                                { id: 'bank_transfer' as PaymentMethod, label: 'Transferencia', icon: '🏦', desc: 'SPEI / Transferencia bancaria' },
                                                { id: 'bank_deposit' as PaymentMethod, label: 'Depósito', icon: '🏧', desc: 'Depósito en ventanilla' },
                                                { id: 'oxxo' as PaymentMethod, label: 'OXXO', icon: '🏪', desc: 'Pago en efectivo en OXXO' },
                                            ]).map((pm) => (
                                                <button
                                                    key={pm.id}
                                                    onClick={() => setPaymentMethod(pm.id)}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${paymentMethod === pm.id
                                                        ? 'border-orange-500 bg-orange-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    <span className="text-xl">{pm.icon}</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-gray-900">{pm.label}</p>
                                                        <p className="text-xs text-gray-500">{pm.desc}</p>
                                                    </div>
                                                    {paymentMethod === pm.id && (
                                                        <span className="text-orange-500 text-lg">✓</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Error */}
                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                                            {error}
                                        </div>
                                    )}

                                    {/* Purchase Button */}
                                    <button
                                        onClick={handlePurchase}
                                        disabled={isLoading || (paymentMethod === 'pocketcash' && walletBalance !== null && walletBalance < selectedAmount)}
                                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-3.5 rounded-xl text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Procesando...
                                            </span>
                                        ) : (
                                            <>
                                                {forSelf ? '💰 Recargar' : '🎁 Comprar'} ${selectedAmount.toLocaleString('es-MX')} MXN
                                            </>
                                        )}
                                    </button>

                                    {paymentMethod === 'pocketcash' && walletBalance !== null && walletBalance < selectedAmount && (
                                        <p className="text-center text-sm text-red-500">Saldo insuficiente. Necesitas ${selectedAmount - walletBalance} más.</p>
                                    )}

                                    {['bank_transfer', 'bank_deposit', 'oxxo'].includes(paymentMethod) && (
                                        <p className="text-center text-xs text-gray-400">
                                            ℹ️ Los pagos manuales requieren verificación. Tu tarjeta se activará una vez confirmado el pago.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
