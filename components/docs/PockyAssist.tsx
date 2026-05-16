'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, HelpCircle, FileText, X, Send, Video } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PockyAssist() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'faq'>('chat');
  const [messages, setMessages] = useState<{ type: 'bot' | 'user'; text: string; link?: string }[]>([
    { type: 'bot', text: '¡Hola! Soy Pocky. ¿En qué puedo ayudarte hoy?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    setMessages(prev => [...prev, { type: 'user', text: userText }]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const response = generateResponse(userText);
      setMessages(prev => [...prev, response]);
    }, 600);
  };

  const generateResponse = (text: string): { type: 'bot'; text: string; link?: string } => {
    const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (lower.includes('comprar') || lower.includes('compra')) {
      return { 
        type: 'bot', 
        text: 'Para comprar, solo necesitas encontrar un producto que te guste y hacer clic en "Comprar". ¿Quieres ver la guía completa?',
        link: '/ayuda/comprar'
      };
    }
    if (lower.includes('vender') || lower.includes('venta') || lower.includes('publicar')) {
      return { 
        type: 'bot', 
        text: '¡Vender es súper fácil! Sube fotos, describe tu producto y listo. Mira nuestros tips para vender más rápido.',
        link: '/ayuda/vender'
      };
    }
    if (lower.includes('destacado') || lower.includes('destacar') || lower.includes('promocionar') || lower.includes('opciones')) {
      return { 
        type: 'bot', 
        text: 'Puedes destacar tus productos para que aparezcan al inicio y se vendan hasta 3x más rápido. Tenemos planes desde $29 MXN.',
        link: '/ayuda/destacados'
      };
    }
    if (lower.includes('envio') || lower.includes('rastrear') || lower.includes('paquete')) {
      return { 
        type: 'bot', 
        text: 'Todos los envíos están asegurados. Al comprar recibirás un código de rastreo para seguir tu paquete.',
        link: '/ayuda/comprar#envios'
      };
    }
    if (lower.includes('devolucion') || lower.includes('reembolso') || lower.includes('regresar')) {
      return { 
        type: 'bot', 
        text: 'Si algo no sale bien, tienes 48 horas para solicitar una devolución. Tu dinero está protegido.',
        link: '/ayuda/comprar#devoluciones'
      };
    }
    if (lower.includes('subasta') || lower.includes('pujar')) {
      return { 
        type: 'bot', 
        text: 'Las subastas son emocionantes. Oferta por productos únicos desde precios muy bajos.',
        link: '/ayuda/subastas'
      };
    }

    return { 
      type: 'bot', 
      text: 'Lo siento, no tengo información exacta sobre eso. ¿Podrías intentar con palabras como "comprar", "vender" o "envíos"? También puedes explorar nuestras guías.' 
    };
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-80 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:w-96"
          >
            {/* Header */}
            <div className="bg-brand-emerald p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-lg">🤖</span>
                  </div>
                  <div>
                    <h3 className="font-bold">Pocky Assist</h3>
                    <p className="text-xs text-pink-100">Ayuda en tiempo real</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-1 hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'chat' ? 'text-brand-emerald border-b-2 border-brand-emerald' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Chat en Vivo
              </button>
              <button
                onClick={() => setActiveTab('faq')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'faq' ? 'text-brand-emerald border-b-2 border-brand-emerald' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Recursos
              </button>
            </div>

            {/* Content */}
            <div className="h-80 overflow-y-auto bg-gray-50 p-4">
              {activeTab === 'chat' ? (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex items-start ${msg.type === 'user' ? 'justify-end' : ''}`}>
                      {msg.type === 'bot' && (
                        <div className="mr-2 h-8 w-8 rounded-full bg-brand-emerald/10 flex items-center justify-center text-xs shrink-0">🤖</div>
                      )}
                      <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                        msg.type === 'user' 
                          ? 'bg-brand-emerald text-white rounded-tr-none' 
                          : 'bg-white text-gray-700 rounded-tl-none ring-1 ring-black/5'
                      }`}>
                        <p>{msg.text}</p>
                        {msg.link && (
                          <Link href={msg.link} className="mt-2 block rounded-lg bg-black/5 p-2 text-xs font-semibold hover:bg-black/10 transition-colors">
                            Ver guía relacionada →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="space-y-3">
                  <button className="flex w-full items-center rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5 hover:bg-gray-50 transition-colors">
                    <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Video className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Tutoriales en Video</div>
                      <div className="text-xs text-gray-500">Aprende visualmente</div>
                    </div>
                  </button>
                  <button className="flex w-full items-center rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5 hover:bg-gray-50 transition-colors">
                    <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-green-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Guías PDF</div>
                      <div className="text-xs text-gray-500">Descargar manuales</div>
                    </div>
                  </button>
                  <Link href="/ayuda/comprar#faq" className="flex w-full items-center rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5 hover:bg-gray-50 transition-colors">
                    <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Preguntas Frecuentes</div>
                      <div className="text-xs text-gray-500">Respuestas rápidas</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Footer Input (Chat only) */}
            {activeTab === 'chat' && (
              <div className="border-t border-gray-100 bg-white p-3">
                <form onSubmit={handleSendMessage} className="relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Escribe tu mensaje..."
                    className="w-full rounded-full border-gray-200 bg-gray-50 py-2 pl-4 pr-10 text-sm focus:border-brand-emerald focus:ring-brand-emerald"
                  />
                  <button 
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-brand-emerald hover:bg-pink-50 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-emerald text-white shadow-lg shadow-brand-emerald/30 transition-colors hover:bg-pink-600"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </motion.button>
    </div>
  );
}
