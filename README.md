# YouTube Downloader

A modern, full-stack YouTube downloader built with Next.js 15, featuring real-time video processing, format conversion, and AI-powered translation.

## Features

- **Video Extraction**: Download YouTube videos in various qualities (360p to 1080p)
- **Format Conversion**: Convert to MP4 or MP3 using FFmpeg
- **AI Translation**: Transcribe and translate content using OpenAI Whisper
- **Real-time Progress**: Live progress tracking for all operations
- **Modern UI**: Beautiful glassmorphism design with Tailwind CSS
- **Server-side Processing**: All processing happens on the server for security

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Video Processing**: yt-dlp, FFmpeg
- **AI Translation**: OpenAI Whisper API
- **Deployment**: Vercel-ready

## Prerequisites

Before running this application, ensure you have:

- Node.js 18+ installed
- FFmpeg installed on your system
- yt-dlp installed (`pip install yt-dlp`)
- OpenAI API key (for translation features)

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [FFmpeg official website](https://ffmpeg.org/download.html)

## Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd youtube-downloader
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your OpenAI API key:
```env
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Create required directories:**
```bash
mkdir -p temp public/downloads
```

## Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Enter a YouTube URL** in the input field
2. **Choose format** (MP4 for video, MP3 for audio)
3. **Select quality** (Best, 1080p, 720p, 480p, 360p)
4. **Optional**: Choose a language for AI translation
5. **Click Download** and watch the progress
6. **Download** your files when processing is complete

## API Endpoints

### `POST /api/extract`
Extract video information from a YouTube URL.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "video_id",
    "title": "Video Title",
    "duration": 120,
    "thumbnail": "thumbnail_url",
    "formats": [...]
  }
}
```

### `POST /api/download`
Download and process a YouTube video.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=...",
  "format": "mp4",
  "quality": "720p",
  "translateTo": "es"
}
```

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "filename": "video_720p.mp4",
      "size": 50000000,
      "format": "mp4",
      "quality": "720p",
      "translated": false,
      "downloadUrl": "/downloads/video_720p.mp4"
    }
  ]
}
```

## Project Structure

```
youtube-downloader/
├── app/
│   ├── api/
│   │   ├── extract/
│   │   │   └── route.ts
│   │   └── download/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── download-links.tsx
│   ├── progress-bar.tsx
│   ├── status-display.tsx
│   └── youtube-downloader.tsx
├── lib/
│   ├── services/
│   │   ├── ffmpeg-service.ts
│   │   ├── translation-service.ts
│   │   └── youtube-service.ts
│   └── utils.ts
├── types/
│   └── index.ts
├── ProjectDocs/
│   └── Build_Notes/
│       └── build-youtube-downloader_phase-1_setup.md
├── public/
│   └── downloads/
├── temp/
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

## Deployment

### Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

**Note**: For production deployment, you'll need a server that supports FFmpeg and yt-dlp. Consider using a VPS or dedicated server instead of serverless platforms for heavy video processing.

### VPS/Dedicated Server

1. Install Node.js, FFmpeg, and yt-dlp on your server
2. Clone the repository
3. Install dependencies: `npm install`
4. Build the application: `npm run build`
5. Start with PM2: `pm2 start npm --name "youtube-downloader" -- start`

## Security Considerations

- **Rate Limiting**: Implement rate limiting for API endpoints
- **File Cleanup**: Automatic cleanup of temporary files
- **Input Validation**: Strict validation of YouTube URLs
- **Resource Management**: Monitor disk space and CPU usage

## Known Limitations

- Large files may timeout on serverless platforms
- Translation accuracy depends on audio quality
- Some YouTube videos may be geo-restricted
- Rate limits apply for OpenAI API usage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the issues page
- Review the build notes in `ProjectDocs/Build_Notes/`
- Ensure all dependencies are properly installed 