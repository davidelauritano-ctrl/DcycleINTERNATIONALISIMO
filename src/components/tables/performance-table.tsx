"use client";

import { formatCurrency, formatNumber, formatPercent, monthKeyToLabel } from "@/lib/utils";
import type { ChannelMonthlyMetrics, CountryMonthlyMetrics, CampaignMonthlyMetrics } from "@/types";

interface ChannelTableProps {
  data: ChannelMonthlyMetrics[];
  title: string;
}

export function ChannelPerformanceTable({ data, title }: ChannelTableProps) {
  const totals = data.reduce(
    (acc, row) => ({
      leads: acc.leads + row.leads,
      mqls: acc.mqls + row.mqls,
      sqls: acc.sqls + row.sqls,
      pipeline: acc.pipeline + row.pipeline,
      spend: acc.spend + row.spend,
    }),
    { leads: 0, mqls: 0, sqls: 0, pipeline: 0, spend: 0 }
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs">Month</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">Leads</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">MQLs</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">SQLs</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">Pipeline</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">Spend</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">CPL</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">CPMQL</th>
              <th className="text-right py-2.5 px-4 font-medium text-muted-foreground text-xs">CPSQL</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-2 px-4 font-medium">{monthKeyToLabel(row.month_key)}</td>
                <td className="py-2 px-4 text-right">{row.leads}</td>
                <td className="py-2 px-4 text-right">{row.mqls}</td>
                <td className="py-2 px-4 text-right">{row.sqls}</td>
                <td className="py-2 px-4 text-right text-emerald-400">{formatCurrency(row.pipeline)}</td>
                <td className="py-2 px-4 text-right">{formatCurrency(row.spend)}</td>
                <td className="py-2 px-4 text-right">{formatCurrency(row.cpl)}</td>
                <td className="py-2 px-4 text-right">{formatCurrency(row.cpmql)}</td>
                <td className="py-2 px-4 text-right">{formatCurrency(row.cpsql)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 font-semibold">
              <td className="py-2.5 px-4">TOTAL</td>
              <td className="py-2.5 px-4 text-right">{totals.leads}</td>
              <td className="py-2.5 px-4 text-right">{totals.mqls}</td>
              <td className="py-2.5 px-4 text-right">{totals.sqls}</td>
              <td className="py-2.5 px-4 text-right text-emerald-400">{formatCurrency(totals.pipeline)}</td>
              <td className="py-2.5 px-4 text-right">{formatCurrency(totals.spend)}</td>
              <td className="py-2.5 px-4 text-right">{totals.leads > 0 ? formatCurrency(totals.spend / totals.leads) : "-"}</td>
              <td className="py-2.5 px-4 text-right">{totals.mqls > 0 ? formatCurrency(totals.spend / totals.mqls) : "-"}</td>
              <td className="py-2.5 px-4 text-right">{totals.sqls > 0 ? formatCurrency(totals.spend / totals.sqls) : "-"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

interface CountryTableProps {
  data: CountryMonthlyMetrics[];
  title: string;
}

export function CountryPerformanceTable({ data, title }: CountryTableProps) {
  const totals = data.reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend,
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      leads: acc.leads + row.leads,
      mqls: acc.mqls + row.mqls,
      sqls: acc.sqls + row.sqls,
      pipeline: acc.pipeline + row.pipeline,
      first_meeting_set: acc.first_meeting_set + row.first_meeting_set,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0, mqls: 0, sqls: 0, pipeline: 0, first_meeting_set: 0 }
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs sticky left-0 bg-muted/30">Country</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Spend</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Impr.</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Clicks</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">CTR</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Leads</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">MQLs</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">SQLs</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Pipeline</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">CPL</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">CPMQL</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">CPSQL</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Mtg Set</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-2 px-3 font-medium sticky left-0 bg-card">{row.country}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(row.spend)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(row.impressions)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(row.clicks)}</td>
                <td className="py-2 px-3 text-right">{formatPercent(row.ctr)}</td>
                <td className="py-2 px-3 text-right">{row.leads}</td>
                <td className="py-2 px-3 text-right">{row.mqls}</td>
                <td className="py-2 px-3 text-right">{row.sqls}</td>
                <td className="py-2 px-3 text-right text-emerald-400">{formatCurrency(row.pipeline)}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(row.cpl)}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(row.cpmql)}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(row.cpsql)}</td>
                <td className="py-2 px-3 text-right">{row.first_meeting_set}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 font-semibold">
              <td className="py-2.5 px-3 sticky left-0 bg-muted/30">TOTAL</td>
              <td className="py-2.5 px-3 text-right">{formatCurrency(totals.spend)}</td>
              <td className="py-2.5 px-3 text-right">{formatNumber(totals.impressions)}</td>
              <td className="py-2.5 px-3 text-right">{formatNumber(totals.clicks)}</td>
              <td className="py-2.5 px-3 text-right">{totals.impressions > 0 ? formatPercent(totals.clicks / totals.impressions) : "-"}</td>
              <td className="py-2.5 px-3 text-right">{totals.leads}</td>
              <td className="py-2.5 px-3 text-right">{totals.mqls}</td>
              <td className="py-2.5 px-3 text-right">{totals.sqls}</td>
              <td className="py-2.5 px-3 text-right text-emerald-400">{formatCurrency(totals.pipeline)}</td>
              <td className="py-2.5 px-3 text-right">{totals.leads > 0 ? formatCurrency(totals.spend / totals.leads) : "-"}</td>
              <td className="py-2.5 px-3 text-right">{totals.mqls > 0 ? formatCurrency(totals.spend / totals.mqls) : "-"}</td>
              <td className="py-2.5 px-3 text-right">{totals.sqls > 0 ? formatCurrency(totals.spend / totals.sqls) : "-"}</td>
              <td className="py-2.5 px-3 text-right">{totals.first_meeting_set}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

