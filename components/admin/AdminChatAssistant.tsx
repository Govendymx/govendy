'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, BarChart3, Loader2 } from 'lucide-react';

export default function AdminChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ type: 'bot' | 'user'; text: string }[]>([
    { type: 'bot', text: 'Hola Admin. Tengo acceso a las métricas de hoy. ¿Qué necesitas saber?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setMessages(prev => [...prev, { type: 'user', text: userText }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      const data = await res.json();
      
      if (data.reply) {
        setMessages(prev => [...prev, { type: 'bot', text: data.reply }]);
      } else {
        setMessages(prev => [...prev, { type: 'bot', text: 'Error al procesar la respuesta.' }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { type: 'bot', text: 'Error de conexión.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-80 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10 sm:w-96"
          >
            {/* Header */}
            <div className="bg-gray-900 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Admin Intelligence</h3>
                    <p className="text-[10px] text-gray-400">Conectado al sistema</p>
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

            {/* Chat Area */}
            <div className="h-80 overflow-y-auto p-4 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200">
              <div className="space-y-4">
                 {messages.map((msg, i) => (
                   <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                       msg.type === 'user' 
                         ? 'bg-gray-900 text-white rounded-tr-none' 
                         : 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-100 rounded-tl-none'
                     }`}>
                       {msg.text}
                     </div>
                   </div>
                 ))}
                 {isLoading && (
                   <div className="flex justify-start">
                     <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm ring-1 ring-gray-100">
                       <div className="flex items-center space-x-1">
                         <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                         <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                         <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                       </div>
                     </div>
                   </div>
                 )}
                 <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-100">
              <div className="relative">
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ej: ¿Cuántos pagos pendientes hay?" 
                  className="w-full bg-gray-100 text-sm rounded-lg pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
                <button 
                  type="submit" 
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 p-1 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-gray-900 text-white p-4 rounded-full shadow-xl hover:scale-105 transition-transform ring-4 ring-gray-900/20 group"
        >
          <BarChart3 className="h-6 w-6" />
          <span className="absolute right-0 top-0 flex h-3 w-3 -mr-1 -mt-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </button>
      )}
    </div>
  );
}
