import { NextRequest, NextResponse } from 'next/server';
import { YouTubeService } from '@/lib/services/youtube-service';
import { isValidYouTubeUrl } from '@/lib/utils';
import { RateLimiter, getClientId } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  // Rate limiting check
  const clientId = getClientId(request);
  if (!RateLimiter.isAllowed(clientId)) {
    const remainingRequests = RateLimiter.getRemainingRequests(clientId);
    const resetTime = RateLimiter.getResetTime(clientId);
    
    return NextResponse.json(
      { 
        error: 'Too many requests. Please wait before trying again.',
        remainingRequests,
        resetTime
      },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString()
        }
      }
    );
  }

  try {
    const { url } = await request.json();

    if (!url || !isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    const videoInfo = await YouTubeService.getVideoInfo(url);
    
    return NextResponse.json({ 
      success: true, 
      data: videoInfo,
      remainingRequests: RateLimiter.getRemainingRequests(clientId)
    });
  } catch (error) {
    console.error('Extract error:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to extract video information';
    if (error instanceof Error) {
      if (error.message.includes('YouTube blocked')) {
        errorMessage = 'YouTube is currently blocking requests from this server. Please try again in a few minutes.';
      } else if (error.message.includes('unavailable') || error.message.includes('private')) {
        errorMessage = 'This video is unavailable or private';
      } else if (error.message.includes('age-restricted')) {
        errorMessage = 'This video is age-restricted';
      } else if (error.message.includes('region')) {
        errorMessage = 'This video is not available in your region';
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 