"use client";

import { Check, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdjustmentSuggestion, analyseAdjustmentSuggestions, QuoteRecord } from "@/lib/adjustmentAnalysis";
import { formatDecimal, formatNumber } from "@/lib/formatting";

type Status = "idle" | "loading" | "ready" | "error";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const APPROVED_ADJUSTMENTS_KEY = "bliss-approved-factor-adjustments-v1";

function readApprovedAdjustments() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(APPROVED_ADJUSTMENTS_KEY);
    return raw ? (JSON.parse(raw) as AdjustmentSuggestion[]) : [];
  } catch {
    return [];
  }
}

function confidenceClass(confidence: AdjustmentSuggestion["confidence"]) {
  if (confidence === "High") return "bg-green-50 text-green-800";
  if (confidence === "Medium") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

async function fetchSupabaseQuotes() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return [];

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/pricing_quotes?select=quote&order=created_at.desc&limit=500`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Could not read Supabase quotes: ${response.status}`);
  }

  const rows = (await response.json()) as { quote?: QuoteRecord }[];
  return rows.map((row) => row.quote).filter(Boolean) as QuoteRecord[];
}

export function AdjustmentLearningPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [approved, setApproved] = useState<AdjustmentSuggestion[]>([]);

  const analysis = useMemo(() => analyseAdjustmentSuggestions(quotes), [quotes]);
  const approvedIds = useMemo(() => new Set(approved.map((item) => item.id)), [approved]);

  async function refresh() {
    setStatus("loading");
    try {
      setQuotes(await fetchSupabaseQuotes());
      setApproved(readApprovedAdjustments());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  function approveSuggestion(suggestion: AdjustmentSuggestion) {
    const nextApproved = [
      ...approved.filter((item) => item.id !== suggestion.id),
      {
        ...suggestion,
        rationale: `${suggestion.rationale} Approved at ${new Date().toISOString()}.`
      }
    ];
    setApproved(nextApproved);
    window.localStorage.setItem(APPROVED_ADJUSTMENTS_KEY, JSON.stringify(nextApproved));
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Adjustment Learning</h2>
          <p className="mt-1 text-sm text-slate-500">Suggested factor moves from confirmed quotes and price feedback.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={refresh}
          disabled={status === "loading"}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Analysed Quotes</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(analysis.sampleSize)}</p>
        </div>
        <div className="rounded-md border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Suggestions</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(analysis.suggestions.length)}</p>
        </div>
        <div className="rounded-md border border-green-200 bg-green-50/70 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Approved</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{formatNumber(approved.length)}</p>
        </div>
      </div>

      {status === "error" ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Could not load Supabase quote records.</p>
      ) : null}

      {status === "ready" && analysis.sampleSize < 4 ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Add at least 4 confirmed quotes with feedback before the model suggests factor changes.
        </p>
      ) : null}

      {analysis.suggestions.length ? (
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <div className="grid grid-cols-[1.1fr_1fr_0.8fr_0.8fr_0.9fr_0.8fr_0.8fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Factor</span>
            <span>Level</span>
            <span>Current</span>
            <span>Suggested</span>
            <span>Change</span>
            <span>Confidence</span>
            <span>Approve</span>
          </div>
          {analysis.suggestions.map((suggestion) => (
            <div key={suggestion.id} className="grid grid-cols-[1.1fr_1fr_0.8fr_0.8fr_0.9fr_0.8fr_0.8fr] gap-3 border-t border-slate-100 px-4 py-3 text-sm">
              <span className="font-medium text-slate-800">{suggestion.factor}</span>
              <span className="text-slate-700">{suggestion.level}</span>
              <span>{formatDecimal(suggestion.currentFactor)}</span>
              <span className="font-semibold text-slate-950">{formatDecimal(suggestion.suggestedFactor)}</span>
              <span className={suggestion.changePercent >= 0 ? "text-green-700" : "text-red-700"}>
                {suggestion.changePercent >= 0 ? "+" : ""}
                {formatDecimal(suggestion.changePercent)}%
              </span>
              <span>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${confidenceClass(suggestion.confidence)}`}>{suggestion.confidence}</span>
              </span>
              <span>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:border-green-200 disabled:bg-green-50 disabled:text-green-800"
                  onClick={() => approveSuggestion(suggestion)}
                  disabled={approvedIds.has(suggestion.id)}
                >
                  <Check size={14} />
                  {approvedIds.has(suggestion.id) ? "Approved" : "Approve"}
                </button>
              </span>
              <p className="col-span-full text-xs text-slate-500">
                {suggestion.rationale} Sample size: {formatNumber(suggestion.sampleSize)}.
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
