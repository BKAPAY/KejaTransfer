import { z } from "zod";
import fs from "fs";
import path from "path";

// Sur Vercel, on utilise /tmp pour les fichiers temporaires
// Sur local, on utilise ./uploads
const UPLOAD_BASE_DIR = process.env.NODE_ENV === "production" 
  ? "/tmp/bkapay-uploads" 
  : "./uploads";

const UPLOAD_DIRS = {
  videos: path.join(UPLOAD_BASE_DIR, "videos"),
  images: path.join(UPLOAD_BASE_DIR, "images"),
};

// Crée les répertoires s'ils n'existent pas
export function ensureUploadDirs() {
  try {
    for (const [key, dir] of Object.entries(UPLOAD_DIRS)) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created ${key} directory: ${dir}`);
      }
    }
  } catch (error) {
    console.error("⚠️ Error creating upload directories:", error);
    // Continue anyway - uploads might still work with streaming
  }
}

export function getUploadDir(type: "videos" | "images"): string {
  return UPLOAD_DIRS[type];
}

export function getUploadPath(type: "videos" | "images", filename: string): string {
  return path.join(UPLOAD_DIRS[type], filename);
}
