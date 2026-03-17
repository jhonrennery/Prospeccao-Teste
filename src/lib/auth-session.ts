import { SUPABASE_AUTH_STORAGE_KEY, supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const AUTH_STORAGE_SUFFIXES = [
  "",
  "-code-verifier",
  "-user",
];

export function isInvalidRefreshTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /invalid refresh token|refresh token not found/i.test(message);
}

export function clearStoredAuthSession(storage: Pick<Storage, "removeItem"> = localStorage) {
  for (const suffix of AUTH_STORAGE_SUFFIXES) {
    storage.removeItem(`${SUPABASE_AUTH_STORAGE_KEY}${suffix}`);
  }
}

export async function restoreSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    return {
      session: data.session satisfies Session | null,
      recoveredFromInvalidStorage: false,
      error: null,
    };
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      clearStoredAuthSession();

      return {
        session: null,
        recoveredFromInvalidStorage: true,
        error: null,
      };
    }

    return {
      session: null,
      recoveredFromInvalidStorage: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
