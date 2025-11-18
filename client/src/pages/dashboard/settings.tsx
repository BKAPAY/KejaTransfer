import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Paramètres</h1>
        <p className="text-muted-foreground">Configurez votre compte et vos préférences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paramètres du compte</CardTitle>
          <CardDescription>Gérez les paramètres de votre compte KEJAtransfer</CardDescription>
        </CardHeader>
        <CardContent className="py-12">
          <div className="text-center">
            <SettingsIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Les paramètres seront bientôt disponibles</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
