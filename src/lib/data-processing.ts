import type {
  LeadEnriched,
  MonthlySpend,
  LinkedInAdsPerformance,
  ChannelMonthlyMetrics,
  CountryMonthlyMetrics,
  CampaignMonthlyMetrics,
  ForecastConfig,
  ForecastRow,
} from "@/types";

// Re-import MONTH_NAMES as a value (the type import above is just for reference)
const MONTH_NAMES_VAL: readonly string[] = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

// ============================================================
// Channel Monthly Metrics
// ============================================================

export function computeChannelMonthlyMetrics(
  leads: LeadEnriched[],
  monthlySpend: MonthlySpend[],
  linkedinPerf: LinkedInAdsPerformance[]
): ChannelMonthlyMetrics[] {
  const channels = ["Paid Social", "Paid Search"];

  // Collect all unique month_keys from leads and monthly spend
  const monthKeys = new Set<string>();
  leads.forEach((l) => {
    if (l.month_key) monthKeys.add(l.month_key);
  });
  monthlySpend.forEach((s) => monthKeys.add(s.month_key));
  linkedinPerf.forEach((lp) => {
    if (lp.month_key) monthKeys.add(lp.month_key);
  });

  const results: ChannelMonthlyMetrics[] = [];

  for (const channel of channels) {
    const monthKeyArr = Array.from(monthKeys);
    for (const monthKey of monthKeyArr) {
      const channelLeads = leads.filter(
        (l) => l.channel === channel && l.month_key === monthKey
      );

      const leadsCount = channelLeads.length;

      const mqls = channelLeads.filter(
        (l) => l.lead_status !== "Not Qualified"
      ).length;

      const sqlLeads = channelLeads.filter((l) => l.deal_amount > 0);
      const sqls = sqlLeads.length;

      const pipeline = channelLeads
        .filter((l) => l.deal_amount > 0)
        .reduce((sum, l) => sum + l.deal_amount, 0);

      // Determine spend: use monthly_spend table or LinkedIn ads for 2026+ months
      let spend = 0;
      const spendEntry = monthlySpend.find(
        (s) => s.month_key === monthKey && s.channel === channel
      );

      if (spendEntry) {
        spend = spendEntry.amount;
      } else {
        // For 2026+ months, sum linkedin_ads_performance total_spent
        const parts = monthKey.split("_");
        const year = parts.length === 2 ? parseInt(parts[1], 10) : 0;
        if (year >= 2026 && channel === "Paid Social") {
          spend = linkedinPerf
            .filter((lp) => lp.month_key === monthKey)
            .reduce((sum, lp) => sum + lp.total_spent, 0);
        }
      }

      const cpl = safeDivide(spend, leadsCount);
      const cpmql = safeDivide(spend, mqls);
      const cpsql = safeDivide(spend, sqls);

      results.push({
        month_key: monthKey,
        channel,
        leads: leadsCount,
        mqls,
        sqls,
        pipeline,
        spend,
        cpl,
        cpmql,
        cpsql,
      });
    }
  }

  return results;
}

// ============================================================
// Country Monthly Metrics
// ============================================================

export function computeCountryMonthlyMetrics(
  leads: LeadEnriched[],
  linkedinPerf: LinkedInAdsPerformance[]
): CountryMonthlyMetrics[] {
  // Exclude demo submissions
  const filteredLeads = leads.filter(
    (l) => l.campaign_raw !== "[Demo] New submission"
  );

  // Build unique month_key + country combos
  const combos = new Map<string, { month_key: string; country: string }>();

  filteredLeads.forEach((l) => {
    if (l.month_key && l.country) {
      const key = `${l.month_key}|${l.country}`;
      if (!combos.has(key)) {
        combos.set(key, { month_key: l.month_key, country: l.country });
      }
    }
  });

  linkedinPerf.forEach((lp) => {
    if (lp.month_key && lp.country) {
      const key = `${lp.month_key}|${lp.country}`;
      if (!combos.has(key)) {
        combos.set(key, { month_key: lp.month_key, country: lp.country });
      }
    }
  });

  const results: CountryMonthlyMetrics[] = [];

  const comboValues = Array.from(combos.values());
  for (const { month_key, country } of comboValues) {
    const countryLeads = filteredLeads.filter(
      (l) => l.month_key === month_key && l.country === country
    );

    const countryLinkedin = linkedinPerf.filter(
      (lp) => lp.month_key === month_key && lp.country === country
    );

    const spend = countryLinkedin.reduce((sum, lp) => sum + lp.total_spent, 0);
    const impressions = countryLinkedin.reduce(
      (sum, lp) => sum + lp.impressions,
      0
    );
    const clicks = countryLinkedin.reduce((sum, lp) => sum + lp.clicks, 0);
    const ctr = safeDivide(clicks, impressions);

    const leadsCount = countryLeads.length;
    const mqls = countryLeads.filter(
      (l) => l.lead_status !== "Not Qualified"
    ).length;
    const sqls = countryLeads.filter((l) => l.deal_amount > 0).length;
    const pipeline = countryLeads
      .filter((l) => l.deal_amount > 0)
      .reduce((sum, l) => sum + l.deal_amount, 0);

    const cpl = safeDivide(spend, leadsCount);
    const cpmql = safeDivide(spend, mqls);
    const cpsql = safeDivide(spend, sqls);
    const cpc = safeDivide(spend, clicks);
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

    const first_meeting_set = countryLeads.filter(
      (l) =>
        l.first_meeting_set !== "Not Found" && l.first_meeting_set !== "NO"
    ).length;

    results.push({
      month_key,
      country,
      spend,
      impressions,
      clicks,
      ctr,
      leads: leadsCount,
      mqls,
      sqls,
      pipeline,
      cpl,
      cpmql,
      cpsql,
      cpc,
      cpm,
      first_meeting_set,
    });
  }

  return results;
}

