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
import { useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    PayDunya: any;
  }
}

declare const jQuery: any;

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
  const [isLoading, setIsLoading] = useState(false);
  const psrLoadedRef = useRef(false);

  const { data: merchantLink, isLoading: linkLoading } = useQuery<MerchantLink>({
    queryKey: ["/api/merchant-links/public", token],
    enabled: !!token,
  });

  // Load PSR SDK
  useEffect(() => {
    if (!psrLoadedRef.current) {
      const script = document.createElement("script");
      script.src = "https://paydunya.com/assets/psr/js/psr.paydunya.min.js";
      script.async = true;
      document.body.appendChild(script);

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://paydunya.com/assets/psr/css/psr.paydunya.min.css";
      document.head.appendChild(link);

      psrLoadedRef.current = true;
    }
  }, []);

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
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.transactionId && window.PayDunya) {
        const btn = document.createElement("button");
        btn.className = "pay";
        btn.setAttribute("onclick", "payWithPaydunya(this)");
        btn.setAttribute("data-ref", data.transactionId);
        btn.setAttribute("data-fullname", form.getValues("customerName"));
        btn.setAttribute("data-email", form.getValues("customerEmail"));
        btn.setAttribute("data-phone", form.getValues("customerPhone"));
        btn.style.display = "none";
        document.body.appendChild(btn);

        window.PayDunya.setup({
          selector: jQuery(btn),
          url: "/api/paydunya-api",
          method: "GET",
          displayMode: window.PayDunya.DISPLAY_IN_POPUP,
          onSuccess: function (token: string) {
            console.log("Payment token received:", token);
          },
          onTerminate: function (ref: string, token: string, status: string) {
            console.log("Payment terminated - Ref:", ref, "Status:", status);
            setLocation(`/status/${ref}`);
          },
          onError: function (error: any) {
            console.error("Payment error:", error);
            alert("Erreur lors du paiement: " + error.toString());
            setIsLoading(false);
          },
          onClose: function () {
            console.log("Payment modal closed");
          },
        }).requestToken();
      }
    },
    onError: (error: any) => {
      console.error("Merchant payment mutation error:", error);
      setIsLoading(false);
    },
  });

  const onSubmit = (data: MerchantPaymentFormData) => {
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

  const availableOperators = selectedCountry
    ? OPERATORS[selectedCountry as keyof typeof OPERATORS] || []
    : [];

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
                    <FormLabel className="text-xs sm:text-sm">Pays</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedCountry(value);
                        form.setValue("operator", "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-country">
                          <SelectValue placeholder="Sélectionner un pays" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
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
                name="operator"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Opérateur</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-operator">
                          <SelectValue placeholder="Sélectionner un opérateur" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableOperators.map((op) => (
                          <SelectItem key={op.code} value={op.code}>
                            {op.name}
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
                disabled={isLoading || paymentMutation.isPending}
                data-testid="button-pay"
              >
                {isLoading || paymentMutation.isPending ? "Traitement..." : `Payer ${form.getValues("amount") ? formatAmount(form.getValues("amount")) : ""}`}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
