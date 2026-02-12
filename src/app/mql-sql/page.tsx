"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useMemo } from "react";
import type { MqlToSql } from "@/types";
import { Plus } from "lucide-react";

export default function MqlSqlPage() {
  const [rows, setRows] = useState<MqlToSql[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [newRow, setNewRow] = useState({
    company_name: "",
    meeting_set: "NO",
    channel_type: "Paid",
  });

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from("mql_to_sql")
        .select("*")
        .order("created_at", { ascending: false });
      setRows((data as MqlToSql[]) || []);
      setLoading(false);
    }
    loadData();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const meetingsSet = rows.filter((r) => r.meeting_set === "YES").length;
    const convRate = total > 0 ? ((meetingsSet / total) * 100).toFixed(1) : "0";
    const paidCount = rows.filter((r) => r.channel_type === "Paid").length;
    const organicCount = rows.filter((r) => r.channel_type === "Organic").length;
    return { total, meetingsSet, convRate, paidCount, organicCount };
  }, [rows]);

  const handleToggleMeeting = async (id: number, current: string) => {
    const newVal = current === "YES" ? "NO" : "YES";
    const { error } = await supabase
      .from("mql_to_sql")
      .update({ meeting_set: newVal, is_sql: newVal === "YES" })
      .eq("id", id);
    if (!error) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, meeting_set: newVal, is_sql: newVal === "YES" } : r
        )
      );
    }
  };

  const handleAdd = async () => {
    if (!newRow.company_name) {
      setMessage("Company name is required");
      return;
    }
    const { data, error } = await supabase
      .from("mql_to_sql")
      .insert({
        company_name: newRow.company_name,
        meeting_set: newRow.meeting_set,
        is_sql: newRow.meeting_set === "YES",
        channel_type: newRow.channel_type,
        date_key: `${new Date().getMonth() + 1}_${new Date().getFullYear().toString().slice(2)}`,
        contact_date: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else if (data) {
      setRows([data as MqlToSql, ...rows]);
      setNewRow({ company_name: "", meeting_set: "NO", channel_type: "Paid" });
      setMessage("Added");
    }
  };

  const handleUpdateChannel = async (id: number, channelType: string) => {
    const { error } = await supabase
      .from("mql_to_sql")
      .update({ channel_type: channelType })
      .eq("id", id);
    if (!error) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, channel_type: channelType } : r))
      );
    }
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
        <div>
          <h1 className="text-2xl font-bold">MQL to SQL Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track MQL to meeting/SQL conversions
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Total MQLs Tracked</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Meetings Set</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">{stats.meetingsSet}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Conversion Rate</p>
            <p className="text-2xl font-bold mt-1">{stats.convRate}%</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Paid</p>
            <p className="text-2xl font-bold mt-1 text-blue-400">{stats.paidCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Organic</p>
            <p className="text-2xl font-bold mt-1 text-green-400">{stats.organicCount}</p>
          </div>
        </div>

        {/* Add new */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-sm mb-3">Add MQL Entry</h3>
          <div className="flex flex-wrap gap-3">
            <input
              placeholder="Company Name"
              value={newRow.company_name}
              onChange={(e) => setNewRow({ ...newRow, company_name: e.target.value })}
              className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={newRow.meeting_set}
              onChange={(e) => setNewRow({ ...newRow, meeting_set: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="NO">No Meeting</option>
              <option value="YES">Meeting Set</option>
            </select>
            <select
              value={newRow.channel_type}
              onChange={(e) => setNewRow({ ...newRow, channel_type: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="Paid">Paid</option>
              <option value="Organic">Organic</option>
            </select>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
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

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-500px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Company</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">Meeting Set</th>
                  <th className="text-center py-2.5 px-4 font-medium text-muted-foreground text-xs">SQL</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Date</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Date Key</th>
                  <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Channel</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-4 font-medium">{row.company_name}</td>
                    <td className="py-2 px-4 text-center">
                      <button
                        onClick={() => handleToggleMeeting(row.id, row.meeting_set)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          row.meeting_set === "YES"
                            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                        }`}
                      >
                        {row.meeting_set}
                      </button>
                    </td>
                    <td className="py-2 px-4 text-center">
                      <span className={`text-xs ${row.is_sql ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {row.is_sql ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      {row.contact_date ? new Date(row.contact_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">{row.date_key || "-"}</td>
                    <td className="py-2 px-4">
                      <select
                        value={row.channel_type || "Paid"}
                        onChange={(e) => handleUpdateChannel(row.id, e.target.value)}
                        className="px-2 py-1 rounded bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="Paid">Paid</option>
                        <option value="Organic">Organic</option>
                      </select>
                    </td>
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
