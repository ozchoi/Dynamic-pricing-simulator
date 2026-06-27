import path from "node:path";
import * as XLSX from "xlsx";
import { calculateCampaignMetrics } from "./calculations";
import { Campaign, CourseAdjustment, FactorRow, Lead, PriceGridRow, SourceProbability, WorkbookData } from "./types";

const WORKBOOK_PATH = path.join(process.cwd(), "src/data/Bliss_Dynamic_Pricing_Model_MVP_v3_PowerBI_ready.xlsx");
const EXPECTED_SHEETS = [
  "Assumptions",
  "Campaign_CAC",
  "Lead_Input_v2",
  "Scenario_v2",
  "Dashboard",
  "Course_Adjustments",
  "Sources",
  "README_Update"
];

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text || text.startsWith("#")) return null;
  if (text === "-") return 0;
  const isPercent = text.endsWith("%");
  const cleaned = text.replace(/HK\$|\$|,|%|x/g, "").trim();
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return isPercent ? parsed / 100 : parsed;
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function sheetRows(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false, raw: false });
}

function parseTable<T>(rows: unknown[][], headerMatchers: string[], mapper: (record: Record<string, unknown>) => T | null) {
  const headerIndex = rows.findIndex((row) =>
    headerMatchers.every((matcher) => row.some((cell) => cleanText(cell).toLowerCase().includes(matcher.toLowerCase())))
  );
  if (headerIndex === -1) return { rows: [] as T[], ignored: 0 };
  const headers = rows[headerIndex].map(cleanText);
  let ignored = 0;
  const parsed: T[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some((cell) => cleanText(cell) !== "")) continue;
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index]]));
    const item = mapper(record);
    if (item) parsed.push(item);
    else ignored += 1;
  }
  return { rows: parsed, ignored };
}

function parsePriceGrid(rows: unknown[][]) {
  return parseTable<PriceGridRow>(rows, ["Programme", "Format", "Base Price"], (record) => {
    const programme = cleanText(record["Programme"]);
    const format = cleanText(record["Format"]);
    const basePrice = cleanNumber(record["Base Price (HK$/hr)"] ?? record["Base Price"]);
    if (!programme || !format || basePrice === null) return null;
    return {
      key: cleanText(record["Key"]) || `${programme}|${format}`,
      programme,
      format,
      basePrice,
      minPrice: cleanNumber(record["Min Price"]),
      maxPrice: cleanNumber(record["Max Price"]),
      expectedHours: cleanNumber(record["Expected Hours"] ?? record["Hours"])
    };
  });
}

function parseFactors(rows: unknown[][]) {
  const teacherFactors: FactorRow[] = [];
  const timeFactors: FactorRow[] = [];
  const capacityFactors: WorkbookData["capacityFactors"] = [];
  const subjectFactors: FactorRow[] = [];

  for (const row of rows) {
    const a = cleanText(row[0]);
    const b = cleanNumber(row[1]);
    const c = cleanNumber(row[2]);
    const e = cleanText(row[4]);
    const f = cleanNumber(row[5]);
    if (["Core", "Experienced", "Senior"].includes(a) && b !== null) teacherFactors.push({ label: a, factor: b, costPercent: c });
    if (e && f !== null && !["Time Slot", "Subject Type", "Urgency"].includes(e)) {
      if (e.includes(":") || e.includes("Weekend") || e.includes("Weekday") || e.includes("Exam")) timeFactors.push({ label: e, factor: f });
      if (!e.includes(":") && !e.includes("Weekend") && !e.includes("Weekday") && !e.includes("Exam") && e !== "Subject Demand Factor") {
        subjectFactors.push({ label: e, factor: f });
      }
    }
    const minUtilisation = cleanNumber(row[0]);
    if (minUtilisation !== null && cleanText(row[1]) && cleanNumber(row[2]) !== null) {
      capacityFactors.push({ min: minUtilisation, band: cleanText(row[1]), factor: Number(cleanNumber(row[2])) });
    }
  }

  if (!teacherFactors.length) {
    teacherFactors.push({ label: "Core", factor: 1, costPercent: 0.45 }, { label: "Experienced", factor: 1.2, costPercent: 0.5 }, { label: "Senior", factor: 1.3, costPercent: 0.55 });
  }
  if (!timeFactors.length) timeFactors.push({ label: "Peak", factor: 1.1 }, { label: "Standard", factor: 1 }, { label: "Non-peak", factor: 0.9 });
  if (!capacityFactors.length) {
    capacityFactors.push({ min: 0, band: "Underfilled", factor: 0.95 }, { min: 0.4, band: "Normal", factor: 1 }, { min: 0.85, band: "Near full", factor: 1.08 });
  }
  if (!subjectFactors.length) subjectFactors.push({ label: "Core Sciences", factor: 1 }, { label: "IBDP HL", factor: 1 }, { label: "Other", factor: 1 });

  return { teacherFactors, timeFactors, capacityFactors, subjectFactors };
}

