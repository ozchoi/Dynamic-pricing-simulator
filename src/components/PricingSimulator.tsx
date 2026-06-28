"use client";

import { Check, Send, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculatePricing } from "@/lib/calculations";
import { formatCurrency, formatDecimal, formatNumber, formatPercent } from "@/lib/formatting";
import { PricingInputs, PricingResult, WorkbookData } from "@/lib/types";

type Tone = "green" | "amber" | "red" | "blue";
type SaveStatus = "idle" | "submitting" | "submitted" | "error";

const QUOTE_STORAGE_KEY = "bliss-pricing-simulator-quotes-v1";
const SUBMITTED_QUOTE_KEYS_STORAGE_KEY = "bliss-pricing-simulator-submitted-quote-keys-v1";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SYLLABUS_OPTIONS = ["IAL", "IGCSE", "IBDP", "HKDSE"];
const HKDSE_LEVEL_OPTIONS = ["F.1", "F.2", "F.3", "F.4", "F.5", "F.6"];
const FORMAT_OPTIONS = ["Group", "2:1", "1:1"];

const priceFeedbackOptions = [
  { value: 5, label: "5", detail: "Too high" },
  { value: 4, label: "4", detail: "Slightly too high" },
  { value: 3, label: "3", detail: "Neutral" },
  { value: 2, label: "2", detail: "Slightly too low" },
  { value: 1, label: "1", detail: "Too low" }
];

function feedbackLabel(value: number | null) {
  return priceFeedbackOptions.find((option) => option.value === value)?.detail ?? "";
}

function numberOrBlank(value: number | null | undefined) {
  return value ?? "";
}

function buildQuoteRecord(
  inputs: PricingInputs,
  result: PricingResult,
  priceFeedback: number,
  userSuggestedPrice: number | null,
  sliderPrice: number,
  sliderResult: PricingResult
) {
  const savedAt = new Date().toISOString();

  return {
    "Saved At": savedAt,
    Campaign: inputs.campaignSeason ?? "",
    Syllabus: inputs.programme,
    Level: inputs.level ?? "",
    Format: inputs.format,
    "Teacher Tier": inputs.teacherTier,
    "Time Slot": inputs.timeSlot,
    "Subject Type": inputs.subjectType,
    "Lead Source": inputs.source,
    "Current Students": inputs.currentStudents,
    "Max Capacity": inputs.maxCapacity,
    "Capacity Utilisation": numberOrBlank(result.capacityUtilisation),
    "Price Sensitivity": inputs.priceSensitivity,
    Urgency: inputs.urgency,
    "Parent Session": inputs.parentStatus,
    "Trial Outcome": inputs.trialOutcome,
    "Base Price / Student / Hr": numberOrBlank(result.basePrice),
    "Syllabus Adjustment": result.courseAdjustment,
    "Adjusted Base": numberOrBlank(result.adjustedBase),
    "Guardrail Min": numberOrBlank(result.minPrice),
    "Guardrail Max": numberOrBlank(result.maxPrice),
    "Teacher Factor": result.teacherFactor,
    "Time Factor": result.timeFactor,
    "Capacity Factor": result.capacityFactor,
    "Subject Factor": result.subjectFactor,
    "Demand Factor": result.courseDemandFactor,
    "Parent Session Factor": result.parentStatusFactor,
    "Lead Score": result.leadScore,
    "Recommended Price / Hr": numberOrBlank(result.recommendedPrice),
    "Display Price / Hr": numberOrBlank(result.displayPrice),
    "Recommended Offer": result.recommendedOffer,
    "Lead To Enrol Probability": numberOrBlank(result.pLeadToEnrol),
    "8-Lesson Retention Probability": numberOrBlank(result.pRetention8Lessons),
    "Expected Lessons": result.expectedLessons,
    "Hours Per Lesson": result.hoursPerLesson,
    "Expected Hours": numberOrBlank(result.expectedHours),
    "Expected Revenue": numberOrBlank(result.expectedRevenue),
    "Tutor Hourly Cost": result.tutorHourlyCost,
    "Expected Tutor Cost": numberOrBlank(result.expectedTutorCost),
    "Expected Admin Cost": numberOrBlank(result.expectedAdminCost),
    "Fixed Marketing Cost": result.fixedMarketingCost,
    "Expected Total Cost": numberOrBlank(result.expectedTotalCost),
    "Expected Gross Profit": numberOrBlank(result.expectedGrossProfit),
    "Expected Net Contribution": numberOrBlank(result.expectedNetContribution),
    "Slide Bar Price / Hr": sliderPrice,
    "Expected Revenue (Slide Bar)": numberOrBlank(sliderResult.expectedRevenue),
    "Expected Gross Profit (Slide Bar)": numberOrBlank(sliderResult.expectedGrossProfit),
    "Expected Net Contribution (Slide Bar)": numberOrBlank(sliderResult.expectedNetContribution),
    "Billable Hours Override": numberOrBlank(inputs.expectedHoursOverride),
    "Manual Price / Hr": numberOrBlank(inputs.priceOverride),
    "Fixed Marketing Cost Override": numberOrBlank(inputs.fixedMarketingCostOverride),
    "Price Feedback Score": priceFeedback,
    "Price Feedback Label": feedbackLabel(priceFeedback),
    "User Suggested Price / Hr": numberOrBlank(userSuggestedPrice)
  };
}

