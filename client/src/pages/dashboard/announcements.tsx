import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Megaphone } from "lucide-react";

export default function Announcements() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Annonces</h1>
        <p className="text-sm text-muted-foreground">Dernières mises à jour</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Annonces système</CardTitle>
          <CardDescription className="text-xs">Actualités et mises à jour</CardDescription>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center">
            <Megaphone className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune annonce pour le moment</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
