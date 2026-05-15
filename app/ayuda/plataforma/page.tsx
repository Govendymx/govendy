'use client';

import DocArticle from '@/components/docs/DocArticle';
import Step from '@/components/docs/Step';
import { Home, Grid, User, ShoppingCart, Clock } from 'lucide-react';

export default function GuiaPlataforma() {
  return (
    <DocArticle
      title="Conoce la Plataforma Pocky"
      description="Un recorrido detallado por todas las secciones principales de nuestro sitio para que le saques el máximo provecho."
      category="Plataforma"
      categoryLink="/ayuda"
      lastUpdated="8 de febrero de 2026"
    >
      <div className="space-y-2">
        <div className="flex items-center mb-4 text-brand-emerald font-bold text-lg">
          <Home className="mr-2 h-6 w-6" />
          1. Inicio (Home)
        </div>
        <Step
          number={1}
          title="Tu centro de novedades"
          description="En la página de inicio encontrarás las ofertas del día, productos recomendados para ti basados en tu historial, y acceso rápido a tus categorías favoritas. Es el punto de partida para explorar."
          imageAlt="Página de inicio"
        />

        <div className="flex items-center mb-4 mt-8 text-brand-emerald font-bold text-lg">
          <Grid className="mr-2 h-6 w-6" />
          2. Categorías
        </div>
        <Step
          number={2}
          title="Explora por temas"
          description="Desde 'Moda' hasta 'Tecnología', nuestro menú de categorías te permite filtrar millones de productos. Usa los subfiltros para afinar tu búsqueda por marca, precio o condición."
          imageAlt="Menú de categorías"
        />

        <div className="flex items-center mb-4 mt-8 text-brand-emerald font-bold text-lg">
          <User className="mr-2 h-6 w-6" />
          3. Perfil de Usuario
        </div>
        <Step
          number={3}
          title="Tu espacio personal"
          description="Aquí gestionas tus datos personales, direcciones de envío y métodos de pago. También puedes ver tu reputación como comprador/vendedor y configurar tus notificaciones."
          imageAlt="Panel de perfil"
        />

        <div className="flex items-center mb-4 mt-8 text-brand-emerald font-bold text-lg">
          <ShoppingCart className="mr-2 h-6 w-6" />
          4. Carrito de Compras
        </div>
        <Step
          number={4}
          title="Antes de pagar"
          description="Revisa los artículos que has guardado. Puedes modificar cantidades, eliminar productos o 'guardar para después'. Aquí verás el resumen total incluyendo costos de envío."
          imageAlt="Vista de carrito"
        />

        <div className="flex items-center mb-4 mt-8 text-brand-emerald font-bold text-lg">
          <Clock className="mr-2 h-6 w-6" />
          5. Historial
        </div>
        <Step
          number={5}
          title="Tus movimientos"
          description="Consulta todas tus compras y ventas pasadas. Puedes volver a comprar un artículo, descargar facturas o dejar una reseña al vendedor desde esta sección."
          imageAlt="Historial de pedidos"
          isLast={true}
        />
      </div>
    </DocArticle>
  );
}
