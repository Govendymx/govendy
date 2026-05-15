import { NextRequest, NextResponse } from 'next/server';
import { notifyWelcome } from '@/lib/email/notify';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Enviar email de bienvenida (no bloqueante para la respuesta)
    // Usamos void para no esperar la promesa y que el cliente reciba respuesta rápido
    void notifyWelcome({ userId }).catch(err => 
      console.error('[WELCOME EMAIL] Error enviando bienvenida:', err)
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[WELCOME EMAIL] Error procesando request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
