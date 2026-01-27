import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache';

export async function GET() {
  try {
    const cacheStats = cache.getStats();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      cache: cacheStats,
      services: {
        musicbrainz: 'operational',
        audiodb: 'operational',
        deezer: 'operational',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
