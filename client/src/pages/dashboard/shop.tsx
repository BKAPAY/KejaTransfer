import { useState } from "react";
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
  Globe, Key, Eye, EyeOff, Copy, Check, ImagePlus, X, Download, Loader2, ExternalLink
} from "lucide-react";
import type { Shop, ShopCategory, ShopProduct, ShopOrder } from "@shared/schema";

type ShopData = {
  shop: Shop;
  categories: ShopCategory[];
  products: ShopProduct[];
  orders: ShopOrder[];
};

const CURRENCIES = ["XOF", "XAF", "CDF", "USD", "EUR", "GHS", "NGN", "MAD", "TND", "GNF", "GMD", "RWF"];

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

function CreateShopForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("XOF");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description, currency }),
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
          <CardDescription>Donnez un nom à votre boutique et commencez à vendre en ligne</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shop-name">Nom de la boutique *</Label>
            <Input
              id="shop-name"
              data-testid="input-shop-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Ma Boutique Bénin"
            />
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
            disabled={mutation.isPending || !name.trim()}
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
  const [showKey, setShowKey] = useState(false);

  const { data: apiKeyData } = useQuery<any>({
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

  if (!shop.apiKeyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4" />
            Liaison paiement
          </CardTitle>
          <CardDescription>
            Liez votre boutique à votre clé API pour accepter des paiements. Votre compte doit être vérifié (KYC).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending} data-testid="button-link-api-key">
            {linkMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Liaison...</> : <><Key className="w-4 h-4 mr-2" />Lier ma clé API</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Key className="w-4 h-4" />
          Clé API boutique
          <Badge variant="secondary" className="text-xs">Configurée</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {apiKeyData && (
          <>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Clé publique</p>
              <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                <code className="text-xs flex-1 truncate">{apiKeyData.publicKey}</code>
                <CopyButton value={apiKeyData.publicKey} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Clé privée</p>
              <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                <code className="text-xs flex-1 truncate">
                  {showKey ? apiKeyData.privateKey : "••••••••••••••••••••••••"}
                </code>
                <Button size="icon" variant="ghost" onClick={() => setShowKey(s => !s)}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                {showKey && <CopyButton value={apiKeyData.privateKey} />}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">URL Webhook</p>
              <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                <code className="text-xs flex-1 truncate">{apiKeyData.callbackUrl}</code>
                <CopyButton value={apiKeyData.callbackUrl || ""} />
              </div>
            </div>
          </>
        )}
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
                  <SelectItem value="">Aucune</SelectItem>
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
                <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setImageUrls(p => p.filter((_, j) => j !== i))}
                    className="absolute top-0 right-0 bg-destructive text-white rounded-bl-md p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {imageUrls.length < 3 && (
              <div className="flex gap-2">
                <Input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="URL de l'image" />
                <Button size="sm" variant="outline" onClick={addImage}><ImagePlus className="w-4 h-4" /></Button>
              </div>
            )}
          </div>

          {/* Fichiers téléchargeables */}
          <div className="space-y-2">
            <Label>Fichiers téléchargeables après paiement</Label>
            {downloadableFiles.map((url, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
                <Download className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs flex-1 truncate">{downloadableFileNames[i] || url}</span>
                <button onClick={() => {
                  setDownloadableFiles(p => p.filter((_, j) => j !== i));
                  setDownloadableFileNames(p => p.filter((_, j) => j !== i));
                }}><X className="w-3 h-3 text-muted-foreground" /></button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <Input value={newFileName} onChange={e => setNewFileName(e.target.value)} placeholder="Nom du fichier" />
              <Input value={newFileUrl} onChange={e => setNewFileUrl(e.target.value)} placeholder="URL du fichier" />
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
            <Label>Image (URL)</Label>
            <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
            {imageUrl && <img src={imageUrl} alt="" className="w-full h-32 object-cover rounded-md" />}
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

function SettingsSection({ shop }: { shop: Shop }) {
  const { toast } = useToast();
  const [currency, setCurrency] = useState(shop.currency);
  const [customDomain, setCustomDomain] = useState(shop.customDomain || "");
  const [slideshowUrls, setSlideshowUrls] = useState<string[]>(shop.slideshowUrls || []);
  const [newSlide, setNewSlide] = useState("");
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
          <div className="space-y-2">
            <Label>Domaine personnalisé (optionnel)</Label>
            <div className="flex gap-2">
              <Input
                value={customDomain}
                onChange={e => setCustomDomain(e.target.value)}
                placeholder="maboutique.com"
                data-testid="input-custom-domain"
              />
              <Button variant="outline" onClick={() => mutation.mutate({ customDomain })}
                disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Créez un enregistrement CNAME vers <code>shops.bkapay.com</code> chez votre registrar.
            </p>
          </div>
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
                <div key={i} className="relative rounded-xl overflow-hidden h-28 group bg-muted">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => setSlideshowUrls(p => p.filter((_, j) => j !== i))}
                      className="bg-destructive text-white rounded-full p-1.5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-1.5 left-2 text-white text-xs font-bold drop-shadow">
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed rounded-xl p-6 text-center text-muted-foreground text-sm">
              Aucune image ajoutée. Ajoutez des images pour illustrer votre boutique.
            </div>
          )}
          {slideshowUrls.length < 5 && (
            <div className="flex gap-2">
              <Input
                value={newSlide}
                onChange={e => setNewSlide(e.target.value)}
                placeholder="URL de l'image (https://...)"
                onKeyDown={e => {
                  if (e.key === "Enter" && newSlide.trim()) {
                    setSlideshowUrls(p => [...p, newSlide.trim()]);
                    setNewSlide("");
                  }
                }}
              />
              <Button size="icon" variant="outline" onClick={() => {
                if (!newSlide.trim()) return;
                setSlideshowUrls(p => [...p, newSlide.trim()]);
                setNewSlide("");
              }}><Plus className="w-4 h-4" /></Button>
            </div>
          )}
          <Button
            variant="outline"
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
  });

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
        <div className="space-y-3">
          <h2 className="font-semibold">Commandes reçues</h2>
          {orders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucune commande pour l'instant.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {orders.map(order => {
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
                            variant={order.status === "completed" ? "default" : order.status === "failed" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {order.status === "completed" ? "Payé" : order.status === "failed" ? "Échoué" : "En attente"}
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
