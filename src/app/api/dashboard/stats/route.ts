import { NextRequest, NextResponse } from "next/server";
import { resolveRepositoryAuth } from "@/lib/auth/request-auth";
import { DEFAULT_WORKSPACE_SLUG } from "@/lib/constants";
import { getDashboardStats } from "@/lib/db/repository";

export async function GET(request: NextRequest) {
  const workspaceSlug =
    request.nextUrl.searchParams.get("workspaceSlug") ?? DEFAULT_WORKSPACE_SLUG;

  try {
    const auth = await resolveRepositoryAuth(request);
    if (auth.authError) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
          details: auth.authError,
        },
        { status: 401 },
      );
    }

    const stats = await getDashboardStats(workspaceSlug, auth.context);
    return NextResponse.json({
      workspaceSlug,
      stats,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load dashboard stats.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
