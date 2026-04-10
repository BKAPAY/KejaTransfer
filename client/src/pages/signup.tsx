import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/bkapay-logo.png";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ALLOWED_REGISTRATION_COUNTRIES } from "@shared/schema";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { CountryFlag, getCountryName } from "@/components/country-flag";

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Bénin",
  TG: "Togo",
  CI: "Côte d'Ivoire",
  SN: "Sénégal",
  CM: "Cameroun",
  CD: "RD Congo",
  CG: "Congo Brazzaville",
};

const signupSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  country: z.enum(["BJ", "TG", "CI", "SN", "CM", "CD", "CG"], {
    required_error: "Veuillez sélectionner votre pays",
  }),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

type Step = "type-selection" | "form" | "verification";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("type-selection");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [verificationCode, setVerificationCode] = useState("");
  const [formData, setFormData] = useState<(SignupFormData & { accountType: "personal" | "business"; businessName?: string }) | null>(null);

  const { data: emailVerificationStatus } = useQuery<{ required: boolean; configured: boolean }>({
    queryKey: ["/api/auth/email-verification-status"],
  });

  const emailVerificationRequired = emailVerificationStatus?.required ?? false;

  const form = useForm<SignupFormData & { businessName?: string }>({
    resolver: zodResolver(
      z.object({
        firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
        lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
        email: z.string().email("Email invalide"),
        country: z.enum(["BJ", "TG", "CI", "SN", "CM", "CD", "CG"]).optional(),
        businessName: z.string().optional(),
        password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
        confirmPassword: z.string(),
      }).refine((data) => {
        if (accountType === "business" && !data.businessName) {
          return false;
        }
        return true;
      }, {
        message: "Le nom de l'entreprise est requis",
        path: ["businessName"],
      }).refine((data) => {
        if (accountType === "personal" && !data.country) {
          return false;
        }
        return true;
      }, {
        message: "Le pays est requis",
        path: ["country"],
      }).refine((data) => data.password === data.confirmPassword, {
        message: "Les mots de passe ne correspondent pas",
        path: ["confirmPassword"],
      })
    ),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      country: undefined,
      businessName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const sendCodeMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/auth/signup/send-code", { email });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Code envoyé",
        description: "Vérifiez votre boîte de réception",
      });
      setStep("verification");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'envoi du code",
        variant: "destructive",
      });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData & { accountType: "personal" | "business"; businessName?: string; verificationCode?: string }) => {
      const response = await apiRequest("POST", "/api/auth/signup", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        country: data.country,
        accountType: data.accountType,
        businessName: data.businessName,
        password: data.password,
        verificationCode: data.verificationCode,
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Compte créé avec succès",
        description: "Bienvenue sur BKApay",
      });
      setLocation(accountType === "business" ? "/dashboard/business" : "/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'inscription",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData & { businessName?: string }) => {
    const finalData = { ...data, accountType };
    if (emailVerificationRequired) {
      setFormData(finalData);
      sendCodeMutation.mutate(data.email);
    } else {
      signupMutation.mutate(finalData);
    }
  };

  const handleVerifyAndComplete = () => {
    if (!formData) return;
    if (verificationCode.length !== 6) {
      toast({
        title: "Erreur",
        description: "Le code doit contenir 6 chiffres",
        variant: "destructive",
      });
      return;
    }
    signupMutation.mutate({ ...formData, verificationCode });
  };

  const handleResendCode = () => {
    if (formData) {
      sendCodeMutation.mutate(formData.email);
    }
  };

  if (step === "type-selection") {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <Link href="/">
              <div className="flex justify-center mb-4 cursor-pointer hover:opacity-80 transition-opacity">
                <img src={logoImage} alt="BKApay" className="h-12 sm:h-16 w-auto" />
              </div>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Bienvenue sur BKApay</h1>
            <p className="text-muted-foreground">Choisissez le type de compte qui vous convient</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card 
              className={`cursor-pointer transition-all hover:border-primary/50 hover-elevate ${accountType === "personal" ? "border-primary ring-1 ring-primary" : ""}`}
              onClick={() => setAccountType("personal")}
              data-testid="card-account-type-personal"
            >
              <CardHeader className="p-4">
                <CardTitle className="text-lg">Compte Personnel</CardTitle>
                <CardDescription>Pour les particuliers.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Nécessite une pièce d'identité valide uniquement</li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:border-primary/50 hover-elevate ${accountType === "business" ? "border-primary ring-1 ring-primary" : ""}`}
              onClick={() => setAccountType("business")}
              data-testid="card-account-type-business"
            >
              <CardHeader className="p-4">
                <CardTitle className="text-lg">Compte Entreprise</CardTitle>
                <CardDescription>Pour les entrepreneurs.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Nécessite une pièce d'identité</li>
                  <li>• Documents d'entreprise</li>
                  <li>• Preuve de résidence</li>
                  <li>• Compte bancaire</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Button 
            className="w-full" 
            size="lg"
            onClick={() => setStep("form")}
            data-testid="button-continue-step-form"
          >
            Continuer avec un compte {accountType === "personal" ? "Personnel" : "Entreprise"}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Vous avez déjà un compte ? </span>
            <Link href="/login">
              <span className="text-primary hover:underline font-medium" data-testid="link-login">
                Se connecter
              </span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "verification" && formData) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
        <Card className="w-full max-w-xs sm:max-w-sm">
          <CardHeader className="space-y-2 sm:space-y-3 text-center p-3 sm:p-4 lg:p-6">
            <Link href="/">
              <div className="flex justify-center mb-1 sm:mb-2 cursor-pointer hover:opacity-80 transition-opacity">
                <img src={logoImage} alt="BKApay" className="h-10 sm:h-12 lg:h-16 w-auto" />
              </div>
            </Link>
            <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold">Vérification email</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Entrez le code à 6 chiffres envoyé à {formData.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={setVerificationCode}
                  data-testid="input-verification-code"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="w-full"
                onClick={handleVerifyAndComplete}
                disabled={signupMutation.isPending || verificationCode.length !== 6}
                data-testid="button-verify"
              >
                {signupMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création du compte...
                  </>
                ) : (
                  "Vérifier et créer le compte"
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={handleResendCode}
                disabled={sendCodeMutation.isPending}
              >
                {sendCodeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Renvoyer le code"
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStep("form")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Modifier mes informations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4 overflow-hidden">
      <Card className="w-full max-w-xs sm:max-w-sm">
        <CardHeader className="space-y-2 sm:space-y-3 lg:space-y-4 text-center p-3 sm:p-4 lg:p-6">
          <Link href="/">
            <div className="flex justify-center mb-1 sm:mb-2 cursor-pointer hover:opacity-80 transition-opacity">
              <img src={logoImage} alt="BKApay" className="h-10 sm:h-12 lg:h-16 w-auto" />
            </div>
          </Link>
          <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold">
            {accountType === "business" ? "Compte Entreprise" : "Créer un compte"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {accountType === "business" ? "Inscrivez votre entreprise sur BKApay" : "Rejoignez BKApay et commencez"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 sm:space-y-3 lg:space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Prénom</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Jean"
                          data-testid="input-firstname"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Dupont"
                          data-testid="input-lastname"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {accountType === "business" && (
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de l'entreprise</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="BKA Corp"
                          data-testid="input-businessname"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="votre@email.com"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {accountType === "personal" && (
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pays</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-country">
                            <SelectValue placeholder="Sélectionnez votre pays" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ALLOWED_REGISTRATION_COUNTRIES.map((code) => (
                            <SelectItem key={code} value={code}>
                              <span className="flex items-center gap-2">
                                <CountryFlag code={code} size="xs" />
                                <span>{COUNTRY_NAMES[code] || code}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder="••••••••"
                        data-testid="input-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder="••••••••"
                        data-testid="input-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={signupMutation.isPending || sendCodeMutation.isPending}
                  data-testid="button-submit"
                >
                  {(signupMutation.isPending || sendCodeMutation.isPending) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {emailVerificationRequired ? "Envoi du code..." : "Inscription..."}
                    </>
                  ) : (
                    emailVerificationRequired ? "Continuer" : "S'inscrire"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("type-selection")}
                  data-testid="button-back-to-selection"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour au choix du compte
                </Button>
              </div>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Vous avez déjà un compte ? </span>
            <Link href="/login">
              <span className="text-primary hover:underline font-medium" data-testid="link-login">
                Se connecter
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
