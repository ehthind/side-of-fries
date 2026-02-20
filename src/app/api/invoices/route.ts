import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveRepositoryAuth } from "@/lib/auth/request-auth";
import { DEFAULT_WORKSPACE_SLUG } from "@/lib/constants";
import { createInvoice, listInvoices } from "@/lib/db/repository";

const createInvoiceSchema = z.object({
  workspaceSlug: z.string().min(1).default(DEFAULT_WORKSPACE_SLUG),
  clientName: z.string().min(1),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional(),
  invoiceNumber: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.string().min(3).max(3).default("USD"),
  dueDate: z.string().min(8),
  issueDate: z.string().optional(),
  notes: z.string().optional(),
});

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

    const invoices = await listInvoices(workspaceSlug, auth.context);
    return NextResponse.json({
      workspaceSlug,
      count: invoices.length,
      invoices,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load invoices.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const payload = createInvoiceSchema.parse(body);
    const created = await createInvoice(payload, auth.context);

    return NextResponse.json({
      invoice: created,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create invoice.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
