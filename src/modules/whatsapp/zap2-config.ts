const DEFAULT_ZAP2_BASE_PATH = "/zap2";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getZap2BaseUrl() {
  const configured = import.meta.env.VITE_ZAP2_MODULE_URL?.trim();

  if (configured) {
    return trimTrailingSlash(configured);
  }

  return DEFAULT_ZAP2_BASE_PATH;
}

export function getZap2HealthUrl() {
  return `${getZap2BaseUrl()}/api/health`;
}
