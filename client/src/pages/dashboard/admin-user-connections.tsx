import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Monitor, Smartphone, Laptop, Globe, MapPin, Wifi, X, Calendar } from "lucide-react";
import type { LoginLog, User } from "@shared/schema";
import { useState } from "react";

export default function AdminUserConnections() {
  const params = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const userId = params.userId;
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const { data: user } = useQuery<User>({
    queryKey: [`/api/admin/user/${userId}/profile`],
    enabled: !!userId,
  });

  const { data: logs, isLoading } = useQuery<LoginLog[]>({
    queryKey: [`/api/admin/login-logs/${userId}`],
    enabled: !!userId,
  });

  const getDeviceIcon = (deviceType: string | null) => {
    if (!deviceType) return <Monitor className="w-4 h-4 shrink-0" />;
    if (deviceType === "Mobile" || deviceType === "Tablette") return <Smartphone className="w-4 h-4 shrink-0" />;
    return <Laptop className="w-4 h-4 shrink-0" />;
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/dashboard/management")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Monitor className="w-5 h-5" />
            Historique des connexions
          </h1>
          {user && (
            <p className="text-sm text-muted-foreground">
              {user.firstName} {user.lastName} - {user.email}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log) => {
            const networkLoc = [log.city, log.region, log.country].filter(v => v && v !== "Inconnu").join(", ");
            const hasGps = log.gpsLatitude && log.gpsLongitude;
            const hasPhotos = !!log.photoBase64;

            return (
              <Card key={log.id} data-testid={`login-log-${log.id}`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getDeviceIcon(log.deviceType)}
                        <span className="text-sm font-medium">{log.deviceType || "Inconnu"}</span>
                        {log.deviceModel && <Badge variant="default">{log.deviceModel}</Badge>}
                        <Badge variant="secondary">{log.browser || "?"}</Badge>
                        <Badge variant="outline">{log.os || "?"}</Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Calendar className="w-3 h-3" />
                        {formatDate(log.createdAt)}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 text-xs">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">IP:</span>
                          <span className="font-mono">{log.ipAddress || "?"}</span>
                          {log.isp && log.isp !== "Inconnu" && (
                            <>
                              <span className="text-muted-foreground">-</span>
                              <span>{log.isp}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Wifi className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="text-muted-foreground">Réseau:</span>
                          <span>{networkLoc || "Inconnu"}</span>
                        </div>

                        {hasGps && (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-green-500 shrink-0" />
                              <span className="text-muted-foreground">GPS:</span>
                              {log.gpsAddress ? (
                                <span className="font-medium">{log.gpsAddress}</span>
                              ) : (
                                <a
                                  href={`https://www.google.com/maps?q=${log.gpsLatitude},${log.gpsLongitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline"
                                  data-testid={`link-gps-${log.id}`}
                                >
                                  {Number(log.gpsLatitude).toFixed(6)}, {Number(log.gpsLongitude).toFixed(6)}
                                </a>
                              )}
                              {log.gpsAccuracy && (
                                <span className="text-muted-foreground">({Number(log.gpsAccuracy).toFixed(0)}m)</span>
                              )}
                            </div>
                            {log.gpsAddress && (
                              <div className="flex items-center gap-1.5 ml-[18px]">
                                <a
                                  href={`https://www.google.com/maps?q=${log.gpsLatitude},${log.gpsLongitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline"
                                  data-testid={`link-gps-${log.id}`}
                                >
                                  Voir sur Google Maps
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {hasPhotos && (
                        <div className="shrink-0">
                          <img
                            src={log.photoBase64!}
                            alt="Photo"
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded border cursor-pointer"
                            onClick={() => setLightboxImg(log.photoBase64)}
                            data-testid={`img-login-photo-${log.id}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Monitor className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-muted-foreground">Aucune connexion enregistrée</p>
        </div>
      )}

      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
          data-testid="lightbox-overlay"
        >
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 text-white"
            onClick={() => setLightboxImg(null)}
            data-testid="button-close-lightbox"
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={lightboxImg}
            alt="Photo agrandie"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            data-testid="img-lightbox"
          />
        </div>
      )}
    </div>
  );
}
