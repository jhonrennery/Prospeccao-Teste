import "dotenv/config";

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.WHATSAPP_GATEWAY_PORT || 3001),
  supabaseUrl: requireEnv("SUPABASE_URL", process.env.VITE_SUPABASE_URL),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  corsOrigin: process.env.WHATSAPP_GATEWAY_CORS_ORIGIN || "*",
  browserName: process.env.WHATSAPP_BROWSER_NAME || "Company Probe",
};