// ============================================================
// Campaign Monthly Metrics
// ============================================================

export function computeCampaignMonthlyMetrics(
  leads: LeadEnriched[],
  linkedinPerf: LinkedInAdsPerformance[]
): CampaignMonthlyMetrics[] {
  // Exclude demo submissions
  const filteredLeads = leads.filter(
    (l) => l.campaign_raw !== "[Demo] New submission"
  );

  // Build unique month_key + campaign_name_normalized combos
  const combos = new Map<
    string,
    { month_key: string; campaign_name_normalized: string }
  >();

  filteredLeads.forEach((l) => {
    if (l.month_key && l.campaign_name_normalized) {
      const key = `${l.month_key}|${l.campaign_name_normalized}`;
      if (!combos.has(key)) {
        combos.set(key, {
          month_key: l.month_key,
          campaign_name_normalized: l.campaign_name_normalized,
        });
      }
    }
  });

  linkedinPerf.forEach((lp) => {
    if (lp.month_key && lp.campaign_name_ok) {
      const key = `${lp.month_key}|${lp.campaign_name_ok}`;
      if (!combos.has(key)) {
        combos.set(key, {
          month_key: lp.month_key,
          campaign_name_normalized: lp.campaign_name_ok,
        });
      }
    }
  });

  const results: CampaignMonthlyMetrics[] = [];

  const campaignComboValues = Array.from(combos.values());
  for (const { month_key, campaign_name_normalized } of campaignComboValues) {
    const campaignLeads = filteredLeads.filter(
      (l) =>
        l.month_key === month_key &&
        l.campaign_name_normalized === campaign_name_normalized
    );

    const campaignLinkedin = linkedinPerf.filter(
      (lp) =>
        lp.month_key === month_key &&
        lp.campaign_name_ok === campaign_name_normalized
    );

    const spend = campaignLinkedin.reduce(
      (sum, lp) => sum + lp.total_spent,
      0
    );
    const impressions = campaignLinkedin.reduce(
      (sum, lp) => sum + lp.impressions,
      0
    );
    const clicks = campaignLinkedin.reduce((sum, lp) => sum + lp.clicks, 0);
    const ctr = safeDivide(clicks, impressions);

    const leadsCount = campaignLeads.length;
    const mqls = campaignLeads.filter(
      (l) => l.lead_status !== "Not Qualified"
    ).length;
    const sqls = campaignLeads.filter((l) => l.deal_amount > 0).length;
    const pipeline = campaignLeads
      .filter((l) => l.deal_amount > 0)
      .reduce((sum, l) => sum + l.deal_amount, 0);

    const cpl = safeDivide(spend, leadsCount);
    const cpmql = safeDivide(spend, mqls);
    const cpsql = safeDivide(spend, sqls);

    results.push({
      month_key,
      campaign_name_normalized,
      spend,
      impressions,
      clicks,
      ctr,
      leads: leadsCount,
      mqls,
      sqls,
      pipeline,
      cpl,
      cpmql,
      cpsql,
    });
  }

  return results;
}

// ============================================================
// Forecast
// ============================================================

export function computeForecast(configs: ForecastConfig[]): ForecastRow[] {
  const results: ForecastRow[] = [];

  // Group configs by channel
  const channelGroups = new Map<string, ForecastConfig[]>();
  for (const cfg of configs) {
    const existing = channelGroups.get(cfg.channel) || [];
    existing.push(cfg);
    channelGroups.set(cfg.channel, existing);
  }

  const channelEntries = Array.from(channelGroups.entries());
  for (const [channel, channelConfigs] of channelEntries) {
    // Sort by month ascending
    const sorted = [...channelConfigs].sort((a, b) => a.month - b.month);

    let pipelineCumulative = 0;

    for (const cfg of sorted) {
      const budget = cfg.budget_amount;
      const budgetPct = cfg.budget_pct;

      // expected MQLs = budget / cpmql_historical
      const expectedMqls =
        cfg.cpmql_historical > 0 ? budget / cfg.cpmql_historical : 0;

      // expected SQLs = expected MQLs * mql_to_sql_pct
      const expectedSqls = expectedMqls * cfg.mql_to_sql_pct;

      // pipeline forecast = expected SQLs * avg_pipe_per_sql
      const pipelineForecast = expectedSqls * cfg.avg_pipe_per_sql;

      pipelineCumulative += pipelineForecast;

      const monthIndex = cfg.month - 1;
      const monthName =
        monthIndex >= 0 && monthIndex < 12
          ? MONTH_NAMES_VAL[monthIndex]
          : `Month ${cfg.month}`;

      results.push({
        month: cfg.month,
        month_name: monthName,
        channel,
        budget,
        budget_pct: budgetPct,
        expected_mqls: Math.round(expectedMqls * 100) / 100,
        expected_sqls: Math.round(expectedSqls * 100) / 100,
        pipeline_forecast: Math.round(pipelineForecast * 100) / 100,
        pipeline_cumulative: Math.round(pipelineCumulative * 100) / 100,
      });
    }
  }

  return results;
}