function readSavedQuotes() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUOTE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string | number>[]) : [];
  } catch {
    return [];
  }
}

function readSubmittedQuoteKeys() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SUBMITTED_QUOTE_KEYS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function createQuoteKey(inputs: PricingInputs, result: PricingResult, userSuggestedPrice: number | null) {
  return JSON.stringify({
    campaignSeason: inputs.campaignSeason ?? "",
    syllabus: inputs.programme,
    level: inputs.level ?? "",
    format: inputs.format,
    teacherTier: inputs.teacherTier,
    timeSlot: inputs.timeSlot,
    subjectType: inputs.subjectType,
    source: inputs.source,
    currentStudents: inputs.currentStudents,
    maxCapacity: inputs.maxCapacity,
    priceSensitivity: inputs.priceSensitivity,
    urgency: inputs.urgency,
    parentSession: inputs.parentStatus,
    trialOutcome: inputs.trialOutcome,
    expectedHoursOverride: inputs.expectedHoursOverride ?? null,
    priceOverride: inputs.priceOverride ?? null,
    fixedMarketingCostOverride: inputs.fixedMarketingCostOverride ?? null,
    userSuggestedPrice: userSuggestedPrice ?? null,
    displayPrice: result.displayPrice,
    recommendedPrice: result.recommendedPrice
  });
}

async function saveQuoteToSupabase(quote: Record<string, string | number>) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return false;

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/pricing_quotes`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ quote })
  });

  if (!response.ok) {
    throw new Error(`Supabase insert failed: ${response.status}`);
  }

  return true;
}

function unique(values: (string | undefined)[]) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function getDefaultInputs(data: WorkbookData): PricingInputs {
  const defaults = data.scenarioDefaults;
  const programme = SYLLABUS_OPTIONS.includes(defaults.programme || "") ? defaults.programme || "IAL" : "IAL";
  const format = FORMAT_OPTIONS.includes(defaults.format || "") ? defaults.format || "Group" : "Group";
  return {
    campaignSeason: data.campaigns[0]?.season || "Workbook baseline",
    course: programme,
    programme,
    level: defaults.level || "F.1",
    format,
    teacherTier: defaults.teacherTier || "Core",
    timeSlot: defaults.timeSlot || data.timeFactors[0]?.label || "Weekend 14:00-16:00",
    subjectType: defaults.subjectType || "IAL Science",
    source: defaults.source || data.sourceProbabilities[0]?.source || "Referral",
    currentStudents: defaults.currentStudents || 1,
    maxCapacity: defaults.maxCapacity || 4,
    priceSensitivity: defaults.priceSensitivity || "Medium",
    urgency: defaults.urgency || "High",
    parentStatus: ["Easy going", "Normal", "Red Flag"].includes(defaults.parentStatus || "") ? defaults.parentStatus || "Normal" : "Normal",
    trialOutcome: defaults.trialOutcome || "Not yet",
    expectedHoursOverride: null,
    priceOverride: null,
    fixedMarketingCostOverride: null
  };
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <select
        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange
}: {
  label: string;
  value: number | null | undefined;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      />
    </label>
  );
}

function SegmentedField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="mt-1 grid grid-cols-3 rounded-md border border-slate-300 bg-slate-100 p-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={`h-8 rounded px-2 text-sm font-medium ${value === option ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"}`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone = "blue"
}: {
  label: string;
  value: string;
  note?: string;
  tone?: Tone;
}) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50/50",
    green: "border-green-200 bg-green-50/70",
    amber: "border-amber-200 bg-amber-50/70",
    red: "border-red-200 bg-red-50/70"
  }[tone];

  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
      {note ? <p className="mt-1 text-sm text-slate-500">{note}</p> : null}
    </div>
  );
}

function BreakdownRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
      </div>
      <p className="shrink-0 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function getNetTone(value: number | null): Tone {
  if (value === null) return "amber";
  if (value > 500) return "green";
  if (value >= 0) return "amber";
  return "red";
}

function comparisonText(value: number | null, baseline: number | null) {
  if (value === null || baseline === null) return "—";
  const delta = value - baseline;
  const percent = baseline === 0 ? null : delta / Math.abs(baseline);
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${formatCurrency(delta)}${percent === null ? "" : ` (${sign}${formatPercent(percent)})`}`;
}

export function PricingSimulator({ data }: { data: WorkbookData }) {
  const initialInputs = useMemo(() => getDefaultInputs(data), [data]);
  const [inputs, setInputs] = useState<PricingInputs>(initialInputs);
  const [priceFeedback, setPriceFeedback] = useState<number | null>(null);
  const [userSuggestedPrice, setUserSuggestedPrice] = useState<number | null>(null);
  const [sliderPriceOverride, setSliderPriceOverride] = useState<number | null>(null);
  const [submittedQuoteKeys, setSubmittedQuoteKeys] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const isSubmittingRef = useRef(false);
  const result = useMemo(() => calculatePricing(inputs, data), [inputs, data]);
  const quoteKey = useMemo(() => createQuoteKey(inputs, result, userSuggestedPrice), [inputs, result, userSuggestedPrice]);
  const hasSubmittedCurrentQuote = priceFeedback !== null && submittedQuoteKeys.includes(quoteKey);
  const campaignOptions = unique([...data.campaigns.map((campaign) => campaign.season), "Workbook baseline"]);
  const formatOptions = inputs.programme === "HKDSE" ? ["Group"] : FORMAT_OPTIONS;
  const netTone = getNetTone(result.expectedNetContribution);
  const priceDelta = result.adjustedBase === null || result.displayPrice === null ? null : result.displayPrice - result.adjustedBase;
  const isOverrideActive = inputs.priceOverride !== null || inputs.expectedHoursOverride !== null || inputs.fixedMarketingCostOverride !== null;
  const sliderPrice = sliderPriceOverride ?? result.displayPrice ?? result.recommendedPrice ?? result.adjustedBase ?? 0;
  const sliderMin = Math.max(0, Math.round((result.minPrice ?? sliderPrice * 0.7) / 10) * 10);
  const sliderMax = Math.max(sliderMin + 10, Math.round((result.maxPrice ?? sliderPrice * 1.3) / 10) * 10);
  const sliderValue = Math.max(sliderMin, Math.min(sliderMax, sliderPrice));
  const sliderResult = useMemo(() => calculatePricing({ ...inputs, priceOverride: sliderValue }, data), [inputs, data, sliderValue]);
  const sliderNetTone = getNetTone(sliderResult.expectedNetContribution);
  const quoteStudentCount = inputs.format === "Group" ? Math.max(1, Math.ceil(inputs.currentStudents || 1)) : 1;

  useEffect(() => {
    setSubmittedQuoteKeys(readSubmittedQuoteKeys());
  }, []);

  function update(patch: Partial<PricingInputs>) {
    setInputs((current) => ({ ...current, ...patch }));
    setSliderPriceOverride(null);
    setSaveStatus("idle");
  }

  function resetSimulator() {
    setInputs(initialInputs);
    setPriceFeedback(null);
    setUserSuggestedPrice(null);
    setSliderPriceOverride(null);
    setSaveStatus("idle");
  }

  async function submitQuote() {
    if (priceFeedback === null || hasSubmittedCurrentQuote || saveStatus === "submitting" || isSubmittingRef.current) return;

    try {
      isSubmittingRef.current = true;
      setSaveStatus("submitting");
      const savedQuotes = readSavedQuotes();
      const quoteRecord = buildQuoteRecord(inputs, result, priceFeedback, userSuggestedPrice, sliderValue, sliderResult);
      const nextQuotes = [...savedQuotes, quoteRecord];
      const nextSubmittedQuoteKeys = [...readSubmittedQuoteKeys(), quoteKey];
      await saveQuoteToSupabase(quoteRecord);
      window.localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(nextQuotes));
      window.localStorage.setItem(SUBMITTED_QUOTE_KEYS_STORAGE_KEY, JSON.stringify(nextSubmittedQuoteKeys));
      setSubmittedQuoteKeys(nextSubmittedQuoteKeys);
      setSaveStatus("submitted");
    } catch {
      setSaveStatus("error");
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
      <aside className="order-2 space-y-4 xl:order-1">
        <section className="panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Quote Setup</h2>
              <p className="mt-1 text-sm text-slate-500">Select the offer context and the lead stage.</p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={resetSimulator}
              title="Reset simulator"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>

          <div className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <SelectField label="Campaign" value={inputs.campaignSeason ?? ""} options={campaignOptions} onChange={(value) => update({ campaignSeason: value })} />
              <SelectField
                label="Syllabus"
                value={inputs.programme}
                options={SYLLABUS_OPTIONS}
                onChange={(value) =>
                  update({
                    course: value,
                    programme: value,
                    level: value === "HKDSE" ? inputs.level || "F.1" : inputs.level,
                    format: value === "HKDSE" ? "Group" : inputs.format,
                    maxCapacity: value === "HKDSE" ? 6 : inputs.maxCapacity
                  })
                }
              />
              {inputs.programme === "HKDSE" ? (
                <SelectField label="Level" value={inputs.level || "F.1"} options={HKDSE_LEVEL_OPTIONS} onChange={(value) => update({ level: value })} />
              ) : null}
              <SelectField label="Format" value={String(inputs.format)} options={formatOptions} onChange={(value) => update({ format: value })} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <SelectField label="Teacher Tier" value={inputs.teacherTier} options={data.teacherFactors.map((row) => row.label)} onChange={(value) => update({ teacherTier: value })} />
              <SelectField label="Time Slot" value={inputs.timeSlot} options={data.timeFactors.map((row) => row.label)} onChange={(value) => update({ timeSlot: value })} />
              <SelectField label="Subject Type" value={inputs.subjectType} options={data.subjectFactors.map((row) => row.label)} onChange={(value) => update({ subjectType: value })} />
              <SelectField label="Lead Source" value={inputs.source} options={data.sourceProbabilities.map((row) => row.source)} onChange={(value) => update({ source: value })} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Current Students" min={0} value={inputs.currentStudents} onChange={(value) => update({ currentStudents: value ?? 0 })} />
              <NumberField label="Max Capacity" min={1} value={inputs.maxCapacity} onChange={(value) => update({ maxCapacity: value ?? 1 })} />
            </div>

            <div className="grid gap-4">
              <SegmentedField label="Price Sensitivity" value={inputs.priceSensitivity} options={["Low", "Medium", "High"]} onChange={(value) => update({ priceSensitivity: value })} />
              <SegmentedField label="Urgency" value={inputs.urgency} options={["Low", "Medium", "High"]} onChange={(value) => update({ urgency: value })} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <SelectField
                label="Parent Session"
                value={inputs.parentStatus}
                options={["Easy going", "Normal", "Red Flag"]}
                onChange={(value) => update({ parentStatus: value })}
              />
              <SelectField label="Trial Outcome" value={inputs.trialOutcome} options={["Not yet", "Strong", "Medium", "Weak"]} onChange={(value) => update({ trialOutcome: value })} />
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Overrides</h2>
              <p className="mt-1 text-sm text-slate-500">Use only when quoting a special case.</p>
            </div>
            {isOverrideActive ? (
              <button type="button" className="text-sm font-medium text-blue-700 hover:text-blue-900" onClick={() => update({ expectedHoursOverride: null, priceOverride: null, fixedMarketingCostOverride: null })}>
                Clear
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <NumberField label="Billable Hours Override" min={0} value={inputs.expectedHoursOverride} onChange={(value) => update({ expectedHoursOverride: value })} />
            <NumberField label="Manual Price / Hr" min={0} step={10} value={inputs.priceOverride} onChange={(value) => update({ priceOverride: value })} />
            <NumberField label="Fixed Marketing Cost" min={0} step={100} value={inputs.fixedMarketingCostOverride} onChange={(value) => update({ fixedMarketingCostOverride: value })} />
          </div>
        </section>
      </aside>

      <section className="order-1 space-y-5 xl:order-2">
        <section className="panel overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
            <div className="p-6">
              <p className="text-sm font-semibold text-blue-700">Recommended quote</p>
              <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-4xl font-semibold text-slate-950">{formatCurrency(result.displayPrice)} / hr</h2>
                {priceDelta !== null ? (
                  <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-semibold ${priceDelta >= 0 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {priceDelta >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                    {priceDelta >= 0 ? "+" : ""}
                    {formatCurrency(priceDelta)} vs adjusted base
                  </span>
                ) : null}
              </div>
              <div className="mt-5 max-w-2xl rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700">Slide Bar Price Change</p>
                  <p className="text-sm font-semibold text-slate-950">{formatCurrency(sliderValue)} / hr</p>
                </div>
                <input
                  className="mt-3 w-full accent-blue-700"
                  type="range"
                  min={sliderMin}
                  max={sliderMax}
                  step={10}
                  value={sliderValue}
                  onChange={(event) => {
                    setSliderPriceOverride(Number(event.target.value));
                    setSaveStatus("idle");
                  }}
                />
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>{formatCurrency(sliderMin)}</span>
                  <span>{formatCurrency(sliderMax)}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-blue-100 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Revenue Change</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{comparisonText(sliderResult.expectedRevenue, result.expectedRevenue)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatCurrency(sliderResult.expectedRevenue)}</p>
                  </div>
                  <div className="rounded-md border border-blue-100 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Gross Profit Change</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{comparisonText(sliderResult.expectedGrossProfit, result.expectedGrossProfit)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatCurrency(sliderResult.expectedGrossProfit)}</p>
                  </div>
                  <div className="rounded-md border border-blue-100 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Net Contribution Change</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{comparisonText(sliderResult.expectedNetContribution, result.expectedNetContribution)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatCurrency(sliderResult.expectedNetContribution)}</p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-base text-slate-700">{result.recommendedOffer}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Stat label="Guardrail Min" value={formatCurrency(result.minPrice)} />
                <Stat label="Guardrail Max" value={formatCurrency(result.maxPrice)} />
                <Stat label="Lead Score" value={formatNumber(result.leadScore)} />
              </div>
            </div>
            <div className={`border-t p-6 lg:border-l lg:border-t-0 ${netTone === "green" ? "bg-green-50" : netTone === "red" ? "bg-red-50" : "bg-amber-50"}`}>
              <p className="text-sm font-semibold text-slate-600">Expected net contribution</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{formatCurrency(result.expectedNetContribution)}</p>
              <div className={`mt-4 rounded-md border p-3 ${sliderNetTone === "green" ? "border-green-200 bg-white/70" : sliderNetTone === "red" ? "border-red-200 bg-white/70" : "border-amber-200 bg-white/70"}`}>
                <p className="text-xs font-semibold uppercase text-slate-500">Expected net contribution (Change by slide bar)</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{formatCurrency(sliderResult.expectedNetContribution)}</p>
                <p className="mt-1 text-sm text-slate-600">{comparisonText(sliderResult.expectedNetContribution, result.expectedNetContribution)}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Includes lead-to-enrol probability, 8-lesson retention, tutor cost, admin cost, and fixed marketing cost.
              </p>
            </div>
          </div>
          {result.warnings.length ? (
            <div className="border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-900">
              {result.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Lead To Enrol" value={formatPercent(result.pLeadToEnrol)} />
          <Stat label="8-Lesson Retention" value={formatPercent(result.pRetention8Lessons)} />
          <Stat label="Expected Revenue" value={formatCurrency(result.expectedRevenue)} tone="green" />
          <Stat label="Gross Profit" value={formatCurrency(result.expectedGrossProfit)} tone="green" />
          <Stat label="Expected Revenue (Slide Bar)" value={formatCurrency(sliderResult.expectedRevenue)} note={comparisonText(sliderResult.expectedRevenue, result.expectedRevenue)} tone="green" />
          <Stat label="Gross Profit (Slide Bar)" value={formatCurrency(sliderResult.expectedGrossProfit)} note={comparisonText(sliderResult.expectedGrossProfit, result.expectedGrossProfit)} tone="green" />
        </div>

        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Price Feedback</h2>
              <p className="mt-1 text-sm text-slate-500">Evaluate whether the recommended price makes sense.</p>
            </div>
            {priceFeedback !== null ? (
              <span className="rounded-md bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">
                Selected {priceFeedback}
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {priceFeedbackOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`rounded-md border p-3 text-left transition ${
                  priceFeedback === option.value
                    ? "border-blue-500 bg-blue-50 text-blue-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50"
                }`}
                onClick={() => setPriceFeedback(option.value)}
              >
                <span className="block text-base font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{option.detail}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 max-w-sm">
            <NumberField
              label="User Suggested Price / Hr"
              min={0}
              step={10}
              value={userSuggestedPrice}
              onChange={(value) => {
                setUserSuggestedPrice(value);
                setSaveStatus("idle");
              }}
            />
            <p className="mt-1 text-xs text-slate-500">Optional: capture the hourly rate the user thinks is reasonable.</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div>
              {hasSubmittedCurrentQuote || saveStatus === "submitted" ? (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-green-800">
                    <Check size={16} />
                    Submitted
                  </p>
                  <p className="mt-1 text-xs text-green-700">This quote feedback has already been recorded.</p>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Select one feedback score, then submit once for this quote.</p>
              )}
              {saveStatus === "submitting" ? <p className="mt-1 text-sm text-blue-700">Submitting feedback...</p> : null}
              {saveStatus === "error" ? <p className="mt-1 text-sm text-red-700">Could not submit this feedback. Please try again.</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={priceFeedback === null || hasSubmittedCurrentQuote || saveStatus === "submitting"}
                onClick={submitQuote}
              >
                {hasSubmittedCurrentQuote || saveStatus === "submitted" ? <Check size={16} /> : <Send size={16} />}
                {hasSubmittedCurrentQuote || saveStatus === "submitted" ? "Submitted" : saveStatus === "submitting" ? "Submitting" : "Submit"}
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">Price Build</h2>
            <div className="mt-2">
              <BreakdownRow label="Base price / student / hr" value={formatCurrency(result.basePrice)} detail={`${inputs.programme}${inputs.programme === "HKDSE" ? ` ${inputs.level || "F.1"}` : ""} ${inputs.format}`} />
              <BreakdownRow label="Syllabus adjustment" value={formatCurrency(result.courseAdjustment)} detail={inputs.programme} />
              <BreakdownRow label="Adjusted base" value={formatCurrency(result.adjustedBase)} />
              <BreakdownRow label="Teacher factor" value={formatDecimal(result.teacherFactor)} detail={inputs.teacherTier} />
              <BreakdownRow label="Time slot factor" value={formatDecimal(result.timeFactor)} detail={inputs.timeSlot} />
              <BreakdownRow label="Capacity factor" value={formatDecimal(result.capacityFactor)} detail={formatPercent(result.capacityUtilisation)} />
              <BreakdownRow label="Subject factor" value={formatDecimal(result.subjectFactor)} detail={inputs.subjectType} />
              <BreakdownRow label="Demand factor" value={formatDecimal(result.courseDemandFactor)} />
              <BreakdownRow label="Parent session factor" value={formatDecimal(result.parentStatusFactor)} detail={inputs.parentStatus} />
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">Operating Cost And Profit</h2>
            <div className="mt-2">
              <BreakdownRow label="Recommended price" value={`${formatCurrency(result.recommendedPrice)} / hr`} />
              <BreakdownRow label="Lesson plan" value={`${formatNumber(result.expectedLessons)} lessons`} detail={`${formatNumber(result.hoursPerLesson)} hours each`} />
              <BreakdownRow label="Billable hours" value={formatNumber(result.expectedHours)} detail={`2 hours x 8 lessons x ${formatNumber(quoteStudentCount)} student${quoteStudentCount === 1 ? "" : "s"}`} />
              <BreakdownRow label="Expected revenue" value={formatCurrency(result.expectedRevenue)} detail="Hourly rate x billable student-hours x enrolment x retention" />
              <BreakdownRow label="Tutor cost" value={formatCurrency(result.expectedTutorCost)} detail={`${formatCurrency(result.tutorHourlyCost)} / teaching hr for ${inputs.teacherTier}`} />
              <BreakdownRow label="Admin cost" value={formatCurrency(result.expectedAdminCost)} detail="HK$120 per student + HK$30 per retained lesson per student" />
              <BreakdownRow label="Fixed marketing cost" value={formatCurrency(result.fixedMarketingCost)} />
              <BreakdownRow label="Total expected cost" value={formatCurrency(result.expectedTotalCost)} />
              <BreakdownRow label="Expected gross profit" value={formatCurrency(result.expectedGrossProfit)} />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
