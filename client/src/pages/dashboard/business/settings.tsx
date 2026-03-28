import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Loader2, Save, Building2, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { COUNTRIES } from "@shared/schema";

export default function BusinessSettings() {
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const [form, setForm] = useState({
    bankAccountHolder: "",
    bankAccountNumber: "",
    bankName: "",
    bankSwiftBic: "",
    bankBranchAddress: "",
    bankBranchName: "",
    bankBranchSortCode: "",
    bankCountry: "",
    bankCurrency: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        bankAccountHolder: user.bankAccountHolder || "",
        bankAccountNumber: user.bankAccountNumber || "",
        bankName: user.bankName || "",
        bankSwiftBic: user.bankSwiftBic || "",
        bankBranchAddress: user.bankBranchAddress || "",
        bankBranchName: user.bankBranchName || "",
        bankBranchSortCode: user.bankBranchSortCode || "",
        bankCountry: user.bankCountry || "",
        bankCurrency: user.bankCurrency || "",
      });
    }
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/business/bank-account", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Enregistré", description: "Vos informations bancaires ont été mises à jour." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const isConfigured = user?.bankAccountNumber && user?.bankName;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Configurez votre compte bancaire pour recevoir vos règlements</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5" />
            Compte bancaire
            {isConfigured && (
              <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">Titulaire du compte *</label>
                <Input
                  value={form.bankAccountHolder}
                  onChange={(e) => setForm({ ...form, bankAccountHolder: e.target.value })}
                  placeholder="Nom du titulaire"
                  required
                  data-testid="input-bank-holder"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Numéro de compte / IBAN *</label>
                <Input
                  value={form.bankAccountNumber}
                  onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                  placeholder="Numéro de compte"
                  required
                  data-testid="input-bank-number"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom de la banque *</label>
                <Input
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="Ex: BOAD, Ecobank..."
                  required
                  data-testid="input-bank-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Code SWIFT / BIC</label>
                <Input
                  value={form.bankSwiftBic}
                  onChange={(e) => setForm({ ...form, bankSwiftBic: e.target.value })}
                  placeholder="Code SWIFT"
                  data-testid="input-bank-swift"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom de l'agence</label>
                <Input
                  value={form.bankBranchName}
                  onChange={(e) => setForm({ ...form, bankBranchName: e.target.value })}
                  placeholder="Agence"
                  data-testid="input-bank-branch-name"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium">Adresse de l'agence</label>
                <Input
                  value={form.bankBranchAddress}
                  onChange={(e) => setForm({ ...form, bankBranchAddress: e.target.value })}
                  placeholder="Adresse complète de l'agence"
                  data-testid="input-bank-branch-address"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Code guichet / Sort code</label>
                <Input
                  value={form.bankBranchSortCode}
                  onChange={(e) => setForm({ ...form, bankBranchSortCode: e.target.value })}
                  placeholder="Code guichet"
                  data-testid="input-bank-sort-code"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pays de la banque</label>
                <Select
                  value={form.bankCountry}
                  onValueChange={(val) => {
                    const cd = COUNTRIES.find(c => c.code === val);
                    setForm({ ...form, bankCountry: val, bankCurrency: cd?.currency || form.bankCurrency });
                  }}
                >
                  <SelectTrigger data-testid="select-bank-country">
                    <SelectValue placeholder="Pays" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Devise du compte</label>
                <Input
                  value={form.bankCurrency}
                  onChange={(e) => setForm({ ...form, bankCurrency: e.target.value })}
                  placeholder="Ex: XOF, EUR, USD"
                  data-testid="input-bank-currency"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={saveMutation.isPending || !form.bankAccountHolder || !form.bankAccountNumber || !form.bankName}
              data-testid="button-save-bank"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
