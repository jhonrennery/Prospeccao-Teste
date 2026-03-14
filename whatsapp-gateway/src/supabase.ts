import { createClient } from "@supabase/supabase-js";
import { env } from "./config.js";

export function createSupabaseClient(accessToken?: string) {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}
