export interface DocVersion {
  version: string;
  releaseDate: string;
  isLatest: boolean;
  isDeprecated: boolean;
  changelog?: string[];
}

export const CURRENT_VERSION = "v1.3";

export const DOC_VERSIONS: DocVersion[] = [
  {
    version: "v1.3",
    releaseDate: "2025-12-06",
    isLatest: true,
    isDeprecated: false,
    changelog: [
      "Webhooks pour activation automatique d'abonnements",
      "Notifications POST signees HMAC-SHA256",
      "Configuration du callback URL dans le dashboard",
      "Exemples de code Node.js et PHP pour webhooks"
    ]
  },
  {
    version: "v1.2",
    releaseDate: "2025-11-26",
    isLatest: false,
    isDeprecated: true,
    changelog: [
      "Ajout du parametre callback pour les redirections",
      "Montant minimum de 100 XOF",
      "Recherche de transactions par client",
      "Amelioration des messages d'erreur"
    ]
  },
  {
    version: "v1.1",
    releaseDate: "2025-11-15",
    isLatest: false,
    isDeprecated: true,
    changelog: [
      "Support des 19 operateurs SOFTPAY",
      "Integration Orange Money OTP",
      "Flux Wave avec redirection"
    ]
  },
  {
    version: "v1.0",
    releaseDate: "2025-11-01",
    isLatest: false,
    isDeprecated: true,
    changelog: [
      "Version initiale de l'API",
      "Support des paiements mobile money",
      "Tableau de bord marchand"
    ]
  }
];

export function getDocVersion(version: string): DocVersion | undefined {
  return DOC_VERSIONS.find(v => v.version.toLowerCase() === version.toLowerCase());
}

export function getLatestVersion(): DocVersion {
  return DOC_VERSIONS.find(v => v.isLatest) || DOC_VERSIONS[0];
}

export function isValidVersion(version: string): boolean {
  return DOC_VERSIONS.some(v => v.version.toLowerCase() === version.toLowerCase());
}
