"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatting";
import { Campaign } from "@/lib/types";

const columns = [
  ["season", "Season"],
  ["adBudget", "Ad Budget"],
  ["enquiries", "Enquiries"],
  ["studentsRecruited", "Students"],
  ["costPerEnquiry", "Cost / Enquiry"],
  ["adOnlyCPA", "Ad-only CPA"],
  ["leadToRecruitmentRate", "Lead → Recruit"],
  ["grossTrialCostPerEnrolment", "Gross Trial / Enrol"],
  ["netTrialCostPerEnrolment", "Net Trial / Enrol"],
  ["fullyLoadedCAC", "Fully Loaded CAC"]
] as const;

export function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  const [sortKey, setSortKey] = useState<keyof Campaign>("fullyLoadedCAC");
  const sorted = useMemo(
    () =>
      [...campaigns].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av ?? "").localeCompare(String(bv ?? ""));
      }),
    [campaigns, sortKey]
  );

  if (!campaigns.length) return <div className="panel p-6 text-sm text-slate-500">No `Campaign_CAC` sheet was found in the workbook.</div>;

  return (
    <div className="panel table-wrap">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {columns.map(([key, label]) => (
              <th key={key} className="px-4 py-3">
                <button className="font-semibold" onClick={() => setSortKey(key)}>
                  {label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((campaign) => (
            <tr key={campaign.season}>
              <td className="px-4 py-3 font-medium text-slate-900">{campaign.season}</td>
              <td className="px-4 py-3">{formatCurrency(campaign.adBudget)}</td>
              <td className="px-4 py-3">{formatNumber(campaign.enquiries)}</td>
              <td className="px-4 py-3">{formatNumber(campaign.studentsRecruited)}</td>
              <td className="px-4 py-3">{formatCurrency(campaign.costPerEnquiry)}</td>
              <td className="px-4 py-3">{formatCurrency(campaign.adOnlyCPA)}</td>
              <td className="px-4 py-3">{formatPercent(campaign.leadToRecruitmentRate)}</td>
              <td className="px-4 py-3">{formatCurrency(campaign.grossTrialCostPerEnrolment)}</td>
              <td className="px-4 py-3">{formatCurrency(campaign.netTrialCostPerEnrolment)}</td>
              <td className="px-4 py-3 font-semibold">{formatCurrency(campaign.fullyLoadedCAC)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
