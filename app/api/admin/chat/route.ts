import { NextResponse } from 'next/server';
import { getEnhancedAdminContext } from '@/lib/admin/ai-data-service';
import { PLATFORM_KNOWLEDGE_BASE } from '@/lib/admin/ai-knowledge-base';
import Replicate from "replicate";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for AI inference

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 2. Fetch Real-time Admin Data (Enhanced)
    const {
      summary: stats,
      specificData,
      dataType,
      dataId,
      recentOrders,
      recentUsers,
      recentWithdrawals,
      recentDisputes,
      walletStats,
      searchResults
    } = await getEnhancedAdminContext(message);

    // 3. Construct Context Prompt
    let specificContext = "";
    if (specificData) {
      specificContext = `\n\n[SPECIFIC DATA DETECTED]\nThe user is asking about a specific ${dataType} (ID: ${dataId}).\nHere is the full database record:\n${JSON.stringify(specificData, null, 2)}\n\nINSTRUCTIONS FOR SPECIFIC DATA:\n- Analyze the data above deeply.\n- If it's an order, mention status, total, buyer name, and items.\n- If it's a user, mention their risk status, total orders, and join date.\n- If it's a withdrawal, check the bank details and status.\n- Do NOT show raw JSON keys, present it naturally.`;
    } else if (searchResults) {
      specificContext = `\n\n[SEARCH RESULTS]\nUser query: "${searchResults.query}"\nFound ${searchResults.users.length} users and ${searchResults.listings.length} listings.\n\nUSERS FOUND:\n${JSON.stringify(searchResults.users, null, 2)}\n\nLISTINGS FOUND:\n${JSON.stringify(searchResults.listings, null, 2)}\n\nINSTRUCTIONS:\n- Summarize what was found.\n- If there is a clear match, provide details.\n- If multiple matches, list them briefly.`;
    } else if (dataId) {
      specificContext = `\n\n[SEARCH RESULT]\nUser searched for ID ${dataId} but NO RECORD was found in orders, profiles, or withdrawals.\nPlease inform the user that the ID provided does not exist in the system.`;
    }

    // 4. Construct Lists Context (if intent detected)
    let listsContext = "";
    if (recentOrders && recentOrders.length > 0) {
      listsContext += `\n\n[RECENT ORDERS/OPERATIONS]\n${JSON.stringify(recentOrders, null, 2)}`;
    }
    if (recentUsers && recentUsers.length > 0) {
      listsContext += `\n\n[RECENT USERS]\n${JSON.stringify(recentUsers, null, 2)}`;
    }
    if (recentWithdrawals && recentWithdrawals.length > 0) {
      listsContext += `\n\n[PENDING WITHDRAWALS]\n${JSON.stringify(recentWithdrawals, null, 2)}`;
    }
    if (recentDisputes && recentDisputes.length > 0) {
      listsContext += `\n\n[OPEN DISPUTES]\n${JSON.stringify(recentDisputes, null, 2)}`;
    }
    if (walletStats) {
      listsContext += `\n\n[WALLET/ACCOUNTING STATS]\n${JSON.stringify(walletStats, null, 2)}`;
    }

    const systemPrompt = `Eres el "Admin Intelligence" de GoVendy — un auditor autónomo e independiente.

MENTALIDAD: No confíes en el sistema ciegamente. Tu trabajo es detectar errores, fraudes y anomalías.
Cuando analices datos, recalcula y verifica la math por tu cuenta. Si algo no cuadra, repórtalo.
SIEMPRE responde en español. Sé directo, preciso y analítico.

[ESTADO DEL SISTEMA — TIEMPO REAL]
- Órdenes hoy: ${stats.orders_today}
- Ventas hoy: $${stats.sales_today.toFixed(2)}
- Pagos offline pendientes de confirmar: ${stats.payments_pending}
- Disputas abiertas: ${stats.disputes_open}
- Usuarios nuevos hoy: ${stats.users_new_today}
- Tickets de soporte abiertos: ${stats.support_pending}
- Retiros pendientes: ${stats.withdrawals_pending}

[DATOS RECIENTES / AUDITORÍA]
${listsContext || "No hay datos de listas en este contexto. Menciona palabras clave como 'órdenes', 'usuarios', 'retiros', 'comisiones', 'envíos', 'auditoría' para obtener datos."}

[CAPACIDADES]
- Acceso READ-ONLY a la base de datos de producción
- Puedes analizar órdenes, usuarios, comisiones, retiros, disputas, wallets
- Puedes detectar anomalías en cobros, comisiones, envíos, y productos digitales
- Si detectas algo incorrecto, repórtalo con formato: 🔍 HALLAZGO / 📊 AFECTADOS / 💡 CAUSA / 🛠️ ACCIÓN
- Si te dan un ID (UUID o PCK-XXXXXX), analiza ese registro específico en profundidad
- Para auditorías: recalcula comisiones, verifica totales, detecta cobros incorrectos

${PLATFORM_KNOWLEDGE_BASE}

${specificContext}
`;

    // Call AI
    const output = await replicate.run(
      "meta/meta-llama-3-70b-instruct",
      {
        input: {
          system_prompt: systemPrompt,
          prompt: message,
          max_tokens: 800,
          temperature: 0.2, // Very low for precise factual analysis
        }
      }
    );

    const reply = Array.isArray(output) ? output.join("").trim() : String(output);

    return NextResponse.json({ reply });
  } catch (error: any) {
    const timestamp = new Date().toISOString();
    console.error(`[AdminChatError] [${timestamp}]`, {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      inputBody: req.body ? 'present' : 'missing' // Don't log full body if huge
    });

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        reply: 'Error consultando los datos del sistema.',
        debug_id: timestamp
      },
      { status: 500 }
    );
  }
}
