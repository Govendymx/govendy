'use client';

import { CheckCircle2 } from 'lucide-react';

interface StepProps {
  number: number;
  title: string;
  description: string;
  imageAlt?: string;
  isLast?: boolean;
}

export default function Step({ number, title, description, imageAlt, isLast = false }: StepProps) {
  return (
    <div className={`relative pb-12 ${isLast ? 'pb-0' : ''}`}>
      {!isLast && (
        <div className="absolute left-5 top-14 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
      )}
      <div className="relative flex items-start group">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-emerald/10 group-hover:bg-brand-emerald/20 transition-colors border-2 border-brand-emerald text-brand-emerald font-bold z-10">
          {number}
        </span>
        <div className="ml-6 min-w-0 flex-1">
          <div className="text-lg font-bold text-gray-900 group-hover:text-brand-emerald transition-colors">
            {title}
          </div>
          <div className="mt-2 text-gray-600">{description}</div>
          
          {/* Placeholder for screenshot/image */}
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm ring-1 ring-black/5">
            <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-gray-400">
              <div className="text-center p-4">
                <div className="mx-auto mb-2 h-10 w-10 rounded-lg bg-gray-200" />
                <span className="text-sm font-medium">Captura de pantalla: {imageAlt || title}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
