import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, signOutMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  SUPABASE_AUTH_STORAGE_KEY: "prospectai-auth-token",
  supabase: {
    auth: {
      getSession: getSessionMock,
      signOut: signOutMock,
    },
  },
}));

import {
  clearStoredAuthSession,
  isInvalidRefreshTokenError,
  restoreSession,
} from "@/lib/auth-session";

describe("auth-session", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    signOutMock.mockReset();
    localStorage.clear();
  });

  it("detects invalid refresh token errors", () => {
    expect(isInvalidRefreshTokenError(new Error("Invalid Refresh Token: Refresh Token Not Found"))).toBe(true);
    expect(isInvalidRefreshTokenError(new Error("Network request failed"))).toBe(false);
  });

  it("clears only Supabase auth keys for this app", () => {
    localStorage.setItem("prospectai-auth-token", "token");
    localStorage.setItem("prospectai-auth-token-user", "user");
    localStorage.setItem("prospectai-auth-token-code-verifier", "verifier");
    localStorage.setItem("prospect_settings", "keep-me");

    clearStoredAuthSession();

    expect(localStorage.getItem("prospectai-auth-token")).toBeNull();
    expect(localStorage.getItem("prospectai-auth-token-user")).toBeNull();
    expect(localStorage.getItem("prospectai-auth-token-code-verifier")).toBeNull();
    expect(localStorage.getItem("prospect_settings")).toBe("keep-me");
  });

  it("returns the current session when bootstrap succeeds", async () => {
    const session = { access_token: "token" };
    getSessionMock.mockResolvedValue({ data: { session }, error: null });

    const restored = await restoreSession();

    expect(restored).toEqual({
      session,
      recoveredFromInvalidStorage: false,
      error: null,
    });
  });

  it("cleans invalid persisted sessions and falls back to logged out state", async () => {
    getSessionMock.mockRejectedValue(new Error("Invalid Refresh Token: Refresh Token Not Found"));
    signOutMock.mockResolvedValue({ error: null });
    localStorage.setItem("prospectai-auth-token", "stale-token");

    const restored = await restoreSession();

    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(localStorage.getItem("prospectai-auth-token")).toBeNull();
    expect(restored).toEqual({
      session: null,
      recoveredFromInvalidStorage: true,
      error: null,
    });
  });
});
