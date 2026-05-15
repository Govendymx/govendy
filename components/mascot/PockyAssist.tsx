'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type AssistMode = 'menu' | 'faq' | 'product_help' | 'chat';

interface PockyAssistProps {
  isOpen: boolean;
  onClose: () => void;
  productContext?: any; // For future real product data
}

export function PockyAssist({ isOpen, onClose }: PockyAssistProps) {
  const [mode, setMode] = useState<AssistMode>('menu');
  const [history, setHistory] = useState<{ type: 'user' | 'bot'; text: string }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Knowledge Base (Cost-Free AI)
  const KNOWLEDGE_BASE = [
    {
      keywords: ['vender', 'publicar', 'subir', 'venta', 'vendedor'],
      answer: "Para vender, ve al botón central '+' en la barra inferior. Sube fotos claras, pon un precio justo y describe tu producto. ¡Es gratis publicar! 📸"
    },
    {
      keywords: ['comprar', 'compra', 'pago', 'pagar', 'tarjeta', 'efectivo'],
      answer: "Comprar es fácil y seguro. Dale al botón de 'Comprar', elige tu método (Tarjeta, Oxxo, Transferencia) y listo. Tu dinero está protegido. 🛡️"
    },
    {
      keywords: ['envio', 'envío', 'paquete', 'rastreo', 'estafeta', 'guia', 'llega'],
      answer: "Usamos guías certificadas (como Estafeta). Al vender se genera la guía sola. Al comprar, recibirás un rastreo para seguir tu paquete. 🚚"
    },
    {
      keywords: ['seguro', 'seguridad', 'fraude', 'confiable', 'garantia', 'miedo'],
      answer: "¡Tranqui! Tenemos 'Garantía de Satisfacción'. El vendedor NO recibe el dinero hasta que tú confirmas que tienes el producto en tus manos. 🤝"
    },
    {
      keywords: ['devolucion', 'devolver', 'regresar', 'reembolso', 'mal estado'],
      answer: "Si algo sale mal, tienes 48 horas tras recibirlo para pedir devolución desde 'Mis Pedidos'. Te regresamos tu dinero íntegro. 💸"
    },
    {
      keywords: ['precio', 'costo', 'comision', 'cobra', 'tarifas'],
      answer: "Publicar es gratis. Solo cobramos comisión (9% + $5) cuando YA vendiste. El comprador paga el envío y una tarifa de servicio. 💰"
    },
    {
      keywords: ['destacado', 'destacar', 'promocionar', 'publicidad', 'visibilidad', 'vender mas', 'opciones destacadas'],
      answer: "¡Destacar tus productos es genial! 🚀 Aumenta tus ventas apareciendo en la página principal. Ve a 'Mis Publicaciones' > 'Destacar' para ver los planes Basic y Pro."
    },
    {
      keywords: ['hola', 'buenos', 'hey', 'que tal', 'saludos'],
      answer: "¡Hola! 👋 Soy Pocky. Pregúntame sobre envíos, cómo vender o si es seguro comprar."
    },
    {
      keywords: ['gracias', 'grx', 'ok', 'vale', 'bien'],
      answer: "¡De nada! Aquí sigo si necesitas algo más. ✨"
    }
  ];

  const findBestMatch = (input: string): string | null => {
      // Find the entry with the most matching keywords
      let bestMatch = null;
      let maxHits = 0;

      KNOWLEDGE_BASE.forEach(entry => {
          let hits = 0;
          entry.keywords.forEach(k => {
              if (input.includes(k)) hits++;
          });
          if (hits > maxHits) {
              maxHits = hits;
              bestMatch = entry.answer;
          }
      });

      return bestMatch;
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, mode]);

  const reset = () => {
    setMode('menu');
    setHistory([]);
    setInputValue("");
  };

  const handleFAQ = (question: string, answer: string) => {
    setHistory(prev => [
      ...prev, 
      { type: 'user', text: question },
      { type: 'bot', text: answer }
    ]);
  };

  const startProductHelp = () => {
    setMode('product_help');
    setHistory([
      { type: 'bot', text: '¡Claro! ¿Qué tipo de producto estás buscando hoy?' }
    ]);
  };

  const handleProductChoice = (choice: string) => {
    let response = "";
    if (choice === 'Ropa') response = "Para ropa, te recomiendo verificar las medidas del vendedor. ¡Las marcas vintage suelen variar de tamaño!";
    else if (choice === 'Electrónica') response = "En electrónica, siempre pide video del funcionamiento antes de comprar. ¡Es más seguro!";
    else if (choice === 'Calzado') response = "¡Los sneakers están volando! Busca vendedores con calificación de 5 estrellas.";
    else response = "Excelente elección. Recuerda usar el chat seguro para negociar.";

    setHistory(prev => [
      ...prev,
      { type: 'user', text: choice },
      { type: 'bot', text: response },
      { type: 'bot', text: '¿Te gustaría ver algunas opciones destacadas?' }
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    setHistory(prev => [...prev, { type: 'user', text: userText }]);
    setInputValue("");

    // Smart Hybrid Logic: Local Rules + Replicate AI
    // -------------------------------------------------------------------------
    setTimeout(async () => {
      const lowerText = userText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
      let botResponse = "";

      // 1. Check Product Help Context first
      if (mode === 'product_help') {
        if (lowerText.includes('ropa') || lowerText.includes('camisa') || lowerText.includes('pantalon')) {
            botResponse = "Para ropa, revisa siempre las medidas en la descripción. ¡El estilo vintage es único!";
        } else if (lowerText.includes('zapato') || lowerText.includes('tenis') || lowerText.includes('sneaker')) {
            botResponse = "En calzado, verifica la talla US/MX. Pide foto de la suela para ver el desgaste.";
        } else if (lowerText.includes('celular') || lowerText.includes('iphone') || lowerText.includes('laptop')) {
            botResponse = "Para electrónicos, usa el chat para pedir video de funcionamiento. ¡Seguridad ante todo!";
        } else {
            // Fallback to AI for product help too
            botResponse = ""; 
        }
      } 
      
      // 2. Global Knowledge Base Search (Instant answers)
      if (!botResponse) {
         if (lowerText.includes('destacado') || lowerText.includes('destacar') || lowerText.includes('promocionar') || lowerText.includes('opciones')) {
            botResponse = "¡Destacar tus productos es genial! 🚀 Aumenta tus ventas apareciendo en la página principal. Ve a 'Mis Publicaciones' > 'Destacar' para ver los planes Basic y Pro.";
         } else {
             const match = findBestMatch(lowerText);
             if (match) botResponse = match;
         }
      }

      // 3. Replicate AI Fallback (If no local match)
      if (!botResponse) {
        try {
          // Show "typing" state if you had one, but for now we just wait
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userText })
          });
          const data = await res.json();
          if (data.reply) {
            botResponse = data.reply;
          } else {
            botResponse = "Lo siento, no entendí bien. ¿Podrías intentar preguntar de otra forma? 🤔";
          }
        } catch (e) {
          console.error(e);
          botResponse = "Tuve un problema de conexión. Intenta de nuevo por favor.";
        }
      }

      setHistory(prev => [...prev, { type: 'bot', text: botResponse }]);
    }, 500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 flex flex-col"
          style={{ maxHeight: '400px', minHeight: '300px' }}
        >
          {/* Header */}
          <div className="bg-brand-emerald p-3 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Asistente Pocky</span>
            </div>
            <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200">
            
            {/* Intro / Menu Mode */}
            {mode === 'menu' && (
              <div className="space-y-4">
                <div className="bg-white p-3 rounded-tr-xl rounded-bl-xl rounded-br-xl shadow-sm text-sm text-gray-700">
                  ¡Hola! Soy Pocky. ¿En qué puedo ayudarte hoy? 🤖
                </div>
                
                <div className="grid gap-2">
                  <button 
                    onClick={() => setMode('faq')}
                    className="text-left px-4 py-3 bg-white hover:bg-brand-emerald/5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors flex items-center gap-2 group"
                  >
                    <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg group-hover:bg-blue-200 transition-colors">🛡️</span>
                    Dudas de la Plataforma
                  </button>
                  
                  <button 
                    onClick={startProductHelp}
                    className="text-left px-4 py-3 bg-white hover:bg-brand-emerald/5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors flex items-center gap-2 group"
                  >
                    <span className="bg-purple-100 text-purple-600 p-1.5 rounded-lg group-hover:bg-purple-200 transition-colors">🛍️</span>
                    Ayuda para Comprar
                  </button>
                </div>
              </div>
            )}

            {/* FAQ Mode */}
            {mode === 'faq' && (
              <div className="space-y-4">
                 {history.length === 0 && (
                    <div className="bg-white p-3 rounded-tr-xl rounded-bl-xl rounded-br-xl shadow-sm text-sm text-gray-700">
                      Selecciona un tema para resolver tus dudas:
                    </div>
                 )}
                 
                 {history.map((msg, i) => (
                   <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                       msg.type === 'user' 
                         ? 'bg-brand-emerald text-white rounded-tr-none' 
                         : 'bg-white text-gray-700 shadow-sm rounded-tl-none'
                     }`}>
                       {msg.text}
                     </div>
                   </div>
                 ))}

                 <div className="grid gap-2 mt-4">
                   <button onClick={() => handleFAQ('¿Es seguro comprar?', '¡Totalmente! Usamos un sistema de "Garantía de Satisfacción". El vendedor no recibe el dinero hasta que tú confirmas que recibiste el producto correctamente.')} className="text-xs text-left bg-white border p-2 rounded-lg hover:bg-gray-50">
                     ¿Es seguro comprar?
                   </button>
                   <button onClick={() => handleFAQ('¿Cómo funcionan los envíos?', 'Los envíos se realizan por paqueterías certificadas. Una vez que compras, recibirás un número de rastreo para seguir tu paquete en todo momento.')} className="text-xs text-left bg-white border p-2 rounded-lg hover:bg-gray-50">
                     ¿Cómo funcionan los envíos?
                   </button>
                   <button onClick={() => handleFAQ('¿Puedo devolver un producto?', 'Si el producto no es como se describió, ¡sí! Tienes 48 horas después de recibirlo para abrir un reclamo.')} className="text-xs text-left bg-white border p-2 rounded-lg hover:bg-gray-50">
                     ¿Puedo devolver un producto?
                   </button>
                 </div>
                 
                 <button onClick={reset} className="mt-4 text-xs text-gray-400 underline w-full text-center">Volver al menú</button>
              </div>
            )}

            {/* Product Help Mode */}
            {mode === 'product_help' && (
              <div className="space-y-4">
                {history.map((msg, i) => (
                   <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                       msg.type === 'user' 
                         ? 'bg-brand-emerald text-white rounded-tr-none' 
                         : 'bg-white text-gray-700 shadow-sm rounded-tl-none'
                     }`}>
                       {msg.text}
                     </div>
                   </div>
                 ))}

                 {history.length < 3 && (
                   <div className="flex flex-wrap gap-2 mt-2">
                     {['Ropa', 'Calzado', 'Electrónica', 'Accesorios'].map(cat => (
                       <button key={cat} onClick={() => handleProductChoice(cat)} className="px-3 py-1.5 bg-white border border-brand-emerald/30 text-brand-emerald text-xs rounded-full hover:bg-brand-emerald hover:text-white transition-colors">
                         {cat}
                       </button>
                     ))}
                   </div>
                 )}
                 
                 <button onClick={reset} className="mt-4 text-xs text-gray-400 underline w-full text-center">Volver al menú</button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-100">
             <div className="relative">
               <input 
                 type="text" 
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 placeholder="Escribe un mensaje..." 
                 className="w-full bg-gray-100 text-sm rounded-full pl-4 pr-10 py-2 focus:outline-none focus:ring-1 focus:ring-brand-emerald/50"
                 disabled={mode === 'menu'}
               />
               <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-emerald p-1 hover:bg-brand-emerald/10 rounded-full transition-colors" disabled={!inputValue.trim()}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
               </button>
             </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
