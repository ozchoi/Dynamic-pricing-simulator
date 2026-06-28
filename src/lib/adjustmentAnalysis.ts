type QuoteValue = string | number | boolean | null | undefined;

export type QuoteRecord = Record<string, QuoteValue>;

export type AdjustmentSuggestion = {
  id: string;
  factor: string;
  level: string;
  currentFactor: number;
  suggestedFactor: number;
  changePercent: number;
  sampleSize: number;
  averageFeedback: number;
  coefficient: number;
  confidence: "Low" | "Medium" | "High";
  direction: "lower" | "raise";
  rationale: string;
};

const FEATURE_SPECS = [
  { factor: "Syllabus", field: "Syllabus", currentFactorField: "Demand Factor" },
  { factor: "Format", field: "Format", currentFactorField: null },
  { factor: "Teacher Tier", field: "Teacher Tier", currentFactorField: "Teacher Factor" },
  { factor: "Time Slot", field: "Time Slot", currentFactorField: "Time Factor" },
  { factor: "Subject Type", field: "Subject Type", currentFactorField: "Subject Factor" },
  { factor: "Parent Session", field: "Parent Session", currentFactorField: "Parent Session Factor" },
  { factor: "Price Sensitivity", field: "Price Sensitivity", currentFactorField: null },
  { factor: "Urgency", field: "Urgency", currentFactorField: null },
  { factor: "Trial Outcome", field: "Trial Outcome", currentFactorField: null }
];

const MIN_SAMPLES = 4;
const SHRINKAGE = 8;
const MAX_FACTOR_STEP = 0.08;

function asNumber(value: QuoteValue) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asText(value: QuoteValue) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function confidenceFor(sampleSize: number, coefficient: number): AdjustmentSuggestion["confidence"] {
  if (sampleSize >= 20 && Math.abs(coefficient) >= 0.35) return "High";
  if (sampleSize >= 10 && Math.abs(coefficient) >= 0.25) return "Medium";
  return "Low";
}

function readableRationale(coefficient: number, averageFeedback: number) {
  if (coefficient > 0) {
    return `Feedback is leaning high after controlling for the other quote inputs. Average vote: ${averageFeedback.toFixed(2)}.`;
  }
  return `Feedback is leaning low after controlling for the other quote inputs. Average vote: ${averageFeedback.toFixed(2)}.`;
}

export function analyseAdjustmentSuggestions(quotes: QuoteRecord[]) {
  const rows = quotes
    .map((quote) => {
      const feedback = asNumber(quote["Price Feedback Score"]);
      if (feedback === null) return null;
      return {
        quote,
        target: feedback - 3,
        feedback
      };
    })
    .filter(Boolean) as { quote: QuoteRecord; target: number; feedback: number }[];

  if (rows.length < MIN_SAMPLES) {
    return { sampleSize: rows.length, suggestions: [] as AdjustmentSuggestion[] };
  }

  const globalMean = mean(rows.map((row) => row.target));
  const coefficients = new Map<string, number>();

  for (let iteration = 0; iteration < 8; iteration += 1) {
    for (const spec of FEATURE_SPECS) {
      const buckets = new Map<string, number[]>();
      for (const row of rows) {
        const level = asText(row.quote[spec.field]);
        if (!level) continue;
        const residual =
          row.target -
          globalMean -
          FEATURE_SPECS.reduce((sum, otherSpec) => {
            if (otherSpec.factor === spec.factor) return sum;
            const otherLevel = asText(row.quote[otherSpec.field]);
            return otherLevel ? sum + (coefficients.get(`${otherSpec.factor}:${otherLevel}`) ?? 0) : sum;
          }, 0);
        buckets.set(level, [...(buckets.get(level) ?? []), residual]);
      }

      for (const [level, residuals] of buckets) {
        const shrink = residuals.length / (residuals.length + SHRINKAGE);
        coefficients.set(`${spec.factor}:${level}`, mean(residuals) * shrink);
      }
    }
  }

  const suggestions: AdjustmentSuggestion[] = [];

  for (const spec of FEATURE_SPECS) {
    const levels = new Map<string, { feedback: number[]; factors: number[] }>();
    for (const row of rows) {
      const level = asText(row.quote[spec.field]);
      if (!level) continue;
      const existing = levels.get(level) ?? { feedback: [], factors: [] };
      existing.feedback.push(row.feedback);
      const currentFactor = spec.currentFactorField ? asNumber(row.quote[spec.currentFactorField]) : null;
      if (currentFactor !== null && currentFactor > 0) existing.factors.push(currentFactor);
      levels.set(level, existing);
    }

    for (const [level, values] of levels) {
      if (values.feedback.length < MIN_SAMPLES) continue;

      const coefficient = coefficients.get(`${spec.factor}:${level}`) ?? 0;
      if (Math.abs(coefficient) < 0.15) continue;

      const currentFactor = values.factors.length ? mean(values.factors) : 1;
      const boundedStep = clamp(coefficient * 0.04, -MAX_FACTOR_STEP, MAX_FACTOR_STEP);
      const suggestedFactor = Number((currentFactor * (1 - boundedStep)).toFixed(3));
      const changePercent = ((suggestedFactor - currentFactor) / currentFactor) * 100;
      const direction = coefficient > 0 ? "lower" : "raise";

      suggestions.push({
        id: `${spec.factor}:${level}`,
        factor: spec.factor,
        level,
        currentFactor: Number(currentFactor.toFixed(3)),
        suggestedFactor,
        changePercent,
        sampleSize: values.feedback.length,
        averageFeedback: mean(values.feedback),
        coefficient,
        confidence: confidenceFor(values.feedback.length, coefficient),
        direction,
        rationale: readableRationale(coefficient, mean(values.feedback))
      });
    }
  }

  return {
    sampleSize: rows.length,
    suggestions: suggestions
      .sort((a, b) => Math.abs(b.coefficient) * b.sampleSize - Math.abs(a.coefficient) * a.sampleSize)
      .slice(0, 12)
  };
}
