'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type SectionMessage = {
  message: string;
  html?: boolean;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  style?: {
    background_color?: string;
    text_color?: string;
    border_color?: string;
  };
};

export function SectionMessage({ section }: { section: string }) {
  const [message, setMessage] = useState<SectionMessage | null>(null);

  useEffect(() => {
    const loadMessage = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('section_messages')
          .eq('id', 1)
          .maybeSingle();

        if (error) throw error;

        const sectionMessages = (data?.section_messages as Record<string, SectionMessage>) || {};
        const sectionMsg = sectionMessages[section];

        if (!sectionMsg || !sectionMsg.is_active) {
          setMessage(null);
          return;
        }

        // Verificar vigencia
        const now = new Date();
        if (sectionMsg.starts_at) {
          const startsAt = new Date(sectionMsg.starts_at);
          if (now < startsAt) {
            setMessage(null);
            return;
          }
        }
        if (sectionMsg.ends_at) {
          const endsAt = new Date(sectionMsg.ends_at);
          if (now > endsAt) {
            setMessage(null);
            return;
          }
        }

        setMessage(sectionMsg);
      } catch (err) {
        console.error('[SectionMessage] Error:', err);
      }
    };

    void loadMessage();
  }, [section]);

  if (!message || !message.message) return null;

  return (
    <div
      className="mb-6 rounded-2xl border-2 p-4 shadow-sm"
      style={{
        backgroundColor: message.style?.background_color || '#fff3cd',
        color: message.style?.text_color || '#856404',
        borderColor: message.style?.border_color || '#ffc107',
      }}
    >
      {message.html ? (
        <div dangerouslySetInnerHTML={{ __html: message.message }} />
      ) : (
        <div className="text-sm font-medium">{message.message}</div>
      )}
    </div>
  );
}
