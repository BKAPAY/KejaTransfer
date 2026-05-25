import { storage } from "./storage";
import { COUNTRIES, OPERATORS } from "@shared/schema";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  content: string;
  generatedAt: number;
}

const cache: {
  fees: CacheEntry | null;
  countries: CacheEntry | null;
} = {
  fees: null,
  countries: null,
};

const countryFlagMap: Record<string, string> = {
  BJ: "🇧🇯", CI: "🇨🇮", SN: "🇸🇳", TG: "🇹🇬", BF: "🇧🇫",
  CM: "🇨🇲", CD: "🇨🇩", CG: "🇨🇬", ML: "🇲🇱", GN: "🇬🇳",
  NE: "🇳🇪", RW: "🇷🇼", GA: "🇬🇦", ZM: "🇿🇲", UG: "🇺🇬", GH: "🇬🇭",
};

function shortOpName(name: string): string {
  return name.replace(/\s*Mobile\s+Money\s*$/i, " Money").replace(/\s+/g, " ").trim();
}

async function loadAvailabilityData() {
  const [feeConfigs, countryStatuses, operatorConfigs, providerConfigs] = await Promise.all([
    storage.getAllFeeConfigs(),
    storage.getCountryStatuses(),
    storage.getCountryOperatorConfigs(),
    storage.getProviderConfigs(),
  ]);

  const noStatusData = countryStatuses.length === 0;
  const noOpConfigData = operatorConfigs.length === 0;

  const activeProvidersByKey = new Set<string>();
  for (const pc of providerConfigs as any[]) {
    const hasAnyKey =
      (pc.apiKey && pc.apiKey.trim() !== "") ||
      (pc.secretKey && (pc.secretKey as any)?.trim?.() !== "") ||
      (pc.masterKey && (pc.masterKey as any)?.trim?.() !== "") ||
      (pc.token && (pc.token as any)?.trim?.() !== "");
    if (hasAnyKey || pc.isActive) {
      activeProvidersByKey.add(pc.provider);
    }
  }

  return { feeConfigs, countryStatuses, operatorConfigs, noStatusData, noOpConfigData, activeProvidersByKey };
}

function evaluateOperator(
  op: { code: string; name: string },
  countryFees: any[],
  statuses: any[],
  opConfigs: any[],
  noStatusData: boolean,
  noOpConfigData: boolean,
  activeProvidersByKey: Set<string>,
) {
  const opProviders = countryFees.filter((fc: any) => fc.operator === op.code);
  if (opProviders.length === 0) return { hasPayin: false, hasPayout: false, inFee: null, outFee: null };

  let inFee: any = opProviders[0];
  let outFee: any = opProviders[0];
  let hasPayin = false;
  let hasPayout = false;

  if (noStatusData) {
    const activeEntry = opProviders.find((fc: any) => activeProvidersByKey.has(fc.provider));
    if (activeEntry) { inFee = activeEntry; outFee = activeEntry; }
    hasPayin = opProviders.some((fc: any) => activeProvidersByKey.has(fc.provider));
    hasPayout = hasPayin;
  } else {
    const payinEntry = opProviders.find((fc: any) => {
      const providerEnabled = statuses.some((cs: any) => cs.provider === fc.provider && cs.payinEnabled);
      if (!providerEnabled) return false;
      if (noOpConfigData) return true;
      const oc = opConfigs.find((c: any) => c.provider === fc.provider && c.operator === op.code);
      return oc ? oc.incomingEnabled : true;
    });
    const payoutEntry = opProviders.find((fc: any) => {
      const providerEnabled = statuses.some((cs: any) => cs.provider === fc.provider && cs.payoutEnabled);
      if (!providerEnabled) return false;
      if (noOpConfigData) return true;
      const oc = opConfigs.find((c: any) => c.provider === fc.provider && c.operator === op.code);
      return oc ? oc.outgoingEnabled : true;
    });
    if (payinEntry) inFee = payinEntry;
    if (payoutEntry) outFee = payoutEntry;
    hasPayin = !!payinEntry;
    hasPayout = !!payoutEntry;
  }

  return { hasPayin, hasPayout, inFee, outFee };
}

async function buildFeesMarkdown(): Promise<string> {
  const { feeConfigs, countryStatuses, operatorConfigs, noStatusData, noOpConfigData, activeProvidersByKey } =
    await loadAvailabilityData();

  const lines: string[] = [];
  lines.push("## Frais de transaction par pays");
  lines.push("");

  for (const country of COUNTRIES) {
    const countryCode = country.code as keyof typeof OPERATORS;
    const operators = OPERATORS[countryCode] || [];
    const statuses = countryStatuses.filter((cs: any) => cs.country === country.code);
    const countryFees = (feeConfigs as any[]).filter((fc: any) => fc.country === country.code && fc.scope === "personal");
    const opConfigs = (operatorConfigs as any[]).filter((oc: any) => oc.country === country.code);
    const flag = countryFlagMap[country.code] || "🌍";

    const activeRows: string[] = [];
    for (const op of operators) {
      const { hasPayin, hasPayout, inFee, outFee } = evaluateOperator(
        op, countryFees, statuses, opConfigs, noStatusData, noOpConfigData, activeProvidersByKey,
      );
      if (!hasPayin && !hasPayout) continue;
      const inCell = hasPayin && inFee ? `${(inFee.incomingFeePercentage / 10).toFixed(1)}%` : "Néant";
      const outCell = hasPayout && outFee ? `${(outFee.outgoingFeePercentage / 10).toFixed(1)}%` : "Néant";
      activeRows.push(`| ${shortOpName(op.name)} | ${inCell} | ${outCell} |`);
    }

    const countryIsActive = noStatusData
      ? countryFees.some((fc: any) => activeProvidersByKey.has(fc.provider))
      : statuses.some((cs: any) => cs.payinEnabled || cs.payoutEnabled);

    if (activeRows.length > 0) {
      lines.push(`${flag} **${country.name.toUpperCase()}** | Devise : ${country.currency}`);
      lines.push("");
      lines.push("| Opérateur | Entrant | Sortant |");
      lines.push("|---|---|---|");
      lines.push(...activeRows);
      lines.push("");
    } else if (countryIsActive) {
      lines.push(`${flag} **${country.name.toUpperCase()}** | Devise : ${country.currency}`);
      lines.push("*Aucun opérateur actif pour ce pays.*");
      lines.push("");
    }
  }

  lines.push("**Frais d'échange de devise** (s'appliquent en plus des frais de transaction si les devises diffèrent) de 3 à 6 %.");

  return lines.join("\n");
}

