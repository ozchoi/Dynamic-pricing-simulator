import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dynamic pricing model v1.1",
  description: "Internal pricing simulator and capacity upside model"
};

const nav = [
  ["Pricing Simulator", "/pricing-simulator"],
  ["Capacity Upside", "/capacity-upside"]
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-4">
            <Link href="/pricing-simulator" className="text-lg font-semibold text-slate-950">
              Dynamic pricing model v1.1
            </Link>
            <nav className="flex flex-wrap gap-2 text-sm text-slate-600">
              {nav.map(([label, href]) => (
                <Link key={href} href={href} className="rounded-md px-3 py-2 hover:bg-slate-100 hover:text-slate-950">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
