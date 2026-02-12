"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { monthKeyToLabel } from "@/lib/utils";

interface BarChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  bars: Array<{ key: string; color: string; name: string; stackId?: string }>;
  height?: number;
  formatXLabel?: (value: string) => string;
  layout?: "horizontal" | "vertical";
}

export function BarChartComponent({
  data,
  xKey,
  bars,
  height = 300,
  formatXLabel,
  layout = "horizontal",
}: BarChartProps) {
  if (layout === "vertical") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14.9%)" />
          <XAxis
            type="number"
            tick={{ fill: "hsl(0 0% 63.9%)", fontSize: 11 }}
            stroke="hsl(0 0% 14.9%)"
          />
          <YAxis
            type="category"
            dataKey={xKey}
            tick={{ fill: "hsl(0 0% 63.9%)", fontSize: 11 }}
            stroke="hsl(0 0% 14.9%)"
            width={75}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(0 0% 6%)",
              border: "1px solid hsl(0 0% 14.9%)",
              borderRadius: "8px",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              fill={bar.color}
              name={bar.name}
              stackId={bar.stackId}
              radius={[0, 4, 4, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14.9%)" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: "hsl(0 0% 63.9%)", fontSize: 11 }}
          tickFormatter={formatXLabel || monthKeyToLabel}
          stroke="hsl(0 0% 14.9%)"
        />
        <YAxis
          tick={{ fill: "hsl(0 0% 63.9%)", fontSize: 11 }}
          stroke="hsl(0 0% 14.9%)"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(0 0% 6%)",
            border: "1px solid hsl(0 0% 14.9%)",
            borderRadius: "8px",
            fontSize: 12,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => (formatXLabel || monthKeyToLabel)(String(label))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            fill={bar.color}
            name={bar.name}
            stackId={bar.stackId}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
