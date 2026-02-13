"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChannelPerformanceTable, CountryPerformanceTable } from "@/components/tables/performance-table";
import { LineChartComponent } from "@/components/charts/line-chart";
import { BarChartComponent } from "@/components/charts/bar-chart";
import { useEffect, useState, useMemo } from "react";
import { formatCurrency, formatNumber, safeDivide, sortMonthKeys, monthKeyToLabel, isMql } from "@/lib/utils";
import type { LeadEnriched, LinkedInAdsPerformance, MonthlySpend, ChannelMonthlyMetrics, CountryMonthlyMetrics } from "@/types";
import { Users, Target, Handshake, TrendingUp, DollarSign, BarChart3, PieChart } from "lucide-react";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";

async function fetchEntity<T>(entity: string): Promise<T[]> {
  const res = await fetch(`/api/data?entity=${entity}`);
  if (!res.ok) return [];
  return res.json();
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<LeadEnriched[]>([]);
  const [linkedinPerf, setLinkedinPerf] = useState<LinkedInAdsPerformance[]>([]);
  const [monthlySpend, setMonthlySpend] = useState<MonthlySpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  useEffect(() => {
    async function loadData() {
      const [leadsData, perfData, spendData] = await Promise.all([
        fetchEntity<LeadEnriched>("leads_enriched"),
        fetchEntity<LinkedInAdsPerformance>("linkedin_ads_performance"),
        fetchEntity<MonthlySpend>("monthly_spend"),
      ]);
      setLeads(leadsData);
      setLinkedinPerf(perfData);
      setMonthlySpend(spendData);
      setLoading(false);
    }
    loadData();
  }, []);

  const allMonthKeys = useMemo(() => {
    const keys = new Set<string>();
    leads.forEach((l) => l.month_key && keys.add(l.month_key));
    linkedinPerf.forEach((p) => p.month_key && keys.add(p.month_key));
    return sortMonthKeys(Array.from(keys));
  }, [leads, linkedinPerf]);

  // Compute channel monthly metrics
  const channelMetrics = useMemo(() => {
    const channels = ["Paid Social", "Paid Search"];
    const result: Record<string, ChannelMonthlyMetrics[]> = {};

    for (const channel of channels) {
      const metrics: ChannelMonthlyMetrics[] = [];
      for (const mk of allMonthKeys) {
        const monthLeads = leads.filter((l) => l.channel === channel && l.month_key === mk);
        const leadCount = monthLeads.length;
        const mqlCount = monthLeads.filter((l) => isMql(l.lead_status)).length;
        const sqlLeads = monthLeads.filter((l) => l.deal_amount > 0);
        const sqlCount = sqlLeads.length;
        const pipeline = sqlLeads.reduce((sum, l) => sum + l.deal_amount, 0);

        // Spend: from monthly_spend or linkedin_ads_performance for 2026+
        let spend = 0;
        const spendEntry = monthlySpend.find((s) => s.month_key === mk && s.channel === channel);
        if (spendEntry) {
          spend = spendEntry.amount;
        } else if (channel === "Paid Social") {
          spend = linkedinPerf
            .filter((p) => p.month_key === mk)
            .reduce((sum, p) => sum + p.total_spent, 0);
        }

        metrics.push({
          month_key: mk,
          channel,
          leads: leadCount,
          mqls: mqlCount,
          sqls: sqlCount,
          pipeline,
          spend,
          cpl: safeDivide(spend, leadCount),
          cpmql: safeDivide(spend, mqlCount),
          cpsql: safeDivide(spend, sqlCount),
        });
      }
      result[channel] = metrics;
    }
    return result;
  }, [leads, linkedinPerf, monthlySpend, allMonthKeys]);

  // Compute country monthly metrics
  const countryMetrics = useMemo(() => {
    const monthFilter = selectedMonth === "all" ? allMonthKeys : [selectedMonth];
    const countryMap = new Map<string, CountryMonthlyMetrics>();

    for (const mk of monthFilter) {
      const monthLeads = leads.filter(
        (l) => l.month_key === mk && l.campaign_raw !== "[Demo] New submission"
      );
      const monthPerf = linkedinPerf.filter((p) => p.month_key === mk);

      // Group by country
      const countries = new Set<string>();
      monthLeads.forEach((l) => countries.add(l.country));
      monthPerf.forEach((p) => p.country && countries.add(p.country));

      for (const country of countries) {
        const key = `${mk}_${country}`;
        const countryLeads = monthLeads.filter((l) => l.country === country);
        const countryPerf = monthPerf.filter((p) => p.country === country);

        const spend = countryPerf.reduce((s, p) => s + p.total_spent, 0);
        const impressions = countryPerf.reduce((s, p) => s + p.impressions, 0);
        const clicks = countryPerf.reduce((s, p) => s + p.clicks, 0);
        const leadCount = countryLeads.length;
        const mqlCount = countryLeads.filter((l) => isMql(l.lead_status)).length;
        const sqlLeads = countryLeads.filter((l) => l.deal_amount > 0);
        const sqlCount = sqlLeads.length;
        const pipeline = sqlLeads.reduce((s, l) => s + l.deal_amount, 0);
        const meetingSet = countryLeads.filter(
          (l) => l.first_meeting_set !== "Not Found" && l.first_meeting_set !== "NO"
        ).length;

        const existing = countryMap.get(key);
        if (existing) {
          existing.spend += spend;
          existing.impressions += impressions;
          existing.clicks += clicks;
          existing.leads += leadCount;
          existing.mqls += mqlCount;
          existing.sqls += sqlCount;
          existing.pipeline += pipeline;
          existing.first_meeting_set += meetingSet;
        } else {
          countryMap.set(key, {
            month_key: mk,
            country,
            spend,
            impressions,
            clicks,
            ctr: safeDivide(clicks, impressions),
            leads: leadCount,
            mqls: mqlCount,
            sqls: sqlCount,
            pipeline,
            cpl: safeDivide(spend, leadCount),
            cpmql: safeDivide(spend, mqlCount),
            cpsql: safeDivide(spend, sqlCount),
            cpc: safeDivide(spend, clicks),
            cpm: safeDivide(spend * 1000, impressions),
            first_meeting_set: meetingSet,
          });
        }
      }
    }

    // Recalculate ratios for aggregated entries
    const result = Array.from(countryMap.values()).map((r) => ({
      ...r,
      ctr: safeDivide(r.clicks, r.impressions),
      cpl: safeDivide(r.spend, r.leads),
      cpmql: safeDivide(r.spend, r.mqls),
      cpsql: safeDivide(r.spend, r.sqls),
      cpc: safeDivide(r.spend, r.clicks),
      cpm: safeDivide(r.spend * 1000, r.impressions),
    }));

    return result.sort((a, b) => b.spend - a.spend);
  }, [leads, linkedinPerf, allMonthKeys, selectedMonth]);

  // Total KPIs
  const totals = useMemo(() => {
    const allLeads = leads.filter((l) => l.campaign_raw !== "[Demo] New submission");
    const totalLeads = allLeads.length;
    const totalMQLs = allLeads.filter((l) => isMql(l.lead_status)).length;
    const sqlLeads = allLeads.filter((l) => l.deal_amount > 0);
    const totalSQLs = sqlLeads.length;
    const totalPipeline = sqlLeads.reduce((s, l) => s + l.deal_amount, 0);
    const totalSpend = Object.values(channelMetrics)
      .flat()
      .reduce((s, m) => s + m.spend, 0);

    return {
      leads: totalLeads,
      mqls: totalMQLs,
      sqls: totalSQLs,
      pipeline: totalPipeline,
      spend: totalSpend,
      cpl: safeDivide(totalSpend, totalLeads),
      cpmql: safeDivide(totalSpend, totalMQLs),
    };
  }, [leads, channelMetrics]);

  // Chart data: leads/mqls/sqls by month
  const trendChartData = useMemo(() => {
    return allMonthKeys.map((mk) => {
      const monthLeads = leads.filter((l) => l.month_key === mk);
      return {
        month_key: mk,
        Leads: monthLeads.length,
        MQLs: monthLeads.filter((l) => isMql(l.lead_status)).length,
        SQLs: monthLeads.filter((l) => l.deal_amount > 0).length,
      };
    });
  }, [leads, allMonthKeys]);

  // Chart data: spend vs pipeline by month
  const spendPipelineData = useMemo(() => {
    return allMonthKeys.map((mk) => {
      const spend = Object.values(channelMetrics)
        .flat()
        .filter((m) => m.month_key === mk)
        .reduce((s, m) => s + m.spend, 0);
      const pipeline = leads
        .filter((l) => l.month_key === mk && l.deal_amount > 0)
        .reduce((s, l) => s + l.deal_amount, 0);
      return { month_key: mk, Spend: Math.round(spend), Pipeline: Math.round(pipeline) };
    });
  }, [channelMetrics, leads, allMonthKeys]);

  // Chart data: leads by channel
  const channelBarData = useMemo(() => {
    return allMonthKeys.map((mk) => {
      const paid_social = leads.filter((l) => l.channel === "Paid Social" && l.month_key === mk).length;
      const paid_search = leads.filter((l) => l.channel === "Paid Search" && l.month_key === mk).length;
      const organic = leads.filter((l) => l.channel === "Organic Search" && l.month_key === mk).length;
      const other = leads.filter(
        (l) =>
          l.month_key === mk &&
          l.channel !== "Paid Social" &&
          l.channel !== "Paid Search" &&
          l.channel !== "Organic Search"
      ).length;
      return { month_key: mk, "Paid Social": paid_social, "Paid Search": paid_search, Organic: organic, Other: other };
    });
  }, [leads, allMonthKeys]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
          <div className="h-80 rounded-xl bg-card border border-border animate-pulse" />
          <div className="h-80 rounded-xl bg-card border border-border animate-pulse" />
        </div>
      </AppShell>
    );
  }

  if (leads.length === 0 && linkedinPerf.length === 0) {
    return (
      <AppShell>
        <div>
          <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            International Paid Media Performance Overview
          </p>
        </div>
        <DashboardEmptyState />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            International Paid Media Performance Overview
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard title="Total Leads" value={formatNumber(totals.leads)} icon={<Users className="h-4 w-4" />} />
          <KpiCard title="Total MQLs" value={formatNumber(totals.mqls)} icon={<Target className="h-4 w-4" />} />
          <KpiCard title="Total SQLs" value={formatNumber(totals.sqls)} icon={<Handshake className="h-4 w-4" />} />
          <KpiCard title="Pipeline" value={formatCurrency(totals.pipeline)} icon={<TrendingUp className="h-4 w-4" />} />
          <KpiCard title="Total Spend" value={formatCurrency(totals.spend)} icon={<DollarSign className="h-4 w-4" />} />
          <KpiCard title="Blended CPL" value={formatCurrency(totals.cpl)} icon={<BarChart3 className="h-4 w-4" />} />
          <KpiCard title="Blended CPMQL" value={formatCurrency(totals.cpmql)} icon={<PieChart className="h-4 w-4" />} />
        </div>

        {/* Channel Performance Tables */}
        <ChannelPerformanceTable
          data={channelMetrics["Paid Social"] || []}
          title="LinkedIn Ads (Paid Social) Performance Overview"
        />
        <ChannelPerformanceTable
          data={channelMetrics["Paid Search"] || []}
          title="Google Ads (Paid Search) Performance Overview"
        />

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Leads / MQLs / SQLs Trend</h3>
            <LineChartComponent
              data={trendChartData}
              xKey="month_key"
              lines={[
                { key: "Leads", color: "#3b82f6", name: "Leads" },
                { key: "MQLs", color: "#00C853", name: "MQLs" },
                { key: "SQLs", color: "#f59e0b", name: "SQLs" },
              ]}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Spend vs Pipeline</h3>
            <BarChartComponent
              data={spendPipelineData}
              xKey="month_key"
              bars={[
                { key: "Spend", color: "#ef4444", name: "Spend" },
                { key: "Pipeline", color: "#00C853", name: "Pipeline" },
              ]}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">Leads by Channel</h3>
          <BarChartComponent
            data={channelBarData}
            xKey="month_key"
            bars={[
              { key: "Paid Social", color: "#3b82f6", name: "Paid Social", stackId: "a" },
              { key: "Paid Search", color: "#f59e0b", name: "Paid Search", stackId: "a" },
              { key: "Organic", color: "#00C853", name: "Organic", stackId: "a" },
              { key: "Other", color: "#8b5cf6", name: "Other", stackId: "a" },
            ]}
          />
        </div>

        {/* Country Performance */}
        <div>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-lg font-semibold">Performance by Country</h2>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Months</option>
              {allMonthKeys.map((mk) => (
                <option key={mk} value={mk}>
                  {monthKeyToLabel(mk)}
                </option>
              ))}
            </select>
          </div>
          <CountryPerformanceTable
            data={countryMetrics}
            title={selectedMonth === "all" ? "All Months" : monthKeyToLabel(selectedMonth)}
          />
        </div>
      </div>
    </AppShell>
  );
}
