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

let supabaseServiceSingleton:
  | SupabaseClient<UntypedDatabase>
  | undefined
  | null = undefined;

export function getSupabaseServiceClient(): SupabaseClient<UntypedDatabase> | null {
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
