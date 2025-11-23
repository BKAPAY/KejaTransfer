import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Configurez votre compte</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Paramètres du compte</CardTitle>
          <CardDescription className="text-xs">Préférences BKApay</CardDescription>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center">
            <SettingsIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Bientôt disponible</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
