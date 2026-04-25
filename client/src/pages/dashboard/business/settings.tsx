import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Building2, CheckCircle2, Pencil, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { COUNTRIES } from "@shared/schema";
import { CountryFlag } from "@/components/country-flag";

export default function BusinessSettings() {
  const { toast } = useToast();
  const [editingBank, setEditingBank] = useState(false);
  const [editingMomo, setEditingMomo] = useState(false);

  const { data: user, isLoading } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const { data: withdrawalCountries = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/countries-operators/withdrawals"],
  });

  const [bankForm, setBankForm] = useState({
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

  const [momoForm, setMomoForm] = useState({
    momoCountry: "",
    momoOperator: "",
    momoPhone: "",
  });

  useEffect(() => {
    if (user) {
      setBankForm({
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
      setMomoForm({
        momoCountry: user.momoCountry || "",
        momoOperator: user.momoOperator || "",
        momoPhone: user.momoPhone || "",
      });
    }
  }, [user]);

  const saveBankMutation = useMutation({
    mutationFn: async (data: typeof bankForm) => {
      const res = await apiRequest("POST", "/api/business/bank-account", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setEditingBank(false);
      toast({ title: "Enregistré", description: "Vos informations bancaires ont été mises à jour." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const saveMomoMutation = useMutation({
    mutationFn: async (data: typeof momoForm) => {
      const res = await apiRequest("POST", "/api/business/momo-account", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setEditingMomo(false);
      toast({ title: "Enregistré", description: "Votre compte Mobile Money a été mis à jour." });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const isBankConfigured = user?.bankAccountNumber && user?.bankName;
  const isMomoConfigured = user?.momoPhone && user?.momoOperator && user?.momoCountry;

  const activeCountries = Object.keys(withdrawalCountries).filter(code => withdrawalCountries[code].length > 0);
  const momoOperators = momoForm.momoCountry ? (withdrawalCountries[momoForm.momoCountry] || []) : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const bankCountryData = COUNTRIES.find(c => c.code === user?.bankCountry);
  const momoCountryData = COUNTRIES.find(c => c.code === user?.momoCountry);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Configurez vos modes de réception pour vos règlements</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5" />
            Compte bancaire
            {isBankConfigured && !editingBank && (
              <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isBankConfigured && !editingBank ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Titulaire</p>
                  <p className="text-sm font-medium" data-testid="text-bank-holder">{user.bankAccountHolder}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Numéro de compte / IBAN</p>
                  <p className="text-sm font-medium" data-testid="text-bank-number">{user.bankAccountNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Banque</p>
                  <p className="text-sm font-medium" data-testid="text-bank-name">{user.bankName}</p>
                </div>
                {user.bankSwiftBic && (
                  <div>
                    <p className="text-xs text-muted-foreground">SWIFT / BIC</p>
                    <p className="text-sm font-medium">{user.bankSwiftBic}</p>
                  </div>
                )}
                {user.bankBranchName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Agence</p>
                    <p className="text-sm font-medium">{user.bankBranchName}</p>
                  </div>
                )}
                {user.bankBranchSortCode && (
                  <div>
                    <p className="text-xs text-muted-foreground">Code guichet</p>
                    <p className="text-sm font-medium">{user.bankBranchSortCode}</p>
                  </div>
                )}
                {user.bankBranchAddress && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Adresse agence</p>
                    <p className="text-sm font-medium">{user.bankBranchAddress}</p>
                  </div>
                )}
                {bankCountryData && (
                  <div>
                    <p className="text-xs text-muted-foreground">Pays</p>
                    <p className="text-sm font-medium flex items-center gap-1"><CountryFlag code={bankCountryData.code} size="xs" /> {bankCountryData.name}</p>
                  </div>
                )}
                {user.bankCurrency && (
                  <div>
                    <p className="text-xs text-muted-foreground">Devise</p>
                    <p className="text-sm font-medium">{user.bankCurrency}</p>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => setEditingBank(true)}
                data-testid="button-edit-bank"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); saveBankMutation.mutate(bankForm); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Titulaire du compte *</label>
                  <Input
                    value={bankForm.bankAccountHolder}
                    onChange={(e) => setBankForm({ ...bankForm, bankAccountHolder: e.target.value })}
                    placeholder="Nom du titulaire"
                    required
                    data-testid="input-bank-holder"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Numéro de compte / IBAN *</label>
                  <Input
                    value={bankForm.bankAccountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, bankAccountNumber: e.target.value })}
                    placeholder="Numéro de compte"
                    required
                    data-testid="input-bank-number"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom de la banque *</label>
                  <Input
                    value={bankForm.bankName}
                    onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                    placeholder="Ex: BOAD, Ecobank..."
                    required
                    data-testid="input-bank-name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code SWIFT / BIC</label>
                  <Input
                    value={bankForm.bankSwiftBic}
                    onChange={(e) => setBankForm({ ...bankForm, bankSwiftBic: e.target.value })}
                    placeholder="Code SWIFT"
                    data-testid="input-bank-swift"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom de l'agence</label>
                  <Input
                    value={bankForm.bankBranchName}
                    onChange={(e) => setBankForm({ ...bankForm, bankBranchName: e.target.value })}
                    placeholder="Agence"
                    data-testid="input-bank-branch-name"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Adresse de l'agence</label>
                  <Input
                    value={bankForm.bankBranchAddress}
                    onChange={(e) => setBankForm({ ...bankForm, bankBranchAddress: e.target.value })}
                    placeholder="Adresse complète de l'agence"
                    data-testid="input-bank-branch-address"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code guichet / Sort code</label>
                  <Input
                    value={bankForm.bankBranchSortCode}
                    onChange={(e) => setBankForm({ ...bankForm, bankBranchSortCode: e.target.value })}
                    placeholder="Code guichet"
                    data-testid="input-bank-sort-code"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pays de la banque</label>
                  <Select
                    value={bankForm.bankCountry}
                    onValueChange={(val) => {
                      const cd = COUNTRIES.find(c => c.code === val);
                      setBankForm({ ...bankForm, bankCountry: val, bankCurrency: cd?.currency || bankForm.bankCurrency });
                    }}
                  >
                    <SelectTrigger data-testid="select-bank-country">
                      <SelectValue placeholder="Pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          <span className="flex items-center gap-1"><CountryFlag code={c.code} size="xs" /> {c.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Devise du compte</label>
                  <Input
                    value={bankForm.bankCurrency}
                    onChange={(e) => setBankForm({ ...bankForm, bankCurrency: e.target.value })}
                    placeholder="Ex: XOF, EUR, USD"
                    data-testid="input-bank-currency"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {isBankConfigured && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingBank(false)}
                    data-testid="button-cancel-edit-bank"
                  >
                    Annuler
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={saveBankMutation.isPending || !bankForm.bankAccountHolder || !bankForm.bankAccountNumber || !bankForm.bankName}
                  data-testid="button-save-bank"
                >
                  {saveBankMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="w-5 h-5" />
            Mobile Money
            {isMomoConfigured && !editingMomo && (
              <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isMomoConfigured && !editingMomo ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Pays</p>
                  <p className="text-sm font-medium flex items-center gap-1" data-testid="text-momo-country">
                    {momoCountryData ? <><CountryFlag code={momoCountryData.code} size="xs" /> {momoCountryData.name}</> : user.momoCountry}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Opérateur</p>
                  <p className="text-sm font-medium" data-testid="text-momo-operator">{user.momoOperator}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Numéro</p>
                  <p className="text-sm font-medium" data-testid="text-momo-phone">{user.momoPhone}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setEditingMomo(true)}
                data-testid="button-edit-momo"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); saveMomoMutation.mutate(momoForm); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pays *</label>
                  <Select
                    value={momoForm.momoCountry}
                    onValueChange={(val) => setMomoForm({ ...momoForm, momoCountry: val, momoOperator: "" })}
                  >
                    <SelectTrigger data-testid="select-momo-country">
                      <SelectValue placeholder="Choisir un pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCountries.map((code) => {
                        const cd = COUNTRIES.find(c => c.code === code);
                        return (
                          <SelectItem key={code} value={code}>
                            <span className="flex items-center gap-1"><CountryFlag code={code} size="xs" /> {cd?.name ?? code}</span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Opérateur *</label>
                  <Select
                    value={momoForm.momoOperator}
                    onValueChange={(val) => setMomoForm({ ...momoForm, momoOperator: val })}
                    disabled={!momoForm.momoCountry || momoOperators.length === 0}
                  >
                    <SelectTrigger data-testid="select-momo-operator">
                      <SelectValue placeholder={momoForm.momoCountry ? "Choisir un opérateur" : "Sélectionnez un pays"} />
                    </SelectTrigger>
                    <SelectContent>
                      {momoOperators.map((op) => (
                        <SelectItem key={op} value={op}>{op}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">Numéro Mobile Money *</label>
                  <Input
                    value={momoForm.momoPhone}
                    onChange={(e) => setMomoForm({ ...momoForm, momoPhone: e.target.value })}
                    placeholder="Ex: 0712345678"
                    required
                    data-testid="input-momo-phone"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {isMomoConfigured && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingMomo(false)}
                    data-testid="button-cancel-edit-momo"
                  >
                    Annuler
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={saveMomoMutation.isPending || !momoForm.momoCountry || !momoForm.momoOperator || !momoForm.momoPhone}
                  data-testid="button-save-momo"
                >
                  {saveMomoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
