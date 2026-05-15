import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

// Esta función se ejecuta en el servidor antes de renderizar la página
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  // Validación básica
  if (!id || id === '[id]') return { title: 'Detalle de Publicación | GoVendy' };

  // Inicializar cliente de manera segura dentro de la función
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials missing in generateMetadata');
    return { title: 'Detalle de Publicación | GoVendy' };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Función auxiliar para verificar UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

  let query = supabase
    .from('listings')
    .select('title, description, images, price, currency');

  if (isUuid) {
    query = query.eq('id', id);
  } else {
    // Si no es UUID, asumimos que es un public_id (ej: PCK-...)
    query = query.eq('public_id', id);
  }

  // Buscamos los datos básicos para la tarjeta social
  const { data: listing } = await query.maybeSingle();

  if (!listing) {
    return {
      title: 'Publicación no encontrada | GoVendy',
    };
  }

  const title = `${listing.title} | GoVendy`;
  // Cortamos la descripción a 160 caracteres para SEO
  const description = listing.description?.substring(0, 160) || `Compra ${listing.title} en GoVendy.`;
  
  // Usamos la primera imagen o una por defecto
  let image = listing.images?.[0];
  if (!image) {
    image = 'https://via.placeholder.com/1200x630.png?text=GoVendy'; 
  } else if (image.startsWith('/')) {
    // Asegurar URL absoluta para Open Graph (si es relativa)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gopocket.com.mx';
    image = `${baseUrl}${image}`;
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image }],
      type: 'website',
      siteName: 'GoVendy',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function ListingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
