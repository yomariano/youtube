import { NextRequest, NextResponse } from 'next/server';
import { YouTubeService } from '@/lib/services/youtube-service';
import { FFmpegService } from '@/lib/services/ffmpeg-service';
import { isValidYouTubeUrl, extractVideoId, sanitizeFilename } from '@/lib/utils';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';

// Only import the TranslationService when needed
import { TranslationService } from '@/lib/services/translation-service';

export async function POST(request: NextRequest) {
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

    const videoInfo = await YouTubeService.getVideoInfo(url);
    const safeTitle = sanitizeFilename(videoInfo.title);
    
    const tempVideoPath = path.join(tempDir, `${videoId}_temp.${format === 'mp3' ? 'webm' : 'mp4'}`);
    const finalPath = path.join(publicDir, `${safeTitle}_${quality}.${format}`);

    // Download the video/audio
    let stream;
    if (format === 'mp3') {
      stream = await YouTubeService.downloadAudio(url);
    } else {
      stream = await YouTubeService.downloadVideo(url, quality);
    }

    // Save to temp file
    const writeStream = fs.createWriteStream(tempVideoPath);
    await pipeline(stream, writeStream);

    // Process the file
    let processedPath = finalPath;
    if (format === 'mp3') {
      processedPath = await FFmpegService.convertToMp3(tempVideoPath, finalPath);
    } else if (quality !== 'highest') {
      processedPath = await FFmpegService.convertToMp4(tempVideoPath, finalPath, quality);
    } else {
      fs.renameSync(tempVideoPath, finalPath);
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
    [tempVideoPath].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    return NextResponse.json({ 
      success: true, 
      files 
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    );
  }
} 