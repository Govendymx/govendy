'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X } from 'lucide-react';

export default function LocationTracker() {
  const [showSoftPrompt, setShowSoftPrompt] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState | 'unknown'>('unknown');

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const sendLocation = async (latitude: number, longitude: number) => {
      try {
        const body = (latitude === 0 && longitude === 0) ? {} : { latitude, longitude };
        await fetch('/api/user/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        console.log('📍 Location sent:', latitude, longitude);
      } catch (err) {
        console.error('Failed to send location:', err);
      }
    };

    const trackLocation = async () => {
      if (!('geolocation' in navigator)) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          sendLocation(latitude, longitude);
          setShowSoftPrompt(false); // Hide prompt if successful
        },
        (error) => {
          // Silent fail
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    };

    const checkPermissionAndTrack = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Initial IP-based check
      sendLocation(0, 0);

      if ('permissions' in navigator) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          setPermissionState(status.state);

          status.onchange = () => {
            setPermissionState(status.state);
            if (status.state === 'granted') trackLocation();
          };

          if (status.state === 'granted') {
            trackLocation();
          } else if (status.state === 'prompt') {
            // Wait a bit before showing the soft prompt to avoid overwhelming the user immediately
            setTimeout(() => setShowSoftPrompt(true), 3000);
          }
          // If denied, do nothing (respect user choice)
        } catch (e) {
          // Fallback for browsers without permissions API
          trackLocation();
        }
      } else {
        trackLocation();
      }

      // Poll every 10 minutes
      intervalId = setInterval(() => {
        if (permissionState === 'granted') trackLocation();
      }, 600000);
    };

    checkPermissionAndTrack();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [permissionState]);

  const handleAllowClick = () => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Success callback handles sending location
        setShowSoftPrompt(false);
      },
      (error) => {
        console.error('User denied or error:', error);
        setShowSoftPrompt(false); // Dismiss if they say no
      }
    );
  };

  return (
    <AnimatePresence>
      {showSoftPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 50, x: '-50%' }}
          className="fixed bottom-6 left-1/2 z-50 flex w-[90%] max-w-sm flex-col gap-3 rounded-2xl bg-white p-4 shadow-xl shadow-black/10 ring-1 ring-black/5 md:left-auto md:right-6 md:x-0 md:translate-x-0"
          style={{ translateX: '-50%' }} // Center on mobile
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <MapPin size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Activar Ubicación</h3>
                <p className="text-xs text-gray-500 leading-tight mt-0.5">
                  Mejora la seguridad de tu cuenta y agiliza tus envíos.
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowSoftPrompt(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowSoftPrompt(false)}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Ahora no
            </button>
            <button
              onClick={handleAllowClick}
              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-black transition-transform active:scale-95"
            >
              Activar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
