// Test script for YouTube downloader API
const videoId = 'cYLK0qGmImg'; // Video ID that had parsing issues
const url = `https://www.youtube.com/watch?v=${videoId}`;

async function testDownload() {
  console.log(`Testing download for video: ${url}`);
  
  try {
    const response = await fetch('http://localhost:3004/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        format: 'mp4',
        quality: 'highest'
      }),
    });
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.error('Download failed:', data.error);
    } else {
      console.log('Download successful!');
      console.log('Method used:', data.method);
      console.log('Files:', data.files);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testDownload(); 