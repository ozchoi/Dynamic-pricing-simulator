import { formatPercent } from "@/lib/formatting";

export function PercentValue({ value }: { value: number | null | undefined }) {
  return <span>{formatPercent(value)}</span>;
}
