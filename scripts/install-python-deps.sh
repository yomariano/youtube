#!/bin/bash

# Install Python dependencies for YouTube Downloader
# This script provides fallback options and additional video processing capabilities

set -e

echo "Installing Python dependencies..."

# Upgrade pip with system packages override for Alpine
python3 -m pip install --upgrade pip --break-system-packages

# Install yt-dlp as a robust YouTube downloader fallback
echo "Installing yt-dlp..."
python3 -m pip install yt-dlp --break-system-packages

# Install additional video processing libraries
echo "Installing additional video processing tools..."
python3 -m pip install \
    requests \
    beautifulsoup4 \
    lxml \
    pillow \
    --break-system-packages

echo "Python dependencies installed successfully!"

# Verify installations
echo "Verifying installations..."
python3 -c "import yt_dlp; print('yt-dlp version:', yt_dlp.version.__version__)" || echo "yt-dlp import test failed"
python3 -c "import requests; print('requests version:', requests.__version__)" || echo "requests import test failed"

echo "All Python dependencies are ready!" 