// Repository para acceso a datos de preguntas

import { supabaseAdmin } from '@/lib/supabase/admin';
import { ListingQuestion, CreateQuestionData, AnswerQuestionData } from '@/lib/types/domain.types';
import { NotFoundError } from '@/lib/utils/errors';

export class QuestionsRepository {
  /**
   * Crear pregunta
   */
  async create(data: CreateQuestionData): Promise<ListingQuestion> {
    const admin = supabaseAdmin();
    const { data: question, error } = await admin
      .from('listing_questions')
      .insert([{
        listing_id: data.listing_id,
        seller_id: data.seller_id,
        asker_id: data.asker_id,
        question_text: data.question_text,
        answer_text: null,
        is_deleted: false,
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creando pregunta: ${error.message}`);
    }

    return question as ListingQuestion;
  }

  /**
   * Buscar pregunta por ID
   */
  async findById(id: string): Promise<ListingQuestion | null> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('listing_questions')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) {
      throw new Error(`Error buscando pregunta: ${error.message}`);
    }

    return data as ListingQuestion | null;
  }

  /**
   * Buscar preguntas por listing_id
   */
  async findByListingId(listingId: string, limit: number = 100): Promise<ListingQuestion[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('listing_questions')
      .select('*')
      .eq('listing_id', listingId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando preguntas: ${error.message}`);
    }

    return (data || []) as ListingQuestion[];
  }

  /**
   * Buscar preguntas por seller_id (sin responder)
   */
  async findUnansweredBySellerId(sellerId: string, limit: number = 100): Promise<ListingQuestion[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('listing_questions')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('is_deleted', false)
      .is('answer_text', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando preguntas sin responder: ${error.message}`);
    }

    return (data || []) as ListingQuestion[];
  }

  /**
   * Buscar preguntas por asker_id
   */
  async findByAskerId(askerId: string, limit: number = 100): Promise<ListingQuestion[]> {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('listing_questions')
      .select('*')
      .eq('asker_id', askerId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Error buscando preguntas del usuario: ${error.message}`);
    }

    return (data || []) as ListingQuestion[];
  }

  /**
   * Responder pregunta
   */
  async answer(id: string, data: AnswerQuestionData): Promise<ListingQuestion> {
    const admin = supabaseAdmin();
    const now = new Date().toISOString();
    const { data: question, error } = await admin
      .from('listing_questions')
      .update({
        answer_text: data.answer_text,
        answered_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error respondiendo pregunta: ${error.message}`);
    }

    if (!question) {
      throw new NotFoundError('Pregunta', id);
    }

    return question as ListingQuestion;
  }
}
