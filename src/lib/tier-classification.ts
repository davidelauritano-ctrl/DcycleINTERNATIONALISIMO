/**
 * Classifies a company into a tier based on number of employees.
 *
 * Thresholds:
 *   > 5500  -> ENTERPRISE
 *   > 1500  -> TIER 1
 *   > 500   -> TIER 2
 *   > 250   -> TIER 3
 *   <= 250  -> TIER 4
 *   null    -> TIER 4
 */
export function classifyTier(numEmployees: number | null): string {
  if (numEmployees === null || numEmployees === undefined) return "TIER 4";
  if (numEmployees > 5500) return "ENTERPRISE";
  if (numEmployees > 1500) return "TIER 1";
  if (numEmployees > 500) return "TIER 2";
  if (numEmployees > 250) return "TIER 3";
  return "TIER 4";
}
