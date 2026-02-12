"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage data sources and integrations
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <HubSpotSync />
          <LinkedInUpload />
        </div>
        <MonthlySpendEditor />
        <RefreshViews />
      </div>
    </AppShell>
  );
}

function HubSpotSync() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/hubspot/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setResult(
        `Synced ${data.contacts_synced} contacts and ${data.deals_synced} deals`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold mb-1">HubSpot Integration</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Sync contacts and deals from HubSpot CRM
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Set <code className="bg-muted px-1 rounded">HUBSPOT_ACCESS_TOKEN</code>{" "}
        in your environment variables.
      </p>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {syncing ? "Syncing..." : "Sync Now"}
      </button>
      {result && (
        <p className="mt-3 text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg">
          {result}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
}

function LinkedInUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }
    setUploading(true);
    setResult(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/linkedin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setResult(
        `Processed ${data.rows_processed} rows (batch: ${data.batch_id?.slice(0, 8)}...)`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold mb-1">LinkedIn Ads CSV Upload</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Upload exported CSV from LinkedIn Ads Manager
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground"
        }`}
      >
        <p className="text-sm text-muted-foreground mb-2">
          Drag & drop your CSV file here, or
        </p>
        <label className="inline-block px-4 py-2 rounded-lg bg-secondary text-sm font-medium cursor-pointer hover:bg-secondary/80 transition-colors">
          Browse Files
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
        {uploading && (
          <p className="mt-3 text-sm text-muted-foreground animate-pulse">
            Processing CSV...
          </p>
        )}
      </div>
      {result && (
        <p className="mt-3 text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg">
          {result}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
}

function MonthlySpendEditor() {
  const [rows, setRows] = useState<
    Array<{ month_key: string; channel: string; amount: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("monthly_spend")
      .select("*")
      .order("month_key");
    if (data && data.length > 0) {
      setRows(
        data.map((r) => ({
          month_key: r.month_key,
          channel: r.channel,
          amount: String(r.amount),
        }))
      );
    } else {
      // Seed with common month_keys
      const months = [
        "9_2025","10_2025","11_2025","12_2025",
        "1_2026","2_2026","3_2026","4_2026","5_2026","6_2026",
        "7_2026","8_2026","9_2026","10_2026","11_2026","12_2026",
      ];
      const seed: Array<{ month_key: string; channel: string; amount: string }> = [];
      for (const m of months) {
        seed.push({ month_key: m, channel: "Paid Social", amount: "0" });
        seed.push({ month_key: m, channel: "Paid Search", amount: "0" });
      }
      setRows(seed);
    }
    setLoading(false);
    setLoaded(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const toUpsert = rows
      .filter((r) => parseFloat(r.amount) > 0)
      .map((r) => ({
        month_key: r.month_key,
        channel: r.channel,
        amount: parseFloat(r.amount),
      }));

    const { error } = await supabase
      .from("monthly_spend")
      .upsert(toUpsert, { onConflict: "month_key,channel" });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage(`Saved ${toUpsert.length} entries`);
    }
    setSaving(false);
  };

  const updateRow = (idx: number, field: string, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Monthly Ad Spend</h2>
          <p className="text-sm text-muted-foreground">
            Manual spend entries for Google Ads and historical LinkedIn data
          </p>
        </div>
        {!loaded && (
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load Data"}
          </button>
        )}
        {loaded && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save All"}
          </button>
        )}
      </div>

      {loaded && (
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                  Month
                </th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                  Channel
                </th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                  Amount (EUR)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-border/50">
                  <td className="py-1.5 px-3 text-muted-foreground">
                    {row.month_key}
                  </td>
                  <td className="py-1.5 px-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        row.channel === "Paid Social"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-orange-500/20 text-orange-400"
                      }`}
                    >
                      {row.channel}
                    </span>
                  </td>
                  <td className="py-1.5 px-3">
                    <input
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) =>
                        updateRow(idx, "amount", e.target.value)
                      }
                      className="w-full text-right px-2 py-1 rounded bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {message && (
        <p
          className={`mt-3 text-sm px-3 py-2 rounded-lg ${
            message.startsWith("Error")
              ? "text-red-400 bg-red-400/10"
              : "text-primary bg-primary/10"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function RefreshViews() {
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setMessage(null);
    const { error } = await supabase.rpc("refresh_materialized_views");
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Dashboard data refreshed successfully");
    }
    setRefreshing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold mb-1">Refresh Dashboard Data</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Re-compute materialized views (leads_enriched &
        linkedin_ads_performance)
      </p>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
      >
        {refreshing ? "Refreshing..." : "Refresh Now"}
      </button>
      {message && (
        <p
          className={`mt-3 text-sm px-3 py-2 rounded-lg ${
            message.startsWith("Error")
              ? "text-red-400 bg-red-400/10"
              : "text-primary bg-primary/10"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
