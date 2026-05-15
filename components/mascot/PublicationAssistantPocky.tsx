'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PocketMascot, MascotEmotion } from './PocketMascot';

interface PublicationAssistantPockyProps {
    error: string | null;
    isSaving?: boolean;
    missingFields?: string[];
    completionPercent?: number;
    currentCategory?: string;
}

export function PublicationAssistantPocky({ error, isSaving, missingFields = [], completionPercent = 0, currentCategory = '' }: PublicationAssistantPockyProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [currentMessage, setCurrentMessage] = useState<string | null>(null);
    const [emotion, setEmotion] = useState<MascotEmotion>('waiting');
    const [mounted, setMounted] = useState(false);

    // Drag state
    const [pos, setPos] = useState({ right: 24, bottom: 24 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, right: 24, bottom: 24 });
    const dragMoved = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Effect for error/saving state
    useEffect(() => {
        let timer: NodeJS.Timeout;

        if (error) {
            setEmotion('confused');
            setCurrentMessage(error);
            setIsVisible(true);
        } else if (isSaving) {
            setEmotion('thinking');
            setCurrentMessage('Procesando tu publicación... ¡Ya casi está! 🚀');
            setIsVisible(true);
        } else {
            timer = setTimeout(() => {
                setIsVisible(false);
                setEmotion('waiting');
            }, 5000);
        }

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [error, isSaving]);

    // Tips aleatorios y recordatorios
    useEffect(() => {
        if (!mounted) return;

        let interval: NodeJS.Timeout;
        let hideTimer: NodeJS.Timeout;

        if (!error && !isSaving) {
            const generalTips = [
                "¡Hola! Soy Pocky. Estoy aquí para ayudarte a publicar tu producto.",
                "Recuerda que buenas fotos atraen más compradores. 📸",
                "Un título descriptivo ayuda a que te encuentren más rápido.",
                "Si tienes dudas, ¡haz clic en mí!",
            ];

            interval = setInterval(() => {
                if (!isVisible) {
                    let msg = "";
                    let emo: MascotEmotion = 'happy';

                    // 60% chance to remind about missing fields if any
                    if (missingFields.length > 0 && Math.random() > 0.4) {
                        const field = missingFields[Math.floor(Math.random() * missingFields.length)];
                        
                        // Smart hints based on field and category
                        if (field === 'Título' && currentCategory) {
                             msg = `💡 Para ${currentCategory}, un buen título incluye Marca + Modelo + Color.`;
                        } else if (field === 'Descripción') {
                             msg = "📝 En la descripción, menciona el estado real y las medidas. ¡Evita devoluciones!";
                        } else if (field === 'Fotos') {
                             msg = "📸 Tip: Usa luz natural y fondo neutro para tus fotos.";
                        } else {
                             msg = `💡 No olvides agregar: ${field}. ¡Es importante!`;
                        }
                        emo = 'thinking';
                    } else {
                        msg = generalTips[Math.floor(Math.random() * generalTips.length)];
                    }

                    setCurrentMessage(msg);
                    setEmotion(emo);
                    setIsVisible(true);

                    hideTimer = setTimeout(() => {
                        setIsVisible(false);
                    }, 6000);
                }
            }, 30000);
        }

        return () => {
            if (interval) clearInterval(interval);
            if (hideTimer) clearTimeout(hideTimer);
        };
    }, [error, isSaving, isVisible, missingFields]);

    // --- Drag handlers ---
    const handleDragStart = useCallback((clientX: number, clientY: number) => {
        setIsDragging(true);
        dragMoved.current = false;
        dragStart.current = {
            x: clientX,
            y: clientY,
            right: pos.right,
            bottom: pos.bottom,
        };
    }, [pos.right, pos.bottom]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);
    }, [handleDragStart]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        handleDragStart(touch.clientX, touch.clientY);
    }, [handleDragStart]);

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (clientX: number, clientY: number) => {
            const dx = dragStart.current.x - clientX;
            const dy = dragStart.current.y - clientY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
            let right = dragStart.current.right + dx;
            let bottom = dragStart.current.bottom + dy;
            const pad = 8;
            right = Math.max(pad, Math.min(window.innerWidth - 120, right));
            bottom = Math.max(pad, Math.min(window.innerHeight - 140, bottom));
            setPos({ right, bottom });
        };
        const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
        const onTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            onMove(touch.clientX, touch.clientY);
        };
        const onUp = () => setIsDragging(false);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onUp);
        };
    }, [isDragging]);

    const handleInteraction = () => {
        if (dragMoved.current) return; // Don't trigger on drag

        // Si hay campos faltantes, priorizar ayuda
        if (missingFields.length > 0) {
            setEmotion('thinking');
            const nextField = missingFields[0];
            const msg = `¡Te falta ${nextField}! Vamos, tú puedes. Llevas el ${completionPercent}% completado. 🏁`;
            setCurrentMessage(msg);
            setIsVisible(true);
            setTimeout(() => { if (!error) setIsVisible(false); }, 6000);
            return;
        }

        const funMessages = [
            "¡Eso! Vamos a vender mucho hoy. 🚀",
            "¡Me encanta ayudarte! Eres un gran vendedor. ✨",
            "¡Click! Jeje, eso me dio cosquillas. 🤖",
            "¿Sabías que los productos con buenas descripciones venden 30% más? 💡",
            "¡Pocky al rescate! ¿Qué más vamos a publicar? 🎒",
            "¡Bip-bup! Todo va sobre ruedas. ⚙️"
        ];
        const randMessage = funMessages[Math.floor(Math.random() * funMessages.length)];
        setEmotion('excited');
        setCurrentMessage(randMessage);
        setIsVisible(true);

        setTimeout(() => {
            if (!error) setIsVisible(false);
        }, 5000);
    };

    if (!mounted) return null;

    return (
        <div
            className="fixed z-50 flex flex-col items-end pointer-events-none"
            style={{ right: pos.right, bottom: pos.bottom }}
        >
            <AnimatePresence>
                {isVisible && currentMessage && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        className="mb-4 max-w-[240px] pointer-events-auto"
                    >
                        <div className="relative rounded-2xl bg-gray-900 px-4 py-3 shadow-2xl ring-1 ring-white/10">
                            <p className="text-xs font-bold leading-relaxed text-white">
                                {currentMessage}
                            </p>
                            <div className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 bg-gray-900" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                className="pointer-events-auto cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                <motion.div
                    whileHover={{ scale: 1.1 }}
                    onClick={handleInteraction}
                >
                    <PocketMascot
                        emotion={emotion}
                        size={100}
                        lookingAt="left"
                        isDragging={isDragging}
                    />
                </motion.div>
            </div>
        </div>
    );
}
