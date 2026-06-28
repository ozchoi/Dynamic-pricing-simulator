export type NullableNumber = number | null;

export type Campaign = {
  season: string;
  adBudget: number;
  enquiries: number;
  studentsRecruited: number;
  costPerClick?: NullableNumber;
  costPerEnrolment?: NullableNumber;
  leadToRecruitmentRate?: NullableNumber;
  grossTrialCostPerEnrolment?: NullableNumber;
  netTrialCostPerEnrolment?: NullableNumber;
  fullyLoadedCAC?: NullableNumber;
  costPerEnquiry?: NullableNumber;
  adOnlyCPA?: NullableNumber;
};

export type Lead = {
  leadId: string;
  enquiryDate?: string;
  campaignSeason?: string;
  course?: string;
  programme?: string;
  format?: string;
  teacherTier?: string;
  timeSlot?: string;
  source?: string;
  currentStudents?: number;
  maxCapacity?: number;
  priceSensitivity?: string;
  urgency?: string;
  parentStatus?: string;
  trialOutcome?: string;
  basePrice?: number;
  courseAdjustment?: number;
  adjustedBase?: number;
  recommendedPrice?: number;
  pLeadToEnrol?: number;
  pRetention8Lessons?: number;
  expectedHours?: number;
  expectedRevenue?: number;
  expectedGrossProfit?: number;
  expectedNetContribution?: number;
};

export type CourseAdjustment = {
  course: string;
  adjustment: number;
};

export type PriceGridRow = {
  key: string;
  programme: string;
  format: string;
  basePrice: number;
  minPrice: number | null;
  maxPrice: number | null;
  expectedHours: number | null;
};

export type FactorRow = {
  label: string;
  factor: number;
  costPercent?: number | null;
};

export type SourceProbability = {
  source: string;
  parentReply: number;
  trialBook: number;
  trialAttend: number;
  enrolAfterTrial: number;
  retention: number;
};

export type PricingInputs = {
  campaignSeason?: string;
  course: string;
  programme: string;
  level?: string;
  format: string;
  teacherTier: string;
  timeSlot: string;
  subjectType: string;
  source: string;
  currentStudents: number;
  maxCapacity: number;
  priceSensitivity: string;
  urgency: string;
  parentStatus: string;
  trialOutcome: string;
  expectedHoursOverride?: number | null;
  priceOverride?: number | null;
  fixedMarketingCostOverride?: number | null;
};

export type PricingResult = {
  basePrice: number | null;
  courseAdjustment: number;
  adjustedBase: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  capacityUtilisation: number | null;
  teacherFactor: number;
  timeFactor: number;
  capacityFactor: number;
  subjectFactor: number;
  courseDemandFactor: number;
  parentStatusFactor: number;
  leadScore: number;
  recommendedPrice: number | null;
  displayPrice: number | null;
  recommendedOffer: string;
  pLeadToEnrol: number | null;
  pRetention8Lessons: number | null;
  expectedLessons: number;
  hoursPerLesson: number;
  expectedHours: number | null;
  expectedRevenue: number | null;
  tutorHourlyCost: number;
  expectedTutorCost: number | null;
  expectedAdminCost: number | null;
  fixedMarketingCost: number;
  expectedTotalCost: number | null;
  expectedGrossProfit: number | null;
  campaignLoadedCAC: number | null;
  expectedMarketingTrialCost: number | null;
  expectedNetContribution: number | null;
  warnings: string[];
};

export type WorkbookData = {
  campaigns: Campaign[];
  leads: Lead[];
  courseAdjustments: CourseAdjustment[];
  priceGrid: PriceGridRow[];
  teacherFactors: FactorRow[];
  timeFactors: FactorRow[];
  capacityFactors: { min: number; band: string; factor: number }[];
  subjectFactors: FactorRow[];
  sourceProbabilities: SourceProbability[];
  dashboardKpis: { label: string; value: string | number | null; note?: string }[];
  scenarioDefaults: Partial<PricingInputs>;
  dataQuality: {
    missingSheets: string[];
    missingValues: number;
    rowsIgnored: number;
    campaignsWithZeroStudents: number;
    leadsMissingSource: number;
    leadsMissingRecommendedPrice: number;
    formulaErrors: number;
    notes: string[];
  };
};
