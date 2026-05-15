export type TemplateBlock =
  | { type: 'heading'; text: string; level?: 1 | 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'richtext'; content: string }
  | { type: 'bullets'; items: string[] }
  // `image` puede ser:
  // - imagen normal (url https permitido)
  // - placeholder de plantilla (url vacío) para que el vendedor suba al publicar
  | {
      type: 'image';
      url: string;
      alt?: string;
      caption?: string;
      is_slot?: boolean;
      slot_id?: string;
      slot_label?: string;
      slot_aspect?: 'portrait' | 'square' | 'landscape';
    }
  | { type: 'divider' }
  | {
      type: 'callout';
      title?: string;
      body: string;
      tone?: 'pink' | 'neutral' | 'success' | 'blue' | 'purple' | 'amber' | 'red' | 'indigo' | 'teal' | 'cyan';
    };

export type ListingBlocksMeta = {
  template_id?: string;
  template_title?: string;
  applied_at?: string;
  applied_by?: string;
};

