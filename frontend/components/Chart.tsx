import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { motion } from "framer-motion";

export interface ChartDataPoint {
  label: string;
  revenue: number;
  sales: number;
}

const MOCK_DATA: ChartDataPoint[] = [
  { label: "Mon", revenue: 4200, sales: 12 },
  { label: "Tue", revenue: 6800, sales: 19 },
  { label: "Wed", revenue: 5100, sales: 14 },
  { label: "Thu", revenue: 9400, sales: 27 },
  { label: "Fri", revenue: 12300, sales: 34 },
  { label: "Sat", revenue: 15800, sales: 44 },
  { label: "Sun", revenue: 11200, sales: 31 },
];

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(15,23,42,0.95)",
        border: "1px solid rgba(148,163,184,0.15)",
        borderRadius: 10,
        padding: "10px 14px",
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ fontSize: 13, fontWeight: 700, color: p.color }}>
          {p.dataKey === "revenue"
            ? `KES ${Number(p.value).toLocaleString("en-KE")}`
            : `${p.value} sales`}
        </div>
      ))}
    </div>
  );
}

interface ChartProps {
  data?: ChartDataPoint[];
  title?: string;
}

export function RevenueChart({ data = MOCK_DATA, title = "Weekly Revenue" }: ChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      style={{
        background: "rgba(30,41,59,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(148,163,184,0.1)",
        borderRadius: 16,
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#f1f5f9",
              marginBottom: 2,
            }}
          >
            {title}
          </h3>
          <p style={{ fontSize: 11, color: "#64748b" }}>Last 7 days · KES</p>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{ width: 8, height: 8, borderRadius: 2, background: "#0ea5e9" }}
            />
            <span style={{ fontSize: 11, color: "#64748b" }}>Revenue</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{ width: 8, height: 8, borderRadius: 2, background: "#8b5cf6" }}
            />
            <span style={{ fontSize: 11, color: "#64748b" }}>Sales</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#gradRevenue)"
            dot={false}
            activeDot={{ r: 5, fill: "#0ea5e9", strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#gradSales)"
            dot={false}
            activeDot={{ r: 5, fill: "#8b5cf6", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
