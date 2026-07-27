import assert from "node:assert/strict";
import test from "node:test";
import { analyseAdjustmentSuggestions } from "../.tmp-tests/src/lib/adjustmentAnalysis.js";
import { calculatePricing, calculateCampaignMetrics, divide } from "../.tmp-tests/src/lib/calculations.js";
import { buildQuoteRecord, createQuoteKey } from "../.tmp-tests/src/lib/quoteRecords.js";

const capacityFactors = [
  { min: 0, band: "Underfilled (<40%)", factor: 0.95 },
  { min: 0.4, band: "Normal (40-70%)", factor: 1 },
  { min: 0.7, band: "Tight (70-85%)", factor: 1.05 },
  { min: 0.85, band: "Near full (85-95%)", factor: 1.1 },
  { min: 0.95, band: "Waitlist / very scarce", factor: 1.15 }
];

const data = {
  campaigns: [],
  leads: [],
  courseAdjustments: [{ course: "TKHC", adjustment: -100 }],
  priceGrid: [
    { key: "IAL|Group", programme: "IAL", format: "Group", basePrice: 580, minPrice: 522, maxPrice: null, expectedHours: null },
    { key: "IAL|2:1", programme: "IAL", format: "2:1", basePrice: 780, minPrice: 702, maxPrice: null, expectedHours: null },
    { key: "F4", programme: "HKDSE", format: "1", basePrice: 480, minPrice: 432, maxPrice: null, expectedHours: null }
  ],
  teacherFactors: [
    { label: "Core", factor: 1, costPercent: 0.45 },
    { label: "Experienced", factor: 1.2, costPercent: 0.5 },
    { label: "Senior", factor: 1.3, costPercent: 0.55 }
  ],
  timeFactors: [
    { label: "Weekend 14:00-16:00", factor: 1 },
    { label: "Weekday 08:00-10:00", factor: 0.85 }
  ],
  capacityFactors,
  subjectFactors: [{ label: "IAL Science", factor: 1 }],
  sourceProbabilities: [{ source: "Referral", parentReply: 0.72, trialBook: 0.65, trialAttend: 0.86, enrolAfterTrial: 0.82, retention: 0.82 }],
  dashboardKpis: [],
  scenarioDefaults: {},
  dataQuality: {
    missingSheets: [],
    missingValues: 0,
    rowsIgnored: 0,
    campaignsWithZeroStudents: 0,
    leadsMissingSource: 0,
    leadsMissingRecommendedPrice: 0,
    formulaErrors: 0,
    notes: []
  }
};

const baseInputs = {
  campaignSeason: "Workbook baseline",
  course: "IAL",
  programme: "IAL",
  format: "Group",
  teacherTier: "Core",
  timeSlot: "Weekend 14:00-16:00",
  subjectType: "IAL Science",
  source: "Referral",
  currentStudents: 1,
  maxCapacity: 4,
  priceSensitivity: "Medium",
  urgency: "High",
  parentStatus: "Normal",
  trialOutcome: "Not yet",
  expectedHoursOverride: null,
  priceOverride: null,
  fixedMarketingCostOverride: null
};

