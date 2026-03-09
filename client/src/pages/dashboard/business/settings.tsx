import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Clock } from "lucide-react";

export default function BusinessSettings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-muted rounded-full mb-4">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Bientôt disponible</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            La configuration des paramètres de votre compte entreprise sera disponible prochainement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
