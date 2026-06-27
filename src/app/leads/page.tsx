import { FunnelChart, PieMixChart, SimpleBarChart } from "@/components/Charts";
import { MetricCard } from "@/components/MetricCard";
import { formatNumber, formatPercent } from "@/lib/formatting";
import { loadWorkbook } from "@/lib/loadWorkbook";

export default function LeadsPage() {
  const data = loadWorkbook();
  const leads = data.leads;
  const countBy = (predicate: (status: string, lead: (typeof leads)[number]) => boolean) => leads.filter((lead) => predicate(lead.parentStatus ?? "", lead)).length;
  const leadCount = leads.length || Number(data.dashboardKpis.find((kpi) => kpi.label === "Total leads")?.value ?? 0);
  const funnelData = [
    { name: "Lead count", value: leadCount },
    { name: "Parent replies", value: countBy((status) => status !== "No reply" && status !== "Ghost") },
    { name: "Trial booked", value: countBy((status) => ["Trial booked", "Trial attended", "Enrolled"].includes(status)) },
    { name: "Trial attended", value: countBy((status) => ["Trial attended", "Enrolled"].includes(status)) },
    { name: "Enrolled", value: countBy((status) => status === "Enrolled") },
    { name: "Retained 4 lessons", value: leads.filter((lead) => (lead.pRetention8Lessons ?? 0) >= 0.5).length },
    { name: "Retained 8 lessons", value: leads.filter((lead) => (lead.pRetention8Lessons ?? 0) >= 0.75).length }
  ];
  const sources = Array.from(new Set(leads.map((lead) => lead.source || "Missing source")));
  const sourceData = sources.map((source) => ({ name: source, value: leads.filter((lead) => (lead.source || "Missing source") === source).length }));
  const conversionBySource = sources.map((source) => {
    const sourceLeads = leads.filter((lead) => (lead.source || "Missing source") === source);
    const enrolled = sourceLeads.filter((lead) => lead.parentStatus === "Enrolled").length;
    return { source, conversionRate: sourceLeads.length ? enrolled / sourceLeads.length : 0, retentionRate: sourceLeads.reduce((sum, lead) => sum + (lead.pRetention8Lessons ?? 0), 0) / (sourceLeads.length || 1) };
  });

  return (
    <main className="page-shell space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Lead Funnel</h1>
        <p className="mt-2 text-slate-600">Available lead-stage and source performance from `Lead_Input_v2` when present.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {funnelData.slice(0, 4).map((item) => (
          <MetricCard key={item.name} label={item.name} value={formatNumber(item.value || null)} />
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <FunnelChart data={funnelData} />
        <PieMixChart data={sourceData} />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <SimpleBarChart data={conversionBySource} xKey="source" yKey="conversionRate" name="Conversion Rate" />
        <SimpleBarChart data={conversionBySource} xKey="source" yKey="retentionRate" name="Retention Rate" />
      </section>
      <section className="panel table-wrap">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial</th>
              <th className="px-4 py-3">P Enrol</th>
            </tr>
          </thead>
          <tbody>
            {leads.length ? (
              leads.map((lead) => (
                <tr key={lead.leadId} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium">{lead.leadId}</td>
                  <td className="px-4 py-3">{lead.source || "—"}</td>
                  <td className="px-4 py-3">{lead.parentStatus || "—"}</td>
                  <td className="px-4 py-3">{lead.trialOutcome || "—"}</td>
                  <td className="px-4 py-3">{formatPercent(lead.pLeadToEnrol)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  No `Lead_Input_v2` sheet was found in the workbook.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
