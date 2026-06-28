import { Campaign, CourseAdjustment, FactorRow, PricingInputs, PricingResult, SourceProbability, WorkbookData } from "./types";

const DEFAULTS = {
  tutorCost: 550,
  adminCost: 120,
  lessonAdminCost: 30,
  hoursPerLesson: 2,
  expectedLessons: 8,
  fixedMarketingCost: 0,
  trialFeeOffset: 200,
  trialSuccessRate: 0.7632,
  campaignAdminCost: 0,
  designerCost: 0,
  grossMarginAssumption: 0.5,
  leadScorePriceAdjustment: 0.02,
  retentionProbability: 0.78,
  retentionCap: 0.9
};

const TUTOR_HOURLY_COSTS: Record<string, number> = {
  Core: 250,
  Experienced: 300,
  Senior: 350
};

export function divide(numerator: number | null | undefined, denominator: number | null | undefined) {
  if (!denominator || numerator === null || numerator === undefined) return null;
  return numerator / denominator;
}

export function calculateCampaignMetrics(campaign: Campaign): Campaign {
  const grossTrialCost = DEFAULTS.tutorCost + DEFAULTS.adminCost;
  const netTrialCost = grossTrialCost - DEFAULTS.trialFeeOffset;
  const adOnlyCPA = divide(campaign.adBudget, campaign.studentsRecruited);
  const fixedConversionCost = DEFAULTS.campaignAdminCost + DEFAULTS.designerCost;
  const fixedConversionCostPerEnrolment = divide(fixedConversionCost, campaign.studentsRecruited) ?? 0;
  const netTrialCostPerEnrolment = divide(netTrialCost, DEFAULTS.trialSuccessRate);

  return {
    ...campaign,
    costPerEnquiry: divide(campaign.adBudget, campaign.enquiries),
    adOnlyCPA,
    costPerEnrolment: adOnlyCPA,
    leadToRecruitmentRate: divide(campaign.studentsRecruited, campaign.enquiries),
    grossTrialCostPerEnrolment: divide(grossTrialCost, DEFAULTS.trialSuccessRate),
    netTrialCostPerEnrolment,
    fullyLoadedCAC:
      adOnlyCPA === null || netTrialCostPerEnrolment === null
        ? null
        : adOnlyCPA + fixedConversionCostPerEnrolment + netTrialCostPerEnrolment
  };
}

export function weightedAverage(items: { value: number | null | undefined; weight: number }[]) {
  const valid = items.filter((item) => item.value !== null && item.value !== undefined && item.weight > 0);
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return null;
  return valid.reduce((sum, item) => sum + Number(item.value) * item.weight, 0) / totalWeight;
}

function lookupFactor(rows: FactorRow[], label: string | undefined, fallback = 1) {
  if (!label) return fallback;
  return rows.find((row) => row.label.toLowerCase() === label.toLowerCase())?.factor ?? fallback;
}

function lookupCostPercent(rows: FactorRow[], label: string | undefined, fallback = DEFAULTS.grossMarginAssumption) {
  if (!label) return fallback;
  return rows.find((row) => row.label.toLowerCase() === label.toLowerCase())?.costPercent ?? fallback;
}

function lookupCourseAdjustment(adjustments: CourseAdjustment[], course: string) {
  const matched = adjustments.find((item) => item.course.toLowerCase() === course.toLowerCase());
  if (matched) return matched.adjustment;
  return course.toUpperCase().includes("TKHC") ? -100 : 0;
}

function score(map: Record<string, number>, key: string | undefined) {
  if (!key) return 0;
  return map[key] ?? map[key.toLowerCase()] ?? 0;
}

function roundToNearest(value: number, nearest: number) {
  return Math.round(value / nearest) * nearest;
}

function probabilityForStage(source: SourceProbability | undefined, parentStatus: string, trialOutcome: string) {
  const p = source ?? {
    source: "Default",
    parentReply: 0.55,
    trialBook: 0.5,
    trialAttend: 0.8,
    enrolAfterTrial: 0.7632,
    retention: DEFAULTS.retentionProbability
  };

  if (["Easy going", "Normal", "Red Flag"].includes(parentStatus)) {
    if (trialOutcome === "Strong") return Math.min(0.95, p.enrolAfterTrial + 0.12);
    if (trialOutcome === "Weak") return Math.max(0.05, p.enrolAfterTrial - 0.25);
    return p.trialBook * p.trialAttend * p.enrolAfterTrial;
  }
  if (parentStatus === "Enrolled") return 1;
  if (parentStatus === "Lost" || parentStatus === "Ghost") return 0;
  if (trialOutcome === "Strong") return Math.min(0.95, p.enrolAfterTrial + 0.12);
  if (trialOutcome === "Weak") return Math.max(0.05, p.enrolAfterTrial - 0.25);
  if (parentStatus === "Trial attended") return p.enrolAfterTrial;
  if (parentStatus === "Trial booked") return p.trialAttend * p.enrolAfterTrial;
  if (parentStatus === "Replied") return p.trialBook * p.trialAttend * p.enrolAfterTrial;
  return p.parentReply * p.trialBook * p.trialAttend * p.enrolAfterTrial;
}

