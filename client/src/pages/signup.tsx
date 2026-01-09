import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/bkapay-logo.png";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ALLOWED_REGISTRATION_COUNTRIES } from "@shared/schema";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Mail, ArrowLeft } from "lucide-react";

const COUNTRY_NAMES: Record<string, string> = {
  BJ: "Benin",
  TG: "Togo",
  CI: "Cote d'Ivoire",
  BF: "Burkina Faso",
  SN: "Senegal",
};

const COUNTRY_FLAGS: Record<string, string> = {
  BJ: "\uD83C\uDDE7\uD83C\uDDEF",
  TG: "\uD83C\uDDF9\uD83C\uDDEC",
  CI: "\uD83C\uDDE8\uD83C\uDDEE",
  BF: "\uD83C\uDDE7\uD83C\uDDEB",
  SN: "\uD83C\uDDF8\uD83C\uDDF3",
};

const signupSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  country: z.enum(["BJ", "TG", "CI", "BF", "SN"], {
    required_error: "Veuillez sélectionner votre pays",
  }),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

type Step = "form" | "verification";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("form");
  const [verificationCode, setVerificationCode] = useState("");
  const [formData, setFormData] = useState<SignupFormData | null>(null);

  const { data: emailVerificationStatus } = useQuery<{ required: boolean; configured: boolean }>({
    queryKey: ["/api/auth/email-verification-status"],
  });

  const emailVerificationRequired = emailVerificationStatus?.required ?? false;

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      country: undefined as any,
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
    mutationFn: async (data: SignupFormData & { verificationCode?: string }) => {
      const response = await apiRequest("POST", "/api/auth/signup", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        country: data.country,
        password: data.password,
        verificationCode: data.verificationCode,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Compte créé avec succès",
        description: "Vous pouvez maintenant vous connecter",
      });
      setLocation("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'inscription",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    if (emailVerificationRequired) {
      setFormData(data);
      sendCodeMutation.mutate(data.email);
    } else {
      signupMutation.mutate(data);
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
          <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold">Créer un compte</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Rejoignez BKApay et commencez</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 sm:space-y-3 lg:space-y-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
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
                  <FormItem>
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

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
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
                              <span className="text-base">{COUNTRY_FLAGS[code]}</span>
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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
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
                      <Input
                        type="password"
                        placeholder="••••••••"
                        data-testid="input-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
