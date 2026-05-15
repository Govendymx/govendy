'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PocketMascot, MascotEmotion } from './PocketMascot';
import { EyeConfig } from './ProceduralEyes';

export function MascotControlPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [emotion, setEmotion] = useState<MascotEmotion>('happy');
  const [eyeConfig, setEyeConfig] = useState<Partial<EyeConfig>>({
    pupilSize: 0.6,
    irisColor: '#4B0082',
    scleraColor: '#ffffff',
    eyelidColor: '#1a0510',
    dilationSpeed: 0.2
  });
  const [mouseX, setMouseX] = useState(500);
  const [mouseY, setMouseY] = useState(300);

  // Handle panel mouse move for simulation
  const handlePanelMouseMove = (e: React.MouseEvent) => {
    // Only update if we want to test "internal" tracking within the panel
    // But for the mascot, we are passing manual X/Y from sliders
  };

  return (
    <div className="fixed bottom-4 right-4 z-[10001]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-brand-orange text-white rounded-full p-3 shadow-lg hover:bg-brand-orange/90 transition-colors"
      >
        {isOpen ? 'Close' : 'Mascot Lab'}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-16 right-0 w-[350px] bg-white rounded-2xl shadow-2xl p-6 ring-1 ring-black/5"
          >
            <h3 className="text-lg font-bold mb-4 text-gray-800">Mascot Lab 🧪</h3>
            
            {/* Preview Area */}
            <div 
              className="relative w-full h-48 bg-gray-100 rounded-xl mb-6 flex items-center justify-center overflow-hidden cursor-crosshair"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setMouseX(e.clientX);
                setMouseY(e.clientY);
              }}
            >
              <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-10 pointer-events-none">
                {[...Array(36)].map((_, i) => <div key={i} className="border border-gray-400"></div>)}
              </div>
              <PocketMascot 
                size={160} 
                emotion={emotion} 
                eyeConfig={eyeConfig}
                mouseX={mouseX}
                mouseY={mouseY}
              />
              <div className="absolute bottom-2 left-2 text-[10px] text-gray-400">
                Move cursor over area to test tracking
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              
              {/* Emotion Selector */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Emotion</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {(['happy', 'sad', 'angry', 'surprised', 'tired', 'thinking', 'excited', 'dizzy'] as const).map((emo) => (
                    <button
                      key={emo}
                      onClick={() => setEmotion(emo as MascotEmotion)}
                      className={`text-xs py-1 px-2 rounded border ${
                        emotion === emo 
                          ? 'bg-brand-orange text-white border-brand-orange' 
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase flex justify-between">
                  Pupil Size <span>{eyeConfig.pupilSize?.toFixed(2)}</span>
                </label>
                <input 
                  type="range" 
                  min="0.1" 
                  max="0.9" 
                  step="0.05"
                  value={eyeConfig.pupilSize}
                  onChange={(e) => setEyeConfig({...eyeConfig, pupilSize: parseFloat(e.target.value)})}
                  className="w-full accent-brand-orange h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Colors */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Iris Color</label>
                <div className="flex gap-2 mt-1">
                  {['#4B0082', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#000000'].map(color => (
                    <button
                      key={color}
                      onClick={() => setEyeConfig({...eyeConfig, irisColor: color})}
                      className={`w-6 h-6 rounded-full ring-2 ring-offset-2 ${
                        eyeConfig.irisColor === color ? 'ring-gray-400' : 'ring-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
