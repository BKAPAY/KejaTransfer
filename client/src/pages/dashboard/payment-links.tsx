import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Copy, ExternalLink, Trash2, Image as ImageIcon, Link as LinkIcon, Edit2, Globe, Wallet } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PaymentLink } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Compress image to reduce size
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Reduce to max 500x500 to save space
        if (width > 500 || height > 500) {
          const ratio = Math.min(500 / width, 500 / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Cannot get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => reject(new Error("Cannot load image"));
    };
    reader.onerror = () => reject(new Error("Cannot read file"));
  });
};

const paymentLinkSchema = z.object({
  productName: z.string().min(1, "Le nom du produit est requis"),
  description: z.string().optional(),
  amount: z.number().min(1, "Le montant doit être supérieur à 0"),
  imageFile: z.instanceof(File).optional(),
  allowedCountries: z.array(z.string()).default([]),
  customerPaysFee: z.boolean().default(false),
});

type PaymentLinkFormData = z.infer<typeof paymentLinkSchema>;

// Countries that support collect (incoming payments) via AfribaPay
const COLLECT_COUNTRIES = COUNTRIES;

export default function PaymentLinks() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [successToken, setSuccessToken] = useState<string | null>(null);
  const [successImage, setSuccessImage] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: paymentLinks, isLoading } = useQuery<PaymentLink[]>({
    queryKey: ["/api/payment-links"],
  });

  const form = useForm<PaymentLinkFormData>({
    resolver: zodResolver(paymentLinkSchema),
    defaultValues: {
      productName: "",
      description: "",
      amount: undefined as any,
      imageFile: undefined,
      allowedCountries: [],
      customerPaysFee: false,
    },
  });

  const startEditingLink = (link: PaymentLink) => {
    setEditingId(link.id);
    form.reset({
      productName: link.productName,
      description: link.description || "",
      amount: link.amount,
      imageFile: undefined,
      allowedCountries: link.allowedCountries || [],
      customerPaysFee: link.customerPaysFee || false,
    });
    setImagePreview(null);
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: PaymentLinkFormData) => {
      let imageData: string | undefined;
      if (data.imageFile) {
        try {
          imageData = await compressImage(data.imageFile);
        } catch (error) {
          throw new Error("Erreur lors du traitement de l'image");
        }
      }

      const res = await apiRequest("POST", "/api/payment-links", {
        productName: data.productName,
        description: data.description,
        amount: data.amount,
        imageUrl: imageData,
        allowedCountries: data.allowedCountries,
        customerPaysFee: data.customerPaysFee,
      });
      return res.json() as Promise<PaymentLink>;
    },
    onSuccess: (data: PaymentLink) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      // Show success screen with image and short link
      if (data.imageUrl) {
        setSuccessImage(data.imageUrl);
      }
      setSuccessToken(data.token);
      setDialogOpen(false);
      setImagePreview(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création du lien",
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: PaymentLinkFormData) => {
      let imageData: string | undefined;
      if (data.imageFile) {
        try {
          imageData = await compressImage(data.imageFile);
        } catch (error) {
          throw new Error("Erreur lors du traitement de l'image");
        }
      }

      const res = await apiRequest("PATCH", `/api/payment-links/${editingId}`, {
        productName: data.productName,
        description: data.description,
        amount: data.amount,
        ...(imageData && { imageUrl: imageData }),
        allowedCountries: data.allowedCountries,
        customerPaysFee: data.customerPaysFee,
      });
      return res.json() as Promise<PaymentLink>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({
        title: "Lien modifié",
        description: "Le lien de paiement a été modifié avec succès",
      });
      setEditingId(null);
      setDialogOpen(false);
      setImagePreview(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la modification",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/payment-links/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({
        title: "Lien supprimé",
        description: "Le lien de paiement a été supprimé",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (token: string, isShortToken = false) => {
    const textToCopy = isShortToken ? token : `${window.location.origin}/pay/${token}`;
    navigator.clipboard.writeText(textToCopy);
    toast({
      title: "Copié",
      description: isShortToken ? "Le token a été copié" : "Le lien a été copié dans le presse-papiers",
    });
  };

  const closeSuccess = () => {
    setSuccessImage(null);
    setSuccessToken(null);
  };

  const onSubmit = (data: PaymentLinkFormData) => {
    if (editingId) {
      editMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // Success screen overlay - show ONLY image and short link
  if (successToken) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            {successImage && (
              <img
                src={successImage}
                alt="Produit"
                className="max-h-56 w-auto rounded-md"
              />
            )}
            <div className="bg-muted rounded-md p-3 flex items-center justify-between gap-2 w-full">
              <code className="text-xs sm:text-sm font-mono text-foreground flex-1 text-center">
                {successToken}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(successToken, true)}
                className="flex-shrink-0"
                data-testid="button-copy-success"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button
              onClick={closeSuccess}
              className="w-full"
              data-testid="button-done"
            >
              Continuer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Liens de paiement</h1>
          <p className="text-sm text-muted-foreground">
            Montant fixe - partagez vos liens
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-link">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau lien
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier le lien de paiement" : "Créer un lien de paiement"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Modifiez les informations de votre produit ou service" : "Remplissez les informations de votre produit ou service"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du produit</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Formation en ligne"
                          data-testid="input-product-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optionnel)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Décrivez votre produit..."
                          rows={3}
                          data-testid="input-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant (XOF)</FormLabel>
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
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imageFile"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      <FormLabel>Image du produit (optionnel)</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <Input
                            type="file"
                            accept="image/*"
                            data-testid="input-image-file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Validate file size (max 5MB)
                                if (file.size > 5 * 1024 * 1024) {
                                  toast({
                                    title: "Fichier trop volumineux",
                                    description: "L'image doit faire moins de 5MB",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                onChange(file);
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setImagePreview(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            {...field}
                          />
                          {imagePreview && (
                            <div className="relative w-full max-w-xs">
                              <img
                                src={imagePreview}
                                alt="Aperçu"
                                className="w-full h-32 object-cover rounded-md border"
                              />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pays autorisés */}
                <FormField
                  control={form.control}
                  name="allowedCountries"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Pays autorisés
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Sélectionnez les pays où les clients peuvent payer. Si aucun pays n'est sélectionné, tous les pays seront disponibles.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {COLLECT_COUNTRIES.map((country) => (
                              <div key={country.code} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`country-${country.code}`}
                                  data-testid={`checkbox-country-${country.code}`}
                                  checked={field.value?.includes(country.code)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...(field.value || []), country.code]);
                                    } else {
                                      field.onChange(field.value?.filter((c: string) => c !== country.code) || []);
                                    }
                                  }}
                                />
                                <Label htmlFor={`country-${country.code}`} className="text-sm cursor-pointer flex items-center gap-1">
                                  <span>{country.flag}</span>
                                  <span>{country.name}</span>
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Frais de paiement */}
                <FormField
                  control={form.control}
                  name="customerPaysFee"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          Frais à la charge du client
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Si activé, le client paiera les frais de 6% en plus du montant.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          data-testid="switch-customer-pays-fee"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      setEditingId(null);
                      form.reset();
                    }}
                    data-testid="button-cancel"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={editingId ? editMutation.isPending : createMutation.isPending}
                    data-testid="button-submit"
                  >
                    {editingId ? (
                      editMutation.isPending ? "Modification..." : "Modifier le lien"
                    ) : (
                      createMutation.isPending ? "Création..." : "Créer le lien"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment Links List - Scrollable Container */}
      <div className="flex-1 overflow-y-auto pr-3">
        <div className="grid gap-6">
          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">Chargement...</p>
              </CardContent>
            </Card>
          ) : paymentLinks && paymentLinks.length > 0 ? (
            paymentLinks.map((link) => (
            <Card key={link.id} data-testid={`payment-link-${link.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <CardTitle className="text-lg">{link.productName}</CardTitle>
                      <Badge variant={link.isActive ? "default" : "secondary"}>
                        {link.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                    {link.description && (
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {new Intl.NumberFormat("fr-FR").format(link.amount)} XOF
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Image du produit - affichage compact */}
                  {link.imageUrl && (
                    <div className="flex justify-start">
                      <img
                        src={link.imageUrl}
                        alt={link.productName}
                        className="w-16 h-16 object-cover rounded-md border bg-muted"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <code className="flex-1 text-sm truncate">
                      {`${window.location.origin}/pay/${link.token}`}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(link.token, false)}
                      data-testid={`button-copy-${link.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      data-testid={`button-open-${link.id}`}
                    >
                      <a href={`/pay/${link.token}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                  <div className="flex justify-end gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditingLink(link)}
                      data-testid={`button-edit-${link.id}`}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Modifier
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(link.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${link.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <LinkIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">
                    Vous n'avez pas encore créé de lien de paiement
                  </p>
                  <Button onClick={() => setDialogOpen(true)} data-testid="button-create-first">
                    <Plus className="w-4 h-4 mr-2" />
                    Créer votre premier lien
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
