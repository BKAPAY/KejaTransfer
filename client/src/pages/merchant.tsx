import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { MerchantLink } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { detectPhoneCountryAndOperator } from "@shared/phone-utils";

const merchantPaymentSchema = z.object({
  amount: z.number().min(100, "Le montant minimum est de 100 XOF"),
  customerName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  customerEmail: z.string().email("Email invalide"),
  customerPhone: z.string().min(8, "Numéro de téléphone invalide"),
});

type MerchantPaymentFormData = z.infer<typeof merchantPaymentSchema>;

export default function Merchant() {
  const [, params] = useRoute("/merchant/:token");
  const token = params?.token;
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [ussdCode, setUssdCode] = useState("");

  const { data: merchantLink, isLoading: linkLoading } = useQuery<MerchantLink>({
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
    },
  });

  const handlePhoneChange = (e: any) => {
    const phone = e.target.value;
    form.setValue("customerPhone", phone);

    if (phone.length >= 9) {
      const detected = detectPhoneCountryAndOperator(phone);
      if (detected.isValid) {
        setPhoneError("");
      } else if (phone.length > 10) {
        setPhoneError("Numéro de téléphone invalide pour cette région");
      }
    }
  };

  const paymentMutation = useMutation({
    mutationFn: async (data: MerchantPaymentFormData) => {
      const detected = detectPhoneCountryAndOperator(data.customerPhone);
      if (!detected.isValid) {
        throw new Error("Impossible de détecter le pays/opérateur du numéro");
      }

      const res = await apiRequest("POST", `/api/merchant-payments/process/${token}`, {
        ...data,
        country: detected.country,
        operator: detected.operator,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.ussdCode) {
        setUssdCode(data.ussdCode);
      }
    },
    onError: (error: any) => {
      console.error("Merchant payment mutation error:", error);
      setIsLoading(false);
    },
  });

  const onSubmit = (data: MerchantPaymentFormData) => {
    const detected = detectPhoneCountryAndOperator(data.customerPhone);
    if (!detected.isValid) {
      setPhoneError("Numéro invalide - impossible à détecter automatiquement");
      return;
    }
    setIsLoading(true);
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

  if (linkLoading) {
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

  if (ussdCode) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2 p-4 sm:p-6">
            <div className="flex justify-center mb-2">
              <img src={logoImage} alt="BKApay" className="h-8 sm:h-10 w-auto" />
            </div>
            <CardTitle>Code USSD</CardTitle>
            <CardDescription>Composez ce code sur votre téléphone pour payer</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 text-center space-y-4">
            <div className="bg-primary/10 p-6 rounded-lg">
              <p className="text-3xl font-bold font-mono text-primary">{ussdCode}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Composez le code ci-dessus sur votre téléphone pour finaliser le paiement
            </p>
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
            <CardTitle className="text-sm sm:text-lg lg:text-2xl mb-1 sm:mb-2">{merchantLink.merchantName}</CardTitle>
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
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Nom complet</FormLabel>
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
                    <FormLabel className="text-xs sm:text-sm">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="jean@exemple.com"
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
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Numéro de téléphone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+221 77 123 45 67"
                        data-testid="input-phone"
                        {...field}
                        onChange={handlePhoneChange}
                      />
                    </FormControl>
                    {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || paymentMutation.isPending}
                data-testid="button-pay"
              >
                {isLoading || paymentMutation.isPending ? "Traitement..." : "Obtenir le code USSD"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
