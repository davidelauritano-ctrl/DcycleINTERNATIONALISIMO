"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import type { Deal } from "@/types";
import { BarChartComponent } from "@/components/charts/bar-chart";

const STAGE_ORDER = [
  "Meeting Qualified",
  "Basic Demo Done",
  "Advanced Demo Done",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

const STAGE_COLORS: Record<string, string> = {
  "Meeting Qualified": "bg-blue-500/20 text-blue-400",
  "Basic Demo Done": "bg-cyan-500/20 text-cyan-400",
  "Advanced Demo Done": "bg-teal-500/20 text-teal-400",
  "Proposal Sent": "bg-yellow-500/20 text-yellow-400",
  "Negotiation": "bg-orange-500/20 text-orange-400",
  "Closed Won": "bg-emerald-500/20 text-emerald-400",
  "Closed Lost": "bg-red-500/20 text-red-400",
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from("deals").select("*").order("close_date", { ascending: false });
      setDeals((data as Deal[]) || []);
      setLoading(false);
    }
    loadData();
  }, []);

  const { stages, owners } = useMemo(() => {
    const stages = [...new Set(deals.map((d) => d.deal_stage).filter(Boolean))].sort();
    const owners = [...new Set(deals.map((d) => d.deal_owner).filter(Boolean))].sort();
    return { stages, owners };
  }, [deals]);

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (filterStage !== "all" && d.deal_stage !== filterStage) return false;
      if (filterOwner !== "all" && d.deal_owner !== filterOwner) return false;
      return true;
    });
  }, [deals, filterStage, filterOwner]);

  const funnelData = useMemo(() => {
    const stageCount: Record<string, { count: number; amount: number }> = {};
    for (const d of deals) {
      const stage = d.deal_stage || "Unknown";
      if (!stageCount[stage]) stageCount[stage] = { count: 0, amount: 0 };
      stageCount[stage].count++;
      stageCount[stage].amount += d.amount_corrected || d.amount || 0;
    }
    return STAGE_ORDER.filter((s) => stageCount[s]).map((stage) => ({
      stage,
      Count: stageCount[stage].count,
      Amount: Math.round(stageCount[stage].amount),
    }));
  }, [deals]);

  const totalPipeline = useMemo(() => {
    return deals
      .filter((d) => !d.is_closed_won && !d.is_closed_lost)
      .reduce((s, d) => s + (d.amount_corrected || d.amount || 0), 0);
  }, [deals]);

  const totalWon = useMemo(() => {
    return deals
      .filter((d) => d.is_closed_won)
      .reduce((s, d) => s + (d.amount_corrected || d.amount || 0), 0);
  }, [deals]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Deals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {filtered.length} deals | Open Pipeline: {formatCurrency(totalPipeline)} | Won: {formatCurrency(totalWon)}
          </p>
        </div>

        {/* Pipeline funnel */}
        {funnelData.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Pipeline Funnel</h3>
            <BarChartComponent
              data={funnelData}
              xKey="stage"
              bars={[
                { key: "Count", color: "#3b82f6", name: "Deals" },
                { key: "Amount", color: "#00C853", name: "Amount (EUR)" },
              ]}
              height={250}
              formatXLabel={(v) => v}
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All Stages</option>
            {stages.map((s) => <option key={s} value={s!}>{s}</option>)}
          </select>
          <select value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All Owners</option>
            {owners.map((o) => <option key={o} value={o!}>{o}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Deal Name</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Stage</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Close Date</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Owner</th>
                  <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">Amount</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Company</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Contact</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-4 font-medium max-w-[250px] truncate">{d.deal_name}</td>
                    <td className="py-2 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STAGE_COLORS[d.deal_stage || ""] || "bg-gray-500/20 text-gray-400"}`}>
                        {d.deal_stage || "-"}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      {d.close_date ? new Date(d.close_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">{d.deal_owner || "-"}</td>
                    <td className="py-2 px-4 text-right text-emerald-400">
                      {formatCurrency(d.amount_corrected || d.amount || 0)}
                    </td>
                    <td className="py-2 px-4 max-w-[150px] truncate">{d.associated_company || "-"}</td>
                    <td className="py-2 px-4 max-w-[150px] truncate text-muted-foreground">{d.associated_contact || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
