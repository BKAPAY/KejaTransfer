import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { bootstrapDatabase } from "./db-bootstrap";
import { startPaymentPolling, stopPaymentPolling } from "./payment-polling";
import { startSalaryScheduler, stopSalaryScheduler } from "./salary-scheduler";
import { storage } from "./storage";

const app = express();

let bootstrapComplete = false;
let bootstrapError: string | null = null;

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: "200mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/") && !req.path.startsWith("/dashboard")) {
    res.setHeader("X-Robots-Tag", "index, follow");
  }
  next();
});

// ── Custom domain middleware ──────────────────────────────────────────────────
// Si le hostname ne correspond pas au domaine BKApay principal, on cherche
// une boutique avec ce custom_domain et on redirige vers /shop/:slug
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hostname = req.hostname;
    // Ignorer les domaines internes (localhost, replit.dev, bkapay.com, sous-domaines)
    const isInternalDomain = (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".replit.dev") ||
      hostname.endsWith(".replit.app") ||
      hostname.endsWith(".kirk.replit.dev") ||
      hostname === "bkapay.com" ||
      hostname.endsWith(".bkapay.com")
    );
    if (isInternalDomain) return next();

    // On cherche uniquement pour les requêtes non-API et non-assets
    if (req.path.startsWith("/api/") || req.path.startsWith("/assets/") || req.path.startsWith("/uploads/")) {
      return next();
    }

    const shop = await storage.getShopByCustomDomain(hostname);
    if (shop) {
      // Si déjà sur /shop/:slug on continue normalement
      if (req.path.startsWith(`/shop/${shop.slug}`)) return next();
      // Sinon rediriger vers la boutique
      return res.redirect(302, `/shop/${shop.slug}${req.path === "/" ? "" : req.path}`);
    }
    next();
  } catch {
    next();
  }
});

app.get("/healthz", (_req, res) => {
  if (bootstrapError) {
    return res.status(503).json({ status: "error", message: bootstrapError });
  }
  if (!bootstrapComplete) {
    return res.status(503).json({ status: "starting", message: "Database bootstrap in progress" });
  }
  return res.status(200).json({ status: "healthy" });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    (async () => {
      try {
        await bootstrapDatabase();
        bootstrapComplete = true;
        log("✅ Bootstrap complete, starting payment polling");
        startPaymentPolling();
        startSalaryScheduler();
        log("✅ Salary scheduler started");
      } catch (error) {
        bootstrapError = String(error);
        log("❌ Database bootstrap failed: " + bootstrapError);
        setTimeout(() => process.exit(1), 5000);
      }
    })();
  });

  process.on("SIGTERM", () => {
    log("Received SIGTERM, stopping payment polling...");
    stopPaymentPolling();
    stopSalaryScheduler();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    log("Received SIGINT, stopping payment polling...");
    stopPaymentPolling();
    stopSalaryScheduler();
    process.exit(0);
  });
})();
