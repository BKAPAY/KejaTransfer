import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { ALLOWED_REGISTRATION_COUNTRIES } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { User as UserIcon, Mail, Calendar, Lock, MapPin } from "lucide-react";
import { useState } from "react";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const COUNTRY_INFO: Record<string, { name: string; flag: string }> = {
  BJ: { name: "Bénin", flag: "🇧🇯" },
  TG: { name: "Togo", flag: "🇹🇬" },
  CI: { name: "Côte d'Ivoire", flag: "🇨🇮" },
  BF: { name: "Burkina Faso", flag: "🇧🇫" },
  SN: { name: "Sénégal", flag: "🇸🇳" },
};

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "🇧🇯 Bénin",
  TG: "🇹🇬 Togo",
  CI: "🇨🇮 Côte d'Ivoire",
  BF: "🇧🇫 Burkina Faso",
  SN: "🇸🇳 Sénégal",
};

export default function Profile() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const { toast } = useToast();

  const updateCountryMutation = useMutation({
    mutationFn: async (country: string) => {
      const res = await apiRequest("PATCH", "/api/user/country", { country });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pays enregistré",
        description: "Votre pays a été enregistré avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'enregistrement du pays",
        variant: "destructive",
      });
    },
  });

  const handleSaveCountry = () => {
    if (selectedCountry) {
      updateCountryMutation.mutate(selectedCountry);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Profil</h1>
        <p className="text-sm text-muted-foreground">Gérez votre compte</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Informations personnelles</CardTitle>
          <CardDescription className="text-xs">Vos informations BKApay</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          ) : user ? (
            <>
              <div className="flex items-center gap-3 pb-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-6 h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold" data-testid="user-name">
                    {user.firstName} {user.lastName}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate" data-testid="user-email">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Prénom</label>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                    {user.firstName}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nom</label>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                    {user.lastName}
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm truncate">
                    {user.email}
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Pays
                  </label>
                  {user.country ? (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm" data-testid="text-user-country">
                      {COUNTRY_NAMES[user.country] || user.country}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-2">
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                          Veuillez sélectionner votre pays pour continuer à utiliser BKApay
                        </p>
                      </div>
                      <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                        <SelectTrigger data-testid="select-user-country">
                          <SelectValue placeholder="Sélectionnez votre pays" />
                        </SelectTrigger>
                        <SelectContent>
                          {ALLOWED_REGISTRATION_COUNTRIES.map((code) => (
                            <SelectItem key={code} value={code}>
                              {COUNTRY_NAMES[code]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={handleSaveCountry}
                        disabled={!selectedCountry || updateCountryMutation.isPending}
                        className="w-full"
                        data-testid="button-save-country"
                      >
                        {updateCountryMutation.isPending ? "Enregistrement..." : "Enregistrer mon pays"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Membre depuis</label>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                    {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                  onClick={() => setChangePasswordOpen(true)}
                  data-testid="button-change-password"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Modifier le mot de passe
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <ChangePasswordDialog 
        open={changePasswordOpen} 
        onOpenChange={setChangePasswordOpen} 
      />
    </div>
  );
}
