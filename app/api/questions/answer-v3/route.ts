// API Route refactorizada para responder preguntas usando nueva arquitectura

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { QuestionsRepository } from '@/lib/repositories/questions.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { QuestionService } from '@/lib/services/questions/question.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  questionId: string;
  answerText: string;
};

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const { userId: sellerId } = await requireAuth(req);

    // Parse body
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const questionId = String(body?.questionId || '').trim();
    const answerText = String(body?.answerText || '').trim();

    // Inicializar servicios
    const questionsRepo = new QuestionsRepository();
    const notificationsRepo = new NotificationsRepository();
    const questionService = new QuestionService(questionsRepo, notificationsRepo);

    // Responder pregunta
    const question = await questionService.answerQuestion({
      questionId,
      sellerId,
      answerText,
    });

    // Respuesta exitosa
    const resp = NextResponse.json({
      ok: true,
      question: {
        id: question.id,
        answer_text: question.answer_text,
        answered_at: question.answered_at,
      },
      verified: true,
    });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;

  } catch (error) {
    const { message, code, statusCode } = handleError(error);
    const resp = NextResponse.json(
      { error: message, code },
      { status: statusCode }
    );
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
