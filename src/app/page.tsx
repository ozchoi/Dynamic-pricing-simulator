import { PricingSimulator } from "@/components/PricingSimulator";
import { loadWorkbook } from "@/lib/loadWorkbook";

export default function Home() {
  const data = loadWorkbook();
  return (
    <main className="page-shell space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Pricing Simulator</h1>
        <p className="mt-2 text-slate-600">Interactive quote calculator based on the workbook scenario logic.</p>
      </div>
      <PricingSimulator data={data} />
    </main>
  );
}
