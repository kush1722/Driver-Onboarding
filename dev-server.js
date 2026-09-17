import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import ocrHandler from './api/ocr.js';
import faceMatchHandler from './api/face-match.js';
import createAdminHandler from './api/create-admin.js';
import checkAdminHandler from './api/check-admin.js';
import sendEmailHandler from './api/send-email.js';
import deleteAppHandler from './api/delete-application.js';
import fs from 'fs';

// Manually parse .env to bypass any dotenvx caching
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      process.env[key] = val;
      if (['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'].includes(key)) {
        console.log(`Loaded key from .env manually: ${key}`);
      }
    }
  });
} catch (err) {
  console.log("No .env found or read error");
}


const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large base64 payloads

// Wrap Vercel handlers for Express
const createVercelHandler = (vercelFn) => async (req, res) => {
  try {
    await vercelFn(req, res);
  } catch (err) {
    console.error("Vercel handler error:", err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

app.post('/api/ocr', async (req, res) => {
  if (req.body.debugError) {
    console.log("=== FRONTEND ERROR ===", req.body.debugError);
    return res.status(200).json({ ok: true });
  }
  return createVercelHandler(ocrHandler)(req, res);
});
app.post('/api/face-match', createVercelHandler(faceMatchHandler));
app.post('/api/create-admin', createVercelHandler(createAdminHandler));
app.get('/api/check-admin', createVercelHandler(checkAdminHandler));
app.post('/api/send-email', createVercelHandler(sendEmailHandler));
app.post('/api/delete-application', createVercelHandler(deleteAppHandler));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Local Dev Server running on http://localhost:${PORT}`);
});
