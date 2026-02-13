"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, RefreshCw, Database, Trash2, Clock, Users, Handshake } from "lucide-react";

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
        <div className="grid gap-6 lg:grid-cols-2">
          <ContactsUpload />
          <DealsUpload />
        </div>
        <UploadHistory />
        <MonthlySpendEditor />
        <div className="grid gap-6 lg:grid-cols-2">
          <RefreshViews />
          <DataStats />
        </div>
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
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Database className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">HubSpot Integration</h2>
          <p className="text-sm text-muted-foreground">
            Sync contacts and deals from HubSpot CRM
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Set <code className="bg-muted px-1.5 py-0.5 rounded text-xs">HUBSPOT_ACCESS_TOKEN</code> in
        your environment variables. Auto-sync runs daily at 06:00 UTC via Vercel Cron.
      </p>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
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

  const handleFile = useCallback(async (file: File) => {
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
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Upload className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">LinkedIn Ads CSV Upload</h2>
          <p className="text-sm text-muted-foreground">
            Upload exported CSV from LinkedIn Ads Manager
          </p>
        </div>
      </div>
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
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
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

function ContactsUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
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
      const res = await fetch("/api/contacts/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setResult(
        `Processed ${data.rows_processed} contacts${data.rows_skipped ? ` (${data.rows_skipped} skipped)` : ""}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-green-500/10">
          <Users className="h-5 w-5 text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Contacts CSV Upload</h2>
          <p className="text-sm text-muted-foreground">
            Upload exported CSV from HubSpot Contacts
          </p>
        </div>
      </div>
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
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
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

function DealsUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
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
      const res = await fetch("/api/deals/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setResult(
        `Processed ${data.rows_processed} deals${data.rows_skipped ? ` (${data.rows_skipped} skipped)` : ""}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Handshake className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Deals CSV Upload</h2>
          <p className="text-sm text-muted-foreground">
            Upload exported CSV from HubSpot Deals
          </p>
        </div>
      </div>
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
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
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

function UploadHistory() {
  type BatchEntry = {
    upload_batch_id: string;
    uploaded_at: string;
    count: number;
    source: "linkedin" | "contacts" | "deals";
  };

  const [batches, setBatches] = useState<BatchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBatches = async () => {
    setLoading(true);
    const allBatches: BatchEntry[] = [];

    // Load LinkedIn batches
    const { data: liData } = await supabase
      .from("linkedin_ads_raw")
      .select("upload_batch_id, uploaded_at")
      .not("upload_batch_id", "is", null)
      .order("uploaded_at", { ascending: false });

    if (liData) {
      const batchMap = new Map<string, { uploaded_at: string; count: number }>();
      for (const row of liData) {
        const bid = row.upload_batch_id;
        if (!bid) continue;
        const existing = batchMap.get(bid);
        if (existing) existing.count++;
        else batchMap.set(bid, { uploaded_at: row.uploaded_at, count: 1 });
      }
      for (const [id, v] of batchMap) {
        allBatches.push({ upload_batch_id: id, uploaded_at: v.uploaded_at, count: v.count, source: "linkedin" });
      }
    }

    // Load Contacts batches
    const { data: cData } = await supabase
      .from("contacts")
      .select("upload_batch_id, created_at")
      .not("upload_batch_id", "is", null)
      .order("created_at", { ascending: false });

    if (cData) {
      const batchMap = new Map<string, { uploaded_at: string; count: number }>();
      for (const row of cData) {
        const bid = row.upload_batch_id;
        if (!bid) continue;
        const existing = batchMap.get(bid);
        if (existing) existing.count++;
        else batchMap.set(bid, { uploaded_at: row.created_at, count: 1 });
      }
      for (const [id, v] of batchMap) {
        allBatches.push({ upload_batch_id: id, uploaded_at: v.uploaded_at, count: v.count, source: "contacts" });
      }
    }

    // Load Deals batches
    const { data: dData } = await supabase
      .from("deals")
      .select("upload_batch_id, synced_at")
      .not("upload_batch_id", "is", null)
      .order("synced_at", { ascending: false });

    if (dData) {
      const batchMap = new Map<string, { uploaded_at: string; count: number }>();
      for (const row of dData) {
        const bid = row.upload_batch_id;
        if (!bid) continue;
        const existing = batchMap.get(bid);
        if (existing) existing.count++;
        else batchMap.set(bid, { uploaded_at: row.synced_at, count: 1 });
      }
      for (const [id, v] of batchMap) {
        allBatches.push({ upload_batch_id: id, uploaded_at: v.uploaded_at, count: v.count, source: "deals" });
      }
    }

    allBatches.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    setBatches(allBatches);
    setLoading(false);
    setLoaded(true);
  };

  const handleRevert = async (batchId: string, source: "linkedin" | "contacts" | "deals") => {
    if (!confirm(`Revert this ${source} upload? This will delete all rows from batch ${batchId.slice(0, 8)}...`)) {
      return;
    }
    setReverting(batchId);
    setMessage(null);
    const revertUrl =
      source === "linkedin" ? "/api/linkedin/revert"
      : source === "contacts" ? "/api/contacts/revert"
      : "/api/deals/revert";
    try {
      const res = await fetch(revertUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: batchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revert failed");
      setMessage(`Reverted ${data.rows_deleted} ${source} rows`);
      setBatches((prev) => prev.filter((b) => b.upload_batch_id !== batchId));
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Revert failed"}`);
    } finally {
      setReverting(null);
    }
  };

  const sourceLabel: Record<string, string> = {
    linkedin: "LinkedIn Ads",
    contacts: "Contacts",
    deals: "Deals",
  };

  const sourceColor: Record<string, string> = {
    linkedin: "bg-blue-500/20 text-blue-400",
    contacts: "bg-green-500/20 text-green-400",
    deals: "bg-amber-500/20 text-amber-400",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Clock className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Upload History</h2>
            <p className="text-sm text-muted-foreground">
              CSV upload batches - revert if needed
            </p>
          </div>
        </div>
        {!loaded && (
          <button
            onClick={loadBatches}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load History"}
          </button>
        )}
      </div>

      {loaded && batches.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No upload batches found. Upload a CSV to get started.
        </div>
      )}

      {loaded && batches.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Source</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Batch ID</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Uploaded</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Rows</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.upload_batch_id} className="border-b border-border/50">
                  <td className="py-2 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sourceColor[b.source]}`}>
                      {sourceLabel[b.source]}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">{b.upload_batch_id.slice(0, 12)}...</td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {new Date(b.uploaded_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right">{b.count}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => handleRevert(b.upload_batch_id, b.source)}
                      disabled={reverting === b.upload_batch_id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-400/10 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      {reverting === b.upload_batch_id ? "Reverting..." : "Revert"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {message && (
        <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${
          message.startsWith("Error") ? "text-red-400 bg-red-400/10" : "text-primary bg-primary/10"
        }`}>
          {message}
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
    try {
      // Dashboard data is computed on-the-fly from raw tables, no materialized views needed.
      // Just verify the raw tables are accessible.
      const { error } = await supabase.from("contacts").select("id", { count: "exact", head: true });
      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage("Dashboard data refreshed successfully. Navigate to Dashboard to see updated data.");
      }
    } catch {
      setMessage("Error: could not connect to database");
    }
    setRefreshing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <RefreshCw className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Refresh Dashboard Data</h2>
          <p className="text-sm text-muted-foreground">
            Verify database connection and refresh data
          </p>
        </div>
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
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

function DataStats() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const tables = ["contacts", "deals", "linkedin_ads_raw", "campaign_names", "mql_to_sql"];
      const counts: Record<string, number> = {};

      for (const table of tables) {
        const { count } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        counts[table] = count || 0;
      }

      setStats(counts);
      setLoading(false);
    }
    loadStats();
  }, []);

  const tableLabels: Record<string, string> = {
    contacts: "Contacts",
    deals: "Deals",
    linkedin_ads_raw: "LinkedIn Ads Rows",
    campaign_names: "Campaign Mappings",
    mql_to_sql: "MQL Entries",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-cyan-500/10">
          <Database className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Database Stats</h2>
          <p className="text-sm text-muted-foreground">
            Current row counts per table
          </p>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(stats).map(([table, count]) => (
            <div
              key={table}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
            >
              <span className="text-sm">{tableLabels[table] || table}</span>
              <span className="text-sm font-mono font-semibold">
                {count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
