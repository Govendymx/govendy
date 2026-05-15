'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function DebugUserInfoPage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Obtener información del usuario
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const user = userData.user;
        if (!user) {
          setUserInfo({ error: 'No hay usuario autenticado' });
          setLoading(false);
          return;
        }

        // Obtener perfil
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        setUserInfo({
          user_id: user.id,
          email: user.email,
          full_name: profileData?.full_name || 'Sin nombre',
          phone: profileData?.phone || 'Sin teléfono',
        });

        // Obtener preguntas pendientes
        const { data: questionsData, error: questionsErr } = await supabase
          .from('listing_questions')
          .select('id,listing_id,seller_id,asker_id,question_text,answer_text,created_at')
          .eq('seller_id', user.id)
          .eq('is_deleted', false)
          .is('answer_text', null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!questionsErr && questionsData) {
          setQuestions(questionsData);
        }

        setQuestionsLoading(false);
      } catch (e) {
        console.error(e);
        setUserInfo({ error: e instanceof Error ? e.message : 'Error desconocido' });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 text-2xl font-bold">Cargando información...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">🔍 Información de Debug - Usuario</h1>

        {userInfo?.error ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <strong>Error:</strong> {userInfo.error}
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Información del Usuario</h2>
              <div className="space-y-2 font-mono text-sm">
                <div>
                  <strong className="text-gray-700">User ID:</strong>{' '}
                  <span className="text-gray-900">{userInfo?.user_id || 'N/A'}</span>
                </div>
                <div>
                  <strong className="text-gray-700">Email:</strong>{' '}
                  <span className="text-gray-900">{userInfo?.email || 'N/A'}</span>
                </div>
                <div>
                  <strong className="text-gray-700">Nombre:</strong>{' '}
                  <span className="text-gray-900">{userInfo?.full_name || 'N/A'}</span>
                </div>
                <div>
                  <strong className="text-gray-700">Teléfono:</strong>{' '}
                  <span className="text-gray-900">{userInfo?.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Preguntas Pendientes</h2>
              {questionsLoading ? (
                <div className="text-gray-600">Cargando preguntas...</div>
              ) : questions.length === 0 ? (
                <div className="text-gray-600">No hay preguntas pendientes.</div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q) => (
                    <div key={q.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-2 font-mono text-xs text-gray-600">
                        <strong>ID Pregunta:</strong> {q.id}
                      </div>
                      <div className="mb-2 font-mono text-xs text-gray-600">
                        <strong>Seller ID:</strong> {q.seller_id}
                      </div>
                      <div className="mb-2 font-mono text-xs text-gray-600">
                        <strong>Asker ID:</strong> {q.asker_id}
                      </div>
                      <div className="mb-2">
                        <strong className="text-gray-700">Pregunta:</strong>{' '}
                        <span className="text-gray-900">{q.question_text}</span>
                      </div>
                      <div className="mb-2 font-mono text-xs text-gray-600">
                        <strong>Listing ID:</strong> {q.listing_id}
                      </div>
                      <div className="font-mono text-xs text-gray-600">
                        <strong>Creada:</strong> {new Date(q.created_at).toLocaleString('es-MX')}
                      </div>
                      <div className="mt-2">
                        <span
                          className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                            q.seller_id === userInfo?.user_id
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {q.seller_id === userInfo?.user_id
                            ? '✅ ES TU PREGUNTA'
                            : '❌ NO ES TU PREGUNTA'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
              <h2 className="mb-4 text-xl font-semibold text-blue-900">📋 Instrucciones</h2>
              <ol className="list-inside list-decimal space-y-2 text-blue-800">
                <li>Copia el <strong>User ID</strong> de arriba</li>
                <li>Ejecuta este SQL en Supabase para verificar las políticas RLS:</li>
              </ol>
              <div className="mt-4 rounded bg-white p-4 font-mono text-xs">
                <pre className="whitespace-pre-wrap">
{`SELECT 
  lq.id,
  lq.seller_id,
  CASE 
    WHEN lq.seller_id = '${userInfo?.user_id || 'TU_USER_ID'}' THEN '✅ ES TU PREGUNTA'
    ELSE '❌ NO ES TU PREGUNTA'
  END as es_tuya,
  lq.question_text
FROM listing_questions lq
WHERE lq.is_deleted = false
  AND (lq.answer_text IS NULL OR lq.answer_text = '')
  AND lq.seller_id = '${userInfo?.user_id || 'TU_USER_ID'}'
ORDER BY lq.created_at DESC;`}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
