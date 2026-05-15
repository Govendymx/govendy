'use client';

import DocArticle from '@/components/docs/DocArticle';
import Step from '@/components/docs/Step';
import Link from 'next/link';
import { Camera, DollarSign, Tag, Truck, CheckCircle } from 'lucide-react';

export default function GuiaVender() {
  return (
    <DocArticle
      title="Cómo vender en Pocky"
      description="Convierte lo que ya no usas en dinero extra. Aprende a crear publicaciones efectivas en minutos."
      category="Vender"
      categoryLink="/ayuda"
      lastUpdated="8 de febrero de 2026"
    >
      <div className="mb-10 rounded-2xl bg-green-50 p-6 text-green-800">
        <h4 className="mb-2 flex items-center font-bold">
          <CheckCircle className="mr-2 h-5 w-5" />
          Tip de experto
        </h4>
        <p className="text-sm">
          Las publicaciones con fotos claras y descripciones detalladas se venden un <strong>40% más rápido</strong>. ¡Tómate tu tiempo para hacerlas bien!
        </p>
      </div>

      <div className="space-y-2">
        <Step
          number={1}
          title="Haz clic en 'Vender'"
          description="Busca el botón 'Vender' en la barra de navegación superior (o el ícono de cámara en la app móvil). Esto iniciará el proceso de creación."
          imageAlt="Botón de vender en el menú"
        />

        <Step
          number={2}
          title="Sube tus mejores fotos"
          description="Puedes subir hasta 10 fotos. Asegúrate de tener buena iluminación, mostrar el producto completo y también los detalles (incluso si tiene algún desperfecto, es mejor mostrarlo)."
          imageAlt="Pantalla de carga de fotos"
        />

        <Step
          number={3}
          title="Describe tu producto"
          description="Escribe un título atractivo (ej. 'Chamarra de cuero Zara casi nueva') y completa la descripción con medidas, material, marca y estado. ¡Sé honesto!"
          imageAlt="Formulario de descripción"
        />

        <Step
          number={4}
          title="Define el precio y envío"
          description="Establece un precio competitivo. Te sugeriremos un rango basado en productos similares. También puedes activar 'Envío Gratis' para atraer más compradores."
          imageAlt="Configuración de precio"
        />

        <Step
          number={5}
          title="¡Publicar!"
          description="Revisa que todo esté correcto y publica tu anuncio. Estará visible para miles de compradores al instante. Te avisaremos cuando alguien pregunte o compre."
          imageAlt="Pantalla de éxito al publicar"
          isLast={true}
        />
      </div>

      <div className="mt-12 border-t border-gray-100 pt-8">
        <h3 className="mb-4 text-xl font-bold text-gray-900">Consejos para vender más</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-black/5">
            <h4 className="font-bold text-brand-emerald mb-2 flex items-center">
              <Camera className="mr-2 h-4 w-4" /> Fotos de impacto
            </h4>
            <p className="text-sm text-gray-600">Usa luz natural y fondos neutros. Muestra la prenda puesta si es posible.</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-black/5">
            <h4 className="font-bold text-brand-emerald mb-2 flex items-center">
              <DollarSign className="mr-2 h-4 w-4" /> Precio justo
            </h4>
            <p className="text-sm text-gray-600">Investiga a cuánto se venden artículos similares. Un precio alto puede ahuyentar compradores.</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-black/5">
            <h4 className="font-bold text-brand-emerald mb-2 flex items-center">
              <Tag className="mr-2 h-4 w-4" /> Detalles completos
            </h4>
            <p className="text-sm text-gray-600">Incluye medidas exactas y composición de la tela para evitar preguntas repetitivas.</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 ring-1 ring-black/5">
            <h4 className="font-bold text-brand-emerald mb-2 flex items-center">
              <Truck className="mr-2 h-4 w-4" /> Envío rápido
            </h4>
            <p className="text-sm text-gray-600">Despacha tus ventas en menos de 24h para ganar buena reputación.</p>
          </div>
        </div>
      </div>
    </DocArticle>
  );
}
