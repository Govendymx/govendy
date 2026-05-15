import { NextResponse } from 'next/server';
import { generateChatResponse } from '@/lib/replicate';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const reply = await generateChatResponse(message);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', reply: 'Lo siento, estoy teniendo problemas técnicos. 😵‍💫' },
      { status: 500 }
    );
  }
}
