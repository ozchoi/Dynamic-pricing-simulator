import { CapacityUpsideSimulator } from "@/components/CapacityUpsideSimulator";
import { loadWorkbook } from "@/lib/loadWorkbook";

export default function CapacityUpsidePage() {
  const data = loadWorkbook();
  return (
    <main className="page-shell space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Capacity Upside Simulator</h1>
        <p className="mt-2 text-slate-600">Compare a price drop against the extra contribution from filling unused class seats.</p>
      </div>
      <CapacityUpsideSimulator data={data} />
    </main>
  );
}
