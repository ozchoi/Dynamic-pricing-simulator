import { formatCurrency } from "@/lib/formatting";

export function CurrencyValue({ value, compact = false }: { value: number | null | undefined; compact?: boolean }) {
  return <span>{formatCurrency(value, { compact })}</span>;
}
