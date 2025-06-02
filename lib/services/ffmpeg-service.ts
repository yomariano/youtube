import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

export class FFmpegService {
  static async convertToMp3(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate(320)
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', (error: Error) => {
          reject(new Error(`FFmpeg conversion failed: ${error.message}`));
        })
        .save(outputPath);
    });
  }

  static async convertToMp4(inputPath: string, outputPath: string, quality: string = '720p'): Promise<string> {
    return new Promise((resolve, reject) => {
      let videoSize = '1280x720';
      let videoBitrate = '2000k';

      switch (quality) {
        case '1080p':
          videoSize = '1920x1080';
          videoBitrate = '4000k';
          break;
        case '480p':
          videoSize = '854x480';
          videoBitrate = '1000k';
          break;
        case '360p':
          videoSize = '640x360';
          videoBitrate = '600k';
          break;
      }

      ffmpeg(inputPath)
        .toFormat('mp4')
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate(videoBitrate)
        .size(videoSize)
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', (error: Error) => {
          reject(new Error(`FFmpeg conversion failed: ${error.message}`));
        })
        .save(outputPath);
    });
  }

  static async extractAudio(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioCodec('pcm_s16le')
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', (error: Error) => {
          reject(new Error(`Audio extraction failed: ${error.message}`));
        })
        .save(outputPath);
    });
  }

  static async addSubtitles(videoPath: string, subtitlePath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .input(subtitlePath)
        .outputOptions([
          '-c:v copy',
          '-c:a copy',
          '-c:s mov_text',
          '-map 0:v:0',
          '-map 0:a:0',
          '-map 1:s:0'
        ])
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', (error: Error) => {
          reject(new Error(`Subtitle addition failed: ${error.message}`));
        })
        .save(outputPath);
    });
  }

  static getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (error, metadata) => {
        if (error) {
          reject(error);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  static getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
} 