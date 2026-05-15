// API Route refactorizada para hacer preguntas usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { QuestionsRepository } from '@/lib/repositories/questions.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { QuestionService } from '@/lib/services/questions/question.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  listingId: string;
  question: string;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: askerId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const listingId = String(body?.listingId || '').trim();
    const questionText = String(body?.question || '').trim();

    // Inicializar servicios
    const questionsRepo = new QuestionsRepository();
    const notificationsRepo = new NotificationsRepository();
    const questionService = new QuestionService(questionsRepo, notificationsRepo);

    // Hacer pregunta
    const question = await questionService.askQuestion({
      listingId,
      askerId,
      questionText,
    });

    // Respuesta exitosa
    return NextResponse.json({
      ok: true,
      question,
    });

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    return NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
  }
}
