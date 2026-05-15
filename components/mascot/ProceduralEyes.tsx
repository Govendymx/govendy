'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

export type EyeExpression = 'normal' | 'happy' | 'sad' | 'angry' | 'surprised' | 'tired' | 'suspicious';

export interface EyeConfig {
  pupilSize: number; // 0.1 to 0.9
  irisColor: string;
  scleraColor: string;
  eyelidColor: string;
  dilationSpeed: number;
}

interface ProceduralEyesProps {
  mouseX?: number;
  mouseY?: number;
  expression?: EyeExpression;
  config?: Partial<EyeConfig>;
  containerRef?: React.RefObject<HTMLElement>;
  isTracking?: boolean;
}

export function ProceduralEyes({
  mouseX = 0,
  mouseY = 0,
  expression = 'normal',
  config = {},
  containerRef,
  isTracking = true
}: ProceduralEyesProps) {
  const defaults: EyeConfig = {
    pupilSize: 0.85, // Larger pupil/iris for cute look
    irisColor: '#3E000C', // Dark Brown/Maroon like the image
    scleraColor: '#ffffff',
    eyelidColor: '#1a0510',
    dilationSpeed: 0.2
  };

  const settings = { ...defaults, ...config };
  
  // Calculate look direction
  const [lookOffset, setLookOffset] = useState({ x: 0, y: 0 });
  const eyesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTracking || !eyesRef.current) return;

    // Default to center if no mouse input
    if (mouseX === 0 && mouseY === 0) {
      setLookOffset({ x: 0, y: 0 });
      return;
    }

    const rect = eyesRef.current.getBoundingClientRect();
    const eyeCenterX = rect.left + rect.width / 2;
    const eyeCenterY = rect.top + rect.height / 2;

    // Calculate normalized vector (-1 to 1)
    const dx = mouseX - eyeCenterX;
    const dy = mouseY - eyeCenterY;
    
    // Max movement radius (pixels)
    const maxRadius = 15;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const limit = Math.min(distance, 200) / 200; // Sensitivity factor

    const angle = Math.atan2(dy, dx);
    const moveX = Math.cos(angle) * maxRadius * limit;
    const moveY = Math.sin(angle) * maxRadius * limit;

    setLookOffset({ x: moveX, y: moveY });
  }, [mouseX, mouseY, isTracking]);

  // Blink Logic
  const [blinkState, setBlinkState] = useState(0); // 0 = open, 1 = closed

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const triggerBlink = () => {
      setBlinkState(1);
      setTimeout(() => setBlinkState(0), 150);
      timeout = setTimeout(triggerBlink, Math.random() * 3000 + 2000);
    };
    timeout = setTimeout(triggerBlink, 2000);
    return () => clearTimeout(timeout);
  }, []);

  // Expression Mapping
  const getEyelidVariants = (expr: EyeExpression) => {
    switch (expr) {
      case 'happy': return { top: '40%', bottom: '40%', curve: '50%' };
      case 'sad': return { top: '30%', bottom: '0%', rotate: -10 };
      case 'angry': return { top: '40%', bottom: '0%', rotate: 20 };
      case 'tired': return { top: '40%', bottom: '0%' };
      case 'surprised': return { top: '-10%', bottom: '-10%' };
      case 'suspicious': return { top: '30%', bottom: '30%' };
      default: return { top: '0%', bottom: '0%', rotate: 0 };
    }
  };

  const exprStyle = getEyelidVariants(expression);

  return (
    <div ref={eyesRef} className="w-full h-full flex justify-center gap-[18%] items-center">
      <SingleEye 
        offset={lookOffset} 
        settings={settings} 
        blink={blinkState} 
        expression={exprStyle}
        side="left"
      />
      <SingleEye 
        offset={lookOffset} 
        settings={settings} 
        blink={blinkState} 
        expression={exprStyle}
        side="right"
      />
    </div>
  );
}

function SingleEye({ offset, settings, blink, expression, side }: any) {
  const isRight = side === 'right';
  
  return (
    <div className="relative w-[29%] aspect-square flex items-center justify-center">
       {/* Kawaii Eye Container - Squashes on Blink */}
       <motion.div 
         className="relative w-full h-full rounded-full overflow-hidden"
         animate={{ 
           scaleY: blink ? 0.1 : 1, // Squash to 10% height on blink
           y: blink ? '10%' : '0%'   // Move down slightly when blinking
         }}
         transition={{ duration: 0.1 }}
         style={{
           backgroundColor: settings.irisColor, // The whole eye is the dark color
           boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
         }}
       >
          {/* Tracking Pupil/Iris Movement */}
          <motion.div 
            className="absolute inset-0"
            animate={{ x: offset.x * 0.5, y: offset.y * 0.5 }} // Subtle movement
            transition={{ type: 'spring', stiffness: 150, damping: 20 }}
          >
             {/* Large White Reflection (Top Left/Right) */}
             <div 
               className={`absolute w-[35%] h-[35%] bg-white rounded-full opacity-90 blur-[0.5px] ${isRight ? 'top-[15%] right-[15%]' : 'top-[15%] left-[15%]'}`} 
             />
             
             {/* Small Sparkle/Star (Bottom Opposite) */}
             <div 
               className={`absolute w-[15%] h-[15%] bg-white rounded-full opacity-80 ${isRight ? 'bottom-[20%] left-[20%]' : 'bottom-[20%] right-[20%]'}`} 
             >
                {/* Star Shape Overlay */}
                <div className="absolute inset-0 bg-white rotate-45 scale-75" />
             </div>
          </motion.div>
       </motion.div>
    </div>
  );
}
