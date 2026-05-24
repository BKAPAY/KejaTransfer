import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  ShoppingCart, Package, ChevronLeft, ChevronRight, X, Download,
  Phone, Mail, Store, Tag, Globe, Loader2, MessageCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Shop, ShopCategory, ShopProduct } from "@shared/schema";

type PublicShopData = {
  shop: Omit<Shop, "apiKeyId">;
  categories: ShopCategory[];
  products: ShopProduct[];
};

declare global {
  interface Window {
    BKAPayInline?: any;
  }
}

function Slideshow({ urls }: { urls: string[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (urls.length <= 1) return;
    const id = setInterval(() => setCurrent(c => (c + 1) % urls.length), 4000);
    return () => clearInterval(id);
  }, [urls.length]);

  if (!urls.length) return null;

  return (
    <div className="relative w-full h-72 md:h-96 overflow-hidden bg-gray-900">
      {urls.map((url, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`}
        >
          <img src={url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        </div>
      ))}
      {urls.length > 1 && (
        <>
          <button
            onClick={() => setCurrent(c => (c - 1 + urls.length) % urls.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrent(c => (c + 1) % urls.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === current ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProductDetailDialog({
  product, shop, categories, open, onClose
}: {
  product: ShopProduct;
  shop: PublicShopData["shop"];
  categories: ShopCategory[];
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [checkoutData, setCheckoutData] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<string>(product.deliveryMethod || "email");
  const [paying, setPaying] = useState(false);

  const hasDownloadable = (product.downloadableFiles?.length ?? 0) > 0;
  const checkoutFields = (product.checkoutFields as { label: string; required: boolean }[]) || [];
  const cat = categories.find(c => c.id === product.categoryId);
  const photos = product.imageUrls?.length ? product.imageUrls : [];

  // Fetch public key for payment
  const { data: paymentConfig } = useQuery<{ publicKey: string; siteName: string } | null>({
    queryKey: ["/api/shop/public", shop.slug, "api-public-key"],
    queryFn: async () => {
      const res = await fetch(`/api/shop/public/${shop.slug}/api-public-key`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: open,
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: shop.id,
          productId: product.id,
          customerName: customerName || null,
          customerEmail: customerEmail || null,
          customerPhone: customerPhone || null,
          checkoutData,
          deliveryMethod,
        }),
      });
      return res.json();
    },
    onSuccess: async (data) => {
      if (!data.success || !data.order) {
        toast({ title: "Erreur", description: "Impossible de créer la commande.", variant: "destructive" });
        return;
      }
      if (!paymentConfig?.publicKey) {
        toast({ title: "Paiement non configuré", description: "Cette boutique n'accepte pas encore les paiements.", variant: "destructive" });
        return;
      }
      // Launch BKApay Inline
      if (!window.BKAPayInline) {
        toast({ title: "Erreur", description: "Module de paiement non chargé.", variant: "destructive" });
        return;
      }
      setPaying(true);
      try {
        window.BKAPayInline.setup({
          public_key: paymentConfig.publicKey,
          tx_ref: data.order.id,
          amount: product.price,
          currency: shop.currency,
          customer: {
            name: customerName || "Client",
            email: customerEmail || "",
            phone: customerPhone || "",
          },
          meta: { orderId: data.order.id },
          callback: async (response: any) => {
            if (response.status === "completed" || response.status === "success") {
              await fetch(`/api/shop/orders/${data.order.id}/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentReference: response.reference }),
              });
              toast({ title: "Paiement réussi !", description: "Merci pour votre achat." });
              onClose();
            }
            setPaying(false);
          },
          onclose: () => setPaying(false),
        });
        window.BKAPayInline.open();
      } catch {
        setPaying(false);
        toast({ title: "Erreur paiement", variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const canSubmit = () => {
    if (checkoutFields.some(f => f.required && !checkoutData[f.label]?.trim())) return false;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-left">{product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Photos */}
          {photos.length > 0 && (
            <div className="space-y-2">
              <div className="relative h-56 rounded-lg overflow-hidden">
                <img src={photos[photoIndex]} alt={product.name} className="w-full h-full object-cover" />
              </div>
              {photos.length > 1 && (
                <div className="flex gap-2">
                  {photos.map((url, i) => (
                    <button key={i} onClick={() => setPhotoIndex(i)}
                      className={`w-14 h-14 rounded-md overflow-hidden border-2 transition-colors ${i === photoIndex ? "border-primary" : "border-transparent"}`}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Infos */}
          <div>
            {cat && <Badge variant="outline" className="mb-2">{cat.name}</Badge>}
            {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
            <p className="text-2xl font-bold mt-2">
              {product.price.toLocaleString()} <span className="text-base font-normal text-muted-foreground">{shop.currency}</span>
            </p>
            {product.stock != null && (
              <p className="text-xs text-muted-foreground">Stock disponible : {product.stock}</p>
            )}
          </div>

          {/* Fichiers téléchargeables */}
          {hasDownloadable && (
            <div className="bg-muted/50 rounded-md p-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <p className="text-xs">
                Ce produit inclut {product.downloadableFiles!.length} fichier{product.downloadableFiles!.length > 1 ? "s" : ""} téléchargeable{product.downloadableFiles!.length > 1 ? "s" : ""} envoyé{product.downloadableFiles!.length > 1 ? "s" : ""} après paiement.
              </p>
            </div>
          )}

          {/* Mode de livraison (si fichiers) */}
          {hasDownloadable && (
            <div className="space-y-2">
              <Label>Comment souhaitez-vous recevoir vos fichiers ?</Label>
              <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email"><Mail className="w-3 h-3 inline mr-1" />Par email</SelectItem>
                  <SelectItem value="whatsapp"><MessageCircle className="w-3 h-3 inline mr-1" />Par WhatsApp</SelectItem>
                  <SelectItem value="both"><Mail className="w-3 h-3 inline mr-1" />Email + WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Infos client */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Vos informations</p>
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Jean Dupont"
                data-testid="input-customer-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email {hasDownloadable && deliveryMethod !== "whatsapp" ? "*" : ""}</Label>
              <Input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="jean@exemple.com"
                data-testid="input-customer-email"
              />
            </div>
            <div className="space-y-2">
              <Label>Téléphone / WhatsApp {hasDownloadable && deliveryMethod !== "email" ? "*" : ""}</Label>
              <Input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+229 XXXXXXXXXX"
                data-testid="input-customer-phone"
              />
            </div>
          </div>

          {/* Champs custom */}
          {checkoutFields.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Informations supplémentaires</p>
              {checkoutFields.map((field, i) => (
                <div key={i} className="space-y-2">
                  <Label>{field.label}{field.required ? " *" : ""}</Label>
                  <Input
                    value={checkoutData[field.label] || ""}
                    onChange={e => setCheckoutData(d => ({ ...d, [field.label]: e.target.value }))}
                    placeholder={field.label}
                    data-testid={`input-checkout-field-${i}`}
                  />
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => createOrderMutation.mutate()}
            disabled={createOrderMutation.isPending || paying || !canSubmit()}
            data-testid="button-pay-now"
          >
            {(createOrderMutation.isPending || paying)
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Préparation du paiement...</>
              : <><ShoppingCart className="w-4 h-4 mr-2" />Payer {product.price.toLocaleString()} {shop.currency}</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ShopPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);

  const { data, isLoading, isError } = useQuery<PublicShopData>({
    queryKey: ["/api/shop/public", slug],
    queryFn: async () => {
      const res = await fetch(`/api/shop/public/${slug}`);
      if (!res.ok) throw new Error("Boutique introuvable");
      return res.json();
    },
    retry: false,
  });

  // Inject BKApay Inline script
  useEffect(() => {
    if (document.getElementById("bkapay-inline-script")) return;
    const script = document.createElement("script");
    script.id = "bkapay-inline-script";
    script.src = "https://bkapay.com/assets/inline/v1.6/bkapay-inline.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Store className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Boutique introuvable</h1>
        <p className="text-muted-foreground">Cette boutique n'existe pas ou n'est plus active.</p>
        <a href="/" className="text-primary hover:underline text-sm">Retour à BKApay</a>
      </div>
    );
  }

  const { shop, categories, products } = data;

  const filteredProducts = activeCategoryId === "all"
    ? products
    : products.filter(p => p.categoryId === activeCategoryId);

  const categoriesWithProducts = categories.filter(cat =>
    products.some(p => p.categoryId === cat.id)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header boutique */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt={shop.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-lg leading-tight">{shop.name}</h1>
              <p className="text-xs text-muted-foreground">{products.length} produit{products.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">{shop.currency}</Badge>
        </div>
      </header>

      {/* Diaporama */}
      {(shop.slideshowUrls?.length ?? 0) > 0 && (
        <div className="relative">
          <Slideshow urls={shop.slideshowUrls!} />
          <div className="absolute bottom-6 left-0 right-0 text-center px-4 z-10">
            <h2 className="text-white text-3xl font-bold drop-shadow-lg">{shop.name}</h2>
            {shop.description && (
              <p className="text-white/90 text-sm mt-1 drop-shadow">{shop.description}</p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Filtre catégories */}
        {categoriesWithProducts.length > 0 && (
          <div className="mb-6">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setActiveCategoryId("all")}
                data-testid="filter-category-all"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                  activeCategoryId === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                Tous
              </button>
              {categoriesWithProducts.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  data-testid={`filter-category-${cat.id}`}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                    activeCategoryId === cat.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {cat.imageUrl && (
                    <img src={cat.imageUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                  )}
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grille produits par catégorie */}
        {activeCategoryId === "all" && categoriesWithProducts.length > 0 ? (
          <div className="space-y-10">
            {categoriesWithProducts.map(cat => {
              const catProducts = products.filter(p => p.categoryId === cat.id);
              if (!catProducts.length) return null;
              return (
                <section key={cat.id}>
                  <div className="flex items-center gap-3 mb-4">
                    {cat.imageUrl && (
                      <img src={cat.imageUrl} alt={cat.name} className="w-10 h-10 rounded-full object-cover" />
                    )}
                    <h2 className="text-xl font-semibold">{cat.name}</h2>
                    <div className="flex-1 border-b" />
                  </div>
                  <ProductGrid products={catProducts} shop={shop} onSelect={setSelectedProduct} />
                </section>
              );
            })}

            {/* Produits sans catégorie */}
            {(() => {
              const uncategorized = products.filter(p => !p.categoryId);
              if (!uncategorized.length) return null;
              return (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xl font-semibold">Autres produits</h2>
                    <div className="flex-1 border-b" />
                  </div>
                  <ProductGrid products={uncategorized} shop={shop} onSelect={setSelectedProduct} />
                </section>
              );
            })()}
          </div>
        ) : (
          <div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Aucun produit dans cette catégorie.</p>
              </div>
            ) : (
              <ProductGrid products={filteredProducts} shop={shop} onSelect={setSelectedProduct} />
            )}
          </div>
        )}
      </div>

      {/* Footer boutique */}
      <footer className="border-t mt-12 py-6 text-center text-xs text-muted-foreground">
        <p>Boutique propulsée par <a href="/" className="font-semibold text-primary hover:underline">BKApay</a></p>
      </footer>

      {/* Product detail dialog */}
      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          shop={shop}
          categories={categories}
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

function ProductGrid({
  products, shop, onSelect
}: {
  products: ShopProduct[];
  shop: PublicShopData["shop"];
  onSelect: (p: ShopProduct) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          data-testid={`card-public-product-${p.id}`}
          className="text-left group"
        >
          <Card className="overflow-hidden hover-elevate">
            <div className="aspect-square bg-muted overflow-hidden">
              {p.imageUrls?.[0] ? (
                <img
                  src={p.imageUrls[0]}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-10 h-10 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <CardContent className="p-3">
              <p className="font-medium text-sm leading-tight line-clamp-2">{p.name}</p>
              <p className="font-bold text-sm mt-1">{p.price.toLocaleString()} <span className="font-normal text-muted-foreground text-xs">{shop.currency}</span></p>
              {p.stock === 0 && <Badge variant="secondary" className="text-xs mt-1">Rupture</Badge>}
              {(p.downloadableFiles?.length ?? 0) > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Download className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Téléchargeable</span>
                </div>
              )}
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}
