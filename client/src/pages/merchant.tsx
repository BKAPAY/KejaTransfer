import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { MerchantLink } from "@shared/schema";
import { COUNTRIES, OPERATORS } from "@shared/schema";
import logoImage from "@assets/bkapay-logo.png";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const merchantPaymentSchema = z.object({
  amount: z.number().min(100, "Le montant minimum est de 100 XOF"),
  customerName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  customerEmail: z.string().email("Email invalide"),
  country: z.string().min(1, "Sélectionnez un pays"),
  customerPhone: z.string().min(8, "Numéro de téléphone invalide"),
  operator: z.string().min(1, "Sélectionnez un opérateur"),
});

type MerchantPaymentFormData = z.infer<typeof merchantPaymentSchema>;

export default function Merchant() {
  const [, params] = useRoute("/merchant/:token");
  const token = params?.token;
  const [paymentStage, setPaymentStage] = useState<"form" | "ussd" | "otp" | "polling" | "completed">("form");
  const [invoiceToken, setInvoiceToken] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [ussdInstruction, setUssdInstruction] = useState<string | null>(null);
  const [wizallTransactionId, setWizallTransactionId] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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
      country: "",
      customerPhone: "",
      operator: "",
    },
  });

  const selectedCountry = form.watch("country");
  const countryOperators = selectedCountry ? OPERATORS[(selectedCountry as keyof typeof OPERATORS) || ("BJ" as const)] || [] : [];

  // SOFTPAY INIT mutation
  const initMutation = useMutation({
    mutationFn: async (data: MerchantPaymentFormData) => {
      const res = await apiRequest("POST", `/api/merchant-links/softpay-init/${token}`, {
        amount: data.amount,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        country: data.country,
        operator: data.operator,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.transactionId && data.token) {
        setTransactionId(data.transactionId);
        setInvoiceToken(data.token);
        setUssdInstruction(data.ussdInstruction || null);
        
        if (data.requiresTwoStep) {
          setPaymentStage("ussd");
        } else if (data.requiresOTP) {
          setPaymentStage("otp");
        } else {
          setPaymentStage("ussd");
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'initialisation du paiement",
        variant: "destructive",
      });
    },
  });

  // SOFTPAY CONFIRM mutation
  const confirmMutation = useMutation({
    mutationFn: async ({ authorizationCode }: { authorizationCode?: string }) => {
      const formData = form.getValues();
      const payload: any = {
        token: invoiceToken,
        transactionId,  // CRITICAL: Include transactionId for backend to find transaction
        authorizationCode,
        country: formData.country,
        operator: formData.operator,
        customerPhone: formData.customerPhone,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
      };
      
      // Include wizallTransactionId for Wizall OTP confirmation
      if (wizallTransactionId && authorizationCode) {
        payload.wizallTransactionId = wizallTransactionId;
      }
      
      const res = await apiRequest("POST", "/api/merchant-links/softpay-confirm", payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        if (data.requiresOTP && data.wizallTransactionId) {
          setWizallTransactionId(data.wizallTransactionId);
          setPaymentStage("otp");
          toast({
            title: "Code OTP envoyé",
            description: "Veuillez entrer le code reçu par SMS",
          });
        } else if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          setPaymentStage("polling");
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la confirmation du paiement",
        variant: "destructive",
      });
      setPaymentStage("form");
    },
  });

  // Polling for payment status
  useEffect(() => {
    if (paymentStage !== "polling" || !invoiceToken) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/softpay/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceToken }),
        });
        const data = await res.json();
        
        if (data.status === "completed") {
          setPaymentStage("completed");
          clearInterval(interval);
          toast({
            title: "Paiement réussi",
            description: "Votre transaction a été confirmée",
          });
        } else if (data.status === "failed") {
          clearInterval(interval);
          setPaymentStage("form");
          toast({
            title: "Paiement échoué",
            description: "La transaction n'a pas pu être complétée",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paymentStage, invoiceToken, toast]);

  const onSubmit = async (data: MerchantPaymentFormData) => {
    initMutation.mutate(data);
  };

  const handleConfirm = async () => {
    if (!transactionId || !invoiceToken) {
      toast({
        title: "Erreur",
        description: "Informations de paiement manquantes",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    confirmMutation.mutate({});
    setIsSubmitting(false);
  };

  const handleOTPSubmit = async () => {
    if (!authCode.trim()) {
      toast({
        title: "Code requis",
        description: "Veuillez entrer le code OTP",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    confirmMutation.mutate({ authorizationCode: authCode });
    setIsSubmitting(false);
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

  // STAGE: Completed
  if (paymentStage === "completed") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2 p-4 sm:p-6">
            <div className="flex justify-center mb-2">
              <CheckCircle2 className="w-12 h-12 text-green-500" data-testid="icon-success" />
            </div>
            <CardTitle>Paiement réussi!</CardTitle>
            <CardDescription>Votre transaction a été confirmée</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // STAGE: Polling
  if (paymentStage === "polling") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2 p-4 sm:p-6">
            <div className="flex justify-center mb-2">
              <Loader2 className="w-12 h-12 text-primary animate-spin" data-testid="icon-polling" />
            </div>
            <CardTitle>Paiement en cours</CardTitle>
            <CardDescription>Vérification du paiement...</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Nous vérifions votre paiement. Cela peut prendre quelques secondes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STAGE: USSD instructions
  if (paymentStage === "ussd") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto" />
            <CardTitle>Instructions de paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ussdInstruction && (
              <Alert className="bg-primary/5 border-primary/20">
                <AlertDescription className="text-sm whitespace-pre-line">
                  {ussdInstruction}
                </AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Suivez les instructions sur votre téléphone pour compléter le paiement
            </p>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting || confirmMutation.isPending}
              className="w-full"
              data-testid="button-confirm-ussd"
            >
              {isSubmitting || confirmMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                "J'ai complété le paiement"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // STAGE: OTP input
  if (paymentStage === "otp") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <img src={logoImage} alt="BKApay" className="h-10 w-auto mx-auto" />
            <CardTitle>Code de confirmation</CardTitle>
            <CardDescription>Entrez le code OTP reçu par SMS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="auth-code" className="block text-sm font-medium mb-2">
                Code OTP
              </label>
              <Input
                id="auth-code"
                type="text"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="Entrez le code"
                data-testid="input-otp"
              />
            </div>
            <Button
              onClick={handleOTPSubmit}
              disabled={isSubmitting || confirmMutation.isPending}
              className="w-full"
              data-testid="button-submit-otp"
            >
              {isSubmitting || confirmMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                "Valider le code"
              )}
            </Button>
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
                disabled={initMutation.isPending}
                data-testid="button-pay"
              >
                {initMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initialisation...
                  </>
                ) : (
                  "Payer maintenant"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
