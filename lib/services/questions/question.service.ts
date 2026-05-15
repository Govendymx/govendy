// Servicio de lógica de negocio para preguntas

import { QuestionsRepository } from '@/lib/repositories/questions.repository';
import { NotificationsRepository } from '@/lib/repositories/notifications.repository';
import { NotificationService } from '@/lib/services/notifications/notification.service';
import { ListingQuestion, CreateQuestionData, AnswerQuestionData } from '@/lib/types/domain.types';
import { ValidationError, NotFoundError, ForbiddenError } from '@/lib/utils/errors';
import { validateRequired, validateUUID, containsContactInfo } from '@/lib/utils/validation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notifyQuestionReceived, notifyAnswerReceived } from '@/lib/email/notify';

export interface AskQuestionParams {
  listingId: string;
  askerId: string;
  questionText: string;
}

export interface AnswerQuestionParams {
  questionId: string;
  sellerId: string;
  answerText: string;
}

export class QuestionService {
  private notificationService?: NotificationService;

  constructor(
    private questionsRepo: QuestionsRepository,
    notificationsRepo?: NotificationsRepository
  ) {
    if (notificationsRepo) {
      this.notificationService = new NotificationService(notificationsRepo);
    }
  }

  /**
   * Hacer una pregunta
   */
  async askQuestion(params: AskQuestionParams): Promise<ListingQuestion> {
    const { listingId, askerId, questionText } = params;

    // Validaciones
    validateRequired(listingId, 'listingId');
    validateRequired(askerId, 'askerId');
    validateRequired(questionText, 'questionText');

    if (!validateUUID(listingId)) {
      throw new ValidationError('listingId debe ser un UUID válido');
    }

    if (questionText.length < 3) {
      throw new ValidationError('La pregunta debe tener al menos 3 caracteres');
    }

    if (questionText.length > 500) {
      throw new ValidationError('La pregunta es demasiado larga (máx. 500 caracteres)');
    }

    // Buscar listing para obtener seller_id
    const admin = supabaseAdmin();
    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id, seller_id, title')
      .eq('id', listingId)
      .maybeSingle();

    if (listingError) {
      throw new Error(`Error buscando publicación: ${listingError.message}`);
    }

    if (!listing) {
      throw new NotFoundError('Publicación', listingId);
    }

    const sellerId = (listing as any).seller_id;
    if (!sellerId) {
      throw new ValidationError('Publicación inválida (sin vendedor)');
    }

    if (sellerId === askerId) {
      throw new ValidationError('No puedes preguntarte a ti mismo en tu publicación');
    }

    // Validar contenido prohibido
    const safetyCheck = containsContactInfo(questionText);
    if (safetyCheck.detected) {
      throw new ValidationError(`Por seguridad, no se permiten ${safetyCheck.reason} en las preguntas.`);
    }

    // Crear pregunta
    const question = await this.questionsRepo.create({
      listing_id: listingId,
      seller_id: sellerId,
      asker_id: askerId,
      question_text: questionText.trim(),
    });

    // Notificar al vendedor (best-effort)
    if (this.notificationService) {
      try {
        const listingTitle = (listing as any).title || 'Tu publicación';
        const questionPreview = questionText.length > 80 ? `${questionText.slice(0, 77)}…` : questionText;

        await this.notificationService.create({
          user_id: sellerId,
          type: 'listing_question',
          title: '💬 Nueva pregunta en tu publicación',
          body: `"${listingTitle}": ${questionPreview}`,
          link_to: `/dashboard/preguntas`,
          data: {
            kind: 'listing_question',
            listingId,
            questionId: question.id,
            questionPreview,
            href: `/dashboard/preguntas`,
            link: `/dashboard/preguntas`,
            link_url: `/listings/${listingId}`,
          },
        });
      } catch (notifyErr) {
        console.warn('[QuestionService] Error enviando notificación:', notifyErr);
      }
    }

    // Notificar por email al vendedor (best-effort)
    try {
      const listingTitle = (listing as any).title || 'Tu publicación';
      console.log(`[QuestionService] Enviando email a vendedor ${sellerId} para listing ${listingId}`);
      await notifyQuestionReceived({
        sellerId,
        listingTitle,
        questionText,
        listingId,
      });
      console.log('[QuestionService] Email enviado correctamente (o encolado)');
    } catch (emailErr) {
      console.error('[QuestionService] Error CRÍTICO enviando email de pregunta:', emailErr);
    }

    return question;
  }

