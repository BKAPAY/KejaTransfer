function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

export function getPublicBaseUrl(): string {
  const configuredUrl = process.env.BASE_URL;
  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_BRANCH_URL
    || process.env.VERCEL_URL;

  if (vercelUrl) {
    return normalizeBaseUrl(vercelUrl);
  }

  return process.env.NODE_ENV === "production"
    ? "https://bkapay.com"
    : "http://localhost:5000";
}
