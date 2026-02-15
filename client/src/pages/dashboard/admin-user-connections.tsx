import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Monitor, Smartphone, Laptop, Globe, MapPin, Wifi, X } from "lucide-react";
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
    if (!deviceType) return <Monitor className="w-4 h-4" />;
    if (deviceType === "Mobile") return <Smartphone className="w-4 h-4" />;
    if (deviceType === "Tablette") return <Smartphone className="w-4 h-4" />;
    return <Laptop className="w-4 h-4" />;
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id} data-testid={`login-log-${log.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getDeviceIcon(log.deviceType)}
                    <span className="font-medium text-sm">{log.deviceType || "Inconnu"}</span>
                    {log.deviceModel && (
                      <Badge variant="default">{log.deviceModel}</Badge>
                    )}
                    <Badge variant="secondary">{log.browser || "Inconnu"}</Badge>
                    <Badge variant="outline">{log.os || "Inconnu"}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">IP:</span>
                    <span className="font-mono text-xs">{log.ipAddress || "Inconnu"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">FAI:</span>
                    <span>{log.isp || "Inconnu"}</span>
                  </div>

                  <div className="flex items-center gap-2 sm:col-span-2 p-2 rounded bg-muted/50">
                    <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-muted-foreground">Réseau:</span>
                    <span>{[log.city, log.region, log.country].filter(v => v && v !== "Inconnu").join(", ") || "Inconnu"}</span>
                  </div>

                  {log.gpsLatitude && log.gpsLongitude && (
                    <div className="flex items-center gap-2 sm:col-span-2 p-2 rounded bg-green-50 dark:bg-green-950/30">
                      <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-muted-foreground">GPS exact:</span>
                      <a
                        href={`https://www.google.com/maps?q=${log.gpsLatitude},${log.gpsLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline text-xs"
                        data-testid={`link-gps-${log.id}`}
                      >
                        {Number(log.gpsLatitude).toFixed(6)}, {Number(log.gpsLongitude).toFixed(6)}
                      </a>
                      {log.gpsAccuracy && (
                        <span className="text-xs text-muted-foreground">(précision: {Number(log.gpsAccuracy).toFixed(0)}m)</span>
                      )}
                    </div>
                  )}
                </div>

                {(log.photoBase64 || log.photoBackBase64) && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Photos de connexion:</p>
                    <div className="flex gap-3 flex-wrap">
                      {log.photoBase64 && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Frontale</p>
                          <img
                            src={log.photoBase64}
                            alt="Photo frontale"
                            className="w-28 h-28 object-cover rounded-md border cursor-pointer"
                            onClick={() => setLightboxImg(log.photoBase64)}
                            data-testid={`img-login-photo-front-${log.id}`}
                          />
                        </div>
                      )}
                      {log.photoBackBase64 && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Arrière</p>
                          <img
                            src={log.photoBackBase64}
                            alt="Photo arrière"
                            className="w-28 h-28 object-cover rounded-md border cursor-pointer"
                            onClick={() => setLightboxImg(log.photoBackBase64)}
                            data-testid={`img-login-photo-back-${log.id}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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
