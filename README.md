# AI TikTok Video API (Render + Docker)

This project provides a Render-deployable Docker service with a public HTTP API for generating vertical TikTok-style MP4 videos using FFmpeg. It downloads a remote image and audio file, creates a 1080x1920 Ken Burns style video, uploads the result to Cloudinary, and returns the final video URL.

## Endpoints

- GET /health
  - Response: { "ok": true }
- GET /
  - Serves public/index.html
- POST /create-video
  - Request JSON:
    {
      "image_url": "https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg",
      "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      "duration": 8,
      "resolution": "1080x1920",
      "fps": 30
    }
  - Response JSON:
    {
      "ok": true,
      "video_url": "https://res.cloudinary.com/demo/video/upload/final.mp4",
      "meta": {
        "duration": 8,
        "resolution": "1080x1920",
        "fps": 30
      }
    }

## Environment Variables

Set these in your local .env file or on Render:

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

## Local Run

1) Install dependencies

   npm install

2) Create a .env file with Cloudinary credentials

   CLOUDINARY_CLOUD_NAME=your_cloud
   CLOUDINARY_API_KEY=your_key
   CLOUDINARY_API_SECRET=your_secret

3) Start the server

   npm run start

The API will listen on http://localhost:3000

## Example Curl

Health check:

curl http://localhost:3000/health

Create video:

curl -X POST http://localhost:3000/create-video \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg",
    "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "duration": 8,
    "resolution": "1080x1920",
    "fps": 30
  }'

## Render Deployment (Docker Web Service)

1) Push this repo to GitHub.
2) In Render, create a new Web Service and choose Docker as the runtime.
3) Set the Root Directory to the repository root.
4) Add the environment variables:
   - CLOUDINARY_CLOUD_NAME
   - CLOUDINARY_API_KEY
   - CLOUDINARY_API_SECRET
5) Deploy.

After deploy, your base URL will be:

https://<your-service>.onrender.com

### n8n HTTP Request Node

POST https://<your-service>.onrender.com/create-video

Map JSON body fields: image_url, audio_url, duration, resolution, fps

## Docker Build/Run (local)

1) Build the image:

   docker build -t ai-tiktok-video-api .

2) Run the container:

   docker run --rm -p 3000:3000 \
     -e CLOUDINARY_CLOUD_NAME=your_cloud \
     -e CLOUDINARY_API_KEY=your_key \
     -e CLOUDINARY_API_SECRET=your_secret \
     ai-tiktok-video-api

## Checklist

- Local test: npm run start
- Docker build/run test
- Render deploy test
