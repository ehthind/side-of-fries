import Papa from "papaparse";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_WORKSPACE_SLUG } from "@/lib/constants";
import { importCsvInvoices } from "@/lib/db/repository";

const importSchema = z.object({
  workspaceSlug: z.string().min(1).default(DEFAULT_WORKSPACE_SLUG),
  csv: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const payload = importSchema.parse(raw);

    const parsed = Papa.parse<Record<string, string>>(payload.csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        {
          error: "CSV parsing failed.",
          details: parsed.errors.map((entry) => entry.message),
        },
        { status: 400 },
      );
    }

    const rows = parsed.data.map((row) => ({
      clientName: row.clientName ?? row.client_name ?? "",
      clientEmail: row.clientEmail ?? row.client_email,
      clientPhone: row.clientPhone ?? row.client_phone,
      invoiceNumber: row.invoiceNumber ?? row.invoice_number ?? "",
      amount: row.amount,
      amountCents: row.amountCents ?? row.amount_cents,
      currency: row.currency,
      dueDate: row.dueDate ?? row.due_date ?? "",
      issueDate: row.issueDate ?? row.issue_date,
      notes: row.notes,
    }));

    const results = await importCsvInvoices(payload.workspaceSlug, rows);

    return NextResponse.json({
      workspaceSlug: payload.workspaceSlug,
      ...results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to import invoices.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