function approx(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

test("core IAL pricing independently matches formula, guardrails, and operating costs", () => {
  const result = calculatePricing(baseInputs, data);
  const leadScore = 0 + 2 + 0;
  const rawPrice = 580 * 1 * 1 * 0.95 * 1 * 1 * 1 * (1 + leadScore * 0.02);
  const guardedPrice = Math.max(522, Math.min(580 * 1.25, rawPrice));
  const recommendedPrice = Math.round(guardedPrice / 10) * 10;
  const pLeadToEnrol = 0.65 * 0.86 * 0.82;
  const retention = Math.min(0.9, 0.82 + 0.03);
  const classTeachingHours = 8 * 2;
  const billableStudentHours = classTeachingHours * 1;
  const expectedRevenue = recommendedPrice * billableStudentHours * pLeadToEnrol * retention;
  const tutorCost = 250 * classTeachingHours * pLeadToEnrol * retention;
  const adminCost = 120 * pLeadToEnrol + 30 * 8 * pLeadToEnrol * retention;

  approx(result.rawPrice, rawPrice, "raw price");
  approx(result.guardedPrice, guardedPrice, "guarded price");
  assert.equal(result.recommendedPrice, 570);
  assert.equal(result.displayPrice, 570);
  approx(result.pLeadToEnrol, pLeadToEnrol, "lead-to-enrol probability");
  approx(result.pRetention8Lessons, retention, "retention probability");
  assert.equal(result.classTeachingHours, classTeachingHours);
  assert.equal(result.expectedHours, billableStudentHours);
  approx(result.expectedRevenue, expectedRevenue, "expected revenue");
  approx(result.expectedTutorCost, tutorCost, "expected tutor cost");
  approx(result.expectedAdminCost, adminCost, "expected admin cost");
  approx(result.expectedTotalCost, tutorCost + adminCost, "total expected cost");
  approx(result.expectedGrossProfit, expectedRevenue - tutorCost - adminCost, "gross profit");
  approx(result.expectedNetContribution, result.expectedGrossProfit, "net contribution");
});

test("group tutor hourly cost increases by HK$50 for each extra student", () => {
  const result = calculatePricing({ ...baseInputs, currentStudents: 4, maxCapacity: 4 }, data);
  assert.equal(result.tutorHourlyCost, 400);
  assert.equal(result.expectedHours, 64);
});

test("HKDSE level price uses selected F-level row and capacity utilisation over 6 seats", () => {
  const result = calculatePricing({ ...baseInputs, course: "HKDSE", programme: "HKDSE", level: "F.4", currentStudents: 5, maxCapacity: 4 }, data);
  const rawPrice = 480 * 1.05 * 1.04;
  assert.equal(result.basePrice, 480);
  approx(result.capacityUtilisation, 5 / 6, "HKDSE utilisation");
  assert.equal(result.capacityFactor, 1.05);
  approx(result.rawPrice, rawPrice, "HKDSE raw price");
  assert.equal(result.recommendedPrice, 520);
});

test("missing programme and format does not silently reuse first price-grid row", () => {
  const result = calculatePricing({ ...baseInputs, course: "Unknown", programme: "Unknown", format: "Group" }, data);
  assert.equal(result.basePrice, null);
  assert.equal(result.recommendedPrice, null);
  assert.match(result.warnings.join(" "), /No price-grid row found/);
});

test("manual price override still passes through guardrails and uses override in economics", () => {
  const belowMin = calculatePricing({ ...baseInputs, priceOverride: 100 }, data);
  assert.equal(belowMin.guardedPrice, 522);
  assert.equal(belowMin.recommendedPrice, 520);

  const inRange = calculatePricing({ ...baseInputs, priceOverride: 620 }, data);
  assert.equal(inRange.rawPrice, 620);
  assert.equal(inRange.guardedPrice, 620);
  assert.equal(inRange.recommendedPrice, 620);
  approx(inRange.expectedRevenue, 620 * 16 * (0.65 * 0.86 * 0.82) * 0.85, "override expected revenue");
});

test("quote records include level only when HKDSE is selected", () => {
  const result = calculatePricing(baseInputs, data);
  const slider = calculatePricing({ ...baseInputs, priceOverride: 600 }, data);
  const ialRecord = buildQuoteRecord(baseInputs, result, 4, 500, 600, slider);
  assert.equal(Object.hasOwn(ialRecord, "Level"), false);
  assert.equal(ialRecord["Price Feedback Label"], "Slightly too high");
  assert.equal(ialRecord["Raw Price / Hr"], result.rawPrice);
  assert.equal(ialRecord["Class Teaching Hours"], 16);

  const hkdseInputs = { ...baseInputs, course: "HKDSE", programme: "HKDSE", level: "F.4" };
  const hkdseRecord = buildQuoteRecord(hkdseInputs, calculatePricing(hkdseInputs, data), 3, null, 520, calculatePricing(hkdseInputs, data));
  assert.equal(hkdseRecord.Level, "F.4");

  const ialKey = JSON.parse(createQuoteKey(baseInputs, result, 500));
  assert.equal(ialKey.level, null);
  const hkdseKey = JSON.parse(createQuoteKey(hkdseInputs, calculatePricing(hkdseInputs, data), null));
  assert.equal(hkdseKey.level, "F.4");
});

test("campaign CAC calculations handle denominators independently", () => {
  const campaign = calculateCampaignMetrics({ season: "Test", adBudget: 10000, enquiries: 50, studentsRecruited: 5 });
  assert.equal(campaign.costPerEnquiry, 200);
  assert.equal(campaign.adOnlyCPA, 2000);
  assert.equal(campaign.leadToRecruitmentRate, 0.1);
  approx(campaign.grossTrialCostPerEnrolment, 670 / 0.7632, "gross trial cost per enrolment");
  approx(campaign.netTrialCostPerEnrolment, 470 / 0.7632, "net trial cost per enrolment");
  approx(campaign.fullyLoadedCAC, 2000 + 470 / 0.7632, "fully loaded CAC");
  assert.equal(divide(1, 0), null);
});

test("capacity upside arithmetic separates revenue bridge and marginal costs", () => {
  const currentStudents = 2;
  const addedStudents = 2;
  const currentPrice = 580;
  const discountedPrice = 520;
  const expectedHours = 16;
  const marginalTutorCost = 50;
  const adminCostPerStudent = 120;
  const currentClassRevenue = currentStudents * currentPrice * expectedHours;
  const discountedClassRevenue = (currentStudents + addedStudents) * discountedPrice * expectedHours;
  const revenueChange = discountedClassRevenue - currentClassRevenue;
  const marginalTutorCostTotal = addedStudents * marginalTutorCost * expectedHours;
  const adminCostTotal = addedStudents * adminCostPerStudent;
  const extraContribution = revenueChange - marginalTutorCostTotal - adminCostTotal;
  const lostRevenueFromExisting = currentStudents * (currentPrice - discountedPrice) * expectedHours;
  const extraRevenueFromNewStudents = addedStudents * discountedPrice * expectedHours;

  assert.equal(currentClassRevenue, 18560);
  assert.equal(discountedClassRevenue, 33280);
  assert.equal(revenueChange, 14720);
  assert.equal(lostRevenueFromExisting, 1920);
  assert.equal(extraRevenueFromNewStudents, 16640);
  assert.equal(marginalTutorCostTotal, 1600);
  assert.equal(adminCostTotal, 240);
  assert.equal(extraContribution, 12880);
});

test("adjustment learning waits for enough samples and suggests lower factor when feedback is high", () => {
  assert.deepEqual(analyseAdjustmentSuggestions([]), { sampleSize: 0, suggestions: [] });
  const quotes = [
    ...Array.from({ length: 8 }, () => ({ "Price Feedback Score": 5, "Parent Session": "Red Flag", "Parent Session Factor": 1.05 })),
    ...Array.from({ length: 8 }, () => ({ "Price Feedback Score": 1, "Parent Session": "Easy going", "Parent Session Factor": 0.95 }))
  ];
  const analysis = analyseAdjustmentSuggestions(quotes);
  const redFlag = analysis.suggestions.find((item) => item.factor === "Parent Session" && item.level === "Red Flag");
  assert.ok(redFlag);
  assert.equal(redFlag.direction, "lower");
  assert.ok(redFlag.suggestedFactor < redFlag.currentFactor);
});
