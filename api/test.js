module.exports = function(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Vercel API routing works',
    env: {
      db: !!process.env.DATABASE_URL,
      session: !!process.env.SESSION_SECRET,
      node: process.version
    }
  });
};