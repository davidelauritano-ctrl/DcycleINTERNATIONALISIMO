import { NextResponse } from "next/server";
import { fetchContacts, fetchDeals } from "@/lib/hubspot";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST() {
  try {
    const supabase = getServiceSupabase();

    // ── Fetch & upsert contacts ──────────────────────────────
    const hubspotContacts = await fetchContacts();

    const contactRows = hubspotContacts.map((c) => {
      const p = c.properties;
      return {
        hubspot_record_id: parseInt(c.id, 10),
        first_name: p.firstname ?? null,
        last_name: p.lastname ?? null,
        email: p.email ?? null,
        phone: p.phone ?? null,
        lead_status: p.hs_lead_status ?? null,
        associated_company_id: p.associatedcompanyid
          ? parseInt(p.associatedcompanyid, 10)
          : null,
        num_employees: p.num_employees
          ? parseInt(p.num_employees, 10)
          : null,
        original_traffic_source: p.hs_analytics_source ?? null,
        first_email_date: p.first_email_date ?? null,
        contact_owner: p.hubspot_owner_id ?? null,
        company_name: p.company ?? null,
        company_industry: p.industry ?? null,
        recent_deal_amount: p.recent_deal_amount
          ? parseFloat(p.recent_deal_amount)
          : null,
        meeting_date: p.meeting_date ?? null,
        utm_campaign: p.utm_campaign ?? null,
        lead_source: p.lead_source ?? null,
        lead_origin_multiple: p.lead_origin_multiple ?? null,
        linkedin_company_url: p.linkedin_company_page ?? null,
        synced_at: new Date().toISOString(),
      };
    });

    // Upsert in batches of 500 to avoid payload limits
    const BATCH_SIZE = 500;
    for (let i = 0; i < contactRows.length; i += BATCH_SIZE) {
      const batch = contactRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("contacts")
        .upsert(batch, { onConflict: "hubspot_record_id" });

      if (error) {
        throw new Error(`Contacts upsert error (batch ${i}): ${error.message}`);
      }
    }

    // ── Fetch & upsert deals ─────────────────────────────────
    const hubspotDeals = await fetchDeals();

    const dealRows = hubspotDeals.map((d) => {
      const p = d.properties;

      const parseBool = (val: string | undefined): boolean => {
        if (!val) return false;
        return val.toLowerCase() === "true" || val === "1";
      };

      return {
        hubspot_record_id: parseInt(d.id, 10),
        deal_name: p.dealname ?? "",
        deal_stage: p.dealstage ?? null,
        close_date: p.closedate ?? null,
        deal_owner: p.hubspot_owner_id ?? null,
        amount: p.amount ? parseFloat(p.amount) : 0,
        is_closed_won: parseBool(p.hs_is_closed_won),
        is_closed_lost: parseBool(p.hs_is_closed_lost),
        associated_contact_id:
          d.associations?.contacts?.results?.[0]?.id
            ? parseInt(d.associations.contacts.results[0].id, 10)
            : null,
        associated_company_id:
          d.associations?.companies?.results?.[0]?.id
            ? parseInt(d.associations.companies.results[0].id, 10)
            : null,
        synced_at: new Date().toISOString(),
      };
    });

    for (let i = 0; i < dealRows.length; i += BATCH_SIZE) {
      const batch = dealRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("deals")
        .upsert(batch, { onConflict: "hubspot_record_id" });

      if (error) {
        throw new Error(`Deals upsert error (batch ${i}): ${error.message}`);
      }
    }

    return NextResponse.json({
      contacts_synced: contactRows.length,
      deals_synced: dealRows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("HubSpot sync error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
