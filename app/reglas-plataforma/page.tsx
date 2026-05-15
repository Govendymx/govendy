import Link from 'next/link';

export const metadata = {
  title: 'Reglas de la Plataforma | GoVendy',
  description: 'Reglas y políticas de uso de la plataforma GoVendy',
};

export default function ReglasPlataformaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 items-center justify-center rounded-xl bg-brand-orange px-3 text-white shadow-sm">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Reglas de la Plataforma</div>
            </div>
          </div>
          <Link href="/" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50">
            Volver
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Reglas de la Plataforma</h1>
          <p className="mt-2 text-sm text-gray-600">Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <div className="mt-8 space-y-6 text-sm text-gray-700">
            <section>
              <h2 className="text-xl font-bold text-gray-900">1. Reglas Generales</h2>
              <div className="mt-2 space-y-2">
                <p>1.1. Todos los usuarios deben ser mayores de 18 años o tener consentimiento de un tutor legal.</p>
                <p>1.2. Cada usuario solo puede tener una cuenta activa.</p>
                <p>1.3. Está prohibido crear cuentas falsas o suplantar la identidad de otros.</p>
                <p>1.4. Los usuarios deben mantener actualizada su información de contacto.</p>
                <p>1.5. El uso de la plataforma implica aceptar todas las reglas y políticas establecidas.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">2. Publicación de Productos</h2>
              <div className="mt-2 space-y-2">
                <p><strong>2.1. Productos Prohibidos:</strong></p>
                <ul className="ml-4 mt-1 list-disc space-y-1">
                  <li>Productos ilegales o que infrinjan leyes locales</li>
                  <li>Productos falsificados o réplicas</li>
                  <li>Armas, drogas, sustancias controladas</li>
                  <li>Productos que promuevan odio, violencia o discriminación</li>
                  <li>Productos que infrinjan derechos de propiedad intelectual</li>
                  <li>Productos peligrosos o que representen riesgo para la salud</li>
                </ul>
                <p className="mt-2"><strong>2.2. Requisitos de Publicación:</strong></p>
                <ul className="ml-4 mt-1 list-disc space-y-1">
                  <li>Fotografías claras y reales del producto</li>
                  <li>Descripción precisa y completa</li>
                  <li>Precio justo y transparente</li>
                  <li>Categoría correcta del producto</li>
                  <li>Estado del producto (nuevo, usado, etc.)</li>
                </ul>
                <p className="mt-2">2.3. No se permite publicar el mismo producto múltiples veces.</p>
                <p>2.4. Los productos deben estar disponibles al momento de la publicación.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">3. Comunicación entre Usuarios</h2>
              <div className="mt-2 space-y-2">
                <p>3.1. Todas las comunicaciones deben ser respetuosas y profesionales.</p>
                <p>3.2. Está prohibido el acoso, amenazas, lenguaje ofensivo o discriminatorio.</p>
                <p>3.3. No se permite el spam, publicidad no autorizada o enlaces maliciosos.</p>
                <p>3.4. Las comunicaciones deben estar relacionadas con transacciones en la plataforma.</p>
                <p>3.5. No se permite contactar a otros usuarios fuera de la plataforma para evitar comisiones.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">4. Transacciones</h2>
              <div className="mt-2 space-y-2">
                <p>4.1. Todas las transacciones deben realizarse a través de la plataforma.</p>
                <p>4.2. Está prohibido intentar realizar transacciones fuera de la plataforma para evitar comisiones.</p>
                <p>4.3. Los vendedores deben cumplir con los tiempos de envío acordados.</p>
                <p>4.4. Los compradores deben confirmar la recepción del producto una vez recibido.</p>
                <p>4.5. No se permite cancelar transacciones sin una razón válida.</p>
                <p>4.6. Los precios publicados deben ser finales, sin cargos ocultos.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">5. Calificaciones y Reseñas</h2>
              <div className="mt-2 space-y-2">
                <p>5.1. Las calificaciones deben ser honestas y basadas en la experiencia real.</p>
                <p>5.2. Está prohibido manipular calificaciones mediante cuentas falsas o incentivos.</p>
                <p>5.3. No se permite publicar reseñas falsas, difamatorias o con información incorrecta.</p>
                <p>5.4. Las reseñas deben ser relevantes y relacionadas con la transacción.</p>
                <p>5.5. No se permite solicitar o ofrecer compensación a cambio de calificaciones positivas.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">6. Pagos y Reembolsos</h2>
              <div className="mt-2 space-y-2">
                <p>6.1. Los pagos deben procesarse únicamente a través de los métodos autorizados en la plataforma.</p>
                <p>6.2. Está prohibido solicitar pagos directos fuera de la plataforma.</p>
                <p>6.3. Los reembolsos se procesarán según las políticas establecidas.</p>
                <p>6.4. No se permite realizar transacciones fraudulentas o usar métodos de pago no autorizados.</p>
                <p>6.5. Los vendedores deben proporcionar información de pago precisa y actualizada.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">7. Disputas y Resolución de Conflictos</h2>
              <div className="mt-2 space-y-2">
                <p>7.1. Las disputas deben reportarse a través del sistema oficial de la plataforma.</p>
                <p>7.2. Los usuarios deben cooperar en el proceso de resolución de disputas.</p>
                <p>7.3. No se permite amenazar o presionar a otros usuarios durante una disputa.</p>
                <p>7.4. Las decisiones del equipo de soporte son finales y deben respetarse.</p>
                <p>7.5. Se debe proporcionar evidencia clara y honesta en caso de disputas.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">8. Uso Prohibido de la Plataforma</h2>
              <div className="mt-2 space-y-2">
                <p>8.1. No se permite usar la plataforma para actividades ilegales o fraudulentas.</p>
                <p>8.2. Está prohibido intentar hackear, manipular o dañar la plataforma.</p>
                <p>8.3. No se permite usar bots, scripts automatizados o herramientas que interfieran con el funcionamiento.</p>
                <p>8.4. Está prohibido recopilar información de otros usuarios sin autorización.</p>
                <p>8.5. No se permite usar la plataforma para competir directamente con nuestros servicios.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">9. Sanciones y Consecuencias</h2>
              <div className="mt-2 space-y-2">
                <p>9.1. El incumplimiento de estas reglas puede resultar en advertencias, suspensiones temporales o permanentes.</p>
                <p>9.2. Las cuentas pueden ser suspendidas o eliminadas sin previo aviso en casos graves.</p>
                <p>9.3. Podemos retener fondos en caso de violaciones o disputas pendientes.</p>
                <p>9.4. Las acciones legales pueden tomarse en casos de fraude o actividades ilegales.</p>
                <p>9.5. Nos reservamos el derecho de rechazar o eliminar cualquier contenido o usuario.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">10. Reportar Violaciones</h2>
              <p className="mt-2">
                Si observa alguna violación de estas reglas, puede reportarla a través del sistema de soporte de la plataforma. Todos los reportes serán revisados y se tomarán las acciones apropiadas. Mantenemos la confidencialidad de los usuarios que reportan violaciones cuando sea posible.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">11. Modificaciones de las Reglas</h2>
              <p className="mt-2">
                Nos reservamos el derecho de modificar estas reglas en cualquier momento. Los cambios serán notificados a través de la plataforma. El uso continuado de nuestros servicios después de los cambios constituye su aceptación de las nuevas reglas.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">12. Contacto</h2>
              <p className="mt-2">
                Para consultas sobre estas reglas o para reportar violaciones, puede contactarnos a través del sistema de soporte de la plataforma o visitando la sección de ayuda.
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
