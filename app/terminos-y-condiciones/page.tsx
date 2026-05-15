import Link from 'next/link';

export const metadata = {
  title: 'Términos y Condiciones | GoVendy',
  description: 'Términos y condiciones de uso de la plataforma GoVendy',
};

export default function TerminosYCondicionesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 items-center justify-center rounded-xl bg-brand-orange px-3 text-white shadow-sm">
              <span className="text-sm font-extrabold tracking-widest">GoVendy</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Términos y Condiciones</div>
            </div>
          </div>
          <Link href="/" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/10 hover:bg-gray-50">
            Volver
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Términos y Condiciones</h1>
          <p className="mt-2 text-sm text-gray-600">Última actualización: {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <div className="mt-8 space-y-6 text-sm text-gray-700">
            <section>
              <h2 className="text-xl font-bold text-gray-900">1. Aceptación de los Términos</h2>
              <p className="mt-2">
                Al acceder y utilizar la plataforma GoVendy, usted acepta cumplir con estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestros servicios.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">2. Descripción del Servicio</h2>
              <p className="mt-2">
                GoVendy es una plataforma de marketplace que permite a los usuarios comprar y vender productos. La plataforma actúa como intermediario entre compradores y vendedores, facilitando transacciones seguras.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">3. Registro y Cuenta de Usuario</h2>
              <div className="mt-2 space-y-2">
                <p>3.1. Para utilizar nuestros servicios, debe crear una cuenta proporcionando información precisa y completa.</p>
                <p>3.2. Usted es responsable de mantener la confidencialidad de sus credenciales de acceso.</p>
                <p>3.3. Debe ser mayor de edad o tener el consentimiento de un tutor legal para utilizar la plataforma.</p>
                <p>3.4. Se compromete a notificarnos inmediatamente sobre cualquier uso no autorizado de su cuenta.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">4. Publicación de Productos</h2>
              <div className="mt-2 space-y-2">
                <p>4.1. Los vendedores son responsables de la veracidad de la información de sus productos.</p>
                <p>4.2. Está prohibido publicar productos ilegales, falsificados o que infrinjan derechos de terceros.</p>
                <p>4.3. Las imágenes y descripciones deben ser precisas y representar fielmente el producto.</p>
                <p>4.4. Nos reservamos el derecho de eliminar cualquier publicación que no cumpla con nuestras políticas.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">5. Artículos Prohibidos</h2>
              <p className="mt-2">
                Queda expresamente prohibida la publicación, oferta, venta o distribución de los siguientes artículos a través de la plataforma GoVendy. La infracción de estas disposiciones podrá resultar en la eliminación inmediata de la publicación y, según la gravedad, en la suspensión permanente de la cuenta conforme a la Sección 10 de estos Términos.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800">5.1. Seguridad y Armamento</h3>
                  <div className="mt-1 space-y-1">
                    <p>a) <strong>Armas de fuego</strong> de cualquier calibre, tipo, mecanismo o clasificación, incluyendo armas antiguas, de colección, réplicas funcionales y sus componentes.</p>
                    <p>b) <strong>Accesorios para armas de fuego</strong>, incluyendo miras telescópicas, silenciadores, supresores, cargadores, culatas, monturas y cualquier pieza o componente destinado a modificar o complementar un arma.</p>
                    <p>c) <strong>Armas blancas reguladas</strong>, tales como navajas automáticas, cuchillos de apertura asistida, estiletes u objetos punzocortantes que carezcan de empaque primario de seguridad.</p>
                    <p>d) <strong>Material explosivo e inflamable</strong>, incluyendo fuegos artificiales (pirotecnia), pólvora, detonadores, aerosoles inflamables y cualquier sustancia o dispositivo con capacidad explosiva o incendiaria.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-800">5.2. Salud y Productos Regulados</h3>
                  <div className="mt-1 space-y-1">
                    <p>a) <strong>Medicamentos</strong>, tanto de prescripción médica como de venta libre. Únicamente las Tiendas Oficiales debidamente autorizadas por GoVendy podrán comercializar productos farmacéuticos conforme a la regulación sanitaria vigente.</p>
                    <p>b) <strong>Equipamiento médico restringido</strong>, incluyendo termómetros de mercurio, jeringas hipodérmicas, dispositivos de diagnóstico o terapéuticos que requieran prescripción o autorización sanitaria.</p>
                    <p>c) <strong>Sustancias prohibidas y controladas</strong>, incluyendo estupefacientes, psicotrópicos, precursores químicos, o productos que contengan sustancias restringidas tales como Ashwagandha, Yohimbina, concentraciones excesivas de formaldehído o cualquier compuesto regulado por las autoridades sanitarias mexicanas.</p>
                    <p>d) <strong>Lentes oftálmicos graduados</strong> que requieran prescripción médica para su dispensación.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-800">5.3. Propiedad Intelectual y Contenido Digital</h3>
                  <div className="mt-1 space-y-1">
                    <p>a) <strong>Artículos falsificados y réplicas</strong>, incluyendo productos descritos como &quot;tipo&quot;, &quot;estilo&quot;, &quot;inspiración&quot; o &quot;genérico de&quot; marcas registradas (por ejemplo: &quot;tipo Nike&quot;, &quot;inspiración Zara&quot;). Toda mercancía que imite, reproduzca o se presente como equivalente a marcas protegidas queda estrictamente prohibida.</p>
                    <p>b) <strong>Bases de datos y datos personales</strong>, incluyendo listas de correos electrónicos, directorios de contactos, registros de clientes o cualquier recopilación de información personal de terceros, en cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-800">5.4. Restricciones Logísticas y Productos Perecederos</h3>
                  <div className="mt-1 space-y-1">
                    <p>a) <strong>Guías de envío prepagadas y servicios logísticos</strong>. Queda prohibida la venta de guías de envío prepagadas, etiquetas de paquetería o servicios de mensajería, salvo por Tiendas Oficiales expresamente autorizadas por GoVendy.</p>
                    <p>b) <strong>Productos perecederos</strong>, incluyendo alimentos cuya fecha de caducidad sea inferior a quince (15) días naturales desde la fecha de publicación, o que requieran condiciones especiales de refrigeración, congelación o cadena de frío para su conservación.</p>
                    <p>c) <strong>Seres vivos, flora y restos biológicos</strong>. Se prohíbe la venta de animales vivos de cualquier especie, especies de flora silvestre o protegida conforme a la NOM-059-SEMARNAT, así como restos humanos o de origen animal.</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-800">5.5. Otros Artículos Prohibidos</h3>
                  <div className="mt-1 space-y-1">
                    <p>a) <strong>Productos de tabaco y vapeo</strong>, incluyendo cigarros, tabaco para pipa, cigarros electrónicos, vapeadores, cartuchos de nicotina y accesorios relacionados, conforme a la regulación sanitaria vigente en materia de productos del tabaco.</p>
                    <p>b) <strong>Documentos oficiales y legales</strong>, incluyendo títulos de propiedad, pasaportes, credenciales de elector, identificaciones oficiales, licencias de conducir, facturas fiscales, certificados académicos o cualquier documento emitido por autoridades gubernamentales.</p>
                    <p>c) <strong>Patrimonio cultural y paleontológico</strong>, incluyendo piezas arqueológicas, vestigios históricos, fósiles, monedas antiguas de valor patrimonial y cualquier bien que constituya patrimonio cultural de la nación conforme a la Ley Federal sobre Monumentos y Zonas Arqueológicos, Artísticos e Históricos.</p>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-500">
                GoVendy se reserva el derecho de actualizar esta lista de artículos prohibidos en cualquier momento. Los usuarios son responsables de verificar que sus publicaciones cumplan con la legislación mexicana vigente y las políticas de la plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">6. Transacciones y Pagos</h2>
              <div className="mt-2 space-y-2">
                <p>6.1. Todas las transacciones se procesan a través de proveedores de pago seguros.</p>
                <p>6.2. Los precios mostrados son responsabilidad del vendedor y deben incluir todos los impuestos aplicables.</p>
                <p>6.3. Los pagos se mantienen en custodia hasta que el comprador confirme la recepción del producto.</p>
                <p>6.4. Las comisiones de la plataforma se deducen automáticamente de las ventas.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">7. Envíos y Entregas</h2>
              <div className="mt-2 space-y-2">
                <p>7.1. El vendedor es responsable del empaque y envío del producto.</p>
                <p>7.2. Los tiempos de entrega son estimaciones y pueden variar según el servicio de envío.</p>
                <p>7.3. El comprador debe verificar el estado del producto al recibirlo.</p>
                <p>7.4. Los costos de envío son responsabilidad del comprador, salvo que se indique lo contrario.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">8. Devoluciones y Reembolsos</h2>
              <div className="mt-2 space-y-2">
                <p>8.1. Las políticas de devolución están sujetas a las condiciones establecidas por cada vendedor.</p>
                <p>8.2. Los reembolsos se procesarán según las políticas de la plataforma y del método de pago utilizado.</p>
                <p>8.3. En caso de disputa, nuestro equipo de soporte evaluará cada caso individualmente.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">9. Conducta del Usuario</h2>
              <div className="mt-2 space-y-2">
                <p>9.1. Los usuarios deben comportarse de manera respetuosa y profesional.</p>
                <p>9.2. Está prohibido realizar actividades fraudulentas, engañosas o ilegales.</p>
                <p>9.3. No se permite el acoso, amenazas o comportamiento abusivo hacia otros usuarios.</p>
                <p>9.4. Nos reservamos el derecho de suspender o eliminar cuentas que violen estas reglas.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">10. Causales de Suspensión Permanente e Inmediata</h2>
              <p className="mt-2">
                El incumplimiento de cualquiera de las siguientes disposiciones constituye causa de <strong>suspensión permanente e inmediata</strong> de la cuenta, sin previo aviso ni derecho a apelación:
              </p>
              <div className="mt-3 space-y-2">
                <p>10.1. <strong>Prohibición de cuentas múltiples.</strong> Queda estrictamente prohibido que un mismo usuario registre, posea o utilice más de una cuenta en la plataforma GoVendy. La detección de cuentas duplicadas resultará en la suspensión permanente de todas las cuentas vinculadas.</p>
                <p>10.2. <strong>Simulación de transacciones.</strong> Queda expresamente prohibido fingir, simular o manipular compras y ventas con el propósito de inflar artificialmente la reputación, las calificaciones o cualquier indicador de desempeño dentro de la plataforma.</p>
                <p>10.3. <strong>Venta de artículos falsificados.</strong> Se prohíbe la venta de artículos pirata, productos clonados presentados como originales, o cualquier mercancía que infrinja derechos de propiedad intelectual, marcas registradas o patentes.</p>
                <p>10.4. <strong>Artículos ilegales.</strong> Queda terminantemente prohibida la publicación, oferta o venta de armas de fuego, sustancias controladas, drogas, estupefacientes o cualquier artículo cuya comercialización esté prohibida por la legislación mexicana vigente.</p>
                <p>10.5. <strong>Desvío de pagos.</strong> Se prohíbe solicitar, inducir o instruir a los compradores para que realicen depósitos, transferencias o pagos a cuentas bancarias, billeteras digitales o cualquier medio de pago externo no autorizado por GoVendy.</p>
                <p>10.6. <strong>Alteración de métodos de transacción.</strong> Queda prohibido solicitar a los usuarios que modifiquen, alteren o evadan de cualquier forma los métodos de compra, pago, envío o venta establecidos por la plataforma.</p>
                <p>10.7. <strong>Evasión de comisiones mediante envíos.</strong> Se prohíbe declarar costos de envío artificialmente elevados en combinación con precios de publicación reducidos, o cualquier esquema diseñado para evadir, reducir o eludir las comisiones establecidas por GoVendy.</p>
                <p>10.8. <strong>Manipulación de comisiones.</strong> Queda prohibido cualquier intento de burlar, evadir o reducir las comisiones de la plataforma mediante la manipulación de cupones, descuentos, promociones, publicaciones, configuraciones de envío o modalidades de entrega personal.</p>
                <p>10.9. <strong>Mal uso de servicios de envío.</strong> Se prohíbe el uso indebido de los servicios de paquetería proporcionados por GoVendy, incluyendo la declaración intencional de peso, dimensiones o características del paquete que no correspondan a la realidad, con el fin de generar sobrepesos, subdeclaraciones u obtener tarifas indebidas.</p>
                <p>10.10. <strong>Fraude y actividades delictivas.</strong> Cualquier usuario que intente realizar estafas, fraudes, engaños o cometer cualquier tipo de delito dentro de la plataforma será eliminado de forma permanente y sin derecho a recuperar los fondos, saldos o PocketCash almacenados en la plataforma. Dichos fondos podrán ser utilizados para reembolsar a los usuarios afectados, en caso de haberlos.</p>
                <p>10.11. <strong>Interferencia con la plataforma.</strong> Queda prohibido intentar manipular, alterar, desestabilizar o afectar de cualquier forma el correcto funcionamiento de la plataforma, sus sistemas, bases de datos, algoritmos o infraestructura tecnológica.</p>
                <p>10.12. <strong>Uso de VPN o suplantación de ubicación.</strong> Se prohíbe el uso de redes privadas virtuales (VPN), servidores proxy o cualquier herramienta tecnológica destinada a ocultar, falsificar o simular una ubicación geográfica distinta a la real del usuario, con el objetivo de evadir los mecanismos de seguridad de la plataforma.</p>
                <p>10.13. <strong>Uso indebido general.</strong> Queda prohibido cualquier uso de la plataforma que contravenga su propósito legítimo, las buenas prácticas comerciales, la legislación aplicable o los presentes Términos y Condiciones. GoVendy se reserva el derecho de evaluar y sancionar cualquier conducta que considere perjudicial para la comunidad de usuarios o para la integridad del servicio.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">11. Propiedad Intelectual</h2>
              <div className="mt-2 space-y-2">
                <p>11.1. Todo el contenido de la plataforma, incluyendo diseño, logos y textos, es propiedad de GoVendy.</p>
                <p>11.2. Los usuarios conservan los derechos sobre el contenido que publican, pero otorgan licencia para su uso en la plataforma.</p>
                <p>11.3. Está prohibido copiar, modificar o distribuir contenido de la plataforma sin autorización.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">12. Limitación de Responsabilidad</h2>
              <div className="mt-2 space-y-2">
                <p>12.1. GoVendy actúa como intermediario y no se hace responsable por la calidad, seguridad o legalidad de los productos.</p>
                <p>12.2. No garantizamos la disponibilidad continua o ininterrumpida de nuestros servicios.</p>
                <p>12.3. Nuestra responsabilidad se limita al monto de las comisiones recibidas en la transacción específica.</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">13. Modificaciones de los Términos</h2>
              <p className="mt-2">
                Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigor al publicarse en la plataforma. El uso continuado de nuestros servicios después de los cambios constituye su aceptación.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">14. Ley Aplicable y Jurisdicción</h2>
              <p className="mt-2">
                Estos términos se rigen por las leyes de México. Cualquier disputa será resuelta en los tribunales competentes de México.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">15. Contacto</h2>
              <p className="mt-2">
                Para consultas sobre estos términos, puede contactarnos a través del sistema de soporte de la plataforma o visitando la sección de ayuda.
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