function parseCourseAdjustments(workbook: XLSX.WorkBook) {
  const rows = sheetRows(workbook, "Course_Adjustments");
  const parsed = parseTable<CourseAdjustment>(rows, ["Course", "Adjustment"], (record) => {
    const course = cleanText(record["Course"]);
    const adjustment = cleanNumber(record["Adjustment"]);
    if (!course || adjustment === null) return null;
    return { course, adjustment };
  }).rows;
  if (!parsed.some((item) => item.course.toUpperCase() === "TKHC")) parsed.push({ course: "TKHC", adjustment: -100 });
  return parsed;
}

function parseCampaigns(workbook: XLSX.WorkBook) {
  const rows = sheetRows(workbook, "Campaign_CAC");
  const parsed = parseTable<Campaign>(rows, ["Season", "Budget"], (record) => {
    const season = cleanText(record["Season"] ?? record["Campaign"] ?? record["Campaign Season"]);
    const adBudget = cleanNumber(record["Ad Budget"] ?? record["Budget"]);
    const enquiries = cleanNumber(record["Enquiries"] ?? record["Leads"]);
    const studentsRecruited = cleanNumber(record["Students Recruited"] ?? record["Recruited"] ?? record["Enrolled"]);
    if (!season || adBudget === null || enquiries === null || studentsRecruited === null) return null;
    return calculateCampaignMetrics({ season, adBudget, enquiries, studentsRecruited });
  });
  return parsed;
}

function parseLeads(workbook: XLSX.WorkBook) {
  const rows = sheetRows(workbook, "Lead_Input_v2");
  return parseTable<Lead>(rows, ["Lead"], (record) => {
    const leadId = cleanText(record["Lead ID"] ?? record["LeadId"] ?? record["Lead"]);
    if (!leadId) return null;
    return {
      leadId,
      enquiryDate: cleanText(record["Enquiry Date"]),
      campaignSeason: cleanText(record["Campaign Season"]),
      course: cleanText(record["Course"]),
      programme: cleanText(record["Programme"]),
      format: cleanText(record["Format"]),
      teacherTier: cleanText(record["Teacher Tier"]),
      timeSlot: cleanText(record["Time Slot"]),
      source: cleanText(record["Source"]),
      currentStudents: cleanNumber(record["Current Students"]) ?? undefined,
      maxCapacity: cleanNumber(record["Max Capacity"]) ?? undefined,
      priceSensitivity: cleanText(record["Price Sensitivity"]),
      urgency: cleanText(record["Urgency"]),
      parentStatus: cleanText(record["Parent Status"]),
      trialOutcome: cleanText(record["Trial Outcome"]),
      basePrice: cleanNumber(record["Base Price"]) ?? undefined,
      courseAdjustment: cleanNumber(record["Course Adjustment"]) ?? undefined,
      adjustedBase: cleanNumber(record["Adjusted Base"]) ?? undefined,
      recommendedPrice: cleanNumber(record["Recommended Price"]) ?? undefined,
      pLeadToEnrol: cleanNumber(record["P Lead To Enrol"] ?? record["P Lead→Enrol"]) ?? undefined,
      pRetention8Lessons: cleanNumber(record["P Retention 8 Lessons"] ?? record["P 8-Lesson Retention"]) ?? undefined,
      expectedHours: cleanNumber(record["Expected Hours"]) ?? undefined,
      expectedRevenue: cleanNumber(record["Expected Revenue"]) ?? undefined,
      expectedGrossProfit: cleanNumber(record["Expected Gross Profit"]) ?? undefined,
      expectedNetContribution: cleanNumber(record["Expected Net Contribution"]) ?? undefined
    };
  });
}

function parseDashboardKpis(workbook: XLSX.WorkBook) {
  const rows = sheetRows(workbook, "Dashboard");
  const kpis: WorkbookData["dashboardKpis"] = [];
  for (const row of rows.slice(0, 30)) {
    const label = cleanText(row[0]);
    if (!label || label === "KPI" || label.startsWith("Dashboard")) continue;
    kpis.push({ label, value: cleanText(row[1]).startsWith("#") ? null : row[1] as string | number | null, note: cleanText(row[2]) });
  }
  return kpis;
}

