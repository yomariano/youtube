import { NextRequest, NextResponse } from 'next/server';
import { YouTubeService } from '@/lib/services/youtube-service';
import { FFmpegService } from '@/lib/services/ffmpeg-service';
import { isValidYouTubeUrl, extractVideoId, sanitizeFilename } from '@/lib/utils';
import { RateLimiter, getClientId } from '@/lib/rate-limiter';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';

// Only import the TranslationService when needed
import { TranslationService } from '@/lib/services/translation-service';

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

  const tempDir = path.join(process.cwd(), 'temp');
  const publicDir = path.join(process.cwd(), 'public', 'downloads');
  
  // Ensure directories exist
  [tempDir, publicDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  try {
    const { url, format, quality, translateTo } = await request.json();

    if (!url || !isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Could not extract video ID' },
        { status: 400 }
      );
    }

    console.log(`Starting download for video: ${videoId}, format: ${format}, quality: ${quality}`);

    const videoInfo = await YouTubeService.getVideoInfo(url);
    const safeTitle = sanitizeFilename(videoInfo.title);
    
    const tempVideoPath = path.join(tempDir, `${videoId}_temp.${format === 'mp3' ? 'webm' : 'mp4'}`);
    const finalPath = path.join(publicDir, `${safeTitle}_${quality}.${format}`);

    console.log(`Downloading to temp file: ${tempVideoPath}`);

    // Download the video/audio with fallback mechanism
    let downloadSuccess = false;
    let useYtDlpFallback = false;

    try {
      // First attempt: Try streaming with ytdl-core
      let stream;
      if (format === 'mp3') {
        stream = await YouTubeService.downloadAudio(url);
      } else {
        stream = await YouTubeService.downloadVideo(url, quality);
      }

      // Save to temp file
      const writeStream = fs.createWriteStream(tempVideoPath);
      await pipeline(stream, writeStream);
      downloadSuccess = true;
      console.log('Successfully downloaded using ytdl-core streaming');

    } catch (streamError: any) {
      console.log('Streaming download failed:', streamError.message);
      
      // If streaming fails due to bot detection or other issues, use yt-dlp fallback
      if (streamError.message.includes('bot') || 
          streamError.message.includes('Sign in') ||
          streamError.message.includes('unavailable') ||
          streamError.message.includes('functions') ||
          streamError.message.includes('403') ||
          streamError.message.includes('429')) {
        
        console.log('Using yt-dlp fallback for download...');
        useYtDlpFallback = true;
        
        try {
          // Use file-based download with yt-dlp
          if (format === 'mp3') {
            await YouTubeService.downloadAudioFile(url, tempVideoPath);
          } else {
            await YouTubeService.downloadVideoFile(url, tempVideoPath, quality);
          }
          downloadSuccess = true;
          console.log('Successfully downloaded using yt-dlp fallback');
          
        } catch (ytDlpError: any) {
          console.error('yt-dlp fallback also failed:', ytDlpError.message);
          throw new Error(`Download failed with both methods: ${ytDlpError.message}`);
        }
      } else {
        throw streamError;
      }
    }

    if (!downloadSuccess) {
      throw new Error('Failed to download video with all available methods');
    }

    // Verify the downloaded file exists and has content
    if (!fs.existsSync(tempVideoPath)) {
      throw new Error('Downloaded file not found');
    }

    const tempFileStats = fs.statSync(tempVideoPath);
    if (tempFileStats.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    console.log(`Downloaded file size: ${tempFileStats.size} bytes`);

    // Process the file
    let processedPath = finalPath;
    console.log(`Processing file to: ${finalPath}`);

    try {
      if (format === 'mp3') {
        processedPath = await FFmpegService.convertToMp3(tempVideoPath, finalPath);
      } else if (quality !== 'highest') {
        processedPath = await FFmpegService.convertToMp4(tempVideoPath, finalPath, quality);
      } else {
        fs.renameSync(tempVideoPath, finalPath);
      }
    } catch (processingError: any) {
      console.error('File processing failed:', processingError.message);
      throw new Error(`File processing failed: ${processingError.message}`);
    }

    const files = [{
      filename: path.basename(processedPath),
      size: FFmpegService.getFileSize(processedPath),
      format,
      quality,
      translated: false,
      downloadUrl: `/downloads/${path.basename(processedPath)}`
    }];

    // Handle translation if requested and the translateTo is not empty
    if (translateTo && translateTo.trim() !== '') {
      try {
        // Check if OpenAI API key is configured
        if (!process.env.OPENAI_API_KEY) {
          console.warn('Translation requested but OPENAI_API_KEY is not configured');
        } else {
          console.log('Starting translation process...');
          const audioPath = format === 'mp3' ? processedPath : 
            await FFmpegService.extractAudio(processedPath, 
              path.join(tempDir, `${videoId}_audio.wav`));

          const translationResult = await TranslationService.transcribeAndTranslate({
            audioPath,
            targetLanguage: translateTo
          });

          if (translationResult.subtitlePath && format === 'mp4') {
            const translatedVideoPath = path.join(publicDir, 
              `${safeTitle}_${quality}_${translateTo}.mp4`);
            
            await FFmpegService.addSubtitles(
              processedPath,
              translationResult.subtitlePath,
              translatedVideoPath
            );

            files.push({
              filename: path.basename(translatedVideoPath),
              size: FFmpegService.getFileSize(translatedVideoPath),
              format,
              quality,
              translated: true,
              downloadUrl: `/downloads/${path.basename(translatedVideoPath)}`
            });
          }
        }
      } catch (translationError) {
        console.error('Translation failed:', translationError);
        // Continue with the download even if translation fails
      }
    }

    // Cleanup temp files
    const filesToCleanup = [
      tempVideoPath,
      path.join(tempDir, `${videoId}_audio.wav`)
    ];
    
    filesToCleanup.forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          console.log(`Cleaned up temp file: ${file}`);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup file ${file}:`, cleanupError);
        }
      }
    });

    console.log(`Download completed successfully. Generated ${files.length} file(s)`);

    return NextResponse.json({ 
      success: true, 
      files,
      method: useYtDlpFallback ? 'yt-dlp' : 'ytdl-core',
      remainingRequests: RateLimiter.getRemainingRequests(clientId)
    });

  } catch (error) {
    console.error('Download error:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Download failed';
    if (error instanceof Error) {
      if (error.message.includes('YouTube blocked')) {
        errorMessage = 'YouTube is currently blocking downloads from this server. Please try again in a few minutes.';
      } else if (error.message.includes('unavailable') || error.message.includes('private')) {
        errorMessage = 'This video is unavailable or private';
      } else if (error.message.includes('age-restricted')) {
        errorMessage = 'This video is age-restricted and cannot be downloaded';
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