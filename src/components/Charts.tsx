"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart as RechartsFunnelChart,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const colors = ["#2f6fed", "#16805b", "#b7791f", "#c24141", "#7757c2", "#0f766e", "#64748b"];

export function EmptyChart({ message }: { message: string }) {
  return <div className="panel flex h-80 items-center justify-center p-6 text-sm text-slate-500">{message}</div>;
}

export function SimpleBarChart({ data, xKey, yKey, name }: { data: Record<string, unknown>[]; xKey: string; yKey: string; name: string }) {
  if (!data.length) return <EmptyChart message="No rows available for this chart." />;
  return (
    <div className="panel h-80 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey={yKey} name={name} fill="#2f6fed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DualBarChart({ data, xKey, leftKey, rightKey }: { data: Record<string, unknown>[]; xKey: string; leftKey: string; rightKey: string }) {
  if (!data.length) return <EmptyChart message="No campaign rows available for this chart." />;
  return (
    <div className="panel h-80 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey={leftKey} fill="#2f6fed" radius={[4, 4, 0, 0]} />
          <Bar dataKey={rightKey} fill="#16805b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CampaignScatter({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return <EmptyChart message="No campaign rows available for this chart." />;
  return (
    <div className="panel h-80 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="costPerEnquiry" name="Cost per enquiry" tick={{ fontSize: 12 }} />
          <YAxis dataKey="leadToRecruitmentRate" name="Conversion" tick={{ fontSize: 12 }} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill="#2f6fed" name="Campaigns" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FunnelChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.some((item) => item.value > 0)) return <EmptyChart message="No lead funnel rows available in the workbook." />;
  return (
    <div className="panel h-80 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsFunnelChart>
          <Tooltip />
          <Funnel dataKey="value" data={data} isAnimationActive>
            <LabelList position="right" fill="#10233f" stroke="none" dataKey="name" />
            {data.map((_, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Funnel>
        </RechartsFunnelChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PieMixChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.some((item) => item.value > 0)) return <EmptyChart message="No source rows available in the workbook." />;
  return (
    <div className="panel h-80 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={110} label>
            {data.map((_, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
