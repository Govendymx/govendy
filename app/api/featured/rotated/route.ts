import { NextRequest, NextResponse } from 'next/server';
import { FeaturedService } from '@/lib/services/featured/featured.service';



export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '12', 10);

    const listings = await FeaturedService.getRotatedListings(limit);

    const res = NextResponse.json({ data: listings });
    res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=90');
    return res;
  } catch (error: any) {
    console.error('Error fetching rotated listings:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