  /**
   * Responder pregunta
   */
  async answerQuestion(params: AnswerQuestionParams): Promise<ListingQuestion> {
    const { questionId, sellerId, answerText } = params;

    // Validaciones
    validateRequired(questionId, 'questionId');
    validateRequired(sellerId, 'sellerId');
    validateRequired(answerText, 'answerText');

    if (!validateUUID(questionId)) {
      throw new ValidationError('questionId debe ser un UUID válido');
    }

    const trimmedAnswer = answerText.trim();
    if (trimmedAnswer.length === 0) {
      throw new ValidationError('La respuesta no puede estar vacía');
    }

    // Validar contenido prohibido (datos de contacto) en la respuesta
    const safetyCheck = containsContactInfo(trimmedAnswer);
    if (safetyCheck.detected) {
      throw new ValidationError(`Por seguridad, no se permiten ${safetyCheck.reason} en las respuestas.`);
    }

    // Buscar pregunta
    const question = await this.questionsRepo.findById(questionId);
    if (!question) {
      throw new NotFoundError('Pregunta', questionId);
    }

    // Verificar autorización
    if (question.seller_id !== sellerId) {
      // Intentar verificar por listing si seller_id no coincide
      const admin = supabaseAdmin();
      const { data: listing } = await admin
        .from('listings')
        .select('seller_id')
        .eq('id', question.listing_id)
        .maybeSingle();

      if (!listing || (listing as any).seller_id !== sellerId) {
        throw new ForbiddenError('Solo el vendedor puede responder esta pregunta');
      }

      // Corregir seller_id en la pregunta
      await admin
        .from('listing_questions')
        .update({ seller_id: sellerId })
        .eq('id', questionId);
    }

    // Verificar que no esté ya respondida
    if (question.answer_text && question.answer_text.trim() !== '') {
      throw new ValidationError('Esta pregunta ya fue respondida');
    }

    // Responder
    const answeredQuestion = await this.questionsRepo.answer(questionId, {
      answer_text: trimmedAnswer,
    });

    // Notificar al usuario que preguntó (best-effort)
    if (this.notificationService && question.asker_id && question.asker_id !== sellerId) {
      try {
        // Obtener título del listing
        const admin = supabaseAdmin();
        const { data: listing } = await admin
          .from('listings')
          .select('title, public_id')
          .eq('id', question.listing_id)
          .maybeSingle();

        const listingTitle = listing
          ? ((listing as any).title || (listing as any).public_id || 'Publicación')
          : 'Publicación';

        const linkUrl = question.listing_id ? `/listings/${question.listing_id}` : '/dashboard/respuestas';

        await this.notificationService.create({
          user_id: question.asker_id,
          type: 'listing_answer',
          title: 'El vendedor respondió tu pregunta',
          body: `Respondieron tu pregunta en: ${listingTitle}.`,
          link_to: linkUrl,
          data: {
            kind: 'listing_answer',
            questionId,
            listingId: question.listing_id,
            listing_id: question.listing_id,
            link_url: linkUrl,
            href: linkUrl,
            link: linkUrl,
          },
        });
      } catch (notifyErr) {
        console.warn('[QuestionService] Error enviando notificación de respuesta:', notifyErr);
      }
    }

    // Notificar por email al usuario que preguntó (best-effort)
    if (question.asker_id && question.asker_id !== sellerId) {
      try {
        const admin = supabaseAdmin();
        const { data: listing } = await admin
          .from('listings')
          .select('title')
          .eq('id', question.listing_id)
          .maybeSingle();
          
        const listingTitle = (listing as any)?.title || 'Publicación';

        await notifyAnswerReceived({
          askerId: question.asker_id,
          listingTitle,
          answerText: trimmedAnswer,
          listingId: question.listing_id,
        });
      } catch (emailErr) {
        console.warn('[QuestionService] Error enviando email de respuesta:', emailErr);
      }
    }

    return answeredQuestion;
  }

  /**
   * Obtener preguntas de un listing
   */
  async getByListingId(listingId: string, limit: number = 100): Promise<ListingQuestion[]> {
    validateRequired(listingId, 'listingId');
    if (!validateUUID(listingId)) {
      throw new ValidationError('listingId debe ser un UUID válido');
    }

    return this.questionsRepo.findByListingId(listingId, limit);
  }

  /**
   * Obtener preguntas sin responder de un vendedor
   */
  async getUnansweredBySellerId(sellerId: string, limit: number = 100): Promise<ListingQuestion[]> {
    validateRequired(sellerId, 'sellerId');
    if (!validateUUID(sellerId)) {
      throw new ValidationError('sellerId debe ser un UUID válido');
    }

    return this.questionsRepo.findUnansweredBySellerId(sellerId, limit);
  }

  /**
   * Obtener preguntas de un usuario
   */
  async getByAskerId(askerId: string, limit: number = 100): Promise<ListingQuestion[]> {
    validateRequired(askerId, 'askerId');
    if (!validateUUID(askerId)) {
      throw new ValidationError('askerId debe ser un UUID válido');
    }

    return this.questionsRepo.findByAskerId(askerId, limit);
  }
}

