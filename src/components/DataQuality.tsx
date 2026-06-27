import { WorkbookData } from "@/lib/types";

export function DataQuality({ data }: { data: WorkbookData }) {
  const quality = data.dataQuality;
  const items = [
    ["Missing values", quality.missingValues],
    ["Rows ignored", quality.rowsIgnored],
    ["Zero-student campaigns", quality.campaignsWithZeroStudents],
    ["Leads missing source", quality.leadsMissingSource],
    ["Leads missing price", quality.leadsMissingRecommendedPrice],
    ["Formula error cells", quality.formulaErrors]
  ];

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Data Quality</h2>
          <p className="mt-1 text-sm text-slate-500">Workbook resilience checks from the latest parse.</p>
        </div>
        <p className="text-sm text-slate-500">Missing sheets: {quality.missingSheets.length ? quality.missingSheets.join(", ") : "None"}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      {quality.notes.length ? (
        <div className="mt-4 space-y-1 text-sm text-amber-700">
          {quality.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
