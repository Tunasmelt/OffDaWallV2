import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { feedback, timestamp, page } = body;

    // Log feedback to console
    console.log('[OffDaWallV2] New feedback received:', {
      feedback,
      page,
      timestamp: new Date(timestamp).toISOString(),
    });

    // In production, you would:
    // 1. Store in database
    // 2. Send to analytics service
    // 3. Notify team via email/Slack

    return NextResponse.json({ 
      success: true,
      message: 'Feedback received successfully' 
    });
  } catch (error) {
    console.error('[OffDaWallV2] Feedback submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

