import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabaseConfig } from "@/lib/env";

type UntypedTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type UntypedDatabase = {
  public: {
    Tables: Record<string, UntypedTable>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AppSupabaseClient = SupabaseClient<UntypedDatabase>;

let supabaseServiceSingleton:
  | AppSupabaseClient
  | undefined
  | null = undefined;

export function hasSupabaseUserConfig(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseServiceClient(): AppSupabaseClient | null {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (supabaseServiceSingleton === undefined) {
    supabaseServiceSingleton = createClient<UntypedDatabase>(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return supabaseServiceSingleton;
}

export function createSupabaseUserClient(
  accessToken: string,
): AppSupabaseClient | null {
  if (!accessToken || !hasSupabaseUserConfig()) {
    return null;
  }

  return createClient<UntypedDatabase>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
