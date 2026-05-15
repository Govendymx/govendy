import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidad | GoVendy',
  description: 'Política de privacidad y protección de datos de GoVendy',
};

export default function PoliticaPrivacidadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 items-center justify-center rounded-xl bg-brand-orange px-3 text-white shadow-sm">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Política de Privacidad</div>
            </div>
          </div>
          <Link href="/" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50">
            Volver
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Política de Privacidad</h1>
          <p className="mt-2 text-sm text-gray-600">Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <div className="mt-8 space-y-6 text-sm text-gray-700">
            <section>
              <h2 className="text-xl font-bold text-gray-900">1. Introducción</h2>
              <p className="mt-2">
                En GoVendy, nos comprometemos a proteger su privacidad y garantizar la seguridad de sus datos personales. Esta Política de Privacidad explica cómo recopilamos, utilizamos, almacenamos y protegemos su información cuando utiliza nuestra plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">2. Información que Recopilamos</h2>
              <div className="mt-2 space-y-2">
                <p><strong>2.1. Información de Registro:</strong> Nombre completo, dirección de correo electrónico, número de teléfono, dirección física y documentos de identificación (INE).</p>
                <p><strong>2.2. Información de Transacciones:</strong> Historial de compras y ventas, métodos de pago, direcciones de envío y facturación.</p>
                <p><strong>2.3. Información de Uso:</strong> Datos sobre cómo interactúa con la plataforma, incluyendo páginas visitadas, productos vistos y búsquedas realizadas.</p>
                <p><strong>2.4. Información Técnica:</strong> Dirección IP, tipo de navegador, sistema operativo, y cookies.</p>
                <p><strong>2.5. Comunicaciones:</strong> Mensajes enviados a través de la plataforma, preguntas y respuestas sobre productos, y comunicaciones con soporte.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">3. Cómo Utilizamos su Información</h2>
              <div className="mt-2 space-y-2">
                <p>3.1. <strong>Procesamiento de Transacciones:</strong> Para facilitar compras, ventas y pagos.</p>
                <p>3.2. <strong>Mejora del Servicio:</strong> Para analizar el uso de la plataforma y mejorar nuestros servicios.</p>
                <p>3.3. <strong>Comunicación:</strong> Para enviar notificaciones sobre transacciones, actualizaciones y soporte.</p>
                <p>3.4. <strong>Seguridad:</strong> Para prevenir fraudes, verificar identidades y proteger la plataforma.</p>
                <p>3.5. <strong>Cumplimiento Legal:</strong> Para cumplir con obligaciones legales y regulatorias.</p>
                <p>3.6. <strong>Marketing:</strong> Con su consentimiento, para enviar promociones y ofertas personalizadas.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">4. Compartir Información con Terceros</h2>
              <div className="mt-2 space-y-2">
                <p>4.1. <strong>Proveedores de Pago:</strong> Compartimos información necesaria para procesar pagos de forma segura.</p>
                <p>4.2. <strong>Servicios de Envío:</strong> Proporcionamos direcciones de entrega a empresas de logística.</p>
                <p>4.3. <strong>Proveedores de Servicios:</strong> Empresas que nos ayudan a operar la plataforma (hosting, análisis, etc.).</p>
                <p>4.4. <strong>Requisitos Legales:</strong> Cuando sea requerido por ley o para proteger nuestros derechos.</p>
                <p>4.5. <strong>Con su Consentimiento:</strong> En cualquier otra situación con su autorización explícita.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">5. Seguridad de los Datos</h2>
              <div className="mt-2 space-y-2">
                <p>5.1. Utilizamos medidas de seguridad técnicas y organizativas para proteger sus datos.</p>
                <p>5.2. Los datos sensibles se cifran durante la transmisión y el almacenamiento.</p>
                <p>5.3. Limitamos el acceso a su información solo al personal autorizado.</p>
                <p>5.4. Realizamos auditorías de seguridad regulares para identificar y corregir vulnerabilidades.</p>
                <p>5.5. Sin embargo, ningún sistema es 100% seguro y no podemos garantizar seguridad absoluta.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">6. Cookies y Tecnologías Similares</h2>
              <div className="mt-2 space-y-2">
                <p>6.1. Utilizamos cookies para mejorar su experiencia, recordar preferencias y analizar el tráfico.</p>
                <p>6.2. Puede configurar su navegador para rechazar cookies, aunque esto puede afectar la funcionalidad.</p>
                <p>6.3. Utilizamos cookies esenciales, de rendimiento, funcionales y de marketing (con su consentimiento).</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">7. Sus Derechos</h2>
              <div className="mt-2 space-y-2">
                <p>7.1. <strong>Acceso:</strong> Puede solicitar una copia de los datos personales que tenemos sobre usted.</p>
                <p>7.2. <strong>Rectificación:</strong> Puede corregir información inexacta o incompleta.</p>
                <p>7.3. <strong>Eliminación:</strong> Puede solicitar la eliminación de sus datos personales, sujeto a obligaciones legales.</p>
                <p>7.4. <strong>Oposición:</strong> Puede oponerse al procesamiento de sus datos para ciertos fines.</p>
                <p>7.5. <strong>Portabilidad:</strong> Puede solicitar la transferencia de sus datos a otro proveedor.</p>
                <p>7.6. <strong>Retirar Consentimiento:</strong> Puede retirar su consentimiento en cualquier momento.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">8. Retención de Datos</h2>
              <p className="mt-2">
                Conservamos sus datos personales durante el tiempo necesario para cumplir con los fines descritos en esta política, cumplir con obligaciones legales, resolver disputas y hacer cumplir nuestros acuerdos. Los datos de transacciones se conservan según los requisitos legales y fiscales aplicables.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">9. Menores de Edad</h2>
              <p className="mt-2">
                Nuestros servicios están dirigidos a personas mayores de 18 años. No recopilamos intencionalmente información de menores. Si descubrimos que hemos recopilado información de un menor sin consentimiento parental, tomaremos medidas para eliminar esa información.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">10. Transferencias Internacionales</h2>
              <p className="mt-2">
                Sus datos pueden ser transferidos y procesados en países fuera de México. Nos aseguramos de que estas transferencias cumplan con las leyes de protección de datos aplicables y que se implementen salvaguardas adecuadas.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">11. Cambios a esta Política</h2>
              <p className="mt-2">
                Podemos actualizar esta Política de Privacidad ocasionalmente. Le notificaremos sobre cambios significativos mediante notificaciones en la plataforma o por correo electrónico. La fecha de &ldquo;Última actualización&rdquo; al inicio de este documento indica cuándo se realizaron los últimos cambios.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">12. Contacto</h2>
              <p className="mt-2">
                Si tiene preguntas, preocupaciones o solicitudes relacionadas con esta Política de Privacidad o el manejo de sus datos personales, puede contactarnos a través del sistema de soporte de la plataforma o visitando la sección de ayuda.
              </p>
            </section>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <Link href="/" className="inline-flex rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
