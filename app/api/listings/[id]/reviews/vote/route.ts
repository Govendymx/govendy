import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            cookie: (await cookieStore).getAll().map(c => `${c.name}=${c.value}`).join('; ')
          }
        }
      }
    );

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { review_id, vote_type } = body; // 1 or -1

    if (!review_id || ![1, -1].includes(vote_type)) {
      return NextResponse.json({ error: 'Invalid vote' }, { status: 400 });
    }

    // Upsert vote
    const { error: voteError } = await supabase
      .from('product_review_votes')
      .upsert({
        review_id,
        user_id: userId,
        vote_type
      });

    if (voteError) throw voteError;

    // Recalculate helpful count for the review
    // We can do this via trigger, but manual for now
    // Get sum of votes
    const { data: votes } = await supabase
      .from('product_review_votes')
      .select('vote_type')
      .eq('review_id', review_id);

    const helpfulCount = votes ? votes.reduce((sum, v) => sum + (v.vote_type === 1 ? 1 : 0), 0) : 0;

    await supabase
      .from('product_reviews')
      .update({ helpful_count: helpfulCount })
      .eq('id', review_id);

    return NextResponse.json({ success: true, helpful_count: helpfulCount });

  } catch (error: any) {
    console.error('Error voting:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
