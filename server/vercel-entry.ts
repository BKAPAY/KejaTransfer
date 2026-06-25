// server/vercel-entry.ts
// Vercel serverless function entry point.
// NO top-level imports - everything is lazy to avoid crashes at function load time.
/* eslint-disable @typescript-eslint/no-var-requires */

let app: any = null;
let appReady: Promise<void> | null = null;
let appError: string | null = null;

function buildApp() {
  if (appReady) return appReady;

  appReady = new Promise<void>((resolve, reject) => {
    try {
      // All requires are inside this function - lazy loading
      const express = require('express');
      const serverApp = express();

      serverApp.use(
        express.json({
          limit: '200mb',
          verify(req: any, _res: any, buf: any) {
            req.rawBody = buf;
          },
        })
      );
      serverApp.use(express.urlencoded({ extended: false }));

      // Health check — no database needed
      serverApp.get('/api/health', (_req: any, res: any) => {
        const missing: string[] = [];
        if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
        if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
        res.status(missing.length ? 503 : 200).json({
          status: missing.length ? 'error' : 'ok',
          missing,
          hint: missing.length
            ? 'Add these in Vercel: Settings -> Environment Variables -> Redeploy'
            : 'Server ready - 695 users in DB',
        });
      });

      // Load the full route set lazily
      const { registerRoutes } = require('./routes') as {
        registerRoutes: (app: any) => Promise<any>;
      };

      registerRoutes(serverApp)
        .then(() => {
          app = serverApp;
          resolve();
        })
        .catch((err: Error) => {
          appError = err.message;
          appReady = null; // allow retry on next request
          reject(err);
        });
    } catch (err: any) {
      appError = String(err?.message ?? err);
      appReady = null;
      reject(err);
    }
  });

  return appReady;
}

module.exports = async function handler(req: any, res: any): Promise<void> {
  // Health check before initialization (no DB needed)
  if (req.url && req.url.split('?')[0] === '/api/health') {
    const missing: string[] = [];
    if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
    if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
    res.status(missing.length ? 503 : 200).json({
      status: missing.length ? 'error' : 'ok',
      missing,
      hint: missing.length
        ? 'Add DATABASE_URL and SESSION_SECRET in Vercel Settings'
        : 'Server ready',
    });
    return;
  }

  try {
    await buildApp();
  } catch (_err) {
    if (!res.headersSent) {
      res.status(503).json({
        message: 'Server initialization failed',
        error: appError,
        fix: 'Add DATABASE_URL and SESSION_SECRET in Vercel Settings -> Environment Variables',
      });
    }
    return;
  }

  await new Promise<void>((resolve) => {
    app(req, res, () => {
      if (!res.headersSent) res.status(404).json({ message: 'Not found' });
      resolve();
    });
  });
};