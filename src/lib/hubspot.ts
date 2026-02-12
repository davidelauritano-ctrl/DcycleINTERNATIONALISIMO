const HUBSPOT_BASE_URL = "https://api.hubapi.com";

function getHeaders(): HeadersInit {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN not configured");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

interface HubSpotSearchResponse<T> {
  results: T[];
  paging?: { next?: { after: string } };
}

async function fetchAllPages<T>(
  url: string,
  properties: string[],
  limit = 100
): Promise<T[]> {
  const allResults: T[] = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = {
      limit,
      properties,
      ...(after ? { after } : {}),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HubSpot API error ${res.status}: ${errText}`);
    }

    const data: HubSpotSearchResponse<T> = await res.json();
    allResults.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return allResults;
}

export interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    hs_lead_status?: string;
    associatedcompanyid?: string;
    num_employees?: string;
    hs_analytics_source?: string;
    first_email_date?: string;
    hubspot_owner_id?: string;
    company?: string;
    industry?: string;
    recent_deal_amount?: string;
    meeting_date?: string;
    utm_campaign?: string;
    lead_source?: string;
    lead_origin_multiple?: string;
    original_traffic_source?: string;
    linkedin_company_page?: string;
  };
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    dealstage?: string;
    closedate?: string;
    hubspot_owner_id?: string;
    amount?: string;
    hs_is_closed_won?: string;
    hs_is_closed_lost?: string;
    notes_last_updated?: string;
  };
  associations?: {
    contacts?: { results: Array<{ id: string }> };
    companies?: { results: Array<{ id: string }> };
  };
}

const CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "hs_lead_status",
  "associatedcompanyid",
  "num_employees",
  "hs_analytics_source",
  "first_email_date",
  "hubspot_owner_id",
  "company",
  "industry",
  "recent_deal_amount",
  "meeting_date",
  "utm_campaign",
  "lead_source",
  "lead_origin_multiple",
  "original_traffic_source",
  "linkedin_company_page",
];

const DEAL_PROPERTIES = [
  "dealname",
  "dealstage",
  "closedate",
  "hubspot_owner_id",
  "amount",
  "hs_is_closed_won",
  "hs_is_closed_lost",
];

export async function fetchContacts(): Promise<HubSpotContact[]> {
  return fetchAllPages<HubSpotContact>(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
    CONTACT_PROPERTIES
  );
}

export async function fetchDeals(): Promise<HubSpotDeal[]> {
  const allDeals: HubSpotDeal[] = [];
  let after: string | undefined;

  do {
    const params = new URLSearchParams({
      limit: "100",
      ...(after ? { after } : {}),
    });
    DEAL_PROPERTIES.forEach((p) => params.append("properties", p));
    params.append("associations", "contacts");
    params.append("associations", "companies");

    const res = await fetch(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/deals?${params.toString()}`,
      { method: "GET", headers: getHeaders() }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HubSpot API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    allDeals.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return allDeals;
}
