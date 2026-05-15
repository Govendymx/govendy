'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

type TourStep = {
  id: string;
  target: string; // selector CSS del elemento a destacar
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
};

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: 'body',
    title: '¡Bienvenido a Pocket! 🎉',
    content: 'Te guiaremos por las funciones principales de tu dashboard. Puedes saltar este tour en cualquier momento.',
    position: 'bottom',
  },
  {
    id: 'notifications',
    target: '[data-tour="notifications"]',
    title: '🔔 Notificaciones',
    content: 'Aquí verás todas tus notificaciones importantes: nuevas ventas, respuestas a tus preguntas, pagos confirmados y más.',
    position: 'bottom',
  },
  {
    id: 'recent-operations',
    target: '[data-tour="recent-operations"]',
    title: '📦 Operaciones Recientes',
    content: 'Mira tus compras y ventas más recientes. Haz clic en cualquier orden para ver los detalles completos.',
    position: 'bottom',
  },
  {
    id: 'documents',
    target: '[data-tour="documents"]',
    title: '📄 Documentos',
    content: 'Sube tu INE para poder vender. Una vez verificado, podrás publicar productos y recibir pagos.',
    position: 'bottom',
  },
  {
    id: 'menu',
    target: '[data-tour="menu"]',
    title: '📋 Menú de Navegación',
    content: 'Accede a todas las secciones: tus ventas, compras, publicaciones, preguntas, respuestas y más.',
    position: 'right',
  },
  {
    id: 'my-store',
    target: '[data-tour="my-store"]',
    title: '🏪 Mi Tienda',
    content: 'Gestiona tus publicaciones, crea cupones y administra todo lo relacionado con tus ventas.',
    position: 'bottom',
  },
];

export function OnboardingTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [targetElement, setTargetElement] = useState<Element | null>(null);

  useEffect(() => {
    const checkTourStatus = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const uid = userData.user.id;
        setUserId(uid);

        // Verificar si el usuario ya vio el tour
        const hasSeenTour = localStorage.getItem(`pocket_tour_seen_${uid}`);
        if (hasSeenTour === 'true') return;

        // Verificar en la base de datos también
        const { data: profile } = await supabase
          .from('profiles')
          .select('has_seen_onboarding_tour')
          .eq('id', uid)
          .maybeSingle();

        if (profile?.has_seen_onboarding_tour) {
          localStorage.setItem(`pocket_tour_seen_${uid}`, 'true');
          return;
        }

        // Esperar un poco para que la página cargue completamente
        setTimeout(() => {
          setIsActive(true);
        }, 1000);
      } catch (err) {
        console.error('[OnboardingTour] Error:', err);
      }
    };

    void checkTourStatus();
  }, []);

  const markTourAsSeen = useCallback(async () => {
    if (!userId) return;

    try {
      // Guardar en localStorage
      localStorage.setItem(`pocket_tour_seen_${userId}`, 'true');

      // Guardar en la base de datos
      await supabase
        .from('profiles')
        .update({ has_seen_onboarding_tour: true })
        .eq('id', userId);

      setIsActive(false);
    } catch (err) {
      console.error('[OnboardingTour] Error al marcar tour como visto:', err);
      // Aún así, desactivar el tour
      setIsActive(false);
    }
  }, [userId]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
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

  const step = tourSteps[currentStep];

  // Buscar el elemento objetivo cuando cambia el paso
  useEffect(() => {
    if (!isActive) return;
    if (typeof document === 'undefined') return;
    
    const step = tourSteps[currentStep];
    if (!step) return;
    
    const element = document.querySelector(step.target);
    setTargetElement(element);

    if (!element && step.target !== 'body') {
      // Si el elemento no existe, esperar un poco y avanzar al siguiente paso
      const timer = setTimeout(() => {
        if (currentStep < tourSteps.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          markTourAsSeen();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isActive]);

  if (!isActive || !step) return null;

  const rect = targetElement && targetElement !== document.body 
    ? targetElement.getBoundingClientRect()
    : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0, right: 0, bottom: 0 };

  const getTooltipPosition = () => {
    const spacing = 20;
    const tooltipWidth = 320;
    const tooltipHeight = 200;

    switch (step.position) {
      case 'top':
        return {
          top: rect.top - tooltipHeight - spacing,
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
        };
      case 'bottom':
        return {
          top: rect.bottom + spacing,
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
        };
      case 'left':
        return {
          top: rect.top + rect.height / 2 - tooltipHeight / 2,
          left: rect.left - tooltipWidth - spacing,
        };
      case 'right':
        return {
          top: rect.top + rect.height / 2 - tooltipHeight / 2,
          left: rect.right + spacing,
        };
      default:
        return {
          top: rect.bottom + spacing,
          left: rect.left + rect.width / 2 - tooltipWidth / 2,
        };
    }
  };

  const tooltipPos = getTooltipPosition();

  return (
    <>
      {/* Overlay oscuro */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 transition-opacity"
        onClick={handleSkip}
        style={{ pointerEvents: 'auto' }}
      />

      {/* Highlight del elemento objetivo */}
      {targetElement && targetElement !== document.body && (
        <div
          className="fixed z-[9999] rounded-lg border-4 border-brand-orange shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-all"
          style={{
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[10000] w-80 rounded-2xl bg-white p-6 shadow-2xl ring-2 ring-brand-orange/20"
        style={{
          top: `${Math.max(20, Math.min(tooltipPos.top, window.innerHeight - 250))}px`,
          left: `${Math.max(20, Math.min(tooltipPos.left, window.innerWidth - 340))}px`,
        }}
      >
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
          <p className="mt-2 text-sm text-gray-600">{step.content}</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {currentStep + 1} de {tourSteps.length}
            </span>
            <div className="flex gap-1">
              {tourSteps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    idx === currentStep ? 'bg-brand-orange' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Anterior
              </button>
            )}
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Saltar
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-lg bg-brand-orange px-4 py-1.5 text-sm font-bold text-white shadow-lg hover:opacity-90"
            >
              {currentStep === tourSteps.length - 1 ? 'Finalizar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
