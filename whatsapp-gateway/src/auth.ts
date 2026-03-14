import type { Request } from "express";
import { supabaseAdmin } from "./supabase.js";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

export async function authenticateRequest(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid access token");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}
