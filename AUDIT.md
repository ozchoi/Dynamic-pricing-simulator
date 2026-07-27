# Dynamic Pricing Simulator Audit

## Calculation Inventory

| Displayed label / output | Variable | Source | Formula and units | Rounding / guardrail / fallback | UI locations |
| --- | --- | --- | --- | --- | --- |
| Base price / student / hr | `basePrice` | `Assumptions` price grid, via `loadWorkbook()` | HK$/student-hour anchor for selected syllabus/format; HKDSE uses selected F-level `format = 1` row | Missing row now returns `null` and warning; no unrelated row fallback | Pricing Simulator price build; quote record; Capacity Upside default current price |
| Syllabus adjustment | `courseAdjustment` | `Course_Adjustments` sheet if present; fallback TKHC `-100`, otherwise `0` | HK$/hr added to base | Exact; TKHC UI reachability unresolved | Pricing Simulator price build |
| Adjusted base | `adjustedBase` | calculation | `basePrice + courseAdjustment`, HK$/hr | `null` when base missing | Pricing Simulator price build and headline delta |
| Guardrail Min / Max | `minPrice`, `maxPrice` | price grid `Min Price` / `Max Price` | lower and upper HK$/hr constraints | min uses workbook row if present, else `base * 0.85 + adjustment`; max uses row if present, else `base * 1.25 + adjustment` | Headline guardrail cards |
| Teacher factor | `teacherFactor` | workbook teacher factor table | multiplier | missing label falls back to `1` | Price build; quote record |
| Time slot factor | `timeFactor` | workbook time table | multiplier | invalid workbook default is normalized to a real dropdown option | Price build; quote record |
| Capacity utilisation | `capacityUtilisation` | UI current/max capacity | non-HKDSE: `currentStudents / maxCapacity`; HKDSE: `currentStudents / 6` | zero or missing denominator returns `null` | Price build detail; quote record |
| Capacity factor | `capacityFactor` | workbook capacity table or fallback curve | utilisation-band multiplier | workbook all-`1.00x` table falls back to app curve; HKDSE uses same lookup over `/6` utilisation | Price build; quote record |
| Subject factor | `subjectFactor` | workbook subject table plus required IAL fallbacks | multiplier | missing label falls back to `1` | Price build; quote record |
| Demand factor | `courseDemandFactor` | hard-coded TKHC rule | `0.98` if course contains TKHC, else `1` | TKHC not currently selectable by default UI | Price build; quote record |
| Parent session factor | `parentStatusFactor` | hard-coded options | Easy going `0.95`, Normal `1`, Red Flag `1.05` | missing falls back to `1` | Price build; quote record |
| Lead score | `leadScore` | hard-coded scoring tables | price sensitivity + urgency + trial outcome score | exact integer | Headline card; quote record |
| Raw calculated price | `rawPrice` | calculation | adjusted base × all factors × `(1 + leadScore × 0.02)`, or manual price override | no rounding before guardrail | quote record; tests |
| Guarded price | `guardedPrice` | calculation | `max(minPrice, min(maxPrice, rawPrice))` | exact before display rounding | quote record; tests |
| Recommended/display price | `recommendedPrice`, `displayPrice` | calculation | guarded price rounded to HK$10 | nearest HK$10; `null` if no price row | headline, Operating Cost And Profit, Supabase quote |
| Lead To Enrol | `pLeadToEnrol` | hard-coded source fallback table | parent-stage probability; current three parent-session choices use `trialBook × trialAttend × enrolAfterTrial` unless trial outcome is Strong/Weak | missing source uses default probabilities and warning | stat card; quote record |
| 8-Lesson Retention | `pRetention8Lessons` | source fallback + modifiers | source retention + trial/sensitivity/referral modifiers | clamped `0` to `0.9` | stat card; quote record |
| Lesson plan | `expectedLessons`, `hoursPerLesson` | constants | 8 lessons, 2 hours each | exact constants | Operating Cost And Profit |
| Class teaching hours | `classTeachingHours` | constants or override | override, else workbook expected hours, else `8 × 2` | override label now says Teaching Hours Override | Operating Cost And Profit; quote record |
| Billable student-hours | `expectedHours` | calculation | `classTeachingHours × studentCount`, where group uses current students and non-group uses 1 | `studentCount` minimum 1 | Operating Cost And Profit; quote record |
| Expected revenue | `expectedRevenue` | calculation | `recommendedPrice × billable student-hours × pLeadToEnrol × retention` | `null` if price/hours unavailable | stat card; Operating Cost And Profit; quote record |
| Tutor hourly cost | `tutorHourlyCost` | hard-coded tier raw cost | Core 250, Experienced 300, Senior 350; group adds HK$50/hr per extra student | exact | Operating Cost And Profit |
| Expected tutor cost | `expectedTutorCost` | calculation | `tutorHourlyCost × classTeachingHours × pLeadToEnrol × retention` | probability weighted | Operating Cost And Profit; quote record |
| Expected admin cost | `expectedAdminCost` | constants | `120 × students × pLeadToEnrol + 30 × 8 × students × pLeadToEnrol × retention` | probability weighted | Operating Cost And Profit; quote record |
| Fixed marketing cost | `fixedMarketingCost` | override or constant `0` | HK$ fixed cost | exact | Operating Cost And Profit |
| Gross profit / net contribution | `expectedGrossProfit`, `expectedNetContribution` | calculation | expected revenue minus tutor, admin, and fixed marketing cost | same value currently | stat card; headline; Operating Cost And Profit |
| Slider outputs | `sliderResult.*` | `calculatePricing({...inputs, priceOverride: sliderValue})` | same formulas with slider price through guardrails | nearest HK$10; comparison uses absolute and percent delta | headline slider cards and stat cards |
| Campaign CAC | `calculateCampaignMetrics()` | constants + campaign sheet if present | ad budget/enquiries/students plus trial cost constants | denominator `0`/missing returns `null` | currently empty because workbook lacks campaign sheet |
| Adjustment Learning | `analyseAdjustmentSuggestions()` | Supabase quote JSON | shrunk additive residual model over quote factors, target = feedback − 3 | min 4 samples, max factor step 8%, local-only approval | Adjustment Learning panel |
| Capacity Upside outputs | local variables | user inputs + pricing defaults | compares current class revenue to discounted filled-class revenue, subtracting marginal tutor/admin cost | expected new students clamped to seats available; break-even can be `null` | Capacity Upside page |

