"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { LineChartComponent } from "@/components/charts/line-chart";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { ForecastConfig } from "@/types";
import { MONTH_NAMES } from "@/types";
import { Save } from "lucide-react";

const DEFAULT_CHANNELS = ["LinkedIn", "Google", "Organic"];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface ForecastInput {
  total_annual_budget: number;
  cpmql_historical: number;
  mql_to_sql_pct: number;
  avg_pipe_per_sql: number;
  win_rate: number;
  organic_sql_expected: number;
  monthly_pcts: number[]; // 12 values
}

export default function ForecastPage() {
  const [, setConfigs] = useState<ForecastConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [year, setYear] = useState(2026);
  const [selectedChannel, setSelectedChannel] = useState("LinkedIn");

  const [inputs, setInputs] = useState<Record<string, ForecastInput>>({
    LinkedIn: {
      total_annual_budget: 47970,
      cpmql_historical: 0,
      mql_to_sql_pct: 0.25,
      avg_pipe_per_sql: 25000,
      win_rate: 0.20,
      organic_sql_expected: 2,
      monthly_pcts: [5, 7, 9, 9, 10, 10, 10, 10, 9, 8, 7, 6],
    },
    Google: {
      total_annual_budget: 15000,
      cpmql_historical: 0,
      mql_to_sql_pct: 0.20,
      avg_pipe_per_sql: 20000,
      win_rate: 0.15,
      organic_sql_expected: 0,
      monthly_pcts: [5, 7, 9, 9, 10, 10, 10, 10, 9, 8, 7, 6],
    },
    Organic: {
      total_annual_budget: 0,
      cpmql_historical: 0,
      mql_to_sql_pct: 0.30,
      avg_pipe_per_sql: 30000,
      win_rate: 0.25,
      organic_sql_expected: 3,
      monthly_pcts: [8, 8, 8, 8, 9, 9, 9, 9, 8, 8, 8, 8],
    },
  });

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from("forecast_config")
        .select("*")
        .eq("year", year);
      if (data && data.length > 0) {
        setConfigs(data as ForecastConfig[]);
        // Rebuild inputs from configs
        const newInputs: Record<string, ForecastInput> = { ...inputs };
        for (const ch of DEFAULT_CHANNELS) {
          const chConfigs = (data as ForecastConfig[]).filter((c) => c.channel === ch);
          if (chConfigs.length > 0) {
            const first = chConfigs[0];
            newInputs[ch] = {
              total_annual_budget: first.total_annual_budget,
              cpmql_historical: first.cpmql_historical,
              mql_to_sql_pct: first.mql_to_sql_pct,
              avg_pipe_per_sql: first.avg_pipe_per_sql,
              win_rate: first.win_rate,
              organic_sql_expected: first.organic_sql_expected,
              monthly_pcts: MONTHS.map((m) => {
                const mc = chConfigs.find((c) => c.month === m);
                return mc ? mc.budget_pct * 100 : 8;
              }),
            };
          }
        }
        setInputs(newInputs);
      }
      setLoading(false);
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const currentInput = inputs[selectedChannel];

  const forecastRows = useMemo(() => {
    const inp = currentInput;
    if (!inp) return [];

    return MONTHS.map((m) => {
      const pct = (inp.monthly_pcts[m - 1] || 0) / 100;
      const budget = inp.total_annual_budget * pct;

      let expectedMQLs: number;
      let expectedSQLs: number;
      let pipelineForecast: number;

      if (selectedChannel === "Organic") {
        expectedMQLs = 0;
        expectedSQLs = inp.organic_sql_expected;
        pipelineForecast = expectedSQLs * inp.avg_pipe_per_sql;
      } else {
        expectedMQLs = inp.cpmql_historical > 0 ? budget / inp.cpmql_historical : 0;
        expectedSQLs = expectedMQLs * inp.mql_to_sql_pct;
        pipelineForecast = expectedSQLs * inp.avg_pipe_per_sql;
      }

      return {
        month: m,
        month_name: MONTH_NAMES[m - 1],
        budget,
        budget_pct: pct,
        expected_mqls: Math.round(expectedMQLs * 10) / 10,
        expected_sqls: Math.round(expectedSQLs * 10) / 10,
        pipeline_forecast: Math.round(pipelineForecast),
      };
    });
  }, [currentInput, selectedChannel]);

  const cumulativeData = useMemo(() => {
    let cum = 0;
    return forecastRows.map((r) => {
      cum += r.pipeline_forecast;
      return {
        month_key: r.month_name.slice(0, 3),
        Pipeline: cum,
        Monthly: r.pipeline_forecast,
      };
    });
  }, [forecastRows]);

  const totalForecast = forecastRows.reduce((s, r) => s + r.pipeline_forecast, 0);
  const totalBudget = forecastRows.reduce((s, r) => s + r.budget, 0);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const records = DEFAULT_CHANNELS.flatMap((ch) => {
      const inp = inputs[ch];
      return MONTHS.map((m) => ({
        year,
        channel: ch,
        month: m,
        budget_pct: (inp.monthly_pcts[m - 1] || 0) / 100,
        budget_amount: inp.total_annual_budget * ((inp.monthly_pcts[m - 1] || 0) / 100),
        total_annual_budget: inp.total_annual_budget,
        cpmql_historical: inp.cpmql_historical,
        mql_to_sql_pct: inp.mql_to_sql_pct,
        avg_pipe_per_sql: inp.avg_pipe_per_sql,
        win_rate: inp.win_rate,
        organic_sql_expected: inp.organic_sql_expected,
      }));
    });

    const { error } = await supabase
      .from("forecast_config")
      .upsert(records, { onConflict: "year,channel,month" });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Forecast saved");
    }
    setSaving(false);
  };

  const updateInput = (field: keyof ForecastInput, value: number) => {
    setInputs((prev) => ({
      ...prev,
      [selectedChannel]: { ...prev[selectedChannel], [field]: value },
    }));
  };

  const updateMonthPct = (monthIdx: number, value: number) => {
    setInputs((prev) => {
      const newPcts = [...prev[selectedChannel].monthly_pcts];
      newPcts[monthIdx] = value;
      return {
        ...prev,
        [selectedChannel]: { ...prev[selectedChannel], monthly_pcts: newPcts },
      };
    });
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sales Forecast</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Pipeline forecast for International Expansion
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Forecast"}
          </button>
        </div>

        {/* Channel tabs + year */}
        <div className="flex items-center gap-4">
          <div className="flex gap-1 p-1 rounded-lg bg-muted/30">
            {DEFAULT_CHANNELS.map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedChannel === ch
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-2 rounded-lg bg-card border border-border text-sm"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>

        {message && (
          <p className={`text-sm px-3 py-2 rounded-lg ${message.startsWith("Error") ? "text-red-400 bg-red-400/10" : "text-primary bg-primary/10"}`}>
            {message}
          </p>
        )}

        {/* Input params */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">Forecast Parameters - {selectedChannel}</h3>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Annual Budget (EUR)</label>
              <input
                type="number"
                value={currentInput.total_annual_budget}
                onChange={(e) => updateInput("total_annual_budget", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">CPMQL Historical (EUR)</label>
              <input
                type="number"
                step="0.01"
                value={currentInput.cpmql_historical}
                onChange={(e) => updateInput("cpmql_historical", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">MQL to SQL %</label>
              <input
                type="number"
                step="0.01"
                value={(currentInput.mql_to_sql_pct * 100).toFixed(1)}
                onChange={(e) => updateInput("mql_to_sql_pct", (parseFloat(e.target.value) || 0) / 100)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Avg Pipeline/SQL (EUR)</label>
              <input
                type="number"
                value={currentInput.avg_pipe_per_sql}
                onChange={(e) => updateInput("avg_pipe_per_sql", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Win Rate %</label>
              <input
                type="number"
                step="0.01"
                value={(currentInput.win_rate * 100).toFixed(1)}
                onChange={(e) => updateInput("win_rate", (parseFloat(e.target.value) || 0) / 100)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Organic SQLs/Month</label>
              <input
                type="number"
                step="0.1"
                value={currentInput.organic_sql_expected}
                onChange={(e) => updateInput("organic_sql_expected", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
            </div>
          </div>
        </div>

        {/* Monthly budget distribution */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">
            Monthly Budget Distribution (Total: {currentInput.monthly_pcts.reduce((a, b) => a + b, 0).toFixed(0)}%)
          </h3>
          <div className="grid gap-3 grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
            {MONTHS.map((m, i) => (
              <div key={m}>
                <label className="block text-xs text-muted-foreground mb-1">{MONTH_NAMES[i].slice(0, 3)}</label>
                <input
                  type="number"
                  step="0.1"
                  value={currentInput.monthly_pcts[i]}
                  onChange={(e) => updateMonthPct(i, parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 rounded bg-background border border-border text-sm text-center"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Forecast output table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              Forecast Output - {selectedChannel} {year}
            </h3>
            <span className="text-sm text-muted-foreground">
              Total: {formatCurrency(totalBudget)} budget | {formatCurrency(totalForecast)} pipeline
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Month</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">Budget %</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">Budget</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">Exp. MQLs</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">Exp. SQLs</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">Pipeline Forecast</th>
                </tr>
              </thead>
              <tbody>
                {forecastRows.map((r) => (
                  <tr key={r.month} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 px-4 font-medium">{r.month_name}</td>
                    <td className="py-2 px-4 text-right text-muted-foreground">{formatPercent(r.budget_pct, 1)}</td>
                    <td className="py-2 px-4 text-right">{formatCurrency(r.budget)}</td>
                    <td className="py-2 px-4 text-right">{r.expected_mqls}</td>
                    <td className="py-2 px-4 text-right">{r.expected_sqls}</td>
                    <td className="py-2 px-4 text-right text-emerald-400">{formatCurrency(r.pipeline_forecast)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-semibold">
                  <td className="py-2.5 px-4">TOTAL</td>
                  <td className="py-2.5 px-4 text-right">
                    {formatPercent(forecastRows.reduce((s, r) => s + r.budget_pct, 0), 0)}
                  </td>
                  <td className="py-2.5 px-4 text-right">{formatCurrency(totalBudget)}</td>
                  <td className="py-2.5 px-4 text-right">
                    {forecastRows.reduce((s, r) => s + r.expected_mqls, 0).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {forecastRows.reduce((s, r) => s + r.expected_sqls, 0).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-emerald-400">{formatCurrency(totalForecast)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Cumulative chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">Cumulative Pipeline Forecast</h3>
          <LineChartComponent
            data={cumulativeData}
            xKey="month_key"
            lines={[
              { key: "Pipeline", color: "#00C853", name: "Cumulative Pipeline" },
              { key: "Monthly", color: "#3b82f6", name: "Monthly Pipeline" },
            ]}
            height={300}
            formatXLabel={(v) => v}
          />
        </div>
      </div>
    </AppShell>
  );
}
