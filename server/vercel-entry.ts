import express from "express";

const app = express();

app.use(
  express.json({
    limit: "200mb",
    verify: function(req: any, _res: any, buf: any) {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: false }));

// Health check - no database needed
app.get("/api/health", function(_req, res) {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET");
  return res.status(missing.length ? 503 : 200).json({
    status: missing.length ? "error" : "ok",
    missing,
    hint: missing.length
      ? "Add these in Vercel: Settings -> Environment Variables -> Redeploy"
      : "Server ready"
  });
});

let initPromise: Promise<void> | null = null;
let initError: string | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = new Promise<void>(function(resolve, reject) {
      try {
        // require() inside function = lazy loading, avoids crash at startup
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require("./routes") as { registerRoutes: (app: any) => Promise<any> };
        mod.registerRoutes(app).then(function() {
          resolve();
        }).catch(function(err: Error) {
          initError = err.message;
          initPromise = null;
          reject(err);
        });
      } catch (err: any) {
        initError = (err && err.message) ? err.message : String(err);
        initPromise = null;
        reject(err);
      }
    });
  }
  return initPromise;
}

module.exports = async function handler(req: any, res: any): Promise<void> {
  // Health check bypasses initialization
  if (req.url && req.url.split("?")[0] === "/api/health") {
    return new Promise<void>(function(resolve) {
      (app as any)(req, res, function() { resolve(); });
    });
  }

  try {
    await ensureInit();
  } catch (_err) {
    if (!res.headersSent) {
      res.status(503).json({
        message: "Server initialization failed",
        error: initError,
        fix: "Add DATABASE_URL and SESSION_SECRET in Vercel Settings -> Environment Variables"
      });
    }
    return;
  }

  return new Promise<void>(function(resolve) {
    (app as any)(req, res, function() {
      if (!res.headersSent) {
        res.status(404).json({ message: "Not found" });
      }
      resolve();
    });
  });
};
