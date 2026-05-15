'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

/** Quita <link rel="stylesheet"> del HTML para evitar "failed to load stylesheet" y URLs rotas. */
function sanitizeFloatingHtml(html: string): string {
  if (typeof html !== 'string' || !html.trim()) return '';
  return html.replace(/<link[^>]*\srel\s*=\s*["']?(?:stylesheet|stylesheet\s[^"']*)["']?[^>]*>/gi, '');
}

type FloatingMessage = {
  id: string;
  title: string;
  content_html?: string | null;
  image_url?: string | null;
  message_type: 'html' | 'image';
  section: string;
  position_x: number;
  position_y: number;
  width: number;
  height?: number | null;
  background_color: string;
  text_color: string;
  border_color: string;
  z_index: number;
  is_draggable: boolean;
  is_closable: boolean;
  redirect_url?: string | null;
};

export function FloatingMessage({ message }: { message: FloatingMessage }) {
  const [position, setPosition] = useState({ x: message.position_x, y: message.position_y });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isClosed, setIsClosed] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  // Cargar posición guardada desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`floating_msg_pos_${message.id}`);
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        setPosition({ x: pos.x, y: pos.y });
      } catch {
        // Ignorar errores de parseo
      }
    }

    // Verificar si el mensaje ya fue cerrado
    const closed = localStorage.getItem(`floating_msg_closed_${message.id}`);
    if (closed === 'true') {
      setIsClosed(true);
    }
  }, [message.id]);

  // Guardar posición en localStorage cuando cambia
  useEffect(() => {
    if (!isDragging && message.is_draggable) {
      localStorage.setItem(`floating_msg_pos_${message.id}`, JSON.stringify(position));
    }
  }, [position, isDragging, message.id, message.is_draggable]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!message.is_draggable || isClosed) return;

    const rect = messageRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !message.is_draggable || isClosed) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Limitar dentro de la ventana
    const maxX = window.innerWidth - (messageRef.current?.offsetWidth || message.width);
    const maxY = window.innerHeight - (messageRef.current?.offsetHeight || 100);

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleClose = async () => {
    setIsClosed(true);
    localStorage.setItem(`floating_msg_closed_${message.id}`, 'true');

    // Notificar al servidor que el mensaje fue cerrado
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (token) {
        await fetch('/api/floating-messages/close', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message_id: message.id }),
        });
      }
    } catch (err) {
      console.error('[FloatingMessage] Error al cerrar:', err);
    }
  };

  if (isClosed) return null;

  const handleClick = (e: React.MouseEvent) => {
    // Si tiene URL de redirección y no se está arrastrando, redirigir
    if (message.redirect_url && !isDragging && !isClosed) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = message.redirect_url;
    }
  };

  const WrapperComponent = message.redirect_url ? 'a' : 'div';
  const wrapperProps = message.redirect_url
    ? {
        href: message.redirect_url,
        onClick: handleClick,
      }
    : {};

  return (
    <WrapperComponent
      ref={messageRef as any}
      className={`fixed rounded-2xl shadow-2xl ring-2 transition-all ${
        message.redirect_url ? 'cursor-pointer hover:ring-4' : ''
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${message.width}px`,
        height: message.height ? `${message.height}px` : 'auto',
        backgroundColor: message.background_color,
        color: message.text_color,
        borderColor: message.border_color,
        zIndex: message.z_index,
        cursor: message.is_draggable && !isDragging ? 'move' : message.redirect_url ? 'pointer' : 'default',
        userSelect: 'none',
        textDecoration: 'none',
      }}
      onMouseDown={handleMouseDown}
      {...wrapperProps}
    >
      {/* Header con título y botón cerrar */}
      <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: message.border_color }}>
        <div className="flex-1 truncate font-semibold" style={{ color: message.text_color }}>
          {message.title}
        </div>
        {message.is_closable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
            style={{ color: message.text_color }}
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {message.message_type === 'html' ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizeFloatingHtml(message.content_html || '') }} />
        ) : (
          <img src={message.image_url || ''} alt={message.title} className="h-auto w-full rounded-lg" />
        )}
      </div>
    </WrapperComponent>
  );
}

export function FloatingMessagesContainer() {
  const [messages, setMessages] = useState<FloatingMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    
    const getCurrentSection = () => {
      if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        const parts = pathname.split('/');
        if (parts.length > 2) return parts[2];
        return 'dashboard';
      }
      if (pathname === '/listings' || pathname.startsWith('/listings/')) return 'listings';
      if (pathname === '/cart') return 'cart';
      if (pathname === '/sell' || pathname.startsWith('/sell/')) return 'sell';
      if (pathname.startsWith('/profile')) return 'profile';
      return 'all';
    };

    const loadMessages = async () => {
      if (cancelled) return;
      try {
        const section = getCurrentSection();
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;

        const res = await fetch(`/api/floating-messages/active?section=${section}`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });

        const json = await res.json();
        if (cancelled) return;
        
        if (res.ok) {
          setMessages(json.messages || []);
        } else {
          setError(json.error || 'Error desconocido');
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Error al cargar mensajes');
      }
    };

    void loadMessages();
    const interval = setInterval(() => {
      if (!cancelled) void loadMessages();
    }, 60000); // Cada 60 segundos

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname]);

  // Mostrar error temporalmente en desarrollo (solo en consola, no en UI)
  if (error) {
    console.error('[FloatingMessagesContainer] Error persistente:', error);
  }

  if (messages.length === 0) return null;

  return (
    <>
      {messages.map((msg) => (
        <FloatingMessage key={msg.id} message={msg} />
      ))}
    </>
  );
}
