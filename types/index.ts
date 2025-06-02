export interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  formats: VideoFormat[];
}

export interface VideoFormat {
  itag: number;
  quality: string;
  container: string;
  hasAudio: boolean;
  hasVideo: boolean;
  url: string;
}

export interface DownloadRequest {
  url: string;
  format: 'mp4' | 'mp3';
  quality: string;
  translateTo?: string;
}

export interface DownloadProgress {
  stage: 'extracting' | 'downloading' | 'converting' | 'translating' | 'complete';
  percentage: number;
  message: string;
}

export interface DownloadResult {
  success: boolean;
  files: DownloadFile[];
  error?: string;
}

export interface DownloadFile {
  filename: string;
  size: number;
  format: string;
  quality: string;
  translated?: boolean;
  downloadUrl: string;
}

export interface TranslationRequest {
  audioPath: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface TranslationResult {
  translatedText: string;
  subtitlePath?: string;
  audioPath?: string;
} 