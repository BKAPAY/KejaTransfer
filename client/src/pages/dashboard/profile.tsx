import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { User as UserIcon, Mail, Calendar } from "lucide-react";

export default function Profile() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Profil</h1>
        <p className="text-muted-foreground">Gérez les informations de votre compte</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations personnelles</CardTitle>
          <CardDescription>Vos informations de compte KEJAtransfer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : user ? (
            <>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserIcon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold" data-testid="user-name">
                    {user.firstName} {user.lastName}
                  </h2>
                  <p className="text-sm text-muted-foreground" data-testid="user-email">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Prénom</label>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span>{user.firstName}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Nom</label>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span>{user.lastName}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{user.email}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Membre depuis</label>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>
                      {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Solde du compte</label>
                  <div className="text-3xl font-bold text-primary" data-testid="user-balance">
                    {formatAmount(user.balance)}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
