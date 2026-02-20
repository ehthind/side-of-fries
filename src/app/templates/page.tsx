"use client";

import { useEffect, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { STAGE_LABEL } from "@/lib/constants";

type StageKey = keyof typeof STAGE_LABEL;
type Channel = "email" | "sms";

type Templates = Record<StageKey, Record<Channel, string>>;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Templates | null>(null);
  const [selectedStage, setSelectedStage] = useState<StageKey>("polite_nudge");
  const [selectedChannel, setSelectedChannel] = useState<Channel>("email");
  const [tone, setTone] = useState<"conservative" | "balanced" | "assertive">(
    "conservative",
  );
  const [draft, setDraft] = useState("");
  const [rewritten, setRewritten] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      const response = await fetch("/api/templates", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.details ?? payload.error ?? "Failed to load templates.");
        return;
      }

      const loaded = payload.templates as Templates;
      setTemplates(loaded);
      setDraft(loaded[selectedStage][selectedChannel]);
    }

    loadTemplates().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Failed to load templates."),
    );
  }, [selectedChannel, selectedStage]);

  useEffect(() => {
    if (templates) {
      setDraft(templates[selectedStage][selectedChannel]);
      setRewritten(null);
    }
  }, [templates, selectedChannel, selectedStage]);

  async function runRewrite() {
    try {
      setError(null);
      const response = await fetch("/api/templates/rewrite", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          stage: selectedStage,
          body: draft,
          tone,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "Rewrite failed.");
      }

      setRewritten(payload.rewritten);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rewrite failed.");
    }
  }

  return (
    <div className="app-shell min-h-screen py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            Messaging
          </p>
          <h1 className="text-3xl text-[var(--color-ink-strong)]">Template studio</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Template-first drafting with optional AI tone rewrite.
          </p>
        </div>
        <SiteNav />
      </header>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="panel grid gap-4 p-5 lg:grid-cols-[1fr_2fr]">
        <aside className="space-y-3">
          <label className="block text-sm font-medium">
            Stage
            <select
              className="input-base mt-1"
              value={selectedStage}
              onChange={(event) => setSelectedStage(event.target.value as StageKey)}
            >
              {Object.entries(STAGE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Channel
            <select
              className="input-base mt-1"
              value={selectedChannel}
              onChange={(event) => setSelectedChannel(event.target.value as Channel)}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </label>

          <label className="block text-sm font-medium">
            Rewrite tone
            <select
              className="input-base mt-1"
              value={tone}
              onChange={(event) =>
                setTone(event.target.value as "conservative" | "balanced" | "assertive")
              }
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="assertive">Assertive</option>
            </select>
          </label>

          <button className="button-primary w-full px-4 py-2" onClick={runRewrite}>
            Rewrite draft
          </button>
        </aside>

        <div className="grid gap-4">
          <article>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
              Canonical template
            </p>
            <textarea
              className="input-base mt-2 min-h-64 whitespace-pre-wrap font-mono text-xs"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </article>

          <article>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
              Rewrite preview
            </p>
            <pre className="mt-2 min-h-40 rounded-xl border border-[var(--color-border)] bg-white p-3 whitespace-pre-wrap text-sm text-[var(--color-ink)]">
              {rewritten ?? "Run rewrite to generate a toned variation."}
            </pre>
          </article>
        </div>
      </section>
    </div>
  );
}
