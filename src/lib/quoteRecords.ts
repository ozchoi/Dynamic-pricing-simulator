import { PricingInputs, PricingResult } from "./types";

export const priceFeedbackOptions = [
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

export function buildQuoteRecord(
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
    ...(inputs.programme === "HKDSE" ? { Level: inputs.level ?? "F.1" } : {}),
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
    "Raw Price / Hr": numberOrBlank(result.rawPrice),
    "Guarded Price / Hr": numberOrBlank(result.guardedPrice),
    "Recommended Price / Hr": numberOrBlank(result.recommendedPrice),
    "Display Price / Hr": numberOrBlank(result.displayPrice),
    "Recommended Offer": result.recommendedOffer,
    "Lead To Enrol Probability": numberOrBlank(result.pLeadToEnrol),
    "8-Lesson Retention Probability": numberOrBlank(result.pRetention8Lessons),
    "Expected Lessons": result.expectedLessons,
    "Hours Per Lesson": result.hoursPerLesson,
    "Class Teaching Hours": numberOrBlank(result.classTeachingHours),
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
    "Teaching Hours Override": numberOrBlank(inputs.expectedHoursOverride),
    "Manual Price / Hr": numberOrBlank(inputs.priceOverride),
    "Fixed Marketing Cost Override": numberOrBlank(inputs.fixedMarketingCostOverride),
    "Price Feedback Score": priceFeedback,
    "Price Feedback Label": feedbackLabel(priceFeedback),
    "User Suggested Price / Hr": numberOrBlank(userSuggestedPrice)
  };
}

export function createQuoteKey(inputs: PricingInputs, result: PricingResult, userSuggestedPrice: number | null) {
  return JSON.stringify({
    campaignSeason: inputs.campaignSeason ?? "",
    syllabus: inputs.programme,
    level: inputs.programme === "HKDSE" ? inputs.level ?? "F.1" : null,
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
