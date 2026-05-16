'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minimize2, Send, MessageCircle } from 'lucide-react';
import Image from 'next/image';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function SupportBot() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      id: uid(),
      role: 'assistant',
      text: 'Hola, soy Pocky (IA). 🤖\n¿En qué puedo ayudarte hoy?',
      ts: Date.now(),
    },
  ]);

  // Draggable position state
  const [pos, setPos] = useState({ right: 20, bottom: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, right: 20, bottom: 20 });
  const dragMoved = useRef(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (isAdminRoute) return;
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    try {
      const saved = window.localStorage.getItem('pocket_support_bot_state');
      if (!saved) return;
      const parsed = JSON.parse(saved) as { open?: boolean; minimized?: boolean; messages?: Msg[] };
      if (typeof parsed.open === 'boolean') setOpen(parsed.open);
      if (typeof parsed.minimized === 'boolean') setMinimized(parsed.minimized);
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) setMessages(parsed.messages);
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    try {
      window.localStorage.setItem('pocket_support_bot_state', JSON.stringify({ open, minimized, messages }));
    } catch {
      // noop
    }
  }, [open, minimized, messages]);

  useEffect(() => {
    if (isAdminRoute) return;
    if (!open || minimized) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, minimized, messages.length]);

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
      right = Math.max(pad, Math.min(window.innerWidth - 80, right));
      bottom = Math.max(pad, Math.min(window.innerHeight - 80, bottom));
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

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    const userMsg: Msg = { id: uid(), role: 'user', text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: pathname
        }),
      });
      const data = await res.json();

      const replyText = data.reply || 'Ups, tuve un problema de conexión. Intenta de nuevo.';
      const botMsg: Msg = { id: uid(), role: 'assistant', text: replyText, ts: Date.now() + 1 };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      const botMsg: Msg = { id: uid(), role: 'assistant', text: 'Lo siento, no pude procesar tu mensaje en este momento.', ts: Date.now() + 1 };
      setMessages((prev) => [...prev, botMsg]);
    }
  };

  if (isAdminRoute) {
    return null;
  }

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{ right: pos.right, bottom: pos.bottom }}
    >
      <div className="relative pointer-events-auto">
        <AnimatePresence mode="wait">
          {!open ? (
            /* ─── Trigger: Draggable Robot ─── */
            <motion.div
              key="trigger"
              layoutId="pocky-chat"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="relative"
            >
              {/* Drag handle area */}
              <div
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onClick={() => {
                  if (!dragMoved.current) {
                    setOpen(true);
                    setMinimized(false);
                  }
                }}
                className="relative cursor-grab active:cursor-grabbing select-none"
              >
                {/* Robot image */}
                <motion.div
                  animate={{
                    y: [0, -6, 0],
                    rotate: [0, 2, -2, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="relative"
                >
                  <Image
                    src="/pocket-robot.png"
                    alt="Pocky - Asistente"
                    width={64}
                    height={64}
                    className="drop-shadow-xl pointer-events-none"
                    priority
                  />

                  {/* Notification dot */}
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-emerald opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-brand-emerald" />
                  </span>
                </motion.div>

                {/* Shadow */}
                <div className="mx-auto mt-1 h-2 w-10 rounded-full bg-black/10 blur-sm" />
              </div>
            </motion.div>
          ) : (
            /* ─── Chat Window ─── */
            <motion.div
              key="chat-window"
              layoutId="pocky-chat"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`flex flex-col overflow-hidden bg-white/60 backdrop-blur-2xl shadow-2xl rounded-[2.5rem] w-[340px] sm:w-[380px] ${minimized ? 'h-auto' : 'h-[500px]'} border border-white/40 ring-1 ring-white/50`}
            >
              {/* Header — drag handle */}
              <div
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                className="flex items-center justify-between px-5 py-4 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full overflow-hidden bg-gradient-to-tr from-brand-emerald/80 to-purple-500/80 shadow-lg backdrop-blur-md">
                    <Image
                      src="/pocket-robot.png"
                      alt="Pocky"
                      width={36}
                      height={36}
                      className="object-contain"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white0" />
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800/90 text-base tracking-tight">Pocky</h3>
                    <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wider">Asistente Virtual</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMinimized(!minimized)}
                    className="p-2 rounded-full hover:bg-white/30 text-gray-600 transition-all active:scale-95"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-full hover:bg-red-500/10 text-gray-600 hover:text-red-500 transition-all active:scale-95"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Chat Content */}
              {!minimized && (
                <>
                  <div
                    ref={listRef}
                    className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide"
                    style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20px)' }}
                  >
                    {messages.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm shadow-sm backdrop-blur-md ${m.role === 'user'
                            ? 'bg-brand-emerald/80 text-white rounded-br-none shadow-brand-emerald/20'
                            : 'bg-white/60 text-gray-800 rounded-bl-none border border-white/50 shadow-gray-200/50'
                            }`}
                        >
                          {m.text}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Input Area */}
                  <div className="p-4 bg-transparent">
                    <form
                      onSubmit={send}
                      className="relative flex items-center bg-white/40 backdrop-blur-xl border border-white/60 rounded-full p-1 shadow-lg transition-all focus-within:bg-white/60 focus-within:shadow-xl focus-within:ring-2 focus-within:ring-brand-emerald/20"
                    >
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Escribe aquí..."
                        className="w-full bg-transparent border-none rounded-full py-2.5 pl-4 pr-12 text-sm text-gray-800 placeholder:text-gray-500 focus:ring-0"
                      />
                      <button
                        type="submit"
                        disabled={!input.trim()}
                        className="absolute right-1.5 p-2 bg-brand-emerald text-white rounded-full shadow-md hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-300"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
