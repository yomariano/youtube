import { VideoInfo, VideoFormat } from '@/types';
import { extractVideoId } from '@/lib/utils';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ProxyService } from './proxy-service';

const ytdl = require('ytdl-core');

// Type declarations for ytdl-core
interface YtdlDownloadOptions {
  quality?: string | any;
  filter?: string;
  requestOptions?: {
    headers?: {
      'User-Agent'?: string;
      'Accept'?: string;
      'Accept-Language'?: string;
      'Accept-Encoding'?: string;
      'Cookie'?: string;
    };
  };
}

interface YtDlpOptions {
  format?: string;
  quality?: string;
  audioFormat?: string;
  useProxy?: boolean;
  proxyUrl?: string;
  extraArgs?: string[];
}

export class YouTubeService {
  // Enhanced user agents with better rotation
  private static USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0'
  ];

  private static getRandomUserAgent(): string {
    return this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
  }

  private static getEnhancedHeaders() {
    return {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };
  }

  static async getVideoInfo(url: string): Promise<VideoInfo> {
    console.log(`Starting download for video: ${extractVideoId(url)}, attempting to get video info with ytdl-core...`);
    
    try {
      return await this.getVideoInfoWithYtdlCore(url);
    } catch (ytdlError: any) {
      console.error('ytdl-core failed, trying yt-dlp fallback...', ytdlError.message);
      
      // Check for specific bot detection errors
      if (this.isBotDetectionError(ytdlError)) {
        console.log('Bot detection error detected, using yt-dlp with enhanced anti-bot measures...');
      }
      
      try {
        return await this.getVideoInfoWithYtDlp(url);
      } catch (ytdlpError: any) {
        console.error('yt-dlp fallback also failed:', ytdlpError.message);
        throw new Error(`Video info extraction failed with both methods. ytdl-core: ${ytdlError.message}. yt-dlp: ${ytdlpError.message}`);
      }
    }
  }

  private static async getVideoInfoWithYtdlCore(url: string): Promise<VideoInfo> {
    if (!ytdl.validateURL(url)) {
      throw new Error('Invalid YouTube URL format');
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('Could not extract video ID from URL');
    }

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
  }

  private static async getVideoInfoWithYtDlp(url: string): Promise<VideoInfo> {
    console.log('Using yt-dlp fallback for video info extraction...');
    
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('Could not extract video ID from URL');
    }

    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--no-playlist',
        '--user-agent', this.getRandomUserAgent(),
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Accept-Language:en-US,en;q=0.5',
        '--add-header', 'Accept-Encoding:gzip, deflate',
        '--add-header', 'DNT:1',
        '--add-header', 'Connection:keep-alive',
        '--add-header', 'Upgrade-Insecure-Requests:1',
        // Multiple client strategies for better success rate
        '--extractor-args', 'youtube:player_client=android,web',
        '--cookies-from-browser', 'chrome', // Use browser cookies if available
        url
      ];

      // Get proxy from ProxyService
      const proxyService = ProxyService.getInstance();
      const proxyUrl = proxyService.getNextProxy() || process.env.YOUTUBE_PROXY_URL;
      
      if (proxyUrl) {
        console.log('Using proxy for yt-dlp:', proxyUrl);
        args.push('--proxy', proxyUrl);
      }

      const ytDlp = spawn('yt-dlp', args);
      let stdout = '';
      let stderr = '';

      ytDlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytDlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytDlp.on('close', (code) => {
        if (code !== 0) {
          console.error('yt-dlp info extraction failed:', stderr);
          
          // Report proxy failure if used
          if (proxyUrl) {
            proxyService.reportFailure(proxyUrl);
          }
          
          reject(new Error(`Failed to extract video info: ${stderr}`));
          return;
        }

        try {
          // Report proxy success if used
          if (proxyUrl) {
            proxyService.reportSuccess(proxyUrl);
          }

          const info = JSON.parse(stdout);
          resolve({
            id: info.id,
            title: info.title,
            duration: info.duration,
            thumbnail: info.thumbnail || '',
            formats: info.formats.map((f: any) => ({
              format: f.format_id,
              quality: f.height ? `${f.height}p` : 'audio',
              container: f.ext,
              audioOnly: !f.height && f.acodec !== 'none'
            }))
          });
        } catch (error: any) {
          reject(new Error(`Failed to parse video info: ${error.message}`));
        }
      });
    });
  }

  static async downloadVideo(url: string, quality: string = 'highest'): Promise<NodeJS.ReadableStream> {
    console.log(`Downloading to temp file: attempting streaming download...`);
    
    try {
      return await this.downloadWithYtdlCore(url, quality, 'video');
    } catch (streamError: any) {
      console.error('Streaming download failed:', streamError.message);
      
      if (this.isBotDetectionError(streamError) || this.isParsingError(streamError)) {
        console.log('Using yt-dlp fallback for download...');
        try {
          return await this.downloadWithYtDlpStream(url, quality, 'video');
        } catch (ytDlpError: any) {
          console.error('yt-dlp fallback also failed:', ytDlpError.message);
          throw new Error(`Download failed with both methods: ${ytDlpError.message}`);
        }
      } else {
        throw streamError;
      }
    }
  }

  static async downloadAudio(url: string): Promise<NodeJS.ReadableStream> {
    try {
      return await this.downloadWithYtdlCore(url, 'highestaudio', 'audio');
    } catch (streamError: any) {
      console.error('Audio streaming download failed:', streamError.message);
      
      if (this.isBotDetectionError(streamError) || this.isParsingError(streamError)) {
        console.log('Using yt-dlp fallback for audio download...');
        try {
          return await this.downloadWithYtDlpStream(url, 'best', 'audio');
        } catch (ytDlpError: any) {
          console.error('yt-dlp audio fallback also failed:', ytDlpError.message);
          throw new Error(`Audio download failed with both methods: ${ytDlpError.message}`);
        }
      } else {
        throw streamError;
      }
    }
  }

  private static async downloadWithYtdlCore(url: string, quality: string, type: 'video' | 'audio'): Promise<NodeJS.ReadableStream> {
    if (!ytdl.validateURL(url)) {
      throw new Error('Invalid YouTube URL format');
    }

    const options: YtdlDownloadOptions = {
      quality: type === 'audio' ? 'highestaudio' : (quality === 'highest' ? 'highestvideo' : quality as any),
      filter: type === 'audio' ? 'audioonly' : 'videoandaudio',
      requestOptions: {
        headers: this.getEnhancedHeaders()
      }
    };

    return ytdl(url, options);
  }

  private static async downloadWithYtDlpStream(url: string, quality: string, type: 'video' | 'audio'): Promise<NodeJS.ReadableStream> {
    console.log('Using yt-dlp file download fallback...');
    
    // Create a temporary file for yt-dlp download
    const tempDir = path.join(process.cwd(), 'temp');
    const videoId = extractVideoId(url);
    const tempFile = path.join(tempDir, `${videoId}_ytdlp_temp.%(ext)s`);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const args = [
        '--no-playlist',
        '--user-agent', this.getRandomUserAgent(),
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Accept-Language:en-US,en;q=0.5',
        '--add-header', 'Accept-Encoding:gzip, deflate',
        '--add-header', 'DNT:1',
        '--add-header', 'Connection:keep-alive',
        '--extractor-args', 'youtube:player_client=android,web',
        '--cookies-from-browser', 'chrome',
        '--retries', '3',
        '--fragment-retries', '3',
        '--sleep-interval', '1',
        '--max-sleep-interval', '5',
        '-o', tempFile
      ];

      // Format selection based on type and quality
      if (type === 'audio') {
        args.push('-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio');
      } else {
        if (quality === 'highest') {
          args.push('-f', 'best[height<=1080]/best');
        } else {
          args.push('-f', `best[height<=${quality.replace('p', '')}]/best`);
        }
      }

      // Get proxy from ProxyService
      const proxyService = ProxyService.getInstance();
      const proxyUrl = proxyService.getNextProxy() || process.env.YOUTUBE_PROXY_URL;
      
      if (proxyUrl) {
        console.log('Using proxy for yt-dlp download:', proxyUrl);
        args.push('--proxy', proxyUrl);
      }

      args.push(url);

      const ytDlp = spawn('yt-dlp', args);
      let stderr = '';

      ytDlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytDlp.on('close', (code) => {
        if (code !== 0) {
          console.error('yt-dlp download stderr:', stderr);
          
          // Report proxy failure if used
          if (proxyUrl) {
            proxyService.reportFailure(proxyUrl);
          }
          
          reject(new Error(`yt-dlp download failed: ${stderr}`));
          return;
        }

        // Report proxy success if used
        if (proxyUrl) {
          proxyService.reportSuccess(proxyUrl);
        }

        // Find the downloaded file
        const files = fs.readdirSync(tempDir).filter(file => 
          file.startsWith(`${videoId}_ytdlp_temp`)
        );

        if (files.length === 0) {
          reject(new Error('File not created or empty'));
          return;
        }

        const downloadedFile = path.join(tempDir, files[0]);
        
        // Verify file exists and has content
        if (!fs.existsSync(downloadedFile) || fs.statSync(downloadedFile).size === 0) {
          reject(new Error('Downloaded file is empty or corrupted'));
          return;
        }

        // Create a readable stream from the downloaded file
        const stream = fs.createReadStream(downloadedFile);
        
        // Clean up the temp file after stream is consumed
        stream.on('end', () => {
          try {
            fs.unlinkSync(downloadedFile);
          } catch (e) {
            console.warn('Failed to cleanup temp file:', e);
          }
        });

        resolve(stream);
      });
    });
  }

  // Helper methods for error detection
  private static isBotDetectionError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('sign in to confirm') ||
           errorMessage.includes('bot') ||
           errorMessage.includes('captcha') ||
           errorMessage.includes('verify') ||
           errorMessage.includes('403') ||
           errorMessage.includes('blocked');
  }

  private static isParsingError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('parsing watch.html') ||
           errorMessage.includes('youtube made a change') ||
           errorMessage.includes('unable to extract') ||
           errorMessage.includes('player not found');
  }
} 