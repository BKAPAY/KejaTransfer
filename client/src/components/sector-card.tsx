import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { ACTIVITY_SECTORS, getSectorLabel, getSubSectorLabel } from "@shared/activity-sectors";

export function SectorCard() {
  const { data: user } = useQuery<User>({ queryKey: ["/api/auth/me"] });
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedSubSector, setSelectedSubSector] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const updateSectorMutation = useMutation({
    mutationFn: async (data: { kycSector: string; kycSubSector: string }) => {
      await apiRequest("POST", "/api/user/activity-sector", data);
    },
    onSuccess: () => {
      toast({
        title: "Secteur d'activité enregistré",
        description: "Votre choix est définitif. Il sera validé par un administrateur avant que vos retraits soient de nouveau possibles.",
      });
      setSelectedSector("");
      setSelectedSubSector("");
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'enregistrement du secteur",
        variant: "destructive",
      });
      setConfirmOpen(false);
    },
  });

  const sectorStatus = (user as any)?.sectorStatus as string | undefined;
  const userSector = (user as any)?.kycSector as string | undefined;
  const userSubSector = (user as any)?.kycSubSector as string | undefined;
  const sectorApproved = !!userSector && sectorStatus === "approved";
  const sectorPending = !!userSector && sectorStatus === "pending";
  const showSectorCard = user?.kycStatus === "verified" || !!userSector;
  const currentSectorObj = ACTIVITY_SECTORS.find((s) => s.code === selectedSector);

  if (!user || !showSectorCard) return null;

  const handleConfirmSave = () => {
    if (!selectedSector) return;
    updateSectorMutation.mutate({ kycSector: selectedSector, kycSubSector: selectedSubSector });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          <CardTitle className="text-lg">Secteur d'activité</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sectorApproved ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-300">Secteur d'activité validé</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium" data-testid="text-sector-label">
                {getSectorLabel(userSector!)}
              </span>
              {userSubSector && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs" data-testid="text-subsector-label">
                  {getSubSectorLabel(userSector!, userSubSector)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Votre secteur est validé. Pour toute modification, veuillez contacter le support.
            </p>
          </div>
        ) : sectorPending ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="text-sm text-yellow-700 dark:text-yellow-300">
                <p className="font-medium">Secteur en attente de validation</p>
                <p className="text-xs mt-1">
                  Votre choix est définitif et ne peut plus être modifié. Vos retraits et transferts seront possibles dès la validation par un administrateur.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium" data-testid="text-sector-label">
                {getSectorLabel(userSector!)}
              </span>
              {userSubSector && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs" data-testid="text-subsector-label">
                  {getSubSectorLabel(userSector!, userSubSector)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Une erreur ? Contactez le support pour toute correction.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="text-sm text-yellow-700 dark:text-yellow-300">
                <p className="font-medium">Secteur d'activité requis</p>
                <p className="text-xs mt-1">
                  Pour des raisons de conformité, vous devez renseigner votre secteur d'activité. Ce choix est définitif : une fois enregistré, il ne pourra plus être modifié. Après validation par un administrateur, vos retraits seront de nouveau possibles.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Secteur principal</label>
                <Select
                  value={selectedSector}
                  onValueChange={(v) => { setSelectedSector(v); setSelectedSubSector(""); }}
                >
                  <SelectTrigger data-testid="select-sector">
                    <SelectValue placeholder="Sélectionnez votre secteur" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_SECTORS.map((s) => (
                      <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentSectorObj && currentSectorObj.subSectors.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Sous-secteur (optionnel)</label>
                  <Select value={selectedSubSector} onValueChange={setSelectedSubSector}>
                    <SelectTrigger data-testid="select-subsector">
                      <SelectValue placeholder="Sélectionnez un sous-secteur" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentSectorObj.subSectors.map((ss) => (
                        <SelectItem key={ss.code} value={ss.code}>{ss.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => setConfirmOpen(true)}
              disabled={!selectedSector || updateSectorMutation.isPending}
              data-testid="button-save-sector"
            >
              {updateSectorMutation.isPending ? "Enregistrement..." : "Enregistrer le secteur d'activité"}
            </Button>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer votre secteur d'activité</AlertDialogTitle>
                  <AlertDialogDescription>
                    Vous êtes sur le point d'enregistrer
                    {selectedSector ? ` « ${getSectorLabel(selectedSector)}${selectedSubSector ? ` — ${getSubSectorLabel(selectedSector, selectedSubSector)}` : ""} »` : " votre secteur"}.
                    {" "}Ce choix est définitif et ne pourra plus être modifié. Confirmez-vous ?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-sector">Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmSave} data-testid="button-confirm-sector">
                    Confirmer définitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
