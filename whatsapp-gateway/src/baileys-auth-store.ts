import {
  BufferJSON,
  initAuthCreds,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { supabaseAdmin } from "./supabase.js";

type AuthValue = Record<string, unknown> | unknown[] | string | number | boolean | null;
type SignalKeyType = keyof SignalDataTypeMap;

function serializeBaileys(value: unknown): AuthValue {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}

function deserializeBaileys<T>(value: AuthValue): T {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver) as T;
}

export class DatabaseAuthStore {
  constructor(
    private readonly userId: string,
    private readonly sessionId: string,
  ) {}

  async load(): Promise<AuthenticationState> {
    const { data, error } = await supabaseAdmin
      .from("whatsapp_session_auth")
      .select("auth_group, auth_key, auth_value")
      .eq("user_id", this.userId)
      .eq("session_id", this.sessionId);

    if (error) {
      throw error;
    }

    const credsRow = data?.find((row) => row.auth_group === "creds" && row.auth_key === "main");
    const creds = credsRow?.auth_value
      ? deserializeBaileys<AuthenticationCreds>(credsRow.auth_value as AuthValue)
      : initAuthCreds();

    return {
      creds,
      keys: {
        get: async <T extends SignalKeyType>(type: T, ids: string[]) => {
          if (ids.length === 0) {
            return {} as Record<string, SignalDataTypeMap[T]>;
          }

          const { data: rows, error: rowsError } = await supabaseAdmin
            .from("whatsapp_session_auth")
            .select("auth_key, auth_value")
            .eq("user_id", this.userId)
            .eq("session_id", this.sessionId)
            .eq("auth_group", type)
            .in("auth_key", ids);

          if (rowsError) {
            throw rowsError;
          }

          const result = {} as Record<string, SignalDataTypeMap[T]>;
          for (const row of rows || []) {
            result[row.auth_key] = deserializeBaileys<SignalDataTypeMap[T]>(row.auth_value as AuthValue);
          }

          return result;
        },
        set: async (data) => {
          const upserts: Array<{ user_id: string; session_id: string; auth_group: string; auth_key: string; auth_value: AuthValue }> = [];
          const deletes: Array<{ auth_group: string; auth_key: string }> = [];

          for (const [authGroup, entries] of Object.entries(data)) {
            for (const [authKey, authValue] of Object.entries(entries || {})) {
              if (authValue == null) {
                deletes.push({ auth_group: authGroup, auth_key: authKey });
                continue;
              }

              upserts.push({
                user_id: this.userId,
                session_id: this.sessionId,
                auth_group: authGroup,
                auth_key: authKey,
                auth_value: serializeBaileys(authValue),
              });
            }
          }

          if (upserts.length > 0) {
            const { error: upsertError } = await supabaseAdmin
              .from("whatsapp_session_auth")
              .upsert(upserts, { onConflict: "session_id,auth_group,auth_key" });

            if (upsertError) {
              throw upsertError;
            }
          }

          for (const entry of deletes) {
            const { error: deleteError } = await supabaseAdmin
              .from("whatsapp_session_auth")
              .delete()
              .eq("user_id", this.userId)
              .eq("session_id", this.sessionId)
              .eq("auth_group", entry.auth_group)
              .eq("auth_key", entry.auth_key);

            if (deleteError) {
              throw deleteError;
            }
          }
        },
      },
    };
  }

  async saveCreds(creds: AuthenticationCreds) {
    const { error } = await supabaseAdmin.from("whatsapp_session_auth").upsert(
      {
        user_id: this.userId,
        session_id: this.sessionId,
        auth_group: "creds",
        auth_key: "main",
        auth_value: serializeBaileys(creds),
      },
      { onConflict: "session_id,auth_group,auth_key" },
    );

    if (error) {
      throw error;
    }
  }

  async clear() {
    const { error } = await supabaseAdmin
      .from("whatsapp_session_auth")
      .delete()
      .eq("user_id", this.userId)
      .eq("session_id", this.sessionId);

    if (error) {
      throw error;
    }
  }
}
