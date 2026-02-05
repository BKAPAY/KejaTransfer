import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Video, X, Scissors, Play, Pause, Check, Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface VideoUploaderProps {
  videoUrl: string | null;
  onVideoChange: (videoUrl: string | null) => void;
  maxDuration?: number;
}

export function VideoUploader({ videoUrl, onVideoChange, maxDuration = 30 }: VideoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [originalVideo, setOriginalVideo] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(maxDuration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      alert("Veuillez sélectionner un fichier vidéo");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const videoDataUrl = await readFileAsDataURL(file, (progress) => {
        setUploadProgress(progress);
      });
      
      setUploadProgress(100);
      const duration = await getVideoDuration(videoDataUrl);

      if (duration > maxDuration) {
        setOriginalVideo(videoDataUrl);
        setVideoDuration(duration);
        setTrimStart(0);
        setTrimEnd(Math.min(maxDuration, duration));
        setShowTrimmer(true);
      } else {
        onVideoChange(videoDataUrl);
      }
    } catch (error) {
      console.error("Erreur lors du chargement de la vidéo:", error);
      alert("Erreur lors du chargement de la vidéo");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const readFileAsDataURL = (file: File, onProgress?: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      };
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getVideoDuration = (videoSrc: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
      video.onerror = reject;
      video.src = videoSrc;
    });
  };

  const handleTrimRangeChange = useCallback((values: number[]) => {
    const [start, end] = values;
    const duration = end - start;
    
    if (duration <= maxDuration) {
      setTrimStart(start);
      setTrimEnd(end);
      if (previewVideoRef.current) {
        previewVideoRef.current.currentTime = start;
      }
    }
  }, [maxDuration]);

  const togglePlayPause = () => {
    if (previewVideoRef.current) {
      if (isPlaying) {
        previewVideoRef.current.pause();
      } else {
        previewVideoRef.current.currentTime = trimStart;
        previewVideoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime >= trimEnd) {
        video.pause();
        video.currentTime = trimStart;
        setIsPlaying(false);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [trimStart, trimEnd]);

  const trimVideo = async () => {
    if (!originalVideo) return;

    setIsTrimming(true);

    try {
      const trimmedVideo = await trimVideoToRange(originalVideo, trimStart, trimEnd);
      onVideoChange(trimmedVideo);
      setShowTrimmer(false);
      setOriginalVideo(null);
    } catch (error) {
      console.error("Erreur lors du découpage:", error);
      alert("Erreur lors du découpage de la vidéo");
    } finally {
      setIsTrimming(false);
    }
  };

  const trimVideoToRange = async (videoSrc: string, start: number, end: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.src = videoSrc;
      video.muted = true;
      video.preload = "auto";

      video.onloadeddata = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Cannot get canvas context"));
          return;
        }

        const stream = canvas.captureStream(30);
        const audioContext = new AudioContext();
        
        try {
          const response = await fetch(videoSrc);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          
          destination.stream.getAudioTracks().forEach(track => {
            stream.addTrack(track);
          });
          
          source.start(0, start, end - start);
        } catch {
          console.log("No audio track or audio processing failed, continuing without audio");
        }

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp9",
          videoBitsPerSecond: 5000000
        });

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        };

        video.currentTime = start;
        await new Promise<void>((res) => {
          video.onseeked = () => res();
        });

        mediaRecorder.start();

        const drawFrame = () => {
          if (video.currentTime >= end || video.ended) {
            mediaRecorder.stop();
            return;
          }
          ctx.drawImage(video, 0, 0);
          requestAnimationFrame(drawFrame);
        };

        video.play();
        drawFrame();

        video.ontimeupdate = () => {
          if (video.currentTime >= end) {
            video.pause();
            mediaRecorder.stop();
          }
        };
      };

      video.onerror = reject;
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const removeVideo = () => {
    onVideoChange(null);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-video-upload"
      />

      {videoUrl ? (
        <div className="relative rounded-lg overflow-hidden border bg-muted">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-auto max-h-48 object-contain"
            controls
            data-testid="video-preview"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={removeVideo}
            data-testid="btn-remove-video"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : isUploading ? (
        <div className="w-full p-4 border rounded-lg bg-muted/50 space-y-3">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-primary animate-pulse" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span>Téléchargement en cours...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Veuillez patienter pendant le chargement de la vidéo
          </p>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-24 flex flex-col gap-2 border-dashed"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          data-testid="btn-add-video"
        >
          <Video className="h-6 w-6" />
          <span className="text-sm">Ajouter une vidéo (max {maxDuration}s)</span>
        </Button>
      )}

      <Dialog open={showTrimmer} onOpenChange={setShowTrimmer}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Découper la vidéo
            </DialogTitle>
            <DialogDescription>
              Votre vidéo dure {formatTime(videoDuration)}. Sélectionnez un segment de {maxDuration} secondes maximum.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {originalVideo && (
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={previewVideoRef}
                  src={originalVideo}
                  className="w-full h-auto max-h-64 object-contain"
                  data-testid="video-trimmer-preview"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-3 left-3"
                  onClick={togglePlayPause}
                  data-testid="btn-play-pause"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Début: {formatTime(trimStart)}</span>
                <span>Durée: {formatTime(trimEnd - trimStart)}</span>
                <span>Fin: {formatTime(trimEnd)}</span>
              </div>
              
              <Slider
                value={[trimStart, trimEnd]}
                min={0}
                max={videoDuration}
                step={0.1}
                onValueChange={handleTrimRangeChange}
                className="py-4"
                data-testid="slider-trim-range"
              />
              
              <p className="text-xs text-center text-muted-foreground">
                Déplacez les curseurs pour sélectionner le segment à conserver
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowTrimmer(false);
                  setOriginalVideo(null);
                }}
                disabled={isTrimming}
                data-testid="btn-cancel-trim"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={trimVideo}
                disabled={isTrimming || trimEnd - trimStart > maxDuration}
                data-testid="btn-confirm-trim"
              >
                {isTrimming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Découpage...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Valider le découpage
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}