function parentStatusFactor(status: string | undefined) {
  return score({ "Easy going": 0.95, Normal: 1, "Red Flag": 1.05 }, status) || 1;
}

function tutorHourlyCost(tier: string | undefined) {
  if (!tier) return TUTOR_HOURLY_COSTS.Core;
  const matchedTier = Object.keys(TUTOR_HOURLY_COSTS).find((key) => key.toLowerCase() === tier.toLowerCase());
  return matchedTier ? TUTOR_HOURLY_COSTS[matchedTier] : TUTOR_HOURLY_COSTS.Core;
}

function formatCandidates(format: string | undefined) {
  if (!format) return ["Group", "1"];
  const normalized = String(format).trim();
  if (normalized === "Group" || /^[1-6]$/.test(normalized)) return ["Group", "1"];
  return [normalized];
}

function isHkdseGroup(inputs: PricingInputs) {
  return inputs.programme.toUpperCase() === "HKDSE" && String(inputs.format).toLowerCase() === "group";
}

function hkdseCapacityStep(currentStudents: number) {
  return String(Math.max(1, Math.min(6, Math.ceil(currentStudents || 1))));
}

function lookupPriceRow(data: WorkbookData, programme: string, formats: string[]) {
  return data.priceGrid.find(
    (row) =>
      row.programme.toLowerCase() === programme.toLowerCase() &&
      formats.some((format) => String(row.format).toLowerCase() === format.toLowerCase())
  );
}

function hkdseCapacityPricing(inputs: PricingInputs, data: WorkbookData) {
  if (!isHkdseGroup(inputs)) return null;

  const baseRow = lookupPriceRow(data, inputs.programme, ["1"]);
  const capacityRow = lookupPriceRow(data, inputs.programme, [hkdseCapacityStep(inputs.currentStudents)]);
  if (!baseRow || !capacityRow || !baseRow.basePrice) return null;

  return {
    baseRow,
    capacityRow,
    factor: capacityRow.basePrice / baseRow.basePrice
  };
}

