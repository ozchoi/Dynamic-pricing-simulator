import { SimpleBarChart } from "@/components/Charts";
import { InsightCard } from "@/components/InsightCard";
import { calculatePricing } from "@/lib/calculations";
import { formatCurrency } from "@/lib/formatting";
import { loadWorkbook } from "@/lib/loadWorkbook";
import { PricingInputs } from "@/lib/types";

export default function CoursesPage() {
  const data = loadWorkbook();
  const rows = data.priceGrid.map((row) => {
    const result = calculatePricing(
      {
        ...(data.scenarioDefaults as PricingInputs),
        course: row.programme,
        programme: row.programme,
        format: row.format
      },
      data
    );
    return {
      course: row.programme,
      programme: row.programme,
      format: row.format,
      recommendedPrice: result.displayPrice ?? 0,
      expectedRevenue: result.expectedRevenue ?? 0,
      expectedNetContribution: result.expectedNetContribution ?? 0
    };
  });
  const programmeRows = Array.from(new Set(rows.map((row) => row.programme))).map((programme) => {
    const subset = rows.filter((row) => row.programme === programme);
    return {
      programme,
      avgRecommendedPrice: subset.reduce((sum, row) => sum + row.recommendedPrice, 0) / subset.length,
      expectedRevenue: subset.reduce((sum, row) => sum + row.expectedRevenue, 0),
      expectedNetContribution: subset.reduce((sum, row) => sum + row.expectedNetContribution, 0)
    };
  });

  return (
    <main className="page-shell space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Course / Pricing Analysis</h1>
        <p className="mt-2 text-slate-600">Programme pricing, expected revenue, contribution, and course-level adjustment logic.</p>
      </div>
      <InsightCard
        title="TKHC Adjustment"
        value="HK$100/hr cheaper"
        body="TKHC is HK$100/hr cheaper than comparable courses. The dashboard should evaluate whether higher conversion compensates for the lower hourly price."
        tone="amber"
      />
      <section className="grid gap-6 lg:grid-cols-3">
        <SimpleBarChart data={programmeRows} xKey="programme" yKey="avgRecommendedPrice" name="Average Recommended Price" />
        <SimpleBarChart data={programmeRows} xKey="programme" yKey="expectedRevenue" name="Expected Revenue" />
        <SimpleBarChart data={programmeRows} xKey="programme" yKey="expectedNetContribution" name="Expected Net Contribution" />
      </section>
      <section className="panel table-wrap">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Adjustment</th>
            </tr>
          </thead>
          <tbody>
            {data.courseAdjustments.map((adjustment) => (
              <tr key={adjustment.course} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium">{adjustment.course}</td>
                <td className="px-4 py-3">{formatCurrency(adjustment.adjustment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
