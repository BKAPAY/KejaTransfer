'use strict';
// NOTE: This file is OVERWRITTEN during build by:
// esbuild server/vercel-entry.ts --format=cjs --outfile=api/index.js
// If you see this message, the build did not complete successfully.
module.exports = function(req, res) {
  if (req.url && req.url.split('?')[0] === '/api/health') {
    return res.status(503).json({
      status: 'build_required',
      message: 'Server not built yet. Add DATABASE_URL and SESSION_SECRET in Vercel Settings, then Redeploy.'
    });
  }
  res.status(503).json({ message: 'Build required. Check Vercel build logs.' });
};