import OpenAI from 'openai';
import fs from 'fs';
import { TranslationRequest, TranslationResult } from '@/types';

export class TranslationService {
  private static _openai: OpenAI | null = null;

  private static get openai(): OpenAI {
    if (!this._openai) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      this._openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    return this._openai;
  }

  static async transcribeAndTranslate(request: TranslationRequest): Promise<TranslationResult> {
    try {
      const audioFile = fs.createReadStream(request.audioPath);
      
      // First, transcribe the audio
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: request.sourceLanguage || 'auto'
      });

      // Then translate the text if target language is different
      let translatedText = transcription.text;
      
      if (request.targetLanguage !== request.sourceLanguage) {
        const translation = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `Translate the following text to ${this.getLanguageName(request.targetLanguage)}. Maintain the timing and structure for subtitles.`
            },
            {
              role: 'user',
              content: transcription.text
            }
          ]
        });

        translatedText = translation.choices[0]?.message?.content || transcription.text;
      }

      // Generate subtitle file
      const subtitlePath = await this.generateSubtitleFile(
        translatedText,
        request.audioPath.replace(/\.[^/.]+$/, '_translated.srt')
      );

      return {
        translatedText,
        subtitlePath
      };
    } catch (error) {
      throw new Error(`Translation failed: ${error}`);
    }
  }

  private static async generateSubtitleFile(text: string, outputPath: string): Promise<string> {
    // Simple subtitle generation - in production, you'd want proper timing
    const subtitle = `1
00:00:00,000 --> 00:01:00,000
${text}`;

    fs.writeFileSync(outputPath, subtitle);
    return outputPath;
  }

  private static getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ar': 'Arabic',
      'hi': 'Hindi'
    };
    
    return languages[code] || code;
  }
} 