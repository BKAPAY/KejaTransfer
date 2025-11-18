import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Megaphone } from "lucide-react";

export default function Announcements() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Annonces</h1>
        <p className="text-muted-foreground">Les dernières nouvelles et mises à jour</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Annonces système</CardTitle>
          <CardDescription>Restez informé des dernières actualités</CardDescription>
        </CardHeader>
        <CardContent className="py-12">
          <div className="text-center">
            <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Aucune annonce pour le moment</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
