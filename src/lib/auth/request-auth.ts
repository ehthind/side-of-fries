import {
  createSupabaseUserClient,
  type AppSupabaseClient,
} from "@/lib/db/supabase";

export interface RepositoryRequestContext {
  supabase?: AppSupabaseClient | null;
  actorEmail?: string | null;
}

export interface RequestRepositoryAuth {
  authError: string | null;
  authenticated: boolean;
  context: RepositoryRequestContext;
}

function parseCookieHeader(cookieHeader: string | null): Array<[string, string]> {
  if (!cookieHeader) {
    return [];
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex < 0) {
        return [part, ""] as [string, string];
      }

      return [
        part.slice(0, separatorIndex).trim(),
        part.slice(separatorIndex + 1).trim(),
      ] as [string, string];
    });
}

function parseSupabaseAuthCookieValue(value: string): string | null {
  const decoded = decodeURIComponent(value);

  const parseSerialized = (serialized: string): string | null => {
    try {
      const parsed = JSON.parse(serialized) as
        | string
        | Array<string | null>
        | { access_token?: string | null };

      if (typeof parsed === "string") {
        return parsed || null;
      }

      if (Array.isArray(parsed)) {
        const token = parsed.find((entry) => typeof entry === "string");
        return token ?? null;
      }

      if (typeof parsed.access_token === "string" && parsed.access_token) {
        return parsed.access_token;
      }
    } catch {
      return null;
    }

    return null;
  };

  const direct = parseSerialized(decoded);
  if (direct) {
    return direct;
  }

  if (decoded.startsWith("base64-")) {
    const payload = decoded.slice("base64-".length);
    try {
      const raw = Buffer.from(payload, "base64").toString("utf8");
      return parseSerialized(raw);
    } catch {
      return null;
    }
  }

  return null;
}

function extractAccessToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return token;
    }
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"));

  for (const [name, value] of cookies) {
    if (
      name === "sb-access-token" ||
      name.endsWith("-access-token") ||
      name.endsWith("-auth-token")
    ) {
      const token = parseSupabaseAuthCookieValue(value);
      if (token) {
        return token;
      }
    }
  }

  return null;
}

export async function resolveRepositoryAuth(
  request: Request,
): Promise<RequestRepositoryAuth> {
  const token = extractAccessToken(request);
  if (!token) {
    return {
      authError: null,
      authenticated: false,
      context: {},
    };
  }

  const client = createSupabaseUserClient(token);
  if (!client) {
    return {
      authError: "Supabase auth client is not configured.",
      authenticated: false,
      context: {},
    };
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return {
      authError: "Invalid or expired auth token.",
      authenticated: false,
      context: {},
    };
  }

  return {
    authError: null,
    authenticated: true,
    context: {
      supabase: client,
      actorEmail: data.user.email ?? null,
    },
  };
}
