'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AnimatePresence, motion } from 'framer-motion';
import { PocketMascot, MascotEmotion } from './mascot/PocketMascot';

export type TourStep = {
  id: string;
  target: string; // selector CSS del elemento a destacar
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
};

type PageTourProps = {
  steps: TourStep[];
  pageId: string;
};

export function PageTour({ steps, pageId }: PageTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [targetElement, setTargetElement] = useState<Element | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const pathname = usePathname();

  // Rectángulo del elemento objetivo
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Mouse Tracking
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isActive]);
    useEffect(() => {
    const checkMobile = () => {
        setIsMobile(window.innerWidth < 640);
    };
    
    // Chequear al montar
    checkMobile();
    
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const checkTourStatus = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const uid = userData.user.id;
        setUserId(uid);

        // Chequeo global para permitir desactivar todos los tours desde el perfil
        const { data: profile } = await supabase
          .from('profiles')
          .select('has_seen_onboarding_tour')
          .eq('id', uid)
          .maybeSingle();

        // Si has_seen_onboarding_tour es true, significa que el usuario desactivó los tours o ya completó el onboarding global
        // y NO quiere ver más tours automáticos (a menos que los reactive explícitamente).
        if (profile?.has_seen_onboarding_tour === true) {
          return;
        }

        const hasSeenPageTour = localStorage.getItem(`pocket_tour_${pageId}_${uid}`);
        if (hasSeenPageTour === 'true') {
          return;
        }

        setTimeout(() => {
          setIsActive(true);
        }, 800);
      } catch (err) {
        console.error('[PageTour] Error:', err);
      }
    };

    void checkTourStatus();
  }, [pageId, pathname]);

  const markTourAsSeen = useCallback(async () => {
    if (!userId) return;
    try {
      localStorage.setItem(`pocket_tour_${pageId}_${userId}`, 'true');
      setIsActive(false);
    } catch (err) {
      console.error('[PageTour] Error al marcar tour como visto:', err);
      setIsActive(false);
    }
  }, [userId, pageId]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      void markTourAsSeen();
    }
  };

  const handleSkip = () => {
    void markTourAsSeen();
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];

  // Actualizar target y rect
  useEffect(() => {
    if (!isActive) return;
    if (typeof document === 'undefined') return;
    if (!step) return;

    const updateRect = () => {
      const element = document.querySelector(step.target);
      setTargetElement(element);
      if (element) {
        const r = element.getBoundingClientRect();
        // Ajustar si el elemento está fuera de vista (scroll)
        if (r.top < 0 || r.bottom > window.innerHeight) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setRect(r);
      } else if (step.target === 'body') {
        setRect(null); // Caso especial para 'body' o modales generales
      } else {
        // Si no encuentra el elemento, intentar avanzar
        const timer = setTimeout(() => {
            if (currentStep < steps.length - 1) {
                setCurrentStep(prev => prev + 1);
            }
        }, 500);
        return () => clearTimeout(timer);
      }
    };

    updateRect();
    // Escuchar resize y scroll para actualizar posición
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [currentStep, isActive, step, steps.length]);

  if (!isActive || !step || steps.length === 0) return null;

  // Calcular posición del tooltip
  const getTooltipPosition = () => {
    // En móvil (width < 640), usamos posición fija abajo pero "flotante"
    if (isMobile) {
        return {
            top: typeof window !== 'undefined' ? window.innerHeight - 280 : 500, // Un poco más arriba
            left: typeof window !== 'undefined' ? window.innerWidth / 2 - 160 : 0, // Centrado
            isFixedBottom: true
        };
    }

    if (!rect) {
      // Centrado si no hay target específico
      if (typeof window === 'undefined') return { top: 0, left: 0 };
      return {
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 160,
      };
    }

    const spacing = 20;
    const tooltipWidth = 320;
    const tooltipHeight = 250; // Aumentado para mayor seguridad (antes 200)

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'top':
        top = rect.top - tooltipHeight - spacing;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + spacing;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - spacing;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + spacing;
        break;
      default:
        top = rect.bottom + spacing;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
    }

    // Asegurar que no se salga de la pantalla
    // Aumentamos el margen inferior para evitar cortes en pantallas pequeñas o con barras de herramientas
    if (typeof window === 'undefined') return { top, left };
    return {
      top: Math.max(20, Math.min(top, window.innerHeight - tooltipHeight - 80)), // Margen inferior aumentado a 80px
      left: Math.max(20, Math.min(left, window.innerWidth - tooltipWidth - 20)),
    };
  };

  const tooltipPos = getTooltipPosition();

  // Variantes para animación
  const overlayVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  // Determinar emoción según el paso o contexto
  const getEmotionForStep = (): MascotEmotion => {
    if (currentStep === 0) return 'happy';
    if (currentStep === steps.length - 1) return 'excited';
    // Lógica simple: pasos pares pensando, impares esperando/feliz
    return currentStep % 2 === 0 ? 'thinking' : 'waiting';
  };

  const emotion = getEmotionForStep();
  
  // Determinar lado de la mascota (relative al tooltip)
  // Por defecto, si el tooltip está a la derecha de la pantalla, mascota a la izquierda (mirando derecha)
  // Si tooltip a la izquierda, mascota a la derecha (mirando izquierda)
  
  // Si estamos en móvil, la mascota va arriba del tooltip fijo
  const mascotSide = 'left'; // En móvil no importa tanto el side si va arriba
  
  // Verificar espacio (solo si no es móvil)
  const mascotSize = 140;
  const gap = 16;
  let desktopMascotSide: 'left' | 'right' = tooltipPos.left > (typeof window !== 'undefined' ? window.innerWidth : 1000) / 2 ? 'left' : 'right';

  if (!isMobile) {
    if (desktopMascotSide === 'left' && tooltipPos.left < (mascotSize + gap)) {
        desktopMascotSide = 'right';
    } else if (desktopMascotSide === 'right' && ((typeof window !== 'undefined' ? window.innerWidth : 1000) - (tooltipPos.left + 320)) < (mascotSize + gap)) {
        desktopMascotSide = 'left';
    }
  }

  const finalMascotSide = isMobile ? 'left' : desktopMascotSide;

  const handlePause = () => {
      setIsActive(false); // Cierra sin marcar como visto (Pausar)
  };

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Overlay Mask System (4 divs) para permitir interacción con el target */}
          {rect && (
            <>
              {/* Top */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed left-0 top-0 z-[9998] bg-black/60 backdrop-blur-[1px]"
                style={{ width: '100%', height: rect.top }}
              />
              {/* Bottom */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed left-0 z-[9998] bg-black/60 backdrop-blur-[1px]"
                style={{ top: rect.bottom, width: '100%', height: window.innerHeight - rect.bottom }}
              />
              {/* Left */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed left-0 z-[9998] bg-black/60 backdrop-blur-[1px]"
                style={{ top: rect.top, height: rect.height, width: rect.left }}
              />
              {/* Right */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed right-0 z-[9998] bg-black/60 backdrop-blur-[1px]"
                style={{ top: rect.top, height: rect.height, width: window.innerWidth - rect.right }}
              />
            </>
          )}

          {/* Fallback overlay si no hay rect (body target) */}
          {!rect && (
            <motion.div
              variants={overlayVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            />
          )}

          {/* Highlight Border (Animado) */}
          {rect && (
            <motion.div
              layoutId="tour-highlight"
              className="fixed z-[9999] rounded-lg border-2 border-brand-emerald shadow-[0_0_20px_rgba(236,72,153,0.5)]"
              initial={false}
              animate={{
                top: rect.top - 4,
                left: rect.left - 4,
                width: rect.width + 8,
                height: rect.height + 8,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Contenedor Principal (Tooltip + Mascota) */}
          <motion.div
            className="fixed z-[10000]"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                top: tooltipPos.top,
                left: tooltipPos.left
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            drag // Habilitado para todos los dispositivos
            dragMomentum={false} // Sin inercia para control preciso
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
          >
            <div className="relative">
                {/* Mascota (Posicionada absolutamente respecto al tooltip) */}
                <div 
                    style={{ zIndex: 50 }}
                    className={`absolute w-[140px] ${
                        isMobile 
                            ? 'bottom-full left-1/2 -ml-[70px] mb-[-10px]' 
                            : finalMascotSide === 'left' ? 'bottom-0 right-full mr-[-20px]' : 'bottom-0 left-full ml-[-20px]'
                    }`}
                >
                   <PocketMascot 
                      emotion={emotion} 
                      size={140} 
                      lookingAt={isMobile ? 'center' : (finalMascotSide === 'left' ? 'right' : 'left')}
                      isDragging={isDragging}
                      mouseX={mousePos.x}
                      mouseY={mousePos.y}
                    />
                </div>

                {/* Globo de diálogo (Tooltip) */}
                <div className={`relative w-80 rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/5 ${
                   !isMobile && (finalMascotSide === 'left' ? 'rounded-bl-none' : 'rounded-br-none')
                }`}>
                   {/* Triángulo del globo */}
                   {!isMobile && (
                       <div className={`absolute bottom-8 h-4 w-4 bg-white transform rotate-45 ${
                         finalMascotSide === 'left' ? '-left-2' : '-right-2'
                       }`}></div>
                   )}
                   {isMobile && (
                       <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 transform bg-white"></div>
                   )}
    
                  {/* Header con botón de cerrar (Pausar) */}
                  <div className="mb-2 flex items-start justify-between">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-emerald/10 text-xs font-bold text-brand-emerald">
                          {currentStep + 1}
                      </span>
                      <div className="flex items-center gap-2">
                          <button 
                              onClick={handleSkip}
                              className="text-[10px] font-medium text-gray-400 hover:text-gray-600 hover:underline"
                          >
                              Saltar
                          </button>
                          <button 
                              onClick={handlePause}
                              className="text-gray-400 hover:text-gray-600"
                              aria-label="Pausar tutorial"
                              title="Pausar tutorial"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                      </div>
                  </div>
    
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">{step.content}</p>
                  </div>
    
                  {/* Barra de progreso */}
                  <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <motion.div 
                          className="h-full bg-brand-emerald"
                          initial={{ width: 0 }}
                          animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                          transition={{ duration: 0.3 }}
                      />
                  </div>
    
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handlePrevious}
                      disabled={currentStep === 0}
                      className={`text-sm font-semibold transition-colors ${
                          currentStep === 0 ? 'cursor-not-allowed text-gray-300' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Atrás
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex items-center gap-2 rounded-xl bg-brand-emerald px-5 py-2 text-sm font-bold text-white shadow-lg shadow-brand-emerald/20 transition-all hover:scale-105 hover:bg-brand-emerald/90 active:scale-95"
                    >
                      {currentStep === steps.length - 1 ? '¡Listo!' : 'Siguiente'}
                      {currentStep < steps.length - 1 && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      )}
                    </button>
                  </div>
                </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

