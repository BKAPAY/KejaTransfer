import express, { type Request, type Response } from "express";

// Validate required env vars before loading anything
const missingVars: string[] = [];
if (!process.env.DATABASE_URL) missingVars.push("DATABASE_URL");
if (!process.env.SESSION_SECRET) missingVars.push("SESSION_SECRET");

if (missingVars.length > 0) {
  console.error("[KejaTransfer] Missing required environment variables:", missingVars.join(", "));
  console.error("[KejaTransfer] Add them in Vercel: Settings → Environment Variables");
}

import { registerRoutes } from "../server/routes";

const app = express();

app.use(
  express.json({
    limit: "200mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// Health check (no DB needed)
app.get("/api/health", (_req, res) => {
  const ok = !!process.env.DATABASE_URL && !!process.env.SESSION_SECRET;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "missing env vars",
    missing: missingVars,
  });
});

// Initialize routes once (cached across warm invocations)
let initPromise: Promise<void> | null = null;

function init(): Promise<void> {
  if (!initPromise) {
    initPromise = registerRoutes(app)
      .then(() => {
        console.log("[KejaTransfer] Routes initialized successfully");
      })
      .catch((err) => {
        console.error("[KejaTransfer] Failed to initialize routes:", err.message || err);
        initPromise = null; // allow retry on next request
        throw err;
      });
  }
  return initPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    await init();
  } catch (err: any) {
    console.error("[KejaTransfer] Initialization error:", err.message);
    return res.status(500).json({
      message: "Server initialization failed. Check DATABASE_URL and SESSION_SECRET in Vercel environment variables.",
      error: err.message,
    });
  }

  return new Promise<void>((resolve) => {
    (app as any)(req, res, () => {
      res.status(404).json({ message: "Not found" });
      resolve();
    });
  });
}
