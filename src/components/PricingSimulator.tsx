"use client";

import { RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { calculatePricing } from "@/lib/calculations";
import { formatCurrency, formatDecimal, formatNumber, formatPercent } from "@/lib/formatting";
import { PricingInputs, WorkbookData } from "@/lib/types";

type Tone = "green" | "amber" | "red" | "blue";

function unique(values: (string | undefined)[]) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function getDefaultInputs(data: WorkbookData): PricingInputs {
  const defaults = data.scenarioDefaults;
  const programme = defaults.programme || data.priceGrid[0]?.programme || "IBDP";
  return {
    campaignSeason: data.campaigns[0]?.season || "Workbook baseline",
    course: defaults.course || programme,
    programme,
    format: defaults.format || data.priceGrid[0]?.format || "1:1",
    teacherTier: defaults.teacherTier || data.teacherFactors[0]?.label || "Senior",
    timeSlot: defaults.timeSlot || data.timeFactors[0]?.label || "Weekend 14:00-16:00",
    subjectType: defaults.subjectType || data.subjectFactors[0]?.label || "IBDP HL",
    source: defaults.source || data.sourceProbabilities[0]?.source || "Referral",
    currentStudents: defaults.currentStudents || 6,
    maxCapacity: defaults.maxCapacity || 8,
    priceSensitivity: defaults.priceSensitivity || "Medium",
    urgency: defaults.urgency || "High",
    parentStatus: ["Good", "Normal", "KAM", "Red flag"].includes(defaults.parentStatus || "") ? defaults.parentStatus || "Normal" : "Normal",
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

export function PricingSimulator({ data }: { data: WorkbookData }) {
  const initialInputs = useMemo(() => getDefaultInputs(data), [data]);
  const [inputs, setInputs] = useState<PricingInputs>(initialInputs);
  const result = useMemo(() => calculatePricing(inputs, data), [inputs, data]);
  const courses = unique([...data.courseAdjustments.map((row) => row.course), ...data.priceGrid.map((row) => row.programme), "TKHC"]);
  const campaignOptions = unique([...data.campaigns.map((campaign) => campaign.season), "Workbook baseline"]);
  const netTone = getNetTone(result.expectedNetContribution);
  const priceDelta = result.adjustedBase === null || result.displayPrice === null ? null : result.displayPrice - result.adjustedBase;
  const isOverrideActive = inputs.priceOverride !== null || inputs.expectedHoursOverride !== null || inputs.fixedMarketingCostOverride !== null;

  function update(patch: Partial<PricingInputs>) {
    setInputs((current) => ({ ...current, ...patch }));
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
              onClick={() => setInputs(initialInputs)}
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
                label="Course"
                value={inputs.course}
                options={courses}
                onChange={(value) => update({ course: value, programme: value === "TKHC" ? inputs.programme : value })}
              />
              <SelectField label="Programme" value={inputs.programme} options={unique(data.priceGrid.map((row) => row.programme))} onChange={(value) => update({ programme: value })} />
              <SelectField label="Format" value={String(inputs.format)} options={unique(data.priceGrid.map((row) => String(row.format)))} onChange={(value) => update({ format: value })} />
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
                label="Parent Status"
                value={inputs.parentStatus}
                options={["Good", "Normal", "KAM", "Red flag"]}
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
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">Price Build</h2>
            <div className="mt-2">
              <BreakdownRow label="Base price" value={formatCurrency(result.basePrice)} detail={`${inputs.programme} ${inputs.format}`} />
              <BreakdownRow label="Course adjustment" value={formatCurrency(result.courseAdjustment)} detail={inputs.course} />
              <BreakdownRow label="Adjusted base" value={formatCurrency(result.adjustedBase)} />
              <BreakdownRow label="Teacher factor" value={formatDecimal(result.teacherFactor)} detail={inputs.teacherTier} />
              <BreakdownRow label="Time slot factor" value={formatDecimal(result.timeFactor)} detail={inputs.timeSlot} />
              <BreakdownRow label="Capacity factor" value={formatDecimal(result.capacityFactor)} detail={formatPercent(result.capacityUtilisation)} />
              <BreakdownRow label="Subject factor" value={formatDecimal(result.subjectFactor)} detail={inputs.subjectType} />
              <BreakdownRow label="Demand factor" value={formatDecimal(result.courseDemandFactor)} />
              <BreakdownRow label="Parent status factor" value={formatDecimal(result.parentStatusFactor)} detail={inputs.parentStatus} />
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">Unit Economics</h2>
            <div className="mt-2">
              <BreakdownRow label="Recommended price" value={`${formatCurrency(result.recommendedPrice)} / hr`} />
              <BreakdownRow label="Lesson plan" value={`${formatNumber(result.expectedLessons)} lessons`} detail={`${formatNumber(result.hoursPerLesson)} hours each`} />
              <BreakdownRow label="Billable hours" value={formatNumber(result.expectedHours)} detail="2 hours x 8 lessons unless overridden" />
              <BreakdownRow label="Expected revenue" value={formatCurrency(result.expectedRevenue)} detail="Hourly rate x billable hours x enrolment x retention" />
              <BreakdownRow label="Tutor cost" value={formatCurrency(result.expectedTutorCost)} detail={`${formatCurrency(result.tutorHourlyCost)} / hr for ${inputs.teacherTier}`} />
              <BreakdownRow label="Admin cost" value={formatCurrency(result.expectedAdminCost)} detail="HK$120 first enrolment + HK$30 per retained lesson" />
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
