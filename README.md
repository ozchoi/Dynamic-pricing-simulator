# Bliss Dynamic Pricing Dashboard

This dashboard converts Bliss Education HK's Excel-based dynamic pricing and CAC model into an interactive management dashboard. The model is designed for early-stage dynamic pricing where internal data is still limited, so it combines:

- Public pricing grid
- Course adjustment
- Campaign CAC
- Lead funnel probabilities
- Trial conversion assumptions
- Retention assumptions
- Expected revenue and contribution logic

The model should not expose constantly changing prices to parents. Instead, it supports internal decision-making on which price tier, package, teacher tier, and trial/retention offer to recommend.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Excel Source

Place the workbook at:

```txt
src/data/Bliss_Dynamic_Pricing_Model_MVP_v3_PowerBI_ready.xlsx
```

To refresh the data, replace that file and restart the dev server. The parsing layer is in `src/lib/loadWorkbook.ts`.

The current uploaded workbook contains `Assumptions`, `Dashboard`, and `Scenario_Simulator`. The app also looks for `Campaign_CAC`, `Lead_Input_v2`, `Scenario_v2`, `Course_Adjustments`, `Sources`, and `README_Update` when fuller workbook versions are available.

## Key Formulas

Campaign metrics:

```txt
costPerEnquiry = adBudget / enquiries
adOnlyCPA = adBudget / studentsRecruited
leadToRecruitmentRate = studentsRecruited / enquiries
grossTrialCostPerEnrolment = (tutorCost + adminCost) / trialSuccessRate
netTrialCostPerEnrolment = (tutorCost + adminCost - trialFeeOffset) / trialSuccessRate
fullyLoadedCAC = adOnlyCPA + fixedConversionCostPerEnrolment + netTrialCostPerEnrolment
```

Pricing:

```txt
adjustedBase = basePrice + courseAdjustment
recommendedPrice = adjustedBase * teacherFactor * timeFactor * capacityFactor * subjectFactor * courseDemandFactor * leadScoreAdjustment
expectedRevenue = recommendedPrice * expectedHours * pLeadToEnrol * pRetention8Lessons
expectedGrossProfit = expectedRevenue * grossMarginAssumption
expectedNetContribution = expectedGrossProfit - expectedMarketingTrialCost
```

All denominator-based calculations return `null` when the denominator is zero or missing, and the UI displays those values as `--`.

## TKHC Adjustment

If a course-adjustment sheet provides a TKHC row, the workbook value is used. If it is missing, TKHC defaults to `-HK$100/hr`.

## Pages

- Executive Summary: management KPIs, campaign charts, funnel view, and data-quality diagnostics.
- Campaign CAC: sortable campaign table, CAC charts, conversion scatter, and insight cards.
- Lead Funnel: lead-stage counts, source mix, conversion by source, retention by source, and lead table.
- Pricing Simulator: interactive quote calculator using workbook assumptions and fallback probabilities.
- Course Analysis: recommended price and contribution by programme, plus course adjustments.

## Business Logic

- Keep public price tiers stable.
- Use dynamic scoring internally.
- Do not discount hourly rates randomly.
- Prefer paid trial, starter packages, non-peak packages, or multi-lesson commitment offers.
- TKHC has a -HK$100/hr course adjustment.
- Campaign performance should be judged by fully loaded CAC and retained-student value, not only cost per enquiry.
