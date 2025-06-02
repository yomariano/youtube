import { VideoInfo, VideoFormat } from '@/types';
import { extractVideoId } from '@/lib/utils';

const ytdl = require('ytdl-core');

// Type declarations for ytdl-core
interface YtdlDownloadOptions {
  quality?: string | any;
  filter?: string;
  requestOptions?: {
    headers?: {
      'User-Agent'?: string;
    };
  };
}

export class YouTubeService {
  static async getVideoInfo(url: string): Promise<VideoInfo> {
    try {
      // Validate URL before processing
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL format');
      }

      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error('Could not extract video ID from URL');
      }

      // Get video info with additional options for better reliability
      const info = await ytdl.getInfo(url, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
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
        throw new Error(`Failed to extract video info: ${error.message}`);
      }
      throw new Error(`Failed to extract video info: ${String(error)}`);
    }
  }

  static async downloadVideo(url: string, quality: string = 'highest'): Promise<NodeJS.ReadableStream> {
    try {
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL format');
      }

      const options: YtdlDownloadOptions = {
        quality: quality === 'highest' ? 'highestvideo' : quality as any,
        filter: 'videoandaudio',
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      };

      return ytdl(url, options);
    } catch (error) {
      throw new Error(`Failed to download video: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async downloadAudio(url: string): Promise<NodeJS.ReadableStream> {
    try {
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL format');
      }

      const options: YtdlDownloadOptions = {
        quality: 'highestaudio',
        filter: 'audioonly',
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      };

      return ytdl(url, options);
    } catch (error) {
      throw new Error(`Failed to download audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 