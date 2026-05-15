import { NextResponse } from 'next/server';
import Replicate from "replicate";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for AI inference

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const BUSINESS_KNOWLEDGE = `
INFORMACIÓN EMPRESARIAL ESENCIAL DE GOPOCKET:

1. **Identidad y Misión:**
   - **Nombre:** GoVendy.
   - **Industria:** Marketplace C2C/B2C de Moda, Streetwear, Sneakers y Lujo Accesible.
   - **Misión:** Democratizar el acceso a la moda auténtica en México, eliminando riesgos de estafas y barreras logísticas.
   - **Visión:** Ser la plataforma líder de reventa de moda en LatAm, impulsando la economía circular.
   - **Público Objetivo:** Gen Z y Millennials (18-35 años) en México, entusiastas de la moda, sneakers y cultura urbana.

2. **Modelo de Negocio:**
   - **Comisión:** Cobramos el 8% + $10 MXN (IVA incluido) por venta realizada al vendedor.
   - **Ingresos:** Comisiones por transacción y planes de posicionamiento ("Destacados").
   - **Sin Costo de Publicación:** Publicar es gratis; solo cobramos si vendes.

3. **Propuesta de Valor y Ventaja Competitiva:**
   - **Seguridad ("Compra Protegida"):** Retenemos el dinero del comprador hasta que recibe el producto y confirma que está bien.
   - **Logística Resuelta:** Generamos guías de envío automáticas (Estafeta, FedEx, DHL, 99Minutos) para que el vendedor solo imprima y pegue.
   - **Autenticación y Confianza:** Filtros anti-fraude y política de cero tolerancia a falsificaciones (fakes).
   - **Comunidad Nicho:** A diferencia de marketplaces genéricos, aquí el foco es moda y estilo.

4. **Procesos Operativos Clave:**
   - **Venta:** El vendedor publica -> Alguien compra -> Vendedor recibe notificación y guía -> Vendedor envía en <3 días hábiles -> Comprador recibe -> Dinero se libera a la Wallet del vendedor en 48h.
   - **Compra:** Comprador paga (Tarjeta, Transferencia, OXXO, Depósito) -> Dinero en custodia -> Recibe producto -> Si todo bien, califica; si no, abre reclamo (disputa).
   - **Retiros:** Los vendedores retiran su saldo a cuenta bancaria (procesado en 24h hábiles).

5. **Políticas y Reglas:**
   - **Prohibido:** Venta de réplicas/clones, transacciones fuera de la App (pierden protección), insultos en el chat.
   - **Devoluciones:** Aceptadas si el producto no coincide con la descripción o tiene defectos no reportados. El comprador tiene 48h para reportar.
   - **Cancelaciones:** Penalizan la reputación del vendedor.

6. **Métricas Clave (KPIs):**
   - Tiempo de envío promedio.
   - Tasa de reclamos/disputas.
   - GMV (Gross Merchandise Value).

7. **Funcionalidades Específicas:**
   - **Subastas:** Puja en tiempo real. Ganador tiene 48h para pagar.
   - **Ofertas:** Compradores pueden ofertar precio menor; vendedor acepta/rechaza.
   - **Destacados:** Planes Basic y Pro para aparecer arriba en búsquedas.
   - **Pocky:** Tú eres Pocky, el asistente IA que guía esta experiencia.

8. **Ubicación:**
   - Operación 100% digital con base en Ciudad de México, cobertura nacional.
`;

const SYSTEM_PROMPT = `Eres Pocky, el asistente virtual oficial de GoVendy. 
Tu personalidad es: Amigable, entusiasta, "cool", servicial y experta en moda/streetwear. Usas emojis (🚀, ✨, 👟, 🧢) moderadamente.
Tu objetivo es ayudar a los usuarios a navegar la plataforma, comprar seguro y vender más.

${BUSINESS_KNOWLEDGE}

INSTRUCCIONES DE RESPUESTA:
- Responde siempre en Español de México.
- Sé conciso pero completo. No des respuestas kilométricas a menos que sea necesario.
- Si te preguntan precios o comisiones, sé exacto: 23% en Plan Básico y 18% en Plan Pro.
- Si te preguntan algo fuera de tu conocimiento, sugiere ir a "/ayuda" o contactar a soporte humano.
- JAMÁS inventes datos técnicos, legales o financieros que no estén en tu base de conocimiento.
- Si detectas intención de fraude (ej. "cómo vender sin pagar comisión"), advierte amablemente sobre los riesgos de salir de la plataforma.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, context } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let dynamicPrompt = SYSTEM_PROMPT;

    // Inyectar contexto dinámico de la navegación
    if (context) {
      dynamicPrompt += `\n\nCONTEXTO ACTUAL DEL USUARIO (URL): ${context}\n`;
      
      if (context.includes('/vender')) {
        dynamicPrompt += "TIP: El usuario está intentando VENDER. Anímalo a subir buenas fotos y describir bien el estado (Nuevo/Usado).";
      } else if (context.includes('/checkout')) {
        dynamicPrompt += "TIP: El usuario está en CHECKOUT. Si duda, recuérdale que su dinero está protegido hasta recibir el pedido.";
      } else if (context.includes('/perfil')) {
        dynamicPrompt += "TIP: El usuario está en su PERFIL. Aquí gestiona sus compras, ventas y saldo.";
      } else if (context.includes('/productos/')) {
        dynamicPrompt += "TIP: El usuario está viendo un PRODUCTO. Ayúdale con dudas sobre tallas, envío o cómo ofertar.";
      } else if (context.includes('/admin')) {
        // Pocky no debería estar en admin, pero por si acaso.
        dynamicPrompt += "NOTA: El usuario parece ser administrador.";
      }
    }

    const output = await replicate.run(
      "meta/meta-llama-3-70b-instruct",
      {
        input: {
          prompt: `${dynamicPrompt}\n\nPREGUNTA DEL USUARIO: ${message}\nRESPUESTA DE POCKY:`,
          max_tokens: 400,
          temperature: 0.7,
          top_p: 0.9,
          presence_penalty: 0.1, // Variedad
          frequency_penalty: 0.1,
        }
      }
    );

    const reply = Array.isArray(output) ? output.join("").trim() : String(output);

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('User Chat API Error (Pocky):', error);
    
    // Mejor manejo de errores para depuración
    const errorMessage = error?.message || 'Error desconocido';
    const isAuthError = errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('token');
    
    let userReply = '¡Ups! Me mareé un poco. 😵 ¿Podrías preguntarme de nuevo?';
    
    if (process.env.NODE_ENV === 'development' || errorMessage.includes('token')) {
       // En dev o error de token, damos una pista sutil si es crítico
       if (isAuthError) userReply += ' (Error de configuración de IA)';
    }

    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        details: errorMessage,
        reply: userReply 
      },
      { status: 500 }
    );
  }
}
