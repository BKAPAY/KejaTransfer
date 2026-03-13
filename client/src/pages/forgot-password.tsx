import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/bkapay-logo.png";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Mail, Key, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "email" | "code" | "password" | "success";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const sendCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/forgot-password/send-code", { email });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Code envoyé",
        description: "Vérifiez votre boîte de réception",
      });
      setStep("code");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'envoi du code",
        variant: "destructive",
      });
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/forgot-password/verify-code", { email, code });
      return response.json();
    },
    onSuccess: () => {
      setStep("password");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Code invalide ou expiré",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/forgot-password/reset", {
        email,
        code,
        newPassword,
        confirmPassword,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mot de passe réinitialisé",
        description: "Vous pouvez maintenant vous connecter",
      });
      setStep("success");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la réinitialisation",
        variant: "destructive",
      });
    },
  });

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un email valide",
        variant: "destructive",
      });
      return;
    }
    sendCodeMutation.mutate();
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast({
        title: "Erreur",
        description: "Le code doit contenir 6 chiffres",
        variant: "destructive",
      });
      return;
    }
    verifyCodeMutation.mutate();
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive",
      });
      return;
    }
    resetPasswordMutation.mutate();
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-3 text-center">
          <Link href="/">
            <div className="flex justify-center mb-2 cursor-pointer hover:opacity-80 transition-opacity">
              <img src={logoImage} alt="BKApay" className="h-12 w-auto" />
            </div>
          </Link>
          <CardTitle className="text-xl font-bold">
            {step === "email" && "Mot de passe oublié"}
            {step === "code" && "Vérification"}
            {step === "password" && "Nouveau mot de passe"}
            {step === "success" && "Réinitialisation réussie"}
          </CardTitle>
          <CardDescription className="text-sm">
            {step === "email" && "Entrez votre email pour recevoir un code de vérification"}
            {step === "code" && "Entrez le code à 6 chiffres envoyé à votre email"}
            {step === "password" && "Créez votre nouveau mot de passe"}
            {step === "success" && "Votre mot de passe a été réinitialisé"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={sendCodeMutation.isPending}
                data-testid="button-send-code"
              >
                {sendCodeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Envoyer le code"
                )}
              </Button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Code de vérification
                </Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    data-testid="input-code"
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
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Code envoyé à {email}
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={verifyCodeMutation.isPending || code.length !== 6}
                data-testid="button-verify-code"
              >
                {verifyCodeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  "Vérifier le code"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => sendCodeMutation.mutate()}
                disabled={sendCodeMutation.isPending}
              >
                Renvoyer le code
              </Button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Nouveau mot de passe
                </Label>
                <PasswordInput
                  id="newPassword"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Confirmer le mot de passe
                </Label>
                <PasswordInput
                  id="confirmPassword"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={resetPasswordMutation.isPending}
                data-testid="button-reset-password"
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Réinitialisation...
                  </>
                ) : (
                  "Réinitialiser le mot de passe"
                )}
              </Button>
            </form>
          )}

          {step === "success" && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
              <p className="text-muted-foreground">
                Votre mot de passe a été réinitialisé avec succès.
              </p>
              <Button
                className="w-full"
                onClick={() => setLocation("/login")}
                data-testid="button-go-login"
              >
                Se connecter
              </Button>
            </div>
          )}

          {step !== "success" && (
            <div className="mt-4 text-center">
              <Link href="/login">
                <span className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1">
                  <ArrowLeft className="w-4 h-4" />
                  Retour à la connexion
                </span>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
