import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { MerchantLink } from "@shared/schema";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { SoftPayQRCode } from "@/components/softpay-qrcode";

const merchantPaymentSchema = z.object({
  amount: z.number().min(100, "Le montant minimum est de 100 XOF"),
  customerName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  customerEmail: z.string().email("Email invalide"),
  customerPhone: z.string().min(8, "Numéro de téléphone invalide"),
  country: z.string().min(1, "Veuillez sélectionner un pays"),
  operator: z.string().min(1, "Veuillez sélectionner un opérateur"),
});

type MerchantPaymentFormData = z.infer<typeof merchantPaymentSchema>;

export default function Merchant() {
  const [, params] = useRoute("/merchant/:token");
  const token = params?.token;
  const [, setLocation] = useLocation();
  const [selectedCountry, setSelectedCountry] = useState("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<any>(null);

  const { data: merchantLink, isLoading } = useQuery<MerchantLink>({
    queryKey: ["/api/merchant-links/public", token],
    enabled: !!token,
  });

  const form = useForm<MerchantPaymentFormData>({
    resolver: zodResolver(merchantPaymentSchema),
    defaultValues: {
      amount: undefined as any,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      country: "",
      operator: "",
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: MerchantPaymentFormData) => {
      const res = await apiRequest("POST", `/api/merchant-payments/process/${token}`, data);
      const jsonData = await res.json();
      console.log("Merchant payment response:", jsonData);
      return jsonData;
    },
    onSuccess: (data: any) => {
      console.log("Merchant payment success, data:", data);
      if (data?.redirectUrl) {
        // Show QR code instead of redirect
        setQRCodeData({
          url: data.redirectUrl,
          paydunyaToken: data.paydunyaToken,
          operator: form.getValues("operator"),
          amount: form.getValues("amount"),
        });
        setShowQRCode(true);
      } else {
        console.error("No redirectUrl in response:", data);
      }
    },
    onError: (error: any) => {
      console.error("Merchant payment mutation error:", error);
    },
  });

  const onSubmit = (data: MerchantPaymentFormData) => {
    paymentMutation.mutate(data);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const availableOperators = selectedCountry
    ? OPERATORS[selectedCountry as keyof typeof OPERATORS] || []
    : [];

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-lg">
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Chargement...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!merchantLink || !merchantLink.isActive) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-lg">
          <CardContent className="py-12">
            <div className="text-center">
              <img src={logoImage} alt="BKApay" className="h-16 w-auto mx-auto mb-4" />
              <p className="text-muted-foreground">Lien marchand introuvable ou inactif</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showQRCode && qrCodeData) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2 p-4 sm:p-6">
            <div className="flex justify-center mb-2">
              <img src={logoImage} alt="BKApay" className="h-8 sm:h-10 w-auto" />
            </div>
            <CardTitle>Paiement Sécurisé</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <SoftPayQRCode
              paymentUrl={qrCodeData.url}
              amount={qrCodeData.amount}
              operator={qrCodeData.operator || ""}
              status="pending"
            />
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => setShowQRCode(false)}
                variant="outline"
                className="flex-1"
                data-testid="button-back-to-form"
              >
                Retour
              </Button>
              <Button
                onClick={() => window.open(qrCodeData.url, "_blank")}
                className="flex-1"
                data-testid="button-open-payment"
              >
                Ouvrir le paiement
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
      <Card className="w-full max-w-xs sm:max-w-sm md:max-w-lg">
        <CardHeader className="text-center space-y-2 sm:space-y-3 lg:space-y-4 p-3 sm:p-4 lg:p-6">
          <div className="flex justify-center mb-1 sm:mb-2">
            <img src={logoImage} alt="BKApay" className="h-8 sm:h-10 lg:h-12 w-auto" />
          </div>
          <div>
            <CardTitle className="text-sm sm:text-lg lg:text-2xl mb-1 sm:mb-2">Envoyer de l'argent</CardTitle>
            <CardDescription className="text-xs sm:text-sm lg:text-base">
              À {merchantLink.merchantName}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 sm:space-y-3 lg:space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Montant (XOF)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="10000"
                        data-testid="input-amount"
                        value={field.value || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? undefined : Number(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    {field.value && field.value > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatAmount(field.value)}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jean Dupont"
                        data-testid="input-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="jean.dupont@example.com"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedCountry(value);
                        form.setValue("operator", "");
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-country">
                          <SelectValue placeholder="Sélectionnez votre pays" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.flag} {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de téléphone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="77 123 45 67"
                        data-testid="input-phone"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="operator"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opérateur</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedCountry}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-operator">
                          <SelectValue placeholder="Sélectionnez votre opérateur" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableOperators.map((operator) => (
                          <SelectItem key={operator.code} value={operator.code}>
                            {operator.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={paymentMutation.isPending || !form.watch("amount")}
                data-testid="button-pay"
              >
                {paymentMutation.isPending
                  ? "Traitement..."
                  : form.watch("amount") > 0
                  ? `Payer ${formatAmount(form.watch("amount"))}`
                  : "Payer"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>Paiement sécurisé par BKApay</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
