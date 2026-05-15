'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export interface CopyButtonProps {
  text: string;
  label?: string; // Text for tooltip/aria
  className?: string;
  iconSize?: number;
  showLabel?: boolean; // Whether to show text next to icon
  size?: 'sm' | 'md' | 'lg'; // Added size prop
}

export function CopyButton({ 
  text, 
  label = 'Copiar al portapapeles', 
  className = '', 
  iconSize,
  showLabel = false,
  size = 'md'
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  // Determine size-based classes if not overridden by className
  // If iconSize is provided, it overrides the default size-based icon size
  const sizeClasses = {
    sm: { p: 'p-1', icon: 14, text: 'text-[10px]' },
    md: { p: 'p-1.5', icon: 16, text: 'text-xs' },
    lg: { p: 'p-2', icon: 20, text: 'text-sm' },
  };

  const currentSize = sizeClasses[size];
  const finalIconSize = iconSize || currentSize.icon;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click events (like row selection)
    e.preventDefault();
    
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`
        inline-flex items-center justify-center gap-1.5 
        rounded-md transition-all duration-200
        hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300
        ${isCopied ? 'text-green-600' : 'text-gray-500 hover:text-gray-900'}
        ${currentSize.p}
        ${className}
      `}
      title={isCopied ? '¡Copiado!' : label}
      aria-label={isCopied ? 'Copiado exitosamente' : label}
      type="button"
    >
      {isCopied ? (
        <Check size={finalIconSize} className="animate-in zoom-in duration-200" />
      ) : (
        <Copy size={finalIconSize} />
      )}
      
      {showLabel && (
        <span className={`font-medium ${currentSize.text}`}>
          {isCopied ? 'Copiado' : 'Copiar'}
        </span>
      )}
    </button>
  );
}
