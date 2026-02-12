"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { CampaignPerformanceTable } from "@/components/tables/performance-table";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import { sortMonthKeys, safeDivide, monthKeyToLabel } from "@/lib/utils";
import type { CampaignName, LeadEnriched, LinkedInAdsPerformance, CampaignMonthlyMetrics } from "@/types";
import { Plus, Save, Trash2 } from "lucide-react";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignName[]>([]);
  const [leads, setLeads] = useState<LeadEnriched[]>([]);
  const [linkedinPerf, setLinkedinPerf] = useState<LinkedInAdsPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [tab, setTab] = useState<"performance" | "mappings">("performance");

  useEffect(() => {
    async function loadData() {
      const [campRes, leadsRes, perfRes] = await Promise.all([
        supabase.from("campaign_names").select("*").order("country_code"),
        supabase.from("leads_enriched").select("*"),
        supabase.from("linkedin_ads_performance").select("*"),
      ]);
      setCampaigns((campRes.data as CampaignName[]) || []);
      setLeads((leadsRes.data as LeadEnriched[]) || []);
      setLinkedinPerf((perfRes.data as LinkedInAdsPerformance[]) || []);
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

  const campaignMetrics = useMemo(() => {
    const monthFilter = selectedMonth === "all" ? allMonthKeys : [selectedMonth];
    const campaignMap = new Map<string, CampaignMonthlyMetrics>();

    for (const mk of monthFilter) {
      const monthLeads = leads.filter(
        (l) => l.month_key === mk && l.campaign_raw !== "[Demo] New submission"
      );
      const monthPerf = linkedinPerf.filter((p) => p.month_key === mk);

      const campaignNames = new Set<string>();
      monthLeads.forEach((l) => l.campaign_name_normalized && campaignNames.add(l.campaign_name_normalized));
      monthPerf.forEach((p) => p.campaign_name_ok && campaignNames.add(p.campaign_name_ok));

      for (const cn of campaignNames) {
        if (cn === "-") continue;
        const campLeads = monthLeads.filter((l) => l.campaign_name_normalized === cn);
        const campPerf = monthPerf.filter((p) => p.campaign_name_ok === cn);

        const spend = campPerf.reduce((s, p) => s + p.total_spent, 0);
        const impressions = campPerf.reduce((s, p) => s + p.impressions, 0);
        const clicks = campPerf.reduce((s, p) => s + p.clicks, 0);
        const leadCount = campLeads.length;
        const mqlCount = campLeads.filter((l) => l.lead_status !== "Not Qualified").length;
        const sqlLeads = campLeads.filter((l) => l.deal_amount > 0);
        const sqlCount = sqlLeads.length;
        const pipeline = sqlLeads.reduce((s, l) => s + l.deal_amount, 0);

        const existing = campaignMap.get(cn);
        if (existing) {
          existing.spend += spend;
          existing.impressions += impressions;
          existing.clicks += clicks;
          existing.leads += leadCount;
          existing.mqls += mqlCount;
          existing.sqls += sqlCount;
          existing.pipeline += pipeline;
        } else {
          campaignMap.set(cn, {
            month_key: mk,
            campaign_name_normalized: cn,
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
          });
        }
      }
    }

    const result = Array.from(campaignMap.values()).map((r) => ({
      ...r,
      ctr: safeDivide(r.clicks, r.impressions),
      cpl: safeDivide(r.spend, r.leads),
      cpmql: safeDivide(r.spend, r.mqls),
      cpsql: safeDivide(r.spend, r.sqls),
    }));

    return result.sort((a, b) => b.spend - a.spend);
  }, [leads, linkedinPerf, allMonthKeys, selectedMonth]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
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
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Campaign name mappings and performance
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted/30 w-fit">
          <button
            onClick={() => setTab("performance")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "performance" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => setTab("mappings")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "mappings" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Campaign Mappings
          </button>
        </div>

        {tab === "performance" && (
          <>
            <div className="flex items-center gap-4">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Months</option>
                {allMonthKeys.map((mk) => (
                  <option key={mk} value={mk}>{monthKeyToLabel(mk)}</option>
                ))}
              </select>
            </div>
            <CampaignPerformanceTable
              data={campaignMetrics}
              title={selectedMonth === "all" ? "All Months" : monthKeyToLabel(selectedMonth)}
            />
          </>
        )}

        {tab === "mappings" && (
          <CampaignMappings campaigns={campaigns} onUpdate={setCampaigns} />
        )}
      </div>
    </AppShell>
  );
}

function CampaignMappings({
  campaigns,
  onUpdate,
}: {
  campaigns: CampaignName[];
  onUpdate: (c: CampaignName[]) => void;
}) {
  const [rows, setRows] = useState(campaigns);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newRow, setNewRow] = useState({ original_name: "", normalized_name: "", country_code: "" });

  const handleSave = async (row: CampaignName) => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("campaign_names")
      .upsert({
        id: row.id,
        original_name: row.original_name,
        normalized_name: row.normalized_name,
        country_code: row.country_code,
        nomenclature: row.nomenclature,
        is_active: row.is_active,
      });
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Saved");
    }
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!newRow.original_name || !newRow.normalized_name || !newRow.country_code) {
      setMessage("Fill all fields");
      return;
    }
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase
      .from("campaign_names")
      .insert(newRow)
      .select()
      .single();
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else if (data) {
      setRows([...rows, data as CampaignName]);
      onUpdate([...rows, data as CampaignName]);
      setNewRow({ original_name: "", normalized_name: "", country_code: "" });
      setMessage("Added");
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("campaign_names").delete().eq("id", id);
    if (!error) {
      const updated = rows.filter((r) => r.id !== id);
      setRows(updated);
      onUpdate(updated);
    }
  };

  const updateRow = (idx: number, field: string, value: string | boolean) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Add new */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold text-sm mb-3">Add New Mapping</h3>
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Original Name (from LinkedIn/HubSpot)"
            value={newRow.original_name}
            onChange={(e) => setNewRow({ ...newRow, original_name: e.target.value })}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            placeholder="Normalized Name (CODE OK)"
            value={newRow.normalized_name}
            onChange={(e) => setNewRow({ ...newRow, normalized_name: e.target.value })}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            placeholder="Country Code (UK, USA, etc.)"
            value={newRow.country_code}
            onChange={(e) => setNewRow({ ...newRow, country_code: e.target.value })}
            className="w-32 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {message && (
        <p className={`text-sm px-3 py-2 rounded-lg ${message.startsWith("Error") ? "text-red-400 bg-red-400/10" : "text-primary bg-primary/10"}`}>
          {message}
        </p>
      )}

      {/* Existing mappings */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Original Name</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Normalized Name</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Country</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Active</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-1.5 px-3">
                    <input
                      value={row.original_name}
                      onChange={(e) => updateRow(idx, "original_name", e.target.value)}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      value={row.normalized_name}
                      onChange={(e) => updateRow(idx, "normalized_name", e.target.value)}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      value={row.country_code}
                      onChange={(e) => updateRow(idx, "country_code", e.target.value)}
                      className="w-20 px-2 py-1 rounded bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      type="checkbox"
                      checked={row.is_active}
                      onChange={(e) => updateRow(idx, "is_active", e.target.checked)}
                      className="rounded"
                    />
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSave(rows[idx])}
                        className="p-1.5 rounded hover:bg-primary/20 text-primary transition-colors"
                        title="Save"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
