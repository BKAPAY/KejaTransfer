import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, AlertTriangle, ArrowRight, Clock, Monitor, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocation } from "wouter";
import { 
  DOC_VERSIONS, 
  CURRENT_VERSION, 
  getDocVersion, 
  getLatestVersion,
  type DocVersion 
} from "@/lib/doc-versions";

interface DocumentationVersionProps {
  version: string;
}

function DeprecatedBanner({ version, latestVersion }: { version: DocVersion; latestVersion: DocVersion }) {
  const [, setLocation] = useLocation();
  
  return (
    <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-600 dark:text-amber-400">Version obsolete</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          Cette version de la documentation ({version.version}) est obsolete depuis le {version.releaseDate}.
          Veuillez utiliser la derniere version pour beneficier des dernieres fonctionnalites.
        </p>
        <Button 
          onClick={() => setLocation(`/documentation/${latestVersion.version}`)}
          size="sm"
          className="gap-2"
          data-testid="button-go-latest"
        >
          Voir la version {latestVersion.version}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function VersionNotFound({ requestedVersion }: { requestedVersion: string }) {
  const [, setLocation] = useLocation();
  const latestVersion = getLatestVersion();
  
  return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Version introuvable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground">
            La version <span className="font-mono font-bold text-foreground">{requestedVersion}</span> de la documentation n'existe pas ou n'est plus disponible.
          </p>
          
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-3">Versions disponibles:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {DOC_VERSIONS.filter(v => !v.isDeprecated).map(v => (
                <Badge 
                  key={v.version}
                  variant={v.isLatest ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setLocation(`/documentation/${v.version}`)}
                  data-testid={`badge-version-${v.version}`}
                >
                  {v.version}
                  {v.isLatest && " (Actuelle)"}
                </Badge>
              ))}
            </div>
          </div>
          
          <Button 
            onClick={() => setLocation(`/documentation/${latestVersion.version}`)}
            size="lg"
            className="gap-2"
            data-testid="button-go-latest-from-404"
          >
            Voir la documentation actuelle ({latestVersion.version})
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function VersionSelector({ currentVersion }: { currentVersion: string }) {
  const [, setLocation] = useLocation();
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Version:</span>
      {DOC_VERSIONS.map(v => (
        <Badge 
          key={v.version}
          variant={v.version === currentVersion ? "default" : "outline"}
          className={`cursor-pointer ${v.isDeprecated ? "opacity-60" : ""}`}
          onClick={() => setLocation(`/documentation/${v.version}`)}
          data-testid={`select-version-${v.version}`}
        >
          {v.version}
          {v.isLatest && " (Actuelle)"}
          {v.isDeprecated && " (Obsolete)"}
        </Badge>
      ))}
    </div>
  );
}

function Changelog({ version }: { version: DocVersion }) {
  if (!version.changelog || version.changelog.length === 0) return null;
  
  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="w-5 h-5" />
          Nouveautes de la version {version.version}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {version.changelog.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-1">•</span>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-4">
          Publiee le {version.releaseDate}
        </p>
      </CardContent>
    </Card>
  );
}

export default function DocumentationVersion({ version }: DocumentationVersionProps) {
  const [location, setLocation] = useLocation();
  const basePath = location.startsWith("/dashboard") ? "/dashboard/documentation" : "/documentation";
  
  const docVersion = getDocVersion(version);
  const latestVersion = getLatestVersion();
  
  if (!docVersion) {
    return <VersionNotFound requestedVersion={version} />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-doc-title">
            Documentation API BKApay
          </h1>
          <Badge variant="secondary" className="w-fit text-sm" data-testid="badge-current-version">
            {docVersion.version}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Integrez facilement les paiements mobile money dans votre application
        </p>
        <VersionSelector currentVersion={docVersion.version} />
      </div>

      {docVersion.isDeprecated && (
        <DeprecatedBanner version={docVersion} latestVersion={latestVersion} />
      )}
      
      {docVersion.isLatest && <Changelog version={docVersion} />}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Choisissez votre type d'integration</h2>
        <p className="text-sm text-muted-foreground">
          BKApay propose quatre methodes d'integration. Cliquez sur celle qui convient a votre projet.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card 
          className="cursor-pointer hover-elevate transition-colors border-2 border-border"
          onClick={() => setLocation(`${basePath}/redirect/${docVersion.version}`)}
          data-testid="card-redirect-checkout"
        >
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <ExternalLink className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Redirect Checkout / HPP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Le client est redirige vers la page de paiement securisee BKApay. 
              Ideal pour une integration rapide sans code complexe.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Integration en quelques lignes de code
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Aucun code JavaScript requis
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Retour automatique sur votre site apres paiement
              </li>
            </ul>
            <Button className="w-full gap-2" data-testid="button-go-redirect">
              Voir la documentation
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate transition-colors border-2 border-border"
          onClick={() => setLocation(`${basePath}/inline/${docVersion.version}`)}
          data-testid="card-inline-checkout"
        >
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <Monitor className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Inline / Modal Checkout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La fenetre de paiement s'ouvre directement sur votre site via une modal.
              Le client ne quitte jamais votre page.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Experience de paiement fluide
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Callbacks JavaScript (onSuccess, onError)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                Compatible web et mobile (React Native, Flutter)
              </li>
            </ul>
            <Button className="w-full gap-2" data-testid="button-go-inline">
              Voir la documentation
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate transition-colors border-2 border-border"
          onClick={() => setLocation(`${basePath}/payout/${docVersion.version}`)}
          data-testid="card-payout-api"
        >
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="text-lg">API Payout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envoyez de l'argent directement sur des numeros mobile money depuis votre serveur. 
              Ideal pour les marketplaces et remuneration automatisee.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                Envoi vers n'importe quel numero mobile money
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                Integration server-to-server via API REST
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                Confirmation automatique par webhook
              </li>
            </ul>
            <Button className="w-full gap-2 bg-blue-600 text-white" data-testid="button-go-payout">
              Voir la documentation
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate transition-colors border-2 border-emerald-500/30"
          onClick={() => setLocation(`${basePath}/sessions/${docVersion.version}`)}
          data-testid="card-sessions-api"
        >
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" className="text-xs bg-emerald-600">Nouveau v1.6</Badge>
            </div>
            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <CardTitle className="text-lg">Sessions de Paiement Securisees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Creez une session de paiement depuis votre serveur avec le montant verrouille. 
              Le client ne peut pas modifier le montant — securite maximale.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-0.5">•</span>
                Montant defini et verrouille cote serveur
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-0.5">•</span>
                Authentification par cle secrete sk_live_
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600 mt-0.5">•</span>
                Redirection vers success_url / cancel_url apres paiement
              </li>
            </ul>
            <Button className="w-full gap-2 bg-emerald-600 text-white" data-testid="button-go-sessions">
              Voir la documentation
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center py-8 border-t">
        <p className="text-sm text-muted-foreground">
          Documentation API BKApay - Version {docVersion.version}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Derniere mise a jour: {docVersion.releaseDate}
        </p>
      </div>
    </div>
  );
}
