'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Radio, Users, Send, ShoppingBag, ArrowLeft, Heart, ExternalLink, Eye, Video, VideoOff } from 'lucide-react';
import { Suspense } from 'react';

interface Product {
    id: string;
    title: string;
    price: number;
    images: string[];
}

function PreviewContent() {
    const searchParams = useSearchParams();
    const title = searchParams.get('title') || 'Mi transmisión en vivo';
    const description = searchParams.get('description') || '';
    const productIds = searchParams.get('products')?.split(',').filter(Boolean) || [];

    const [products, setProducts] = useState<Product[]>([]);
    const [profileData, setProfileData] = useState<{ full_name: string | null; avatar_url: string | null }>({ full_name: null, avatar_url: null });
    const [reactions, setReactions] = useState<{ id: number; x: number }[]>([]);
    const [reactionCount, setReactionCount] = useState(0);
    const [cameraActive, setCameraActive] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        const load = async () => {
            // Load host profile
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', user.id)
                    .single();
                if (profile) setProfileData(profile);
            }

            // Load products
            if (productIds.length > 0) {
                const { data } = await supabase
                    .from('listings')
                    .select('id, title, price, images')
                    .in('id', productIds);
                if (data) setProducts(data);
            }
        };
        load();

        // Auto-start camera
        const startCam = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false,
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                streamRef.current = stream;
                setCameraActive(true);
            } catch (e) {
                console.log('[Preview] Camera not available:', e);
            }
        };
        startCam();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const addReaction = () => {
        const id = reactionCount;
        setReactionCount(c => c + 1);
        const x = 20 + Math.random() * 60;
        setReactions((prev) => [...prev, { id, x }]);
        setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== id));
        }, 2000);
    };

    const hostName = profileData.full_name || 'Vendedor';

    const mockMessages = [
        { id: '1', name: 'María López', message: '¡Hola! ¿Ese producto está disponible?', isHost: false },
        { id: '2', name: hostName, message: '¡Bienvenidos a todos! Sí, todo lo que ven está disponible 🔥', isHost: true },
        { id: '3', name: 'Carlos Ruiz', message: '¿Hacen envíos a Monterrey?', isHost: false },
        { id: '4', name: hostName, message: '¡Claro! Envíos a toda la república 📦', isHost: true },
        { id: '5', name: 'Ana García', message: '¡Me encanta el primero! ¿Qué tallas tienen?', isHost: false },
    ];

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Preview banner */}
            <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-semibold flex items-center justify-center gap-2">
                <Eye className="w-4 h-4" />
                VISTA PREVIA — Así es como los compradores verán tu transmisión en vivo
                <Link href="/dashboard/live" className="ml-4 bg-white text-amber-600 px-3 py-0.5 rounded-full text-xs font-bold hover:bg-amber-50">
                    ← Volver al dashboard
                </Link>
            </div>

            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-0 lg:gap-4 p-0 lg:p-4">

                {/* Video area */}
                <div className="flex-1 relative">
                    {/* Back button */}
                    <Link href="/live" className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Lives
                    </Link>

                    {/* Video area with camera */}
                    <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-none lg:rounded-2xl overflow-hidden">
                        {/* Camera feed */}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${cameraActive ? '' : 'hidden'}`}
                            style={{ transform: 'scaleX(-1)' }}
                        />
                        {/* Fallback when no camera */}
                        {!cameraActive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                {profileData.avatar_url ? (
                                    <img src={profileData.avatar_url} alt="" className="w-28 h-28 rounded-full ring-4 ring-red-500/40 object-cover mb-3" />
                                ) : (
                                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-4xl font-bold ring-4 ring-red-500/40 mb-3">
                                        {hostName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <h2 className="text-white text-lg font-bold">{hostName}</h2>
                                <p className="text-gray-400 text-sm">{title}</p>
                            </div>
                        )}
                        {/* Host name overlay when camera is on */}
                        {cameraActive && (
                            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-lg font-semibold">
                                {hostName} · {title}
                            </div>
                        )}

                        {/* LIVE badge */}
                        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg animate-pulse">
                            <div className="w-2.5 h-2.5 bg-white rounded-full" />
                            EN VIVO
                        </div>

                        {/* Viewer count */}
                        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-lg">
                            <Users className="w-4 h-4" />
                            {Math.floor(Math.random() * 20) + 5} viendo
                        </div>

                        {/* Reactions */}
                        {reactions.map((r) => (
                            <div
                                key={r.id}
                                className="absolute bottom-20 text-2xl"
                                style={{ left: `${r.x}%`, animation: 'float-up 2s ease-out forwards' }}
                            >
                                ❤️
                            </div>
                        ))}
                    </div>

                    {/* Products showcase */}
                    {products.length > 0 && (
                        <div className="p-4">
                            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4 text-red-400" />
                                Productos en vivo ({products.length})
                            </h3>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {products.map((product) => (
                                    <Link
                                        key={product.id}
                                        href={`/listings/${product.id}`}
                                        target="_blank"
                                        className="flex-shrink-0 w-36 rounded-xl bg-gray-800 overflow-hidden hover:ring-2 hover:ring-red-500 transition-all group"
                                    >
                                        <div className="h-24 bg-gray-700 overflow-hidden">
                                            {product.images?.[0] ? (
                                                <img src={product.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                                    <ShoppingBag className="w-8 h-8" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2">
                                            <p className="text-white text-xs font-medium line-clamp-1">{product.title}</p>
                                            <p className="text-red-400 text-sm font-bold">${product.price?.toLocaleString('es-MX')}</p>
                                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                                                <ExternalLink className="w-3 h-3" /> Ver producto
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {products.length === 0 && productIds.length === 0 && (
                        <div className="p-4">
                            <div className="rounded-xl border border-dashed border-gray-600 p-6 text-center">
                                <ShoppingBag className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">No seleccionaste productos para mostrar</p>
                                <p className="text-gray-600 text-xs mt-1">Selecciona productos desde el dashboard antes de iniciar tu Live</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat panel */}
                <div className="w-full lg:w-96 flex flex-col bg-gray-800 lg:rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 2rem)', maxHeight: '700px' }}>
                    {/* Chat header */}
                    <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            💬 Chat en vivo
                            <span className="bg-gray-700 text-gray-400 text-xs px-2 py-0.5 rounded-full">{mockMessages.length}</span>
                        </h3>
                        <button
                            onClick={addReaction}
                            className="flex items-center gap-1 bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-red-500/30 transition-colors active:scale-95"
                        >
                            <Heart className="w-3.5 h-3.5" />
                            Reaccionar
                        </button>
                    </div>

                    {/* Mock messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {mockMessages.map((msg) => (
                            <div key={msg.id} className="flex items-start gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${msg.isHost ? 'bg-red-500 text-white' : 'bg-gray-600 text-gray-300'
                                    }`}>
                                    {msg.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <span className={`text-xs font-semibold ${msg.isHost ? 'text-red-400' : 'text-gray-400'}`}>
                                        {msg.name}
                                        {msg.isHost && <span className="ml-1 bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded text-[9px]">Vendedor</span>}
                                    </span>
                                    <p className="text-white text-sm break-words">{msg.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-gray-700">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Escribe un mensaje..."
                                disabled
                                className="flex-1 bg-gray-700 text-white text-sm rounded-xl px-4 py-2.5 outline-none placeholder-gray-500 opacity-60"
                            />
                            <button
                                disabled
                                className="bg-red-500 text-white rounded-xl px-4 py-2.5 opacity-40 cursor-not-allowed"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-gray-600 text-[10px] text-center mt-1">Vista previa — el chat estará activo durante la transmisión real</p>
                    </div>
                </div>
            </div>

            {/* Floating reactions CSS */}
            <style jsx>{`
                @keyframes float-up {
                    0% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-200px) scale(1.5); }
                }
            `}</style>
        </div>
    );
}

export default function LivePreviewPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
            </div>
        }>
            <PreviewContent />
        </Suspense>
    );
}