interface CampaignTableProps {
  data: CampaignMonthlyMetrics[];
  title: string;
}

export function CampaignPerformanceTable({ data, title }: CampaignTableProps) {
  const totals = data.reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend,
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      leads: acc.leads + row.leads,
      mqls: acc.mqls + row.mqls,
      sqls: acc.sqls + row.sqls,
      pipeline: acc.pipeline + row.pipeline,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0, mqls: 0, sqls: 0, pipeline: 0 }
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs sticky left-0 bg-muted/30 min-w-[200px]">Campaign</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Spend</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Impr.</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Clicks</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">CTR</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Leads</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">MQLs</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">SQLs</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">Pipeline</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">CPL</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">CPMQL</th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs">CPSQL</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-2 px-3 font-medium sticky left-0 bg-card truncate max-w-[250px]" title={row.campaign_name_normalized}>{row.campaign_name_normalized}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(row.spend)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(row.impressions)}</td>
                <td className="py-2 px-3 text-right">{formatNumber(row.clicks)}</td>
                <td className="py-2 px-3 text-right">{formatPercent(row.ctr)}</td>
                <td className="py-2 px-3 text-right">{row.leads}</td>
                <td className="py-2 px-3 text-right">{row.mqls}</td>
                <td className="py-2 px-3 text-right">{row.sqls}</td>
                <td className="py-2 px-3 text-right text-emerald-400">{formatCurrency(row.pipeline)}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(row.cpl)}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(row.cpmql)}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(row.cpsql)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 font-semibold">
              <td className="py-2.5 px-3 sticky left-0 bg-muted/30">TOTAL</td>
              <td className="py-2.5 px-3 text-right">{formatCurrency(totals.spend)}</td>
              <td className="py-2.5 px-3 text-right">{formatNumber(totals.impressions)}</td>
              <td className="py-2.5 px-3 text-right">{formatNumber(totals.clicks)}</td>
              <td className="py-2.5 px-3 text-right">{totals.impressions > 0 ? formatPercent(totals.clicks / totals.impressions) : "-"}</td>
              <td className="py-2.5 px-3 text-right">{totals.leads}</td>
              <td className="py-2.5 px-3 text-right">{totals.mqls}</td>
              <td className="py-2.5 px-3 text-right">{totals.sqls}</td>
              <td className="py-2.5 px-3 text-right text-emerald-400">{formatCurrency(totals.pipeline)}</td>
              <td className="py-2.5 px-3 text-right">{totals.leads > 0 ? formatCurrency(totals.spend / totals.leads) : "-"}</td>
              <td className="py-2.5 px-3 text-right">{totals.mqls > 0 ? formatCurrency(totals.spend / totals.mqls) : "-"}</td>
              <td className="py-2.5 px-3 text-right">{totals.sqls > 0 ? formatCurrency(totals.spend / totals.sqls) : "-"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
