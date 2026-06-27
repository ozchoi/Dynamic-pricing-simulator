import { CampaignTable } from "@/components/CampaignTable";
import { CampaignScatter, DualBarChart, SimpleBarChart } from "@/components/Charts";
import { InsightCard } from "@/components/InsightCard";
import { formatCurrency, formatPercent } from "@/lib/formatting";
import { loadWorkbook } from "@/lib/loadWorkbook";

export default function CampaignsPage() {
  const data = loadWorkbook();
  const campaigns = data.campaigns;
  const byConversion = [...campaigns].sort((a, b) => (b.leadToRecruitmentRate ?? -1) - (a.leadToRecruitmentRate ?? -1))[0];
  const byLowestCac = [...campaigns].sort((a, b) => (a.fullyLoadedCAC ?? Infinity) - (b.fullyLoadedCAC ?? Infinity))[0];
  const byWorstCac = [...campaigns].sort((a, b) => (b.fullyLoadedCAC ?? -1) - (a.fullyLoadedCAC ?? -1))[0];
  const tkhc = campaigns.find((campaign) => campaign.season.toUpperCase().includes("TKHC"));
  const chartData = campaigns.map((campaign) => ({
    season: campaign.season,
    costPerEnquiry: campaign.costPerEnquiry ?? 0,
    leadToRecruitmentRate: campaign.leadToRecruitmentRate ?? 0,
    fullyLoadedCAC: campaign.fullyLoadedCAC ?? 0,
    adBudget: campaign.adBudget,
    studentsRecruited: campaign.studentsRecruited
  }));

  return (
    <main className="page-shell space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Campaign CAC</h1>
        <p className="mt-2 text-slate-600">Which campaign brings the cheapest retained student, not just the cheapest enquiry?</p>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard title="Best Conversion" value={byConversion ? `${byConversion.season} · ${formatPercent(byConversion.leadToRecruitmentRate)}` : "—"} tone="green" />
        <InsightCard title="Lowest CAC" value={byLowestCac ? `${byLowestCac.season} · ${formatCurrency(byLowestCac.fullyLoadedCAC)}` : "—"} tone="green" />
        <InsightCard title="Highest Waste" value={byWorstCac ? `${byWorstCac.season} · ${formatCurrency(byWorstCac.fullyLoadedCAC)}` : "—"} tone="red" />
        <InsightCard title="TKHC Highlight" value={tkhc ? `${tkhc.season} · ${formatCurrency(tkhc.fullyLoadedCAC)}` : "No TKHC campaign row"} tone="amber" />
      </section>
      <CampaignTable campaigns={campaigns} />
      <section className="grid gap-6 xl:grid-cols-3">
        <CampaignScatter data={chartData} />
        <SimpleBarChart data={chartData} xKey="season" yKey="fullyLoadedCAC" name="Fully Loaded CAC" />
        <DualBarChart data={chartData} xKey="season" leftKey="adBudget" rightKey="studentsRecruited" />
      </section>
    </main>
  );
}
