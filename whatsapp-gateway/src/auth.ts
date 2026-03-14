import type { Request } from "express";
import { createSupabaseClient } from "./supabase.js";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  accessToken: string;
}

export async function authenticateRequest(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const supabase = createSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid access token");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    accessToken: token,
  };
}
