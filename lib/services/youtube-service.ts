import { VideoInfo, VideoFormat } from '@/types';
import { extractVideoId } from '@/lib/utils';
import { spawn } from 'child_process';
import path from 'path';

const ytdl = require('ytdl-core');

// Type declarations for ytdl-core
interface YtdlDownloadOptions {
  quality?: string | any;
  filter?: string;
  requestOptions?: {
    headers?: {
      'User-Agent'?: string;
      'Cookie'?: string;
      'Accept-Language'?: string;
      'Accept'?: string;
      'DNT'?: string;
      'Upgrade-Insecure-Requests'?: string;
      'Sec-Fetch-Dest'?: string;
      'Sec-Fetch-Mode'?: string;
      'Sec-Fetch-Site'?: string;
    };
  };
}

// Rate limiting to prevent being flagged as bot
class RateLimiter {
  private static lastRequest = 0;
  private static minInterval = 2000; // 2 seconds between requests

  static async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequest = Date.now();
  }
}

export class YouTubeService {
  // Enhanced user agents rotation
  private static userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];

  private static getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private static getEnhancedHeaders() {
    return {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    };
  }

  // Python yt-dlp fallback method
  private static async getVideoInfoWithYtDlp(url: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      const ytDlpProcess = spawn('python3', ['-c', `
import json
import yt_dlp
import sys

try:
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'user_agent': '${this.getRandomUserAgent()}',
        'extractor_args': {
            'youtube': {
                'skip': ['dash']
            }
        }
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info('${url}', download=False)
        
        # Extract formats
        formats = []
        for f in info.get('formats', []):
            if f.get('url') and (f.get('vcodec') != 'none' or f.get('acodec') != 'none'):
                formats.append({
                    'itag': f.get('format_id', 'unknown'),
                    'quality': f.get('format_note', f.get('quality', 'unknown')),
                    'container': f.get('ext', 'unknown'),
                    'hasAudio': f.get('acodec') != 'none',
                    'hasVideo': f.get('vcodec') != 'none',
                    'url': f.get('url', '')
                })
        
        result = {
            'id': info.get('id', ''),
            'title': info.get('title', 'Unknown Title'),
            'duration': int(info.get('duration', 0) or 0),
            'thumbnail': info.get('thumbnail', ''),
            'formats': formats
        }
        
        print(json.dumps(result))
        
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
      `]);

      let output = '';
      let errorOutput = '';

      ytDlpProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      ytDlpProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ytDlpProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp failed: ${errorOutput}`));
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result as VideoInfo);
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse yt-dlp output: ${parseError}`));
        }
      });

      ytDlpProcess.on('error', (error) => {
        reject(new Error(`yt-dlp process error: ${error.message}`));
      });
    });
  }

  static async getVideoInfo(url: string): Promise<VideoInfo> {
    // Rate limiting
    await RateLimiter.waitIfNeeded();

    try {
      // Validate URL before processing
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL format');
      }

      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error('Could not extract video ID from URL');
      }

      // Try ytdl-core with enhanced options first
      try {
        const info = await ytdl.getInfo(url, {
          requestOptions: {
            headers: this.getEnhancedHeaders()
          }
        });

        if (!info.videoDetails) {
          throw new Error('No video details found');
        }

        const formats: VideoFormat[] = info.formats
          .filter((format: any) => format.url && (format.hasVideo || format.hasAudio))
          .map((format: any) => ({
            itag: format.itag,
            quality: format.qualityLabel || format.quality || 'unknown',
            container: format.container || 'unknown',
            hasAudio: format.hasAudio || false,
            hasVideo: format.hasVideo || false,
            url: format.url || ''
          }));

        return {
          id: videoId,
          title: info.videoDetails.title || 'Unknown Title',
          duration: parseInt(info.videoDetails.lengthSeconds || '0'),
          thumbnail: info.videoDetails.thumbnails?.[0]?.url || '',
          formats: formats
        };
      } catch (ytdlError: any) {
        console.log('ytdl-core failed, trying yt-dlp fallback...', ytdlError.message);
        
        // If ytdl-core fails with bot detection, try yt-dlp
        if (ytdlError.message.includes('bot') || 
            ytdlError.message.includes('Sign in') ||
            ytdlError.message.includes('unavailable') ||
            ytdlError.message.includes('functions')) {
          
          console.log('Using yt-dlp fallback for video info extraction...');
          return await this.getVideoInfoWithYtDlp(url);
        }
        
        throw ytdlError;
      }
    } catch (error) {
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Video unavailable')) {
          throw new Error('Video is unavailable or private');
        }
        if (error.message.includes('age-gated')) {
          throw new Error('Video is age-restricted');
        }
        if (error.message.includes('region')) {
          throw new Error('Video is not available in your region');
        }
        if (error.message.includes('bot') || error.message.includes('Sign in')) {
          throw new Error('YouTube blocked the request. This usually happens due to high traffic. Please try again in a few minutes.');
        }
        throw new Error(`Failed to extract video info: ${error.message}`);
      }
      throw new Error(`Failed to extract video info: ${String(error)}`);
    }
  }

  // Python yt-dlp download fallback
  private static async downloadWithYtDlp(url: string, outputPath: string, format: 'video' | 'audio' = 'video'): Promise<string> {
    return new Promise((resolve, reject) => {
      const formatSelector = format === 'audio' ? 'best[ext=webm][abr<=128]/best[ext=m4a]/bestaudio' : 'best[height<=1080]';
      
      const ytDlpProcess = spawn('python3', ['-c', `
import yt_dlp
import sys

try:
    ydl_opts = {
        'format': '${formatSelector}',
        'outtmpl': '${outputPath}',
        'user_agent': '${this.getRandomUserAgent()}',
        'extractor_args': {
            'youtube': {
                'skip': ['dash']
            }
        }
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download(['${url}'])
        print('SUCCESS')
        
except Exception as e:
    print(f'ERROR: {str(e)}', file=sys.stderr)
    sys.exit(1)
      `]);

      let output = '';
      let errorOutput = '';

      ytDlpProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      ytDlpProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ytDlpProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp download failed: ${errorOutput}`));
          return;
        }

        if (output.includes('SUCCESS')) {
          resolve(outputPath);
        } else {
          reject(new Error(`yt-dlp download failed: ${errorOutput}`));
        }
      });

      ytDlpProcess.on('error', (error) => {
        reject(new Error(`yt-dlp process error: ${error.message}`));
      });
    });
  }

  static async downloadVideo(url: string, quality: string = 'highest'): Promise<NodeJS.ReadableStream> {
    // Rate limiting
    await RateLimiter.waitIfNeeded();

    try {
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL format');
      }

      const options: YtdlDownloadOptions = {
        quality: quality === 'highest' ? 'highestvideo' : quality as any,
        filter: 'videoandaudio',
        requestOptions: {
          headers: this.getEnhancedHeaders()
        }
      };

      return ytdl(url, options);
    } catch (error) {
      // If ytdl-core fails, we'd need to handle file-based download with yt-dlp
      // For now, we'll let the error bubble up and handle it in the route
      throw new Error(`Failed to download video: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async downloadAudio(url: string): Promise<NodeJS.ReadableStream> {
    // Rate limiting
    await RateLimiter.waitIfNeeded();

    try {
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL format');
      }

      const options: YtdlDownloadOptions = {
        quality: 'highestaudio',
        filter: 'audioonly',
        requestOptions: {
          headers: this.getEnhancedHeaders()
        }
      };

      return ytdl(url, options);
    } catch (error) {
      throw new Error(`Failed to download audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Add a method for yt-dlp file-based downloads when stream fails
  static async downloadVideoFile(url: string, outputPath: string, quality: string = 'highest'): Promise<string> {
    console.log('Using yt-dlp file download fallback...');
    return await this.downloadWithYtDlp(url, outputPath, 'video');
  }

  static async downloadAudioFile(url: string, outputPath: string): Promise<string> {
    console.log('Using yt-dlp audio download fallback...');
    return await this.downloadWithYtDlp(url, outputPath, 'audio');
  }
} 