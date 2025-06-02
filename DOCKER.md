# Docker Deployment Guide

## Overview
This YouTube Downloader application is containerized with Docker and includes both Node.js and Python dependencies for robust video downloading capabilities.

## Features
- **Multi-stage build** for optimized image size
- **FFmpeg** support for video processing
- **yt-dlp** as backup YouTube downloader
- **Health checks** for monitoring
- **Non-root user** for security
- **Standalone Next.js output** for production
- **Optional AI translation** with OpenAI integration

## Quick Start

### Local Development with Docker
```bash
# Build and run with docker-compose
docker-compose up --build

# Or build and run manually
docker build -t youtube-downloader .
docker run -p 3000:3000 youtube-downloader
```

### Coolify Deployment

1. **Repository Setup**:
   - Ensure your repository contains the `Dockerfile` in the root
   - Push all changes to your Git repository

2. **Coolify Configuration**:
   - **Build Pack**: Docker
   - **Port**: 3000
   - **Health Check URL**: `/api/health`
   - **Build Command**: `docker build -t youtube-downloader .`
   - **Start Command**: Automatically handled by Dockerfile

3. **Environment Variables**:
   ```env
   # Required
   NODE_ENV=production
   NEXT_TELEMETRY_DISABLED=1
   PORT=3000
   
   # Optional - for AI translation features
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   **Note**: The application will work without `OPENAI_API_KEY`. Translation features will be disabled if not provided.

### Other Deployment Platforms

#### Railway
```bash
# Install Railway CLI and deploy
npm install -g @railway/cli
railway deploy
```

#### Render
- Connect your GitHub repository
- Select "Docker" as the environment
- Set port to 3000
- Add optional environment variables

#### DigitalOcean App Platform
- Use the provided `Dockerfile`
- Set HTTP port to 3000
- Configure environment variables in the dashboard

## Environment Variables

### Required
- `NODE_ENV=production` - Sets the application to production mode
- `PORT=3000` - Port number for the application

### Optional
- `OPENAI_API_KEY` - For AI-powered transcription and translation features
- `NEXT_TELEMETRY_DISABLED=1` - Disables Next.js telemetry

## Build Fixes

Recent fixes include:
- **Next.js config updates**: Updated deprecated configuration options
- **Lazy OpenAI initialization**: Prevents build failures when API key is missing
- **Better error handling**: Graceful degradation when optional features are unavailable

## Image Details

### Size Optimization
- Multi-stage build reduces final image size
- Alpine Linux base for minimal footprint
- Only production dependencies included

### Security Features
- Non-root user (`nextjs:nodejs`)
- Minimal attack surface
- No unnecessary packages

### Included Dependencies
- **Node.js 20** (LTS)
- **FFmpeg** for video processing
- **Python 3** with pip
- **yt-dlp** for YouTube downloading
- **curl** for health checks

## Health Monitoring

The application includes a health check endpoint at `/api/health` that returns:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "youtube-downloader"
}
```

## Features

### Core Features (Always Available)
- YouTube video information extraction
- MP4 video download in multiple qualities
- MP3 audio extraction
- FFmpeg-powered conversion

### Optional Features (Requires API Keys)
- AI-powered transcription (requires OPENAI_API_KEY)
- Multi-language translation (requires OPENAI_API_KEY)
- Subtitle generation (requires OPENAI_API_KEY)

## Troubleshooting

### Build Issues
1. **Docker build fails**: Ensure Docker daemon is running
2. **Permission errors**: Check that scripts are executable
3. **Node.js build fails**: Verify package.json and dependencies
4. **OpenAI build error**: Fixed with lazy initialization - no longer an issue

### Runtime Issues
1. **Health check failing**: Check application logs
2. **FFmpeg not found**: Verify Alpine packages are installed
3. **Python dependencies missing**: Check install-python-deps.sh execution
4. **Translation not working**: Verify OPENAI_API_KEY is set (optional feature)

### Common Solutions
```bash
# Rebuild without cache if issues persist
docker build --no-cache -t youtube-downloader .

# Check environment variables
docker run --rm youtube-downloader printenv | grep -E "(NODE_ENV|PORT|OPENAI)"

# View container logs
docker logs <container-name>

# Follow logs in real-time
docker logs -f <container-name>
```

## Development

### Local Testing
```bash
# Test the health endpoint
curl http://localhost:3000/api/health

# Test video extraction
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Test download (without translation)
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","format":"mp3","quality":"highest"}'
```

### Rebuilding
```bash
# Force rebuild without cache
docker build --no-cache -t youtube-downloader .

# Rebuild with docker-compose
docker-compose build --no-cache
```

## Performance Tips

1. **Use .dockerignore**: Excludes unnecessary files from build context
2. **Multi-stage builds**: Separate build and runtime environments
3. **Alpine Linux**: Minimal base image for smaller size
4. **Layer caching**: Order Dockerfile commands for optimal caching
5. **Optional features**: AI features only activate when API keys are provided

## Support

For deployment issues:
- Check container logs first
- Verify environment variables
- Test health endpoint
- Ensure port 3000 is accessible
- Verify optional features are properly configured 