## Data Mapping Notes

- Workbook sheets present: `Assumptions`, `Dashboard`, `Scenario_Simulator`.
- Workbook sheets absent: `Campaign_CAC`, `Lead_Input_v2`, `Course_Adjustments`, `Sources`, `README_Update`; `Scenario_v2` is treated as satisfied by `Scenario_Simulator`.
- `Sources` is absent, so source probabilities are hard-coded fallback data.
- `Course_Adjustments` is absent, so TKHC uses fallback `-HK$100/hr`, but TKHC is not currently reachable from the two-page UI.
- The workbook capacity table has numeric utilisation rows with `1.00x` factors. A text row `Zoom / Underfilled (<40%) / 0.80x` exists but has no numeric threshold, so it is not parseable as a band.
- `README.md` still describes old gross-margin logic; the implementation now subtracts tutor, admin, and fixed marketing costs.

## Unresolved Business-Rule Ambiguities

1. Capacity factor source of truth: decide whether to use the app fallback curve, the workbook's all-`1.00x` rows, or a corrected workbook row for the `Zoom / 0.80x` assumption.
2. HKDSE capacity pricing: decide whether HKDSE should use the generic utilisation factor, the historical F.1-F.6 group price ladder, or a new marginal-revenue factor curve.
3. Guardrail adjustment: decide whether TKHC/course adjustments should shift workbook min/max guardrails when min/max cells are present.
4. Manual price override: decide whether a manual override should bypass guardrails or continue to be guarded.
5. Subject dropdown compatibility: decide whether subject options should be filtered by syllabus or remain global.
6. Adjustment Learning: approved suggestions are stored only in browser localStorage and do not update production factors; decide whether approved adjustments should write to a governed table or config file.
