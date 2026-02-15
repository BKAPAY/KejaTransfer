import { Request } from "express";
import { storage } from "../storage";

function parseUserAgent(ua: string): { deviceType: string; browser: string; os: string; deviceModel: string } {
  let deviceType = "Desktop";
  let browser = "Inconnu";
  let os = "Inconnu";
  let deviceModel = "";

  if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
    deviceType = /ipad|tablet/i.test(ua) ? "Tablette" : "Mobile";
  }

  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";
  else if (/firefox\//i.test(ua)) browser = "Firefox";

  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  const androidMatch = ua.match(/;\s*([^;)]+)\s*Build\//i);
  if (androidMatch) {
    deviceModel = androidMatch[1].trim();
  } else if (/iPhone/i.test(ua)) {
    deviceModel = "iPhone";
  } else if (/iPad/i.test(ua)) {
    deviceModel = "iPad";
  } else if (/Macintosh/i.test(ua)) {
    deviceModel = "Mac";
  } else if (/Windows NT/i.test(ua)) {
    deviceModel = "PC Windows";
  }

  return { deviceType, browser, os, deviceModel };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = (typeof forwarded === "string" ? forwarded : forwarded[0]).split(",")[0].trim();
    return ip;
  }
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return typeof realIp === "string" ? realIp : realIp[0];
  }
  return req.socket.remoteAddress || "Inconnu";
}

async function getGeoFromIp(ip: string): Promise<{ city: string; region: string; country: string; isp: string }> {
  const defaults = { city: "Inconnu", region: "Inconnu", country: "Inconnu", isp: "Inconnu" };
  
  if (!ip || ip === "Inconnu" || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return defaults;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country,isp&lang=fr`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      return {
        city: data.city || defaults.city,
        region: data.regionName || defaults.region,
        country: data.country || defaults.country,
        isp: data.isp || defaults.isp,
      };
    }
  } catch (e) {
  }
  
  return defaults;
}

export async function recordLoginLog(req: Request, userId: string): Promise<void> {
  try {
    const userAgent = req.headers["user-agent"] || "";
    const ip = getClientIp(req);
    const { deviceType, browser, os, deviceModel } = parseUserAgent(userAgent);
    const geo = await getGeoFromIp(ip);

    await storage.createLoginLog({
      userId,
      ipAddress: ip,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      isp: geo.isp,
      deviceType,
      deviceModel: deviceModel || undefined,
      browser,
      os,
      userAgent,
    });
  } catch (error) {
    console.error("[LoginTracker] Error recording login log:", error);
  }
}
