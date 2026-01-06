const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');
const { validateInput } = require('./src/utils/validateInput');
const { downloadToFile } = require('./src/utils/downloadToFile');
const { safeTmpPath } = require('./src/utils/safeTmpPath');
const { HttpError } = require('./src/utils/httpError');
const { generateVideo } = require('./src/ffmpeg/generateVideo');

if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (err) {
    console.warn('dotenv not available, skipping .env loading');
  }
}

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  const id = crypto.randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/public', express.static(path.join(__dirname, 'public')));

const REQUIRED_ENV = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

function getMissingEnv() {
  return REQUIRED_ENV.filter((key) => !process.env[key]);
}

function getFileExt(url, fallback) {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname);
    return ext || fallback;
  } catch (err) {
    return fallback;
  }
}

async function cleanupFiles(paths) {
  await Promise.all(
    paths.map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.warn(`Failed to remove temp file ${filePath}: ${err.message}`);
        }
      }
    })
  );
}

app.post('/create-video', async (req, res, next) => {
  const requestId = req.id;
  const tmpFiles = [];

  try {
    const input = validateInput(req.body);
    const missing = getMissingEnv();
    if (missing.length > 0) {
      throw new HttpError(500, 'INTERNAL_ERROR', 'Missing Cloudinary configuration', {
        missing
      });
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });

    const imagePath = safeTmpPath('image', getFileExt(input.image_url, '.img'));
    const audioPath = safeTmpPath('audio', getFileExt(input.audio_url, '.aud'));
    const outputPath = safeTmpPath('video', '.mp4');
    tmpFiles.push(imagePath, audioPath, outputPath);

    await downloadToFile(input.image_url, imagePath, {
      timeoutMs: 30000,
      maxBytes: 25 * 1024 * 1024,
      requestId
    });

    await downloadToFile(input.audio_url, audioPath, {
      timeoutMs: 30000,
      maxBytes: 50 * 1024 * 1024,
      requestId
    });

    await generateVideo({
      imagePath,
      audioPath,
      outputPath,
      duration: input.duration,
      resolution: input.resolution,
      fps: input.fps
    });

    const uploadResult = await cloudinary.uploader.upload(outputPath, {
      resource_type: 'video',
      folder: 'ai-tiktok-videos'
    });

    res.status(200).json({
      ok: true,
      video_url: uploadResult.secure_url,
      meta: {
        duration: input.duration,
        resolution: input.resolution,
        fps: input.fps
      }
    });
  } catch (err) {
    next(err);
  } finally {
    await cleanupFiles(tmpFiles);
  }
});

app.use((err, req, res, next) => {
  const requestId = req.id || 'unknown';

  if (err instanceof HttpError) {
    console.error(`[${requestId}] ${err.code}: ${err.message}`);
    const payload = {
      ok: false,
      error: {
        code: err.code,
        message: err.message
      }
    };

    if (err.details) {
      payload.error.details = err.details;
    }

    return res.status(err.status).json(payload);
  }

  console.error(`[${requestId}] INTERNAL_ERROR`, err);
  return res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error'
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on 0.0.0.0:${port}`);
});
