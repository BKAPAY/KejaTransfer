import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { PaymentLink } from "@shared/schema";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";

const paymentSchema = z.object({
  customerName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  customerEmail: z.string().email("Email invalide"),
  country: z.string().min(1, "Sélectionnez un pays"),
  customerPhone: z.string().min(8, "Numéro de téléphone invalide"),
  operator: z.string().min(1, "Sélectionnez un opérateur"),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export default function Pay() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token;
  const [isLoading, setIsLoading] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [invoiceToken, setInvoiceToken] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: paymentLink, isLoading: linkLoading } = useQuery<PaymentLink>({
    queryKey: ["/api/payment-links/public", token],
    enabled: !!token,
  });

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      country: "",
      customerPhone: "",
      operator: "",
    },
  });

  const selectedCountry = form.watch("country");
  const countryOperators = selectedCountry ? OPERATORS[(selectedCountry as keyof typeof OPERATORS) || ("BJ" as const)] || [] : [];

  // Wait for webhook confirmation (payment link payments use webhook, not polling)
  useEffect(() => {
    if (!paymentInProgress || !invoiceToken) return;

    // Timeout after 5 minutes if no webhook confirmation
    const timeout = setTimeout(() => {
      setPaymentInProgress(false);
      setPollingStatus("timeout");
      toast({
        title: "Paiement en attente",
        description: "Le paiement n'a pas pu être confirmé. Veuillez vérifier votre solde et réessayer.",
        variant: "destructive",
      });
    }, 5 * 60 * 1000);

    return () => clearTimeout(timeout);
  }, [paymentInProgress, invoiceToken, toast]);

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      const res = await apiRequest("POST", `/api/payments/process/${token}`, {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        country: data.country,
        operator: data.operator,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.token) {
        setInvoiceToken(data.token);
        setPaymentInProgress(true);
        setPollingStatus("waiting");
        toast({
          title: "Facture créée",
          description: "Veuillez compléter le paiement sur votre téléphone",
        });
      }
    },
    onError: (error: any) => {
      console.error("Payment mutation error:", error);
      setIsLoading(false);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du paiement",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PaymentFormData) => {
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

  if (!paymentLink || !paymentLink.isActive) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-lg">
          <CardContent className="py-12">
            <div className="text-center">
              <img src={logoImage} alt="BKApay" className="h-16 w-auto mx-auto mb-4" />
              <p className="text-muted-foreground">Lien de paiement introuvable ou inactif</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentInProgress) {
    if (pollingStatus === "completed") {
      return (
        <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center space-y-2 p-4 sm:p-6">
              <div className="flex justify-center mb-2">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <CardTitle>Paiement réussi!</CardTitle>
              <CardDescription>Votre transaction a été confirmée</CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }

    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2 p-4 sm:p-6">
            <div className="flex justify-center mb-2">
              <Clock className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
            <CardTitle>Paiement en attente</CardTitle>
            <CardDescription>Veuillez compléter le paiement sur votre téléphone</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Vous allez recevoir un SMS sur votre téléphone. Confirmez le paiement directement sur votre mobile.
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
            <CardTitle className="text-sm sm:text-lg lg:text-2xl mb-1 sm:mb-2">{paymentLink.productName}</CardTitle>
            {paymentLink.description && (
              <CardDescription className="text-xs sm:text-sm">{paymentLink.description}</CardDescription>
            )}
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold pt-2">
            {formatAmount(paymentLink.amount)}
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 sm:space-y-3 lg:space-y-4">
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
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Pays</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-country">
                          <SelectValue placeholder="Sélectionnez un pays" />
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
                    <FormLabel className="text-xs sm:text-sm">Numéro de téléphone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={selectedCountry === "SN" ? "771234567" : "97123456"}
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
                    <FormLabel className="text-xs sm:text-sm">Opérateur</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-operator">
                          <SelectValue placeholder="Sélectionnez votre opérateur" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {countryOperators.map((op) => (
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
                {isLoading || paymentMutation.isPending ? "Traitement..." : "Payer maintenant"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