async function buildCountriesOperatorsMarkdown(): Promise<string> {
  const { feeConfigs, countryStatuses, operatorConfigs, noStatusData, noOpConfigData, activeProvidersByKey } =
    await loadAvailabilityData();

  const lines: string[] = [];
  lines.push("## Pays et opérateurs disponibles");
  lines.push("");

  for (const country of COUNTRIES) {
    const countryCode = country.code as keyof typeof OPERATORS;
    const operators = OPERATORS[countryCode] || [];
    const statuses = countryStatuses.filter((cs: any) => cs.country === country.code);
    const countryFees = (feeConfigs as any[]).filter((fc: any) => fc.country === country.code && fc.scope === "personal");
    const opConfigs = (operatorConfigs as any[]).filter((oc: any) => oc.country === country.code);
    const flag = countryFlagMap[country.code] || "🌍";

    const activeRows: string[] = [];
    for (const op of operators) {
      const { hasPayin, hasPayout } = evaluateOperator(
        op, countryFees, statuses, opConfigs, noStatusData, noOpConfigData, activeProvidersByKey,
      );
      if (!hasPayin && !hasPayout) continue;
      const inMark = hasPayin ? "✅" : "—";
      const outMark = hasPayout ? "✅" : "—";
      activeRows.push(`| ${shortOpName(op.name)} | ${inMark} | ${outMark} |`);
    }

    const countryIsActive = noStatusData
      ? countryFees.some((fc: any) => activeProvidersByKey.has(fc.provider))
      : statuses.some((cs: any) => cs.payinEnabled || cs.payoutEnabled);

    if (activeRows.length > 0) {
      lines.push(`${flag} **${country.name.toUpperCase()}** | Devise : ${country.currency}`);
      lines.push("");
      lines.push("| Opérateur | Dépôt | Retrait |");
      lines.push("|---|---|---|");
      lines.push(...activeRows);
      lines.push("");
    } else if (countryIsActive) {
      lines.push(`${flag} **${country.name.toUpperCase()}** | Devise : ${country.currency}`);
      lines.push("*Aucun opérateur actif pour ce pays.*");
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function refreshEntry(key: "fees" | "countries"): Promise<CacheEntry> {
  const content = key === "fees" ? await buildFeesMarkdown() : await buildCountriesOperatorsMarkdown();
  const entry: CacheEntry = { content, generatedAt: Date.now() };
  cache[key] = entry;
  return entry;
}

export async function getEmaliFees(): Promise<CacheEntry> {
  const existing = cache.fees;
  if (existing && Date.now() - existing.generatedAt < CACHE_TTL_MS) return existing;
  return refreshEntry("fees");
}

export async function getEmaliCountriesOperators(): Promise<CacheEntry> {
  const existing = cache.countries;
  if (existing && Date.now() - existing.generatedAt < CACHE_TTL_MS) return existing;
  return refreshEntry("countries");
}

export function invalidateEmaliCache() {
  cache.fees = null;
  cache.countries = null;
}

function msUntilNextMonday3am(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  const day = next.getDay();
  const daysUntilMonday = day === 1 && next.getTime() > now.getTime() ? 0 : (8 - day) % 7 || 7;
  next.setDate(next.getDate() + daysUntilMonday);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 7);
  return next.getTime() - now.getTime();
}

async function refreshAll(label: string) {
  try {
    await Promise.all([refreshEntry("fees"), refreshEntry("countries")]);
    console.log(`[EMALI Cache] ${label} OK (prochain rafraîchissement : lundi 03h00).`);
  } catch (err: any) {
    console.error(`[EMALI Cache] ${label} échec :`, err.message || err);
  }
}

export function startEmaliCacheRefresher() {
  // Chargement initial 5s après démarrage : les données sont disponibles dès aujourd'hui.
  setTimeout(() => { void refreshAll("Chargement initial"); }, 5000);

  // Planification du prochain lundi 03h00, puis chaque lundi suivant via setInterval hebdomadaire.
  const scheduleNextMonday = () => {
    const delay = msUntilNextMonday3am();
    const nextDate = new Date(Date.now() + delay).toISOString();
    console.log(`[EMALI Cache] Prochain rafraîchissement programmé : ${nextDate}`);
    setTimeout(() => {
      void refreshAll("Rafraîchissement hebdomadaire (lundi)");
      setInterval(() => { void refreshAll("Rafraîchissement hebdomadaire (lundi)"); }, CACHE_TTL_MS);
    }, delay);
  };
  scheduleNextMonday();
}