function parseScenarioDefaults(workbook: XLSX.WorkBook): Partial<WorkbookData["scenarioDefaults"]> {
  const rows = sheetRows(workbook, "Scenario_Simulator");
  const defaults: Record<string, string | number> = {};
  for (const row of rows.slice(0, 25)) {
    const label = cleanText(row[0]);
    if (label) defaults[label] = row[1] as string | number;
  }
  return {
    programme: cleanText(defaults["Programme"]) || "IBDP",
    subjectType: cleanText(defaults["Subject Type"]) || "IBDP HL",
    format: cleanText(defaults["Format"]) || "1:1",
    teacherTier: cleanText(defaults["Teacher Tier"]) || "Senior",
    timeSlot: cleanText(defaults["Time Slot"]) || "Weekend 14:00-16:00",
    source: cleanText(defaults["Source"]) || "Referral",
    priceSensitivity: cleanText(defaults["Price Sensitivity"]) || "Medium",
    urgency: cleanText(defaults["Urgency"]) || "High",
    parentStatus: ["Good", "Normal", "KAM", "Red flag"].includes(cleanText(defaults["Parent Status"])) ? cleanText(defaults["Parent Status"]) : "Normal",
    trialOutcome: cleanText(defaults["Trial Outcome"]) || "Not yet",
    currentStudents: cleanNumber(defaults["Current Students"]) ?? 6,
    maxCapacity: cleanNumber(defaults["Max Capacity"]) ?? 8,
    course: "IBDP"
  };
}

function defaultSources(): SourceProbability[] {
  return [
    { source: "Meta Ads", parentReply: 0.45, trialBook: 0.5, trialAttend: 0.78, enrolAfterTrial: 0.68, retention: 0.72 },
    { source: "Instagram", parentReply: 0.5, trialBook: 0.52, trialAttend: 0.78, enrolAfterTrial: 0.7, retention: 0.74 },
    { source: "Referral", parentReply: 0.72, trialBook: 0.65, trialAttend: 0.86, enrolAfterTrial: 0.82, retention: 0.82 },
    { source: "Google Search", parentReply: 0.52, trialBook: 0.54, trialAttend: 0.8, enrolAfterTrial: 0.74, retention: 0.76 },
    { source: "Snapask", parentReply: 0.38, trialBook: 0.42, trialAttend: 0.7, enrolAfterTrial: 0.58, retention: 0.65 },
    { source: "School Recommendation", parentReply: 0.7, trialBook: 0.62, trialAttend: 0.84, enrolAfterTrial: 0.8, retention: 0.82 },
    { source: "Existing Parent Referral", parentReply: 0.78, trialBook: 0.7, trialAttend: 0.88, enrolAfterTrial: 0.84, retention: 0.84 },
    { source: "WhatsApp Organic", parentReply: 0.58, trialBook: 0.56, trialAttend: 0.8, enrolAfterTrial: 0.76, retention: 0.78 }
  ];
}

export function loadWorkbook(): WorkbookData {
  const workbook = XLSX.readFile(WORKBOOK_PATH, { cellFormula: false, cellDates: true });
  const sheetNames = new Set(workbook.SheetNames);
  const missingSheets = EXPECTED_SHEETS.filter((sheet) => !sheetNames.has(sheet) && !(sheet === "Scenario_v2" && sheetNames.has("Scenario_Simulator")));
  const assumptionRows = sheetRows(workbook, "Assumptions");
  const priceGrid = parsePriceGrid(assumptionRows);
  const campaigns = parseCampaigns(workbook);
  const leads = parseLeads(workbook);
  const factors = parseFactors(assumptionRows);
  const allRows = workbook.SheetNames.flatMap((sheet) => sheetRows(workbook, sheet));
  const formulaErrors = allRows.flat().filter((cell) => cleanText(cell).startsWith("#")).length;

  return {
    campaigns: campaigns.rows,
    leads: leads.rows,
    courseAdjustments: parseCourseAdjustments(workbook),
    priceGrid: priceGrid.rows,
    ...factors,
    sourceProbabilities: defaultSources(),
    dashboardKpis: parseDashboardKpis(workbook),
    scenarioDefaults: parseScenarioDefaults(workbook),
    dataQuality: {
      missingSheets,
      missingValues: allRows.flat().filter((cell) => cell === null || cell === "").length,
      rowsIgnored: priceGrid.ignored + campaigns.ignored + leads.ignored,
      campaignsWithZeroStudents: campaigns.rows.filter((campaign) => campaign.studentsRecruited === 0).length,
      leadsMissingSource: leads.rows.filter((lead) => !lead.source).length,
      leadsMissingRecommendedPrice: leads.rows.filter((lead) => !lead.recommendedPrice).length,
      formulaErrors,
      notes: [
        missingSheets.includes("Campaign_CAC") ? "Campaign CAC sheet is not present in this workbook, so campaign charts render as empty states." : "",
        missingSheets.includes("Lead_Input_v2") ? "Lead-level sheet is not present in this workbook, so lead funnel counts use available dashboard KPIs only." : ""
      ].filter(Boolean)
    }
  };
}
