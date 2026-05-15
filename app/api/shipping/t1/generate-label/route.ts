import { NextRequest, NextResponse } from 'next/server';
import { generateT1Label } from '@/lib/shipping/t1-api';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.quote_token) {
            return NextResponse.json({ error: 'Se requiere quote_token' }, { status: 400 });
        }

        const result = await generateT1Label(body);

        return NextResponse.json({ success: true, label: result });
    } catch (err: any) {
        console.error('[API /shipping/t1/generate-label]', err);
        return NextResponse.json({ error: err?.message || 'Error al generar guía' }, { status: 500 });
    }
}
