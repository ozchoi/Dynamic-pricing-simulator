"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { calculatePricing } from "@/lib/calculations";
import { formatCurrency, formatNumber } from "@/lib/formatting";
import { PricingInputs, WorkbookData } from "@/lib/types";

const SYLLABUS_OPTIONS = ["IAL", "IGCSE", "IBDP", "HKDSE"];
const FORMAT_OPTIONS = ["Group", "2:1", "1:1"];

function defaultPricingInputs(data: WorkbookData): PricingInputs {
  const defaults = data.scenarioDefaults;
  const programme = SYLLABUS_OPTIONS.includes(defaults.programme || "") ? defaults.programme || "IAL" : "IAL";
  const format = FORMAT_OPTIONS.includes(defaults.format || "") ? defaults.format || "Group" : "Group";
  return {
    campaignSeason: data.campaigns[0]?.season || "Workbook baseline",
    course: programme,
    programme,
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
    priceOverride: null
  };
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
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
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
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
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

function Stat({
  label,
  value,
  note,
  tone = "blue"
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "blue" | "green" | "amber" | "red";
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

function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
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

export function CapacityUpsideSimulator({ data }: { data: WorkbookData }) {
  const initialInputs = useMemo(() => defaultPricingInputs(data), [data]);
  const currentQuote = useMemo(() => calculatePricing(initialInputs, data), [initialInputs, data]);
  const [programme, setProgramme] = useState(initialInputs.programme);
  const [format, setFormat] = useState(String(initialInputs.format));
  const [currentStudents, setCurrentStudents] = useState(initialInputs.currentStudents);
  const [maxCapacity, setMaxCapacity] = useState(initialInputs.maxCapacity);
  const [expectedHours, setExpectedHours] = useState(currentQuote.expectedHours ?? 8);
  const [currentPrice, setCurrentPrice] = useState(currentQuote.displayPrice ?? 1000);
  const [discountedPrice, setDiscountedPrice] = useState(Math.round(((currentQuote.displayPrice ?? 1000) * 0.9) / 10) * 10);
  const [expectedNewStudents, setExpectedNewStudents] = useState(Math.max(0, initialInputs.maxCapacity - initialInputs.currentStudents));
  const [marginalTutorCost, setMarginalTutorCost] = useState(50);
  const [adminCostPerStudent, setAdminCostPerStudent] = useState(120);

  function priceForSelection(nextProgramme: string, nextFormat: string) {
    const quote = calculatePricing(
      {
        ...initialInputs,
        course: nextProgramme,
        programme: nextProgramme,
        format: nextFormat
      },
      data
    );
    return quote.displayPrice ?? quote.recommendedPrice ?? currentPrice;
  }

  function applyProgramme(nextProgramme: string) {
    const nextPrice = priceForSelection(nextProgramme, format);
    setProgramme(nextProgramme);
    setCurrentPrice(nextPrice);
    setDiscountedPrice(Math.round((nextPrice * 0.9) / 10) * 10);
  }

  function applyFormat(nextFormat: string) {
    const nextPrice = priceForSelection(programme, nextFormat);
    setFormat(nextFormat);
    setCurrentPrice(nextPrice);
    setDiscountedPrice(Math.round((nextPrice * 0.9) / 10) * 10);
  }

  const seatsAvailable = Math.max(0, maxCapacity - currentStudents);
  const addedStudents = Math.max(0, Math.min(expectedNewStudents, seatsAvailable));
  const currentClassRevenue = currentStudents * currentPrice * expectedHours;
  const discountedClassRevenue = (currentStudents + addedStudents) * discountedPrice * expectedHours;
  const revenueChange = discountedClassRevenue - currentClassRevenue;
  const marginalTutorCostTotal = addedStudents * marginalTutorCost * expectedHours;
  const adminCostTotal = addedStudents * adminCostPerStudent;
  const extraContribution = revenueChange - marginalTutorCostTotal - adminCostTotal;
  const lostRevenueFromExisting = currentStudents * Math.max(0, currentPrice - discountedPrice) * expectedHours;
  const extraRevenueFromNewStudents = addedStudents * discountedPrice * expectedHours;
  const totalMarginalCost = marginalTutorCostTotal + adminCostTotal;
  const breakEvenAddedStudents =
    discountedPrice * expectedHours - marginalTutorCost * expectedHours - adminCostPerStudent <= 0
      ? null
      : Math.ceil(lostRevenueFromExisting / (discountedPrice * expectedHours - marginalTutorCost * expectedHours - adminCostPerStudent));
  const minDiscountedPrice =
    currentStudents + addedStudents === 0
      ? null
      : (currentStudents * currentPrice * expectedHours + totalMarginalCost) / ((currentStudents + addedStudents) * expectedHours);
  const upsideTone = extraContribution > 0 ? "green" : extraContribution === 0 ? "amber" : "red";
  const summaryBorder = upsideTone === "green" ? "border-green-200" : upsideTone === "red" ? "border-red-200" : "border-amber-200";

  function reset() {
    setProgramme(initialInputs.programme);
    setFormat(String(initialInputs.format));
    setCurrentStudents(initialInputs.currentStudents);
    setMaxCapacity(initialInputs.maxCapacity);
    setExpectedHours(currentQuote.expectedHours ?? 8);
    setCurrentPrice(currentQuote.displayPrice ?? 1000);
    setDiscountedPrice(Math.round(((currentQuote.displayPrice ?? 1000) * 0.9) / 10) * 10);
    setExpectedNewStudents(Math.max(0, initialInputs.maxCapacity - initialInputs.currentStudents));
    setMarginalTutorCost(50);
    setAdminCostPerStudent(120);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
      <aside className="order-2 space-y-4 xl:order-1">
        <section className="panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Class Scenario</h2>
              <p className="mt-1 text-sm text-slate-500">Model a price drop against filled seats.</p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={reset}
              title="Reset capacity simulator"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <SelectField label="Syllabus" value={programme} options={SYLLABUS_OPTIONS} onChange={applyProgramme} />
            <SelectField label="Format" value={format} options={FORMAT_OPTIONS} onChange={applyFormat} />
            <NumberField label="Current Students" min={0} value={currentStudents} onChange={setCurrentStudents} />
            <NumberField label="Max Capacity" min={1} value={maxCapacity} onChange={setMaxCapacity} />
            <NumberField label="Expected New Students" min={0} max={seatsAvailable} value={expectedNewStudents} onChange={setExpectedNewStudents} />
            <NumberField label="Expected Hours" min={1} value={expectedHours} onChange={setExpectedHours} />
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold text-slate-950">Price And Marginal Cost</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <NumberField label="Current Price / Hr" min={0} step={10} value={currentPrice} onChange={setCurrentPrice} />
            <NumberField label="Discounted Price / Hr" min={0} step={10} value={discountedPrice} onChange={setDiscountedPrice} />
            <NumberField label="Extra Tutor Cost / Hr / Student" min={0} step={10} value={marginalTutorCost} onChange={setMarginalTutorCost} />
            <NumberField label="Admin Cost / Added Student" min={0} step={10} value={adminCostPerStudent} onChange={setAdminCostPerStudent} />
          </div>
        </section>
      </aside>

      <section className="order-1 space-y-5 xl:order-2">
        <section className={`panel overflow-hidden ${summaryBorder}`}>
          <div className={`p-6 ${upsideTone === "green" ? "bg-green-50" : upsideTone === "red" ? "bg-red-50" : "bg-amber-50"}`}>
            <p className="text-sm font-semibold text-slate-600">Incremental contribution from filling seats</p>
            <h2 className="mt-2 text-4xl font-semibold text-slate-950">{formatCurrency(extraContribution)}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              This compares the current class revenue with a discounted filled-class scenario. Existing tutor cost is treated as already committed; only added seats carry {formatCurrency(marginalTutorCost)} tutor cost per hour plus admin cost.
            </p>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Seats Available" value={formatNumber(seatsAvailable)} />
          <Stat label="Added Students Modelled" value={formatNumber(addedStudents)} />
          <Stat label="Revenue Change" value={formatCurrency(revenueChange)} tone={revenueChange >= 0 ? "green" : "red"} />
          <Stat label="Marginal Cost" value={formatCurrency(totalMarginalCost)} tone="amber" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">Revenue Bridge</h2>
            <div className="mt-2">
              <Row label="Current class revenue" value={formatCurrency(currentClassRevenue)} detail={`${currentStudents} students x ${formatCurrency(currentPrice)} x ${formatNumber(expectedHours)} hrs`} />
              <Row
                label="Discounted filled-class revenue"
                value={formatCurrency(discountedClassRevenue)}
                detail={`${currentStudents + addedStudents} students x ${formatCurrency(discountedPrice)} x ${formatNumber(expectedHours)} hrs`}
              />
              <Row label="Lost revenue on existing students" value={`-${formatCurrency(lostRevenueFromExisting)}`} detail="Current students paying the lower price" />
              <Row label="Revenue from added students" value={formatCurrency(extraRevenueFromNewStudents)} detail={`${addedStudents} added students at discounted price`} />
              <Row label="Net revenue change" value={formatCurrency(revenueChange)} />
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">Decision Check</h2>
            <div className="mt-2">
              <Row label="Extra tutor cost" value={formatCurrency(marginalTutorCostTotal)} detail={`${formatCurrency(marginalTutorCost)} / hr / added student`} />
              <Row label="Admin cost" value={formatCurrency(adminCostTotal)} detail={`${formatCurrency(adminCostPerStudent)} / added student`} />
              <Row label="Extra contribution" value={formatCurrency(extraContribution)} />
              <Row label="Break-even added students" value={breakEvenAddedStudents === null ? "No break-even" : formatNumber(breakEvenAddedStudents)} />
              <Row label="Break-even discounted price" value={formatCurrency(minDiscountedPrice)} detail="At the modelled added-student count" />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
