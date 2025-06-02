'use client';

import { useState } from 'react';
import { DownloadRequest, DownloadResult } from '@/types';
import { isValidYouTubeUrl } from '@/lib/utils';
import { StatusDisplay } from './status-display';
import { ProgressBar } from './progress-bar';
import { DownloadLinks } from './download-links';

export function YouTubeDownloader() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'mp4' | 'mp3'>('mp4');
  const [quality, setQuality] = useState('highest');
  const [translateTo, setTranslateTo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'processing' | 'success' | 'error' } | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidYouTubeUrl(url)) {
      setStatus({ message: 'Invalid YouTube URL', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setDownloadResult(null);
    setProgress(5);
    
    try {
      const request: DownloadRequest = {
        url,
        format,
        quality,
        translateTo: translateTo || undefined
      };

      // Extract video info
      setStatus({ message: 'Extracting video information...', type: 'processing' });
      setProgress(25);
      
      // Download and process
      setStatus({ message: 'Downloading...', type: 'processing' });
      setProgress(60);
      
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const result = await response.json();
      
      // Only show translation status if translation was requested
      if (translateTo && translateTo.trim() !== '') {
        setStatus({ message: 'Translating...', type: 'processing' });
        setProgress(90);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        // Skip directly to 100% if no translation
        setProgress(100);
      }

      setProgress(100);
      setStatus({ message: 'Complete!', type: 'success' });
      setDownloadResult(result);
      
    } catch (error) {
      setStatus({ 
        message: error instanceof Error ? error.message : 'Download failed', 
        type: 'error' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="glassmorphism relative w-full max-w-lg p-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-2 gradient-text tracking-tight">
          YouTube Downloader
        </h1>
        <p className="text-white/50 text-sm font-medium">
          Extract, convert, and translate
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL here..."
            className="input-glass text-base"
            required
            disabled={isProcessing}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'mp4' | 'mp3')}
              className="select-glass text-sm font-medium"
              disabled={isProcessing}
            >
              <option value="mp4">MP4</option>
              <option value="mp3">MP3</option>
            </select>
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative">
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="select-glass text-sm font-medium"
              disabled={isProcessing}
            >
              <option value="highest">Best</option>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
              <option value="360p">360p</option>
            </select>
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="relative">
          <select
            value={translateTo}
            onChange={(e) => setTranslateTo(e.target.value)}
            className="input-glass text-base"
            disabled={isProcessing}
          >
            <option value="">No translation</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="ru">Russian</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
            <option value="ar">Arabic</option>
            <option value="hi">Hindi</option>
          </select>
          <div className="absolute right-6 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <button
          type="submit"
          disabled={isProcessing}
          className="btn-primary text-base relative overflow-hidden"
        >
          {isProcessing ? 'Processing...' : 'Download'}
          {!isProcessing && (
            <div className="shimmer absolute inset-0 opacity-0 hover:opacity-100 transition-opacity" />
          )}
        </button>
      </form>

      <StatusDisplay status={status} />
      <ProgressBar progress={progress} show={isProcessing} />
      <DownloadLinks result={downloadResult} />
    </div>
  );
} 