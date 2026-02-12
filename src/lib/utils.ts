import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyDecimal(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function getMonthKey(date: Date): string {
  return `${date.getMonth() + 1}_${date.getFullYear()}`;
}

export function parseMonthKey(monthKey: string): { month: number; year: number } {
  const [month, year] = monthKey.split("_").map(Number);
  return { month, year };
}

export function monthKeyToLabel(monthKey: string): string {
  const { month, year } = parseMonthKey(monthKey);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[month - 1]} ${year}`;
}

export function sortMonthKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const aP = parseMonthKey(a);
    const bP = parseMonthKey(b);
    if (aP.year !== bP.year) return aP.year - bP.year;
    return aP.month - bP.month;
  });
}

export function classifyTier(numEmployees: number | null): string {
  if (numEmployees === null || numEmployees === undefined) return "TIER 4";
  if (numEmployees > 5500) return "ENTERPRISE";
  if (numEmployees > 1500) return "TIER 1";
  if (numEmployees > 500) return "TIER 2";
  if (numEmployees > 250) return "TIER 3";
  return "TIER 4";
}

export function determineCampaign(
  utmCampaign: string | null,
  leadOriginMultiple: string | null,
  originalTrafficSource: string | null
): string | null {
  if (utmCampaign && utmCampaign.trim()) return utmCampaign.trim();
  if (leadOriginMultiple && leadOriginMultiple.trim()) return leadOriginMultiple.trim();
  return originalTrafficSource?.trim() || null;
}

export function tierColor(tier: string): string {
  switch (tier) {
    case "ENTERPRISE":
      return "bg-purple-600 text-white";
    case "TIER 1":
      return "bg-emerald-600 text-white";
    case "TIER 2":
      return "bg-blue-600 text-white";
    case "TIER 3":
      return "bg-yellow-600 text-white";
    case "TIER 4":
      return "bg-gray-600 text-white";
    default:
      return "bg-gray-500 text-white";
  }
}
