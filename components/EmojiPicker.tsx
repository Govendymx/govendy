'use client';

import { useState, useRef, useEffect } from 'react';

const EMOJI_CATEGORIES = {
  'Frecuentes': ['😊', '👍', '❤️', '✅', '🎉', '🙏', '😍', '🔥', '💯', '⭐'],
  'Caras': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔'],
  'Gestos': ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  'Objetos': ['💎', '👑', '🎁', '🎀', '🎊', '🎈', '🎉', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🥋', '🎯', '🎮', '🎰', '🎲', '🃏', '🀄', '🎴'],
  'Símbolos': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐'],
};

type EmojiPickerProps = {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
  popupClassName?: string;
};

export function EmojiPicker({ onEmojiSelect, className = '', popupClassName = 'left-0' }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('Frecuentes');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('pointerdown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
  };

  return (
    <div className={`relative ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm ring-1 ring-black/10 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-orange touch-manipulation"
        title="Agregar emoji"
      >
        😊
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-2 z-50 w-[320px] sm:w-[420px] rounded-2xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/10 ${popupClassName}`}>
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {Object.keys(EMOJI_CATEGORIES).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category as keyof typeof EMOJI_CATEGORIES)}
                className={`flex-shrink-0 px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap touch-manipulation ${activeCategory === category
                  ? 'bg-brand-orange text-white'
                  : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="max-h-64 overflow-y-auto p-3">
            <div className="grid grid-cols-8 gap-2">
              {EMOJI_CATEGORIES[activeCategory].map((emoji, idx) => (
                <button
                  key={`${activeCategory}-${idx}`}
                  type="button"
                  onClick={() => {
                    handleEmojiClick(emoji);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-xl hover:bg-gray-100 active:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-orange touch-manipulation"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
