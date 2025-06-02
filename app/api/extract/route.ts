import { NextRequest, NextResponse } from 'next/server';
import { YouTubeService } from '@/lib/services/youtube-service';
import { isValidYouTubeUrl } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || !isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    const videoInfo = await YouTubeService.getVideoInfo(url);
    
    return NextResponse.json({ success: true, data: videoInfo });
  } catch (error) {
    console.error('Extract error:', error);
    return NextResponse.json(
      { error: 'Failed to extract video information' },
      { status: 500 }
    );
  }
} 