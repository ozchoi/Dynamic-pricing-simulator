import clsx from "clsx";

export function InsightCard({
  title,
  value,
  body,
  tone = "blue"
}: {
  title: string;
  value: string;
  body?: string;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className={clsx("panel p-5", tone === "green" && "bg-green-50", tone === "amber" && "bg-amber-50", tone === "red" && "bg-red-50")}>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
      {body ? <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p> : null}
    </div>
  );
}
