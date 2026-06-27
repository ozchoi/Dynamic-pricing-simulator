import clsx from "clsx";

export function MetricCard({
  label,
  value,
  note,
  tone = "blue"
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className={clsx("panel p-5", tone === "green" && "border-green-200", tone === "amber" && "border-amber-200", tone === "red" && "border-red-200")}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {note ? <p className="mt-2 text-sm text-slate-500">{note}</p> : null}
    </div>
  );
}
