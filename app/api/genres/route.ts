import { NextResponse } from 'next/server';
import { getAllGenres } from '@/lib/genres';

export async function GET() {
  try {
    const genres = getAllGenres();
    
    return NextResponse.json({
      data: genres,
      cached: false,
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch genres',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
