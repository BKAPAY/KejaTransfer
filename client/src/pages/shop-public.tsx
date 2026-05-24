import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  ShoppingCart, Package, ChevronLeft, ChevronRight, Download,
  Store, Loader2, MessageCircle, Mail, Search, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Shop, ShopCategory, ShopProduct } from "@shared/schema";

type PublicShopData = {
  shop: Omit<Shop, "apiKeyId">;
  categories: ShopCategory[];
  products: ShopProduct[];
};

declare global {
  interface Window { BKAPayInline?: any; }
}

// ── Google Fonts loader ─────────────────────────────────────────────────────
function loadGoogleFont(family: string) {
  const id = `gf-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;600;700;900&display=swap`;
  document.head.appendChild(link);
}

// ── Slideshow ───────────────────────────────────────────────────────────────
function Slideshow({ urls, shopName, description, font, color }: {
  urls: string[]; shopName: string; description?: string | null; font: string; color: string;
}) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (urls.length <= 1) return;
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % urls.length), 5000);
  };

  useEffect(() => { startTimer(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [urls.length]);

  const go = (dir: number) => {
    setCurrent(c => (c + dir + urls.length) % urls.length);
    startTimer();
  };

  if (!urls.length) {
    return (
      <div className="w-full h-64 md:h-80 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${color}22 0%, ${color}44 100%)` }}>
        <div className="text-center px-6">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight"
            style={{ fontFamily: `'${font}', sans-serif`, color }}>
            {shopName}
          </h1>
          {description && (
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-lg">{description}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-72 md:h-[480px] overflow-hidden bg-gray-900">
      {urls.map((url, i) => (
        <div key={i} className={`absolute inset-0 transition-opacity duration-1000 ${i === current ? "opacity-100" : "opacity-0"}`}>
          <img src={url} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Shop name as logo overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-10 md:pb-14 text-center">
        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-black text-white drop-shadow-lg tracking-tight leading-tight"
          style={{ fontFamily: `'${font}', sans-serif`, textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}
        >
          {shopName}
        </h1>
        {description && (
          <p className="text-white/80 mt-2 text-sm md:text-base max-w-2xl mx-auto drop-shadow">
            {description}
          </p>
        )}
      </div>

      {/* Navigation */}
      {urls.length > 1 && (
        <>
          <button onClick={() => go(-1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white rounded-full p-2.5 transition-colors backdrop-blur-sm">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => go(1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/60 text-white rounded-full p-2.5 transition-colors backdrop-blur-sm">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {urls.map((_, i) => (
              <button key={i} onClick={() => { setCurrent(i); startTimer(); }}
                className={`rounded-full transition-all ${i === current ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Product Buy Dialog ──────────────────────────────────────────────────────
function BuyDialog({ product, shop, categories, open, onClose }: {
  product: ShopProduct; shop: PublicShopData["shop"];
  categories: ShopCategory[]; open: boolean; onClose: () => void;
}) {
  const { toast } = useToast();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [checkoutData, setCheckoutData] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState(product.deliveryMethod || "email");
  const [paying, setPaying] = useState(false);

  const hasDownloadable = (product.downloadableFiles?.length ?? 0) > 0;
  const checkoutFields = (product.checkoutFields as { label: string; required: boolean }[]) || [];
  const cat = categories.find(c => c.id === product.categoryId);
  const photos = product.imageUrls?.length ? product.imageUrls : [];
  const color = (shop as any).primaryColor || "#6366f1";

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      return data;
    },
    onSuccess: async (data) => {
      if (!paymentConfig?.publicKey) {
        toast({ title: "Paiement non configuré", description: "Cette boutique n'accepte pas encore les paiements en ligne.", variant: "destructive" });
        return;
      }
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
          customer: { name: customerName || "Client", email: customerEmail || "", phone: customerPhone || "" },
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
    onError: (err: any) => toast({ title: "Erreur", description: err?.message, variant: "destructive" }),
  });

  const canSubmit = () => !checkoutFields.some(f => f.required && !checkoutData[f.label]?.trim());

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-0">
        {/* Product header */}
        <div className="relative">
          {photos.length > 0 ? (
            <div className="relative h-52 overflow-hidden rounded-t-lg">
              <img src={photos[photoIndex]} alt={product.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              {photos.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {photos.map((_, i) => (
                    <button key={i} onClick={() => setPhotoIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === photoIndex ? "bg-white" : "bg-white/40"}`} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-24 rounded-t-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${color}20, ${color}40)` }}>
              <Package className="w-12 h-12 opacity-30" />
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-left">{product.name}</DialogTitle>
          </DialogHeader>
          {cat && <Badge variant="outline">{cat.name}</Badge>}
          {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black" style={{ color }}>
              {product.price.toLocaleString()}
            </span>
            <span className="text-muted-foreground font-medium">{shop.currency}</span>
          </div>

          {hasDownloadable && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: `${color}10` }}>
              <Download className="w-4 h-4" style={{ color }} />
              <span>{product.downloadableFiles!.length} fichier{product.downloadableFiles!.length > 1 ? "s" : ""} inclus après paiement</span>
            </div>
          )}

          {hasDownloadable && (
            <div className="space-y-1.5">
              <Label>Réception des fichiers</Label>
              <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email"><Mail className="w-3 h-3 inline mr-1" />Email</SelectItem>
                  <SelectItem value="whatsapp"><MessageCircle className="w-3 h-3 inline mr-1" />WhatsApp</SelectItem>
                  <SelectItem value="both">Email + WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3 pt-1">
            <p className="text-sm font-semibold text-foreground">Vos coordonnées</p>
            <div className="grid grid-cols-1 gap-2">
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="Nom complet" data-testid="input-customer-name" />
              <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
                placeholder="Email" data-testid="input-customer-email" />
              <Input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Téléphone / WhatsApp (+229...)" data-testid="input-customer-phone" />
            </div>
          </div>

          {checkoutFields.length > 0 && (
            <div className="space-y-2">
              {checkoutFields.map((field, i) => (
                <div key={i}>
                  <Label className="text-sm">{field.label}{field.required ? " *" : ""}</Label>
                  <Input value={checkoutData[field.label] || ""}
                    onChange={e => setCheckoutData(d => ({ ...d, [field.label]: e.target.value }))}
                    placeholder={field.label} />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => createOrderMutation.mutate()}
            disabled={createOrderMutation.isPending || paying || !canSubmit()}
            className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
            data-testid="button-pay-now"
          >
            {(createOrderMutation.isPending || paying)
              ? <><Loader2 className="w-5 h-5 animate-spin" />Préparation...</>
              : <><ShoppingCart className="w-5 h-5" />Acheter — {product.price.toLocaleString()} {shop.currency}</>
            }
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Product Card ────────────────────────────────────────────────────────────
function ProductCard({ product, shop, onSelect }: {
  product: ShopProduct; shop: PublicShopData["shop"]; onSelect: () => void;
}) {
  const color = (shop as any).primaryColor || "#6366f1";
  const hasImage = product.imageUrls?.length > 0;
  const isOutOfStock = product.stock === 0;

  return (
    <button
      onClick={onSelect}
      disabled={isOutOfStock}
      data-testid={`card-public-product-${product.id}`}
      className="text-left group w-full bg-card border rounded-2xl overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="aspect-square overflow-hidden relative"
        style={{ background: hasImage ? undefined : `linear-gradient(135deg, ${color}15, ${color}30)` }}>
        {hasImage ? (
          <img src={product.imageUrls[0]} alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 opacity-20" />
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-xs font-bold px-2 py-1 bg-black/60 rounded-full">Rupture de stock</span>
          </div>
        )}
        {(product.downloadableFiles?.length ?? 0) > 0 && (
          <div className="absolute top-2 right-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white flex items-center gap-1"
              style={{ background: color }}>
              <Download className="w-2.5 h-2.5" />Numérique
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-sm leading-snug line-clamp-2 text-foreground">{product.name}</p>
        {product.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>
        )}
        <p className="font-black text-base mt-2" style={{ color }}>
          {product.price.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{shop.currency}</span>
        </p>
      </div>
    </button>
  );
}

// ── Main Public Page ────────────────────────────────────────────────────────
export default function ShopPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery<PublicShopData>({
    queryKey: ["/api/shop/public", slug],
    queryFn: async () => {
      const res = await fetch(`/api/shop/public/${slug}`);
      if (!res.ok) throw new Error("Boutique introuvable");
      return res.json();
    },
    retry: false,
  });

  const font = (data?.shop as any)?.fontFamily || "Poppins";
  const color = (data?.shop as any)?.primaryColor || "#6366f1";

  // Load Google Font + BKApay Inline script
  useEffect(() => {
    loadGoogleFont(font);
    if (!document.getElementById("bkapay-inline-script")) {
      const script = document.createElement("script");
      script.id = "bkapay-inline-script";
      script.src = "https://bkapay.com/assets/inline/v1.6/bkapay-inline.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, [font]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Store className="w-10 h-10 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground text-sm">Chargement de la boutique...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center bg-background">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
          <Store className="w-10 h-10 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Boutique introuvable</h1>
          <p className="text-muted-foreground mt-1">Cette boutique n'existe pas ou n'est plus disponible.</p>
        </div>
        <a href="https://bkapay.com" className="text-sm font-medium" style={{ color }}>
          Créer votre boutique sur BKApay →
        </a>
      </div>
    );
  }

  const { shop, categories, products } = data;

  // Filter products
  const filtered = products.filter(p => {
    const matchCat = activeCategoryId === "all" || p.categoryId === activeCategoryId;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // Group by category for "all" view
  const productsByCat: Record<string, ShopProduct[]> = {};
  if (activeCategoryId === "all" && !search) {
    for (const p of products) {
      const key = p.categoryId || "__none";
      if (!productsByCat[key]) productsByCat[key] = [];
      productsByCat[key].push(p);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt={shop.name}
                className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
                {shop.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-black text-xl truncate hidden sm:block"
              style={{ fontFamily: `'${font}', sans-serif`, color }}>
              {shop.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="pl-8 pr-8 h-9 w-40 md:w-56 text-sm rounded-full"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Badge variant="outline" className="text-xs shrink-0">{shop.currency}</Badge>
          </div>
        </div>
      </header>

      {/* ── Hero Slideshow ── */}
      <Slideshow
        urls={shop.slideshowUrls || []}
        shopName={shop.name}
        description={shop.description}
        font={font}
        color={color}
      />

      {/* ── Stats bar ── */}
      <div className="border-b bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="font-medium">{products.length} produit{products.length > 1 ? "s" : ""}</span>
          {categories.length > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              <span>{categories.length} catégorie{categories.length > 1 ? "s" : ""}</span>
            </>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">

        {/* ── Category Filters ── */}
        {categories.length > 0 && (
          <div className="mb-8">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setActiveCategoryId("all")}
                data-testid="filter-category-all"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border-2 flex-shrink-0"
                style={activeCategoryId === "all"
                  ? { background: color, color: "white", borderColor: color }
                  : { borderColor: "transparent", background: "var(--muted)" }}
              >
                Tous
                <span className="text-xs opacity-75">({products.length})</span>
              </button>
              {categories.map(cat => {
                const count = products.filter(p => p.categoryId === cat.id).length;
                const isActive = activeCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategoryId(cat.id)}
                    data-testid={`filter-category-${cat.id}`}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border-2 flex-shrink-0"
                    style={isActive
                      ? { background: color, color: "white", borderColor: color }
                      : { borderColor: "transparent", background: "var(--muted)" }}
                  >
                    {cat.imageUrl && (
                      <img src={cat.imageUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                    )}
                    {cat.name}
                    <span className="text-xs opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Products ── */}
        {search ? (
          // Search results
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {filtered.length} résultat{filtered.length > 1 ? "s" : ""} pour « {search} »
            </p>
            {filtered.length === 0 ? (
              <EmptyState color={color} message={`Aucun produit pour "${search}"`} />
            ) : (
              <ProductsGrid products={filtered} shop={shop} onSelect={setSelectedProduct} />
            )}
          </div>
        ) : activeCategoryId !== "all" ? (
          // Single category view
          <div>
            {filtered.length === 0 ? (
              <EmptyState color={color} message="Aucun produit dans cette catégorie" />
            ) : (
              <ProductsGrid products={filtered} shop={shop} onSelect={setSelectedProduct} />
            )}
          </div>
        ) : (
          // All products, grouped by category
          <div className="space-y-12">
            {categories.filter(cat => (productsByCat[cat.id] || []).length > 0).map(cat => {
              const catProducts = productsByCat[cat.id] || [];
              return (
                <section key={cat.id}>
                  <div className="flex items-center gap-4 mb-5">
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} alt={cat.name}
                        className="w-11 h-11 rounded-xl object-cover shadow-sm flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${color}30, ${color}15)`, color }}>
                        {cat.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h2 className="text-lg font-bold">{cat.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {catProducts.length} produit{catProducts.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex-1 h-px bg-border ml-2" />
                  </div>
                  <ProductsGrid products={catProducts} shop={shop} onSelect={setSelectedProduct} />
                </section>
              );
            })}
            {/* Uncategorized */}
            {(productsByCat["__none"]?.length ?? 0) > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Autres produits</h2>
                    <p className="text-xs text-muted-foreground">{productsByCat["__none"].length} produit{productsByCat["__none"].length > 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex-1 h-px bg-border ml-2" />
                </div>
                <ProductsGrid products={productsByCat["__none"]} shop={shop} onSelect={setSelectedProduct} />
              </section>
            )}
            {products.length === 0 && categories.length === 0 && (
              <EmptyState color={color} message="Cette boutique n'a pas encore de produits" />
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t py-8 text-center">
        <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <span>Boutique propulsée par</span>
          <a
            href="https://bkapay.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-base hover:opacity-80 transition-opacity"
            style={{ color: "#2563eb", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
          >
            BKApay
          </a>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Paiements sécurisés · Mobile Money · Afrique
        </p>
      </footer>

      {/* ── Buy Dialog ── */}
      {selectedProduct && (
        <BuyDialog
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

function ProductsGrid({ products, shop, onSelect }: {
  products: ShopProduct[]; shop: PublicShopData["shop"]; onSelect: (p: ShopProduct) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {products.map(p => (
        <ProductCard key={p.id} product={p} shop={shop} onSelect={() => onSelect(p)} />
      ))}
    </div>
  );
}

function EmptyState({ color, message }: { color: string; message: string }) {
  return (
    <div className="text-center py-20 text-muted-foreground">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: `${color}15` }}>
        <Package className="w-8 h-8" style={{ color: `${color}60` }} />
      </div>
      <p className="font-medium">{message}</p>
    </div>
  );
}
