"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { useEffect, useState, useMemo } from "react";
import { formatCurrency, monthKeyToLabel, sortMonthKeys, tierColor } from "@/lib/utils";
import type { LeadEnriched } from "@/types";
import { Download, Search } from "lucide-react";

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterTier, setFilterTier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");

  useEffect(() => {
    async function loadData() {
      const res = await fetch("/api/data?entity=leads_enriched");
      const data = res.ok ? await res.json() : [];
      setLeads((data as LeadEnriched[]) || []);
      setLoading(false);
    }
    loadData();
  }, []);

  const { channels, countries, tiers, statuses, monthKeys } = useMemo(() => {
    const channels = [...new Set(leads.map((l) => l.channel).filter(Boolean))].sort();
    const countries = [...new Set(leads.map((l) => l.country).filter((c) => c !== "-"))].sort();
    const tiers = [...new Set(leads.map((l) => l.tier))].sort();
    const statuses = [...new Set(leads.map((l) => l.lead_status).filter(Boolean))].sort();
    const monthKeys = sortMonthKeys([...new Set(leads.map((l) => l.month_key).filter(Boolean) as string[])]);
    return { channels, countries, tiers, statuses, monthKeys };
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filterChannel !== "all" && l.channel !== filterChannel) return false;
      if (filterCountry !== "all" && l.country !== filterCountry) return false;
      if (filterTier !== "all" && l.tier !== filterTier) return false;
      if (filterStatus !== "all" && l.lead_status !== filterStatus) return false;
      if (filterMonth !== "all" && l.month_key !== filterMonth) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = `${l.first_name || ""} ${l.last_name || ""}`.toLowerCase();
        const company = (l.company_name || "").toLowerCase();
        const email = (l.email || "").toLowerCase();
        if (!name.includes(q) && !company.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, filterChannel, filterCountry, filterTier, filterStatus, filterMonth]);

  const exportCSV = () => {
    const headers = [
      "Name","Date","Industry","Status","Meeting","Employees","Tier",
      "Campaign","Channel","Company","Deal Amount","Month","Country","Email",
    ];
    const rows = filtered.map((l) => [
      `${l.first_name || ""} ${l.last_name || ""}`,
      l.first_email_date ? new Date(l.first_email_date).toLocaleDateString() : "",
      l.industry,
      l.lead_status || "",
      l.first_meeting_set,
      l.num_employees || "",
      l.tier,
      l.campaign_raw || "",
      l.channel || "",
      l.company_name || "",
      l.deal_amount,
      l.month_key || "",
      l.country,
      l.email || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Leads</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {filtered.length} of {leads.length} leads
            </p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search name, company, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm w-64 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All Channels</option>
            {channels.map((c) => <option key={c} value={c!}>{c}</option>)}
          </select>
          <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All Countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All Tiers</option>
            {tiers.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All Statuses</option>
            {statuses.map((s) => <option key={s} value={s!}>{s}</option>)}
          </select>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All Months</option>
            {monthKeys.map((mk) => <option key={mk} value={mk}>{monthKeyToLabel(mk)}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Name</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Date</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Industry</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Meeting</th>
                  <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Employees</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Tier</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Campaign</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Channel</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Company</th>
                  <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Deal</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Month</th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs">Country</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 font-medium whitespace-nowrap">{l.first_name} {l.last_name}</td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {l.first_email_date ? new Date(l.first_email_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground max-w-[150px] truncate">{l.industry}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        l.lead_status === "MQL" ? "bg-blue-500/20 text-blue-400" :
                        l.lead_status === "SQL" ? "bg-emerald-500/20 text-emerald-400" :
                        l.lead_status === "Not Qualified" ? "bg-red-500/20 text-red-400" :
                        l.lead_status === "Closed Won" ? "bg-green-500/20 text-green-400" :
                        l.lead_status === "Closed Lost" ? "bg-red-500/20 text-red-400" :
                        "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {l.lead_status || "-"}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-xs ${l.first_meeting_set === "YES" ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {l.first_meeting_set}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{l.num_employees || "-"}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tierColor(l.tier)}`}>
                        {l.tier}
                      </span>
                    </td>
                    <td className="py-2 px-3 max-w-[200px] truncate text-muted-foreground" title={l.campaign_raw || ""}>
                      {l.campaign_name_normalized !== "-" ? l.campaign_name_normalized : l.campaign_raw || "-"}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        l.channel === "Paid Social" ? "bg-blue-500/20 text-blue-400" :
                        l.channel === "Paid Search" ? "bg-orange-500/20 text-orange-400" :
                        l.channel === "Organic Search" ? "bg-green-500/20 text-green-400" :
                        "bg-purple-500/20 text-purple-400"
                      }`}>
                        {l.channel || "-"}
                      </span>
                    </td>
                    <td className="py-2 px-3 max-w-[150px] truncate">{l.company_name || "-"}</td>
                    <td className="py-2 px-3 text-right text-emerald-400">
                      {l.deal_amount > 0 ? formatCurrency(l.deal_amount) : "-"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {l.month_key ? monthKeyToLabel(l.month_key) : "-"}
                    </td>
                    <td className="py-2 px-3">{l.country}</td>
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
