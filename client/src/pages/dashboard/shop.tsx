import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Store, Plus, Pencil, Trash2, Link as LinkIcon, Package, Tag, ShoppingBag,
  Globe, Key, Eye, EyeOff, Copy, Check, ImagePlus, X, Download, Loader2, ExternalLink,
  CheckCircle2, AlertTriangle, RefreshCw, XCircle, Info
} from "lucide-react";
import type { Shop, ShopCategory, ShopProduct, ShopOrder } from "@shared/schema";

type ShopData = {
  shop: Shop;
  categories: ShopCategory[];
  products: ShopProduct[];
  orders: ShopOrder[];
};

const CURRENCIES = ["XOF", "XAF", "CDF", "USD", "EUR", "GHS", "NGN", "MAD", "TND", "GNF", "GMD", "RWF"];

// ── Utilitaire upload image ─────────────────────────────────────────────────
async function uploadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ data: base64, filename: file.name, mimeType: file.type }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload échoué");
        resolve(data.url);
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Composant sélecteur d'image depuis la galerie ───────────────────────────
function ImagePickerBtn({ onUploaded, disabled, label }: {
  onUploaded: (url: string) => void; disabled?: boolean; label?: string;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onUploaded(url);
    } catch {
      toast({ title: "Erreur", description: "Impossible d'uploader l'image.", variant: "destructive" });
    }
    setUploading(false);
    e.target.value = "";
  };
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handle} />
      <Button type="button" variant="outline" size="sm" disabled={uploading || disabled}
        onClick={() => ref.current?.click()}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ImagePlus className="w-4 h-4 mr-1" />}
        {label || "Choisir une photo"}
      </Button>
    </>
  );
}

// ── Sélecteur fichier générique (documents, zips, pdfs...) ─────────────────
function FilePickerBtn({ onUploaded, label }: {
  onUploaded: (url: string, name: string) => void; label?: string;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onUploaded(url, file.name);
    } catch {
      toast({ title: "Erreur", description: "Impossible d'uploader le fichier.", variant: "destructive" });
    }
    setUploading(false);
    e.target.value = "";
  };
  return (
    <>
      <input ref={ref} type="file" className="hidden" onChange={handle} />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => ref.current?.click()}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
        {label || "Fichier"}
      </Button>
    </>
  );
}

const DELIVERY_METHODS = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "both", label: "Email + WhatsApp" },
];

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="icon" variant="ghost" onClick={copy} title="Copier" data-testid="button-copy-value">
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40);
}

function CreateShopForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const slugCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManual) {
      const generated = toSlug(val);
      setSlug(generated);
      checkSlug(generated);
    }
  };

  const handleSlugChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 40);
    setSlug(clean);
    setSlugManual(true);
    checkSlug(clean);
  };

  const checkSlug = (s: string) => {
    if (slugCheckRef.current) clearTimeout(slugCheckRef.current);
    if (!s || s.length < 3) { setSlugStatus("invalid"); return; }
    setSlugStatus("checking");
    slugCheckRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/shop/check-slug?slug=${encodeURIComponent(s)}`, { credentials: "include" });
        const data = await res.json();
        setSlugStatus(data.available ? "ok" : "taken");
      } catch { setSlugStatus("idle"); }
    }, 500);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, slug, description, currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Boutique créée !", description: `Votre boutique "${data.shop.name}" est prête.` });
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
      onCreated();
    },
    onError: (err: any) => toast({ title: "Erreur", description: err?.message || "Impossible de créer la boutique.", variant: "destructive" }),
  });

  const canSubmit = !mutation.isPending && name.trim().length >= 2 && slug.length >= 3 && slugStatus === "ok";

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Store className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Créer votre boutique</CardTitle>
          <CardDescription>Donnez un nom unique à votre boutique pour commencer à vendre</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shop-name">Nom de la boutique *</Label>
            <Input
              id="shop-name"
              data-testid="input-shop-name"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Ex: Keja Store"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shop-slug">
              Identifiant unique *
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">(définitif, non modifiable)</span>
            </Label>
            <div className="relative">
              <Input
                id="shop-slug"
                data-testid="input-shop-slug"
                value={slug}
                onChange={e => handleSlugChange(e.target.value)}
                placeholder="keja-store"
                className={slugStatus === "taken" ? "border-destructive pr-8" : slugStatus === "ok" ? "border-green-500 pr-8" : "pr-8"}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {slugStatus === "checking" && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                {slugStatus === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                {slugStatus === "taken" && <XCircle className="w-3.5 h-3.5 text-destructive" />}
              </div>
            </div>
            {slugStatus === "taken" && (
              <p className="text-xs text-destructive">Cet identifiant est déjà utilisé. Choisissez-en un autre.</p>
            )}
            {slugStatus === "ok" && slug && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Disponible — votre boutique sera sur <code className="font-mono">{slug}.bkapay.com</code>
              </p>
            )}
            {slugStatus === "invalid" && slug.length > 0 && (
              <p className="text-xs text-muted-foreground">Minimum 3 caractères (lettres et chiffres uniquement)</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="shop-desc">Description</Label>
            <Textarea
              id="shop-desc"
              data-testid="input-shop-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Décrivez votre boutique en quelques mots..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Devise de la boutique</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger data-testid="select-shop-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            data-testid="button-create-shop"
          >
            {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</> : <><Store className="w-4 h-4 mr-2" />Créer ma boutique</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ApiKeySection({ shop }: { shop: Shop }) {
  const { toast } = useToast();

  const { data: apiKeyData, isLoading: isLoadingKey } = useQuery<any>({
    queryKey: ["/api/shop", "apikey", shop.apiKeyId],
    enabled: !!shop.apiKeyId,
    queryFn: async () => {
      const res = await fetch(`/api/api-keys`, { credentials: "include" });
      const keys = await res.json();
      return keys.find((k: any) => k.id === shop.apiKeyId) || null;
    },
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shop/link-api-key", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.error) {
        toast({ title: "Erreur", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Clé API liée !", description: "Votre boutique peut maintenant accepter des paiements." });
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop", "apikey"] });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de lier la clé API.", variant: "destructive" }),
  });

  // Cas 1 : aucune clé liée
  if (!shop.apiKeyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4" />
            Paiement en ligne
          </CardTitle>
          <CardDescription>
            Liez votre boutique à votre clé API pour accepter des paiements. Votre compte doit être vérifié (KYC).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending} data-testid="button-link-api-key">
            {linkMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Liaison en cours...</>
              : <><Key className="w-4 h-4 mr-2" />Lier ma clé API</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Cas 2 : clé liée mais en cours de chargement
  if (isLoadingKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4" />
            Paiement en ligne
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Vérification de la configuration...
        </CardContent>
      </Card>
    );
  }

  // Cas 3 : apiKeyId renseigné mais la clé a été supprimée (introuvable)
  if (!apiKeyData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4" />
            Paiement en ligne
            <Badge variant="destructive" className="text-xs">Clé supprimée</Badge>
          </CardTitle>
          <CardDescription>
            La clé API précédemment liée a été supprimée. Vous devez lier une nouvelle clé pour continuer à accepter des paiements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">
              Les paiements sur votre boutique sont actuellement désactivés. Liez une nouvelle clé API pour les réactiver.
            </p>
          </div>
          <Button onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending} data-testid="button-relink-api-key">
            {linkMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Liaison en cours...</>
              : <><RefreshCw className="w-4 h-4 mr-2" />Lier une nouvelle clé</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Cas 4 : clé liée et active — afficher uniquement le statut, jamais la valeur de la clé
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base flex-wrap">
          <Key className="w-4 h-4" />
          Paiement en ligne
          <Badge className="text-xs gap-1 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Configuré
          </Badge>
        </CardTitle>
        <CardDescription>
          Votre boutique est prête à recevoir des paiements en ligne.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statut de la clé — sans exposer les valeurs */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
          <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Clé API active</p>
            <p className="text-xs text-muted-foreground truncate">
              Identifiant : ••••{apiKeyData.publicKey?.slice(-8) ?? "••••••••"}
            </p>
          </div>
        </div>

        {/* Option pour changer de clé */}
        <div className="pt-1">
          <p className="text-xs text-muted-foreground mb-2">
            Besoin de changer la clé liée à cette boutique ?
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-relink-api-key">
                <RefreshCw className="w-4 h-4 mr-2" />
                Changer de clé API
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Changer la clé API</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action déliera la clé API actuelle et liera automatiquement votre clé principale. Les paiements en cours ne seront pas affectés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => linkMutation.mutate()}
                  disabled={linkMutation.isPending}
                >
                  {linkMutation.isPending ? "Mise à jour..." : "Confirmer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductDialog({
  open, onClose, shopId, categories, product
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
  categories: ShopCategory[];
  product?: ShopProduct;
}) {
  const { toast } = useToast();
  const isEdit = !!product;

  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [imageUrls, setImageUrls] = useState<string[]>(product?.imageUrls || []);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [downloadableFiles, setDownloadableFiles] = useState<string[]>(product?.downloadableFiles || []);
  const [downloadableFileNames, setDownloadableFileNames] = useState<string[]>(product?.downloadableFileNames || []);
  const [newFileUrl, setNewFileUrl] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [checkoutFields, setCheckoutFields] = useState<{ label: string; required: boolean }[]>(
    (product?.checkoutFields as any) || []
  );
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState(product?.deliveryMethod || "email");
  const [stock, setStock] = useState(product?.stock?.toString() || "");

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name, description, price: Number(price), categoryId: categoryId || null,
        imageUrls, downloadableFiles, downloadableFileNames,
        checkoutFields, deliveryMethod,
        stock: stock ? Number(stock) : null,
      };
      if (isEdit) {
        const res = await apiRequest("PATCH", `/api/shop/products/${product!.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/shop/products", { ...payload, shopId });
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Produit mis à jour" : "Produit ajouté" });
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
      onClose();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const addImage = () => {
    if (!newImageUrl.trim() || imageUrls.length >= 3) return;
    setImageUrls(prev => [...prev, newImageUrl.trim()]);
    setNewImageUrl("");
  };

  const addFile = () => {
    if (!newFileUrl.trim() || !newFileName.trim()) return;
    setDownloadableFiles(prev => [...prev, newFileUrl.trim()]);
    setDownloadableFileNames(prev => [...prev, newFileName.trim()]);
    setNewFileUrl(""); setNewFileName("");
  };

  const addField = () => {
    if (!newFieldLabel.trim()) return;
    setCheckoutFields(prev => [...prev, { label: newFieldLabel.trim(), required: false }]);
    setNewFieldLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le produit" : "Ajouter un produit"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nom du produit *</Label>
              <Input data-testid="input-product-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Robe en wax" />
            </div>
            <div className="space-y-2">
              <Label>Prix *</Label>
              <Input data-testid="input-product-price" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="5000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Décrivez votre produit..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stock (vide = illimité)</Label>
              <Input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="100" />
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>Photos du produit (max 3)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setImageUrls(p => p.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {imageUrls.length < 3 && (
                <ImagePickerBtn
                  label="Ajouter photo"
                  onUploaded={url => setImageUrls(p => [...p, url])}
                />
              )}
            </div>
          </div>

          {/* Fichiers téléchargeables */}
          <div className="space-y-2">
            <Label>Fichiers téléchargeables après paiement</Label>
            {downloadableFiles.map((url, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                <Download className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs flex-1 truncate">{downloadableFileNames[i] || url}</span>
                <button type="button" onClick={() => {
                  setDownloadableFiles(p => p.filter((_, j) => j !== i));
                  setDownloadableFileNames(p => p.filter((_, j) => j !== i));
                }}><X className="w-3 h-3 text-muted-foreground" /></button>
              </div>
            ))}
            <div className="space-y-2">
              <Input value={newFileName} onChange={e => setNewFileName(e.target.value)} placeholder="Nom du fichier (ex: Licence Pro)" />
              <div className="flex gap-2 items-center">
                <Input value={newFileUrl} onChange={e => setNewFileUrl(e.target.value)} placeholder="URL du fichier téléchargeable" className="flex-1" />
                <span className="text-xs text-muted-foreground">ou</span>
                <FilePickerBtn label="Choisir" onUploaded={(url, name) => { setNewFileUrl(url); if (!newFileName) setNewFileName(name); }} />
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={addFile} className="w-full">
              <Plus className="w-3 h-3 mr-1" />Ajouter un fichier
            </Button>
          </div>

          {/* Champs de livraison */}
          <div className="space-y-2">
            <Label>Mode de livraison des fichiers</Label>
            <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DELIVERY_METHODS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Le client choisira la méthode lors du checkout</p>
          </div>

          {/* Champs checkout */}
          <div className="space-y-2">
            <Label>Champs à remplir par le client lors de l'achat</Label>
            {checkoutFields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm flex-1 bg-muted px-3 py-1.5 rounded-md">{f.label}</span>
                <Badge variant="outline" className="text-xs">{f.required ? "Requis" : "Optionnel"}</Badge>
                <button onClick={() => setCheckoutFields(p => p.map((x, j) => j === i ? { ...x, required: !x.required } : x))}>
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
                <button onClick={() => setCheckoutFields(p => p.filter((_, j) => j !== i))}>
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} placeholder="Ex: Taille, couleur, adresse..." />
              <Button size="sm" variant="outline" onClick={addField}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name || !price} className="flex-1">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open, onClose, shopId, category
}: {
  open: boolean; onClose: () => void; shopId: string; category?: ShopCategory;
}) {
  const { toast } = useToast();
  const isEdit = !!category;
  const [name, setName] = useState(category?.name || "");
  const [imageUrl, setImageUrl] = useState(category?.imageUrl || "");

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const res = await apiRequest("PATCH", `/api/shop/categories/${category!.id}`, { name, imageUrl: imageUrl || null });
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/shop/categories", { name, imageUrl: imageUrl || null, shopId });
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Catégorie mise à jour" : "Catégorie ajoutée" });
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
      onClose();
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la catégorie" : "Ajouter une catégorie"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vêtements" />
          </div>
          <div className="space-y-2">
            <Label>Image de la catégorie</Label>
            {imageUrl ? (
              <div className="relative w-full h-36 rounded-xl overflow-hidden border group">
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                <button type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="border border-dashed rounded-xl h-24 flex items-center justify-center bg-muted/30">
                <ImagePickerBtn label="Choisir depuis la galerie" onUploaded={setImageUrl} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name} className="flex-1">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const FONT_OPTIONS = [
  { value: "Poppins",          label: "Poppins",           style: "Poppins" },
  { value: "Playfair Display", label: "Playfair Display",  style: "Playfair Display" },
  { value: "Montserrat",       label: "Montserrat",        style: "Montserrat" },
  { value: "Raleway",          label: "Raleway",           style: "Raleway" },
  { value: "Bebas Neue",       label: "Bebas Neue",        style: "Bebas Neue" },
  { value: "Dancing Script",   label: "Dancing Script",    style: "Dancing Script" },
  { value: "Josefin Sans",     label: "Josefin Sans",      style: "Josefin Sans" },
  { value: "Cinzel",           label: "Cinzel",            style: "Cinzel" },
  { value: "Pacifico",         label: "Pacifico",          style: "Pacifico" },
  { value: "Lobster",          label: "Lobster",           style: "Lobster" },
];

const COLOR_PRESETS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#000000", "#475569",
];

function loadGoogleFontDash(family: string) {
  const id = `gf-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700;900&display=swap`;
  document.head.appendChild(link);
}

function OrdersSection({ orders, products }: { orders: ShopOrder[]; products: ShopProduct[] }) {
  const visibleOrders = orders.filter(o => o.status !== "pending");
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Commandes reçues</h2>
      {visibleOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Aucune commande pour l'instant.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleOrders.map(order => {
            const prod = products.find(p => p.id === order.productId);
            return (
              <Card key={order.id} data-testid={`card-order-${order.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-medium text-sm">{prod?.name || "Produit"}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.customerName || "Client"} · {order.customerEmail || order.customerPhone || ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{order.amount.toLocaleString()} {order.currency}</p>
                      <Badge
                        variant={order.status === "completed" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {order.status === "completed" ? "Payé" : "Échoué"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsSection({ shop }: { shop: Shop }) {
  const { toast } = useToast();
  const [currency, setCurrency] = useState(shop.currency);
  const [customDomain, setCustomDomain] = useState(shop.customDomain || "");
  const [description, setDescription] = useState((shop as any).description || "");
  const [dnsStatus, setDnsStatus] = useState<"ok" | "error" | "checking" | null>(null);

  const checkDns = async () => {
    const domainToCheck = shop.customDomain;
    if (!domainToCheck) return;
    setDnsStatus("checking");
    try {
      const res = await fetch(`/api/shop/check-domain?domain=${encodeURIComponent(domainToCheck)}`, { credentials: "include" });
      const data = await res.json();
      setDnsStatus(data.ok ? "ok" : "error");
    } catch {
      setDnsStatus("error");
    }
  };
  const [slideshowUrls, setSlideshowUrls] = useState<string[]>(shop.slideshowUrls || []);
  const [fontFamily, setFontFamily] = useState((shop as any).fontFamily || "Poppins");
  const [primaryColor, setPrimaryColor] = useState((shop as any).primaryColor || "#6366f1");

  // Précharger toutes les polices pour la prévisualisation
  FONT_OPTIONS.forEach(f => loadGoogleFontDash(f.value));

  const mutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await apiRequest("PATCH", "/api/shop", updates);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Boutique mise à jour" });
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* URL publique */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-4 h-4" />
            URL de votre boutique
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
            <code className="text-sm flex-1">{window.location.host}/shop/{shop.slug}</code>
            <CopyButton value={`${window.location.origin}/shop/${shop.slug}`} />
            <a href={`/shop/${shop.slug}`} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost"><ExternalLink className="w-4 h-4" /></Button>
            </a>
          </div>
          <div className="space-y-3">
            <Label>Domaine personnalisé (optionnel)</Label>
            <div className="flex gap-2">
              <Input
                value={customDomain}
                onChange={e => { setCustomDomain(e.target.value); setDnsStatus(null); }}
                placeholder="maboutique.com ou shop.maboutique.com"
                data-testid="input-custom-domain"
              />
              <Button variant="outline"
                onClick={() => { mutation.mutate({ customDomain }); setDnsStatus(null); }}
                disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>

            {shop.customDomain && (() => {
              const savedDomain = shop.customDomain!.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
              const parts = savedDomain.split(".");
              const isSubdomain = parts.length > 2;
              const cnameNom = isSubdomain ? parts[0] : "www";
              const cnameTarget = `${shop.slug}-${shop.id.substring(0, 8)}.bkapay.com`;
              return (
                <div className="rounded-md border bg-muted/30 p-4 space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    Configuration DNS
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Dans votre gestionnaire DNS (Hostinger, OVH, GoDaddy…), ajoutez un enregistrement
                    de type <strong className="text-foreground">CNAME</strong> avec ces deux valeurs :
                  </p>

                  {/* Nom */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Champ Nom</p>
                    <div className="flex items-center gap-2 rounded-md bg-background border px-3 py-2.5">
                      <span className="font-mono font-bold text-sm flex-1 text-foreground">{cnameNom}</span>
                      <CopyButton value={cnameNom} />
                    </div>
                  </div>

                  {/* Valeur/Cible */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Champ Valeur (ou Cible / Pointe vers)</p>
                    <div className="flex items-center gap-2 rounded-md bg-background border px-3 py-2.5">
                      <span className="font-mono font-bold text-sm flex-1 text-foreground">{cnameTarget}</span>
                      <CopyButton value={cnameTarget} />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    La propagation peut prendre <strong>15 min à 24 h</strong> selon votre registrar.
                  </p>

                  <div className="flex items-center gap-3 pt-1 border-t border-border/50 flex-wrap">
                    <Button size="sm" variant="outline"
                      onClick={checkDns}
                      disabled={dnsStatus === "checking"}
                      data-testid="button-check-dns"
                    >
                      {dnsStatus === "checking"
                        ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                        : <RefreshCw className="w-3 h-3 mr-1.5" />}
                      Vérifier la connexion
                    </Button>
                    {dnsStatus === "ok" && (
                      <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        DNS connecté — votre domaine est actif
                      </span>
                    )}
                    {dnsStatus === "error" && (
                      <span className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        DNS non détecté — vérifiez la configuration ou réessayez dans quelques heures
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description de la boutique</CardTitle>
          <CardDescription>Ce texte apparaît sous le nom de votre boutique sur la page publique</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Décrivez votre boutique en quelques mots…"
            data-testid="input-shop-description-settings"
          />
          <Button
            variant="outline"
            onClick={() => mutation.mutate({ description })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      {/* Design — Police logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Typographie du logo</CardTitle>
          <CardDescription>
            Le nom de votre boutique s'affiche en grand sur la page publique avec la police choisie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview live */}
          <div className="w-full py-6 px-4 rounded-xl border bg-muted/30 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}30)` }}>
            <span
              className="text-4xl font-black tracking-tight"
              style={{ fontFamily: `'${fontFamily}', sans-serif`, color: primaryColor }}
            >
              {shop.name}
            </span>
          </div>

          <div className="space-y-2">
            <Label>Style de police</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FONT_OPTIONS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFontFamily(f.value)}
                  data-testid={`button-font-${f.value}`}
                  className="px-3 py-2.5 rounded-lg border-2 text-sm transition-all"
                  style={{
                    fontFamily: `'${f.style}', sans-serif`,
                    borderColor: fontFamily === f.value ? primaryColor : "transparent",
                    background: fontFamily === f.value ? `${primaryColor}15` : "var(--muted)",
                    color: fontFamily === f.value ? primaryColor : "inherit",
                    fontWeight: 700,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Couleur principale</Label>
            <div className="flex flex-wrap gap-2 items-center">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setPrimaryColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    background: c,
                    borderColor: primaryColor === c ? "white" : "transparent",
                    boxShadow: primaryColor === c ? `0 0 0 2px ${c}` : "none",
                  }}
                />
              ))}
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
                className="w-8 h-8 rounded-full border cursor-pointer"
                title="Couleur personnalisée"
              />
            </div>
          </div>

          <Button
            onClick={() => mutation.mutate({ fontFamily, primaryColor })}
            disabled={mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Enregistrer le design
          </Button>
        </CardContent>
      </Card>

      {/* Devise */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Devise de la boutique</CardTitle>
          <CardDescription>Tous les prix et paiements seront dans cette devise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger data-testid="select-shop-currency-settings">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => mutation.mutate({ currency })} disabled={mutation.isPending}>
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diaporama */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diaporama page d'accueil</CardTitle>
          <CardDescription>Jusqu'à 5 images affichées en rotation sur votre boutique publique</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {slideshowUrls.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {slideshowUrls.map((url, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden h-28 bg-muted">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-1.5 left-2 text-white text-xs font-bold drop-shadow">
                    {i + 1}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="absolute top-1.5 right-1.5 bg-destructive text-white rounded-full p-1 shadow-md">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette photo ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          La photo numéro {i + 1} sera retirée du diaporama. Cliquez sur "Enregistrer le diaporama" après pour valider.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          onClick={() => setSlideshowUrls(p => p.filter((_, j) => j !== i))}
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed rounded-xl p-6 text-center text-muted-foreground text-sm">
              Aucune image ajoutée. Ajoutez des images pour illustrer votre boutique.
            </div>
          )}
          {slideshowUrls.length < 5 && (
            <div className="flex items-center justify-center py-2">
              <ImagePickerBtn
                label={`Ajouter une photo (${slideshowUrls.length}/5)`}
                onUploaded={url => setSlideshowUrls(p => [...p, url])}
              />
            </div>
          )}
          <Button
            className="w-full"
            onClick={() => mutation.mutate({ slideshowUrls })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImagePlus className="w-4 h-4 mr-2" />}
            Enregistrer le diaporama
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ShopPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"products" | "categories" | "orders" | "settings" | "api">("products");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | undefined>();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ShopCategory | undefined>();

  const { data, isLoading } = useQuery<ShopData | null>({
    queryKey: ["/api/shop"],
    refetchInterval: 30000,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shop/seed-defaults", {});
      return res.json();
    },
    onSuccess: (d) => {
      if (d.created > 0) {
        toast({ title: `${d.created} produits exemples créés`, description: "Vous pouvez les modifier ou supprimer depuis l'onglet Produits." });
        queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
      }
    },
  });

  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (data?.shop && data.products.length === 0 && data.categories.length > 0 && !seedMutation.isPending && !hasSeededRef.current) {
      hasSeededRef.current = true;
      seedMutation.mutate();
    }
  }, [data?.products?.length, data?.categories?.length, data?.shop?.id]);

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/shop/products/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Produit supprimé" });
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/shop/categories/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Catégorie supprimée" });
      queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <CreateShopForm onCreated={() => {}} />
      </div>
    );
  }

  const { shop, categories, products, orders } = data;

  const TABS = [
    { id: "products", label: "Produits", icon: Package, count: products.length },
    { id: "categories", label: "Catégories", icon: Tag, count: categories.length },
    { id: "orders", label: "Commandes", icon: ShoppingBag, count: orders.length },
    { id: "settings", label: "Paramètres", icon: Globe },
    { id: "api", label: "Paiement", icon: Key },
  ] as const;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="w-6 h-6" />
            {shop.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <a href={`/shop/${shop.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
              {shop.slug}.bkapay.com <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={shop.isActive ? "default" : "secondary"}>
            {shop.isActive ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="outline">{shop.currency}</Badge>
          <a href={`/shop/${shop.slug}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" data-testid="button-view-shop">
              <Eye className="w-3 h-3 mr-1" />Voir la boutique
            </Button>
          </a>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{products.length}</p>
            <p className="text-xs text-muted-foreground">Produits</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{orders.filter(o => o.status === "completed").length}</p>
            <p className="text-xs text-muted-foreground">Ventes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {orders.filter(o => o.status === "completed").reduce((s, o) => s + o.amount, 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{shop.currency}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            data-testid={`tab-shop-${tab.id}`}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {"count" in tab && tab.count > 0 && (
              <Badge variant="secondary" className="text-xs">{tab.count}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Produits */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Mes produits</h2>
            <Button size="sm" onClick={() => { setEditingProduct(undefined); setProductDialogOpen(true); }} data-testid="button-add-product">
              <Plus className="w-4 h-4 mr-1" />Ajouter
            </Button>
          </div>
          {products.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucun produit. Ajoutez votre premier produit !</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {products.map(p => {
                const cat = categories.find(c => c.id === p.categoryId);
                return (
                  <Card key={p.id} data-testid={`card-product-${p.id}`}>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {p.imageUrls?.[0] ? (
                          <img src={p.imageUrls[0]} alt={p.name} className="w-16 h-16 rounded-md object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm truncate">{p.name}</p>
                              {cat && <Badge variant="outline" className="text-xs mt-0.5">{cat.name}</Badge>}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button size="icon" variant="ghost" onClick={() => { setEditingProduct(p); setProductDialogOpen(true); }}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost"><Trash2 className="w-3 h-3 text-destructive" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer "{p.name}" ?</AlertDialogTitle>
                                    <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteProductMutation.mutate(p.id)}>Supprimer</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          <p className="text-sm font-semibold mt-1">{p.price.toLocaleString()} {shop.currency}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={p.isActive ? "default" : "secondary"} className="text-xs">
                              {p.isActive ? "Actif" : "Inactif"}
                            </Badge>
                            {p.stock != null && <span className="text-xs text-muted-foreground">Stock: {p.stock}</span>}
                            {(p.downloadableFiles?.length ?? 0) > 0 && (
                              <Badge variant="outline" className="text-xs"><Download className="w-2.5 h-2.5 mr-0.5" />{p.downloadableFiles!.length}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Catégories */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Catégories</h2>
            <Button size="sm" onClick={() => { setEditingCategory(undefined); setCategoryDialogOpen(true); }} data-testid="button-add-category">
              <Plus className="w-4 h-4 mr-1" />Ajouter
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map(cat => (
              <Card key={cat.id} data-testid={`card-category-${cat.id}`}>
                <CardContent className="p-3">
                  {cat.imageUrl && (
                    <img src={cat.imageUrl} alt={cat.name} className="w-full h-24 object-cover rounded-md mb-2" />
                  )}
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{cat.name}</p>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingCategory(cat); setCategoryDialogOpen(true); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost"><Trash2 className="w-3 h-3 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer "{cat.name}" ?</AlertDialogTitle>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCategoryMutation.mutate(cat.id)}>Supprimer</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Commandes */}
      {activeTab === "orders" && (
        <OrdersSection orders={orders} products={products} />
      )}

      {/* Paramètres */}
      {activeTab === "settings" && <SettingsSection shop={shop} />}

      {/* API / Paiement */}
      {activeTab === "api" && <ApiKeySection shop={shop} />}

      {/* Dialogs */}
      {productDialogOpen && (
        <ProductDialog
          open={productDialogOpen}
          onClose={() => { setProductDialogOpen(false); setEditingProduct(undefined); }}
          shopId={shop.id}
          categories={categories}
          product={editingProduct}
        />
      )}
      {categoryDialogOpen && (
        <CategoryDialog
          open={categoryDialogOpen}
          onClose={() => { setCategoryDialogOpen(false); setEditingCategory(undefined); }}
          shopId={shop.id}
          category={editingCategory}
        />
      )}
    </div>
  );
}
