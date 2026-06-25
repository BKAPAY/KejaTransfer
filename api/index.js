'use strict';
// KejaTransfer - Vercel serverless function entry
// This file is committed to the repo and Vercel auto-detects it as a serverless function.
// It loads the pre-built server bundle (dist/vercel-server.cjs) created during npm run build.

let serverHandler = null;
let loadError = null;

function loadServer() {
  if (loadError) throw new Error(loadError);
  if (serverHandler) return serverHandler;
  try {
    serverHandler = require('../dist/vercel-server.cjs');
  } catch (err) {
    loadError = err.message;
    throw err;
  }
  return serverHandler;
}

module.exports = async function handler(req, res) {
  // Health check - no server bundle needed
  if (req.url && req.url.split('?')[0] === '/api/health') {
    const missing = [];
    if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
    if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
    return res.status(missing.length ? 503 : 200).json({
      status: missing.length ? 'error' : 'ok',
      missing: missing,
      hint: missing.length
        ? 'Add these in Vercel: Settings -> Environment Variables -> Redeploy'
        : 'Server ready - 695 users in DB',
      db: !!process.env.DATABASE_URL,
      session: !!process.env.SESSION_SECRET
    });
  }

  let fn;
  try {
    fn = loadServer();
  } catch (err) {
    return res.status(503).json({
      error: 'Server bundle failed to load. Check build logs in Vercel.',
      details: loadError
    });
  }

  return fn(req, res);
};