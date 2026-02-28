import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const SOCIAL_BOTS_UA = [
  "whatsapp",
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "telegrambot",
  "linkedinbot",
  "googlebot",
  "slackbot-linkexpanding",
  "slackbot",
  "discordbot",
  "applebot",
  "bingbot",
  "duckduckbot",
  "pinterestbot",
  "line-poker",
  "viber",
  "kakaotalk",
  "skype",
  "iframely",
  "embedly",
  "vkshare",
  "outbrain",
  "developers.google",
  "preview",
  "scrapy",
  "python-requests",
  "curl/",
  "wget/",
];

function isSocialBot(ua: string): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return SOCIAL_BOTS_UA.some((bot) => lower.includes(bot));
}

function truncateDescription(text: string | null | undefined, maxLen = 160): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 3) + "...";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildOgHtml(opts: {
  title: string;
  description: string;
  imageUrl?: string;
  pageUrl: string;
  amount?: number;
  currency?: string;
}): string {
  const { title, description, imageUrl, pageUrl } = opts;
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const imageMeta = imageUrl
    ? `
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />`
    : `<meta name="twitter:card" content="summary" />`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:site_name" content="BKApay" />
  ${imageMeta}
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}" />
</head>
<body>
  <p>Redirection en cours... <a href="${escapeHtml(pageUrl)}">Cliquez ici</a></p>
</body>
</html>`;
}

async function extractFirstBase64(imageUrls: string[] | null | undefined, legacyImageUrl: string | null | undefined): Promise<{ mimeType: string; buffer: Buffer } | null> {
  const urls = (imageUrls && imageUrls.length > 0) ? imageUrls : (legacyImageUrl ? [legacyImageUrl] : []);
  for (const url of urls) {
    if (!url) continue;
    const b64Match = url.match(/^data:(image\/[a-zA-Z0-9+\-.]+);base64,(.+)$/);
    if (b64Match) {
      const mimeType = b64Match[1];
      const buffer = Buffer.from(b64Match[2], "base64");
      return { mimeType, buffer };
    }
  }
  return null;
}

async function extractVideoThumbnail(videoUrl: string): Promise<Buffer | null> {
  try {
    const ffmpegPath = "ffmpeg";
    let videoFilePath: string;

    if (videoUrl.startsWith("/uploads/videos/")) {
      videoFilePath = path.join(process.cwd(), videoUrl);
    } else {
      return null;
    }

    if (!fs.existsSync(videoFilePath)) return null;

    const tmpOut = path.join(os.tmpdir(), `og-thumb-${Date.now()}.jpg`);

    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpegPath,
        ["-ss", "0", "-i", videoFilePath, "-vframes", "1", "-vf", "scale=1200:630:force_original_aspect_ratio=decrease,pad=1200:630:(ow-iw)/2:(oh-ih)/2", "-y", tmpOut],
        { timeout: 10000 },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    if (!fs.existsSync(tmpOut)) return null;
    const buf = fs.readFileSync(tmpOut);
    fs.unlinkSync(tmpOut);
    return buf;
  } catch {
    return null;
  }
}

// Endpoint: serve first image from payment link as a proper image file
export function registerOgRoutes(app: import("express").Express) {
  // Serve the first product image for OG tags
  app.get("/api/og-image/pay/:token", async (req: Request, res: Response) => {
    try {
      const link = await storage.getPaymentLinkByToken(req.params.token);
      if (!link) return res.status(404).end();

      const imgData = await extractFirstBase64(link.imageUrls, link.imageUrl);
      if (imgData) {
        res.set("Cache-Control", "public, max-age=86400");
        res.set("Content-Type", imgData.mimeType);
        return res.send(imgData.buffer);
      }

      return res.status(404).end();
    } catch {
      res.status(500).end();
    }
  });

  // Serve video thumbnail for OG tags
  app.get("/api/og-thumb/pay/:token", async (req: Request, res: Response) => {
    try {
      const link = await storage.getPaymentLinkByToken(req.params.token);
      if (!link || !link.videoUrl) return res.status(404).end();

      const thumb = await extractVideoThumbnail(link.videoUrl);
      if (!thumb) return res.status(404).end();

      res.set("Cache-Control", "public, max-age=86400");
      res.set("Content-Type", "image/jpeg");
      return res.send(thumb);
    } catch {
      res.status(500).end();
    }
  });

  // Bot detection middleware for payment links
  app.get("/pay/:token", async (req: Request, res: Response, next: NextFunction) => {
    const ua = req.headers["user-agent"] || "";
    if (!isSocialBot(ua)) {
      return next();
    }

    try {
      const link = await storage.getPaymentLinkByToken(req.params.token);
      if (!link) return next();

      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
      const pageUrl = `${baseUrl}/pay/${req.params.token}`;

      let ogImageUrl: string | undefined;
      const hasImages = (link.imageUrls && link.imageUrls.length > 0) || !!link.imageUrl;
      const hasVideo = !!link.videoUrl;

      if (hasImages) {
        ogImageUrl = `${baseUrl}/api/og-image/pay/${req.params.token}`;
      } else if (hasVideo) {
        ogImageUrl = `${baseUrl}/api/og-thumb/pay/${req.params.token}`;
      }

      const desc = truncateDescription(link.description, 160);

      const html = buildOgHtml({
        title: link.productName,
        description: desc,
        imageUrl: ogImageUrl,
        pageUrl,
        amount: link.amount,
      });

      res.set("Cache-Control", "public, max-age=60");
      return res.status(200).set("Content-Type", "text/html; charset=utf-8").end(html);
    } catch {
      return next();
    }
  });
}
