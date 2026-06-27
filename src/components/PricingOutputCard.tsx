import clsx from "clsx";

export function PricingOutputCard({
  label,
  value,
  tone = "blue"
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className={clsx("rounded-md border bg-white p-4", tone === "green" && "border-green-200", tone === "amber" && "border-amber-200", tone === "red" && "border-red-200")}>
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