export function calculatePricing(inputs: PricingInputs, data: WorkbookData): PricingResult {
  const possibleFormats = formatCandidates(inputs.format);
  const hkdseCapacity = hkdseCapacityPricing(inputs, data);
  const priceRow = hkdseCapacity?.baseRow ?? lookupPriceRow(data, inputs.programme, possibleFormats) ?? data.priceGrid[0];

  const basePrice = priceRow?.basePrice ?? null;
  const courseAdjustment = lookupCourseAdjustment(data.courseAdjustments, inputs.course);
  const adjustedBase = basePrice === null ? null : basePrice + courseAdjustment;
  const minPrice = hkdseCapacity?.capacityRow.minPrice ?? priceRow?.minPrice ?? (basePrice === null ? null : basePrice * 0.85 + courseAdjustment);
  const maxPrice =
    hkdseCapacity?.capacityRow.maxPrice ??
    priceRow?.maxPrice ??
    (hkdseCapacity?.capacityRow.basePrice
      ? hkdseCapacity.capacityRow.basePrice * 1.25 + courseAdjustment
      : basePrice === null
        ? null
        : basePrice * 1.25 + courseAdjustment);
  const capacityUtilisation = isHkdseGroup(inputs) ? divide(inputs.currentStudents, 6) : divide(inputs.currentStudents, inputs.maxCapacity);
  const teacherFactor = lookupFactor(data.teacherFactors, inputs.teacherTier);
  const timeFactor = lookupFactor(data.timeFactors, inputs.timeSlot);
  const capacityFactor =
    hkdseCapacity?.factor ??
    (capacityUtilisation === null
      ? 1
      : [...data.capacityFactors].reverse().find((row) => capacityUtilisation >= row.min)?.factor ?? 1);
  const subjectFactor = lookupFactor(data.subjectFactors, inputs.subjectType);
  const courseDemandFactor = inputs.course.toUpperCase().includes("TKHC") ? 0.98 : 1;
  const parentFactor = parentStatusFactor(inputs.parentStatus);
  const leadScore =
    score({ Low: 1, Medium: 0, High: -2 }, inputs.priceSensitivity) +
    score({ Low: 0, Medium: 1, High: 2 }, inputs.urgency) +
    score({ "Not yet": 0, Strong: 2, Medium: 0, Weak: -2 }, inputs.trialOutcome);

  const rawPrice =
    inputs.priceOverride ??
    (adjustedBase === null
      ? null
      : adjustedBase *
        teacherFactor *
        timeFactor *
        capacityFactor *
        subjectFactor *
        courseDemandFactor *
        parentFactor *
        (1 + leadScore * DEFAULTS.leadScorePriceAdjustment));
  const guarded = rawPrice === null ? null : Math.max(minPrice ?? rawPrice, Math.min(maxPrice ?? rawPrice, rawPrice));
  const recommendedPrice = guarded === null ? null : roundToNearest(guarded, 10);
  const displayPrice = recommendedPrice === null ? null : roundToNearest(recommendedPrice, 50);
  const source = data.sourceProbabilities.find((row) => row.source.toLowerCase() === inputs.source.toLowerCase());
  const pLeadToEnrol = probabilityForStage(source, inputs.parentStatus, inputs.trialOutcome);
  const pRetention8Lessons = Math.max(
    0,
    Math.min(
      DEFAULTS.retentionCap,
      (source?.retention ?? DEFAULTS.retentionProbability) +
        (inputs.trialOutcome === "Strong" ? 0.05 : inputs.trialOutcome === "Weak" ? -0.1 : 0) +
        (inputs.priceSensitivity === "High" ? -0.05 : 0) +
        (inputs.source === "Referral" ? 0.03 : 0)
    )
  );
  const expectedLessons = DEFAULTS.expectedLessons;
  const hoursPerLesson = DEFAULTS.hoursPerLesson;
  const expectedHours = inputs.expectedHoursOverride ?? priceRow?.expectedHours ?? expectedLessons * hoursPerLesson;
  const expectedRevenue =
    recommendedPrice === null || expectedHours === null ? null : recommendedPrice * expectedHours * pLeadToEnrol * pRetention8Lessons;
  const rawTutorHourlyCost = tutorHourlyCost(inputs.teacherTier);
  const fixedMarketingCost = inputs.fixedMarketingCostOverride ?? DEFAULTS.fixedMarketingCost;
  const expectedTutorCost = expectedHours === null ? null : rawTutorHourlyCost * expectedHours * pLeadToEnrol * pRetention8Lessons;
  const expectedAdminCost =
    DEFAULTS.adminCost * pLeadToEnrol + DEFAULTS.lessonAdminCost * expectedLessons * pLeadToEnrol * pRetention8Lessons;
  const expectedTotalCost =
    expectedTutorCost === null ? null : expectedTutorCost + expectedAdminCost + fixedMarketingCost;
  const expectedGrossProfit =
    expectedRevenue === null || expectedTotalCost === null ? null : expectedRevenue - expectedTotalCost;
  const campaignLoadedCAC = fixedMarketingCost;
  const expectedMarketingTrialCost = fixedMarketingCost;
  const expectedNetContribution = expectedGrossProfit;
  const warnings = [
    capacityUtilisation !== null && capacityUtilisation > 0.85 ? "Capacity utilisation is above 85%." : "",
    rawPrice !== null && minPrice !== null && rawPrice < minPrice ? "Calculated price is below guardrail." : "",
    !source ? "Source probability is missing; fallback probabilities are in use." : ""
  ].filter(Boolean);

  let recommendedOffer = "Standard package + mentor review";
  if (inputs.priceSensitivity === "High" && leadScore <= 0) recommendedOffer = "Paid trial + Core / 2:1 option";
  if (inputs.urgency === "High" && inputs.teacherTier === "Senior") recommendedOffer = "Premium senior teacher quote";
  if (timeFactor < 1 && (capacityUtilisation ?? 1) < 0.4) recommendedOffer = "Non-peak starter package";
  if (inputs.trialOutcome === "Strong") recommendedOffer = "Standard package, no hourly discount";
  if (inputs.trialOutcome === "Weak") recommendedOffer = "Group / non-peak only, avoid senior peak slot";

  return {
    basePrice,
    courseAdjustment,
    adjustedBase,
    minPrice,
    maxPrice,
    capacityUtilisation,
    teacherFactor,
    timeFactor,
    capacityFactor,
    subjectFactor,
    courseDemandFactor,
    parentStatusFactor: parentFactor,
    leadScore,
    recommendedPrice,
    displayPrice,
    recommendedOffer,
    pLeadToEnrol,
    pRetention8Lessons,
    expectedLessons,
    hoursPerLesson,
    expectedHours,
    expectedRevenue,
    tutorHourlyCost: rawTutorHourlyCost,
    expectedTutorCost,
    expectedAdminCost,
    fixedMarketingCost,
    expectedTotalCost,
    expectedGrossProfit,
    campaignLoadedCAC,
    expectedMarketingTrialCost,
    expectedNetContribution,
    warnings
  };
}
