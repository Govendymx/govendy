'use client';

import { motion, Variants } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';

import { ProceduralEyes, EyeExpression, EyeConfig } from './ProceduralEyes';

export type MascotEmotion = 'happy' | 'thinking' | 'waiting' | 'excited' | 'confused' | 'dizzy' | 'sleeping' | 'surprised';

interface PocketMascotProps {
  emotion?: MascotEmotion;
  className?: string;
  size?: number;
  lookingAt?: 'left' | 'right' | 'center';
  isDragging?: boolean;
  eyeConfig?: Partial<EyeConfig>;
  mouseX?: number;
  mouseY?: number;
}

export function PocketMascot({
  emotion: externalEmotion = 'happy',
  className = '',
  size = 120,
  lookingAt = 'center',
  isDragging = false,
  eyeConfig = {
    pupilSize: 0.85,
    irisColor: '#3E000C', // Dark Maroon
    scleraColor: '#ffffff',
    eyelidColor: '#1a0510',
    dilationSpeed: 0.2
  },
  mouseX = 0,
  mouseY = 0
}: PocketMascotProps) {
  const [internalEmotion, setInternalEmotion] = useState<MascotEmotion | null>(null);
  const [interactionText, setInteractionText] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeEmotion = internalEmotion || (isDragging ? 'surprised' : externalEmotion);

  // Map emotions to eye expressions
  const getEyeExpression = (emo: MascotEmotion): EyeExpression => {
      switch (emo) {
          case 'happy': return 'happy';
          case 'excited': return 'happy';
          case 'thinking': return 'suspicious';
          case 'confused': return 'sad';
          case 'dizzy': return 'tired';
          case 'sleeping': return 'tired';
          case 'surprised': return 'surprised';
          default: return 'normal';
      }
  };

  // Interaction reset effect
  useEffect(() => {
    if (isDragging) {
      setInternalEmotion('surprised');
      setInteractionText("¡Woah!");
    } else {
      const t = setTimeout(() => {
        setInternalEmotion(null);
        setInteractionText(null);
      }, 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isDragging]);

  // Idle timer effect
  useEffect(() => {
    let idleTimer: NodeJS.Timeout;

    if (internalEmotion !== 'sleeping') {
      idleTimer = setTimeout(() => {
        setInternalEmotion('sleeping');
        setInteractionText("Zzz...");
      }, 30000); // Wait 30s instead of 15s
    }

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [internalEmotion]);

  const floatingVariant: Variants = {
    animate: {
      y: [0, -8, 0],
      rotate: [0, 2, -2, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const emotionVariants: Variants = {
    happy: { scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 2 } },
    excited: { y: [0, -15, 0], transition: { repeat: Infinity, duration: 0.5 } },
    thinking: { rotate: [0, 5, 0, -5, 0], transition: { repeat: Infinity, duration: 3 } },
    waiting: { scale: 1 },
    confused: { rotate: [0, 10, -10, 0], transition: { duration: 0.5 } },
    dizzy: { rotate: [0, 360], transition: { duration: 1, repeat: 2 } },
    sleeping: { scale: [1, 0.95, 1], opacity: 0.8, transition: { repeat: Infinity, duration: 3 } },
    surprised: { scale: 1.2, y: -10, transition: { type: 'spring' } }
  };

  const handleClick = () => {
    if (activeEmotion === 'sleeping') {
      setInternalEmotion('surprised');
      setInteractionText("¡Estoy despierto!");
    } else {
      setInternalEmotion('excited');
      const quotes = ["¡Vamos!", "¡Sip!", "¡Genial!", "¡Aquí estoy!", "¡Clic!"];
      setInteractionText(quotes[Math.floor(Math.random() * quotes.length)]);
    }

    setTimeout(() => {
      setInternalEmotion(null);
      setInteractionText(null);
    }, 2000);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ width: size, height: size }}>
      {interactionText && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -20 }}
          className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-emerald shadow-md z-30 ring-1 ring-brand-emerald/20"
        >
          {interactionText}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45"></div>
        </motion.div>
      )}

      <motion.div
        variants={floatingVariant}
        animate="animate"
        whileTap={{ scale: 0.9 }}
        onClick={handleClick}
        className="relative h-full w-full cursor-pointer select-none"
      >
        <motion.div
          animate={activeEmotion}
          variants={emotionVariants}
          className="h-full w-full drop-shadow-2xl filter"
        >
          <Image
            src="/pocket-robot.png"
            alt="Pocket Mascot"
            width={size}
            height={size}
            className={`object-contain transition-transform duration-500 ${lookingAt === 'left' ? 'scale-x-[-1]' : ''}`}
            priority
          />
          
          {/* Ojos Procedurales */}
          <div className="absolute top-[29%] left-[27%] right-[27%] h-[12%] z-10 pointer-events-none">
             <ProceduralEyes 
                mouseX={mouseX}
                mouseY={mouseY}
                expression={getEyeExpression(activeEmotion)}
                config={eyeConfig}
                containerRef={containerRef}
             />
          </div>

        </motion.div>
      </motion.div>
      <div className="absolute -bottom-4 left-1/2 h-3 w-2/3 -translate-x-1/2 rounded-[100%] bg-black/20 blur-sm" />
    </div>
  );
}

