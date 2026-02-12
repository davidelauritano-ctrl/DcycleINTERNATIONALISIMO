"use client";

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { monthKeyToLabel } from "@/lib/utils";

interface LineChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  lines: Array<{ key: string; color: string; name: string }>;
  height?: number;
  formatXLabel?: (value: string) => string;
}

export function LineChartComponent({
  data,
  xKey,
  lines,
  height = 300,
  formatXLabel,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart
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
        <Legend
          wrapperStyle={{ fontSize: 12 }}
        />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            stroke={line.color}
            name={line.name}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
