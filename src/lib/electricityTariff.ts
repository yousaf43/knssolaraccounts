/**
 * Pakistan electricity (DISCO / NEPRA uniform) tariff used for proposal payback.
 * Base rates are NEPRA "GoP applicable" uniform rates (Jan 2026). The live copy is
 * stored in the database and refreshed automatically by the `electricity-tariff`
 * server function; these defaults are only a fallback.
 */

export type TariffCategory = "domestic" | "commercial" | "industrial" | "agricultural";
export type TariffChoice = TariffCategory | "auto";

export type DomesticSlab = { upTo: number | null; rate: number; fixed: number };

export type TariffRates = {
  domesticProtected: DomesticSlab[];
  domesticUnprotected: DomesticSlab[];
  commercial: number;
  industrial: number;
  agricultural: number;
  /** Fuel price adjustment + quarterly adjustment, PKR per unit */
  fpa: number;
  /** GST percent */
  gst: number;
  /** Electricity duty percent of energy charge */
  electricityDuty: number;
  /** Rate DISCO pays for exported units under net metering, PKR per unit */
  exportRate: number;
};

export type TariffRecord = {
  rates: TariffRates;
  source: string;
  effectiveLabel: string;
  updatedAt: string;
};

export const DEFAULT_TARIFF: TariffRecord = {
  rates: {
    domesticProtected: [
      { upTo: 100, rate: 10.54, fixed: 0 },
      { upTo: 200, rate: 13.01, fixed: 0 },
    ],
    domesticUnprotected: [
      { upTo: 100, rate: 22.44, fixed: 0 },
      { upTo: 200, rate: 28.91, fixed: 0 },
      { upTo: 300, rate: 33.1, fixed: 0 },
      { upTo: 400, rate: 37.99, fixed: 200 },
      { upTo: 500, rate: 40.2, fixed: 400 },
      { upTo: 600, rate: 41.62, fixed: 600 },
      { upTo: 700, rate: 42.76, fixed: 800 },
      { upTo: null, rate: 47.69, fixed: 1000 },
    ],
    commercial: 45.43,
    industrial: 33.48,
    agricultural: 31.0,
    fpa: 2.0,
    gst: 18,
    electricityDuty: 1.5,
    exportRate: 10,
  },
  source: "NEPRA uniform tariff (built-in)",
  effectiveLabel: "Jan 2026",
  updatedAt: "2026-01-12",
};

export const CATEGORY_LABEL: Record<TariffCategory, string> = {
  domestic: "Domestic (Residential)",
  commercial: "Commercial",
  industrial: "Industrial",
  agricultural: "Agricultural (Tube-well)",
};

const KEYWORDS: [TariffCategory, RegExp][] = [
  ["agricultural", /\b(tube[\s-]?well|tubewell|farm|farms|agri\w*|zarai|khet|dera|orchard|nursery|irrigation|livestock|dairy farm)\b/i],
  ["industrial", /\b(mill|mills|factory|industr\w*|plant|cold storage|ice factory|textile|steel|foundry|manufactur\w*|processing|weaving|poultry)\b/i],
  ["commercial", /\b(shop|store|plaza|market|mall|mart|hospital|medical|clinic|pharmacy|school|college|academy|universit\w*|hotel|restaurant|cafe|office|bank|petrol|filling station|traders|trading|enterprises?|center|centre|complex|showroom|bakery|marriage hall|mosque|masjid|madrasa)\b/i],
];

/** Guess the customer's electricity category from their name/address and system size. */
export function detectCategory(p: {
  customerName?: string;
  companyName?: string;
  address?: string;
  systemKw?: number;
  monthlyUnits?: number[];
}): { category: TariffCategory; reason: string } {
  const text = [p.companyName, p.customerName, p.address].filter(Boolean).join(" ");
  for (const [cat, re] of KEYWORDS) {
    const m = text.match(re);
    if (m) return { category: cat, reason: `name/address mentions "${m[0]}"` };
  }
  const kw = Number(p.systemKw) || 0;
  const units = (p.monthlyUnits || []).map((u) => Number(u) || 0);
  const avg = units.length ? units.reduce((a, b) => a + b, 0) / units.length : 0;
  if (kw >= 40 || avg >= 5000) return { category: "industrial", reason: `large load (${kw} kW, ~${Math.round(avg)} units/month)` };
  if (kw >= 20 || avg >= 2000) return { category: "commercial", reason: `high load (${kw} kW, ~${Math.round(avg)} units/month)` };
  return { category: "domestic", reason: "home-size load" };
}

export function resolveCategory(choice: TariffChoice | undefined, p: Parameters<typeof detectCategory>[0]) {
  if (choice && choice !== "auto") return { category: choice, reason: "selected manually" };
  return detectCategory(p);
}

/** Monthly bill in PKR (energy + FPA + duty + GST) for a number of units. */
export function monthlyBill(units: number, category: TariffCategory, r: TariffRates): number {
  const u = Math.max(0, Math.round(units));
  if (u === 0) return 0;
  let energy = 0;
  let fixed = 0;
  if (category === "domestic") {
    if (u <= 200) {
      // Up to 200 units: telescopic slabs (first 100 at slab-1, rest at slab-2)
      let prev = 0;
      for (const s of r.domesticUnprotected) {
        const cap = s.upTo ?? Infinity;
        if (u <= prev) break;
        energy += (Math.min(u, cap) - prev) * s.rate;
        prev = cap;
        if (cap >= 200) break;
      }
    } else {
      // Above 200 units: all units at the slab reached (non-telescopic) + slab fixed charge
      const slab = r.domesticUnprotected.find((s) => s.upTo === null || u <= s.upTo) ?? r.domesticUnprotected[r.domesticUnprotected.length - 1];
      energy = u * slab.rate;
      fixed = slab.fixed;
    }
  } else {
    energy = u * r[category];
  }
  const fpa = u * r.fpa;
  const duty = energy * (r.electricityDuty / 100);
  const beforeTax = energy + fixed + fpa + duty;
  return beforeTax * (1 + r.gst / 100);
}

export type SavingsResult = {
  category: TariffCategory;
  billBefore: number[];
  billAfter: number[];
  exportCredit: number[];
  yearSave: number;
  monthSave: number;
  /** Average all-in PKR per unit the customer pays today */
  avgRate: number;
};

/**
 * Savings per month: bill without solar − bill with solar (only the units still
 * bought from the grid) + credit for exported units when net metering is on.
 * When usage is unknown, generation is valued at a typical bill's all-in rate.
 */
export function computeSavings(
  monthlyUnits: number[],
  genMonthly: number[],
  category: TariffCategory,
  r: TariffRates,
  netMetering: boolean
): SavingsResult {
  const usage = Array.from({ length: 12 }, (_, i) => Math.max(0, Number(monthlyUnits[i]) || 0));
  const hasUsage = usage.some((u) => u > 0);
  if (!hasUsage) {
    const typical = category === "domestic" ? 500 : 2000;
    const rate = monthlyBill(typical, category, r) / typical;
    const before = genMonthly.map((g) => g * rate);
    const yearSave = Math.round(before.reduce((a, b) => a + b, 0));
    return { category, billBefore: before, billAfter: genMonthly.map(() => 0), exportCredit: genMonthly.map(() => 0), yearSave, monthSave: Math.round(yearSave / 12), avgRate: rate };
  }
  const billBefore = usage.map((u) => monthlyBill(u, category, r));
  const billAfter = usage.map((u, i) => monthlyBill(Math.max(0, u - (genMonthly[i] || 0)), category, r));
  const exportCredit = usage.map((u, i) => (netMetering ? Math.max(0, (genMonthly[i] || 0) - u) * r.exportRate : 0));
  const yearSave = Math.round(billBefore.reduce((a, b, i) => a + b - billAfter[i] + exportCredit[i], 0));
  const totalUnits = usage.reduce((a, b) => a + b, 0);
  const avgRate = billBefore.reduce((a, b) => a + b, 0) / totalUnits;
  return { category, billBefore, billAfter, exportCredit, yearSave, monthSave: Math.round(yearSave / 12), avgRate };
}

/** Basic sanity check for rates coming from the server. */
export function isValidRates(r: unknown): r is TariffRates {
  if (!r || typeof r !== "object") return false;
  const x = r as TariffRates;
  const ok = (n: unknown, lo: number, hi: number) => typeof n === "number" && n >= lo && n <= hi;
  const slabsOk = (s: unknown) => Array.isArray(s) && s.length > 0 && s.every((v) => v && ok(v.rate, 1, 200));
  return slabsOk(x.domesticProtected) && slabsOk(x.domesticUnprotected) && ok(x.commercial, 5, 200) && ok(x.industrial, 5, 200) && ok(x.agricultural, 3, 200) && ok(x.fpa, -20, 30) && ok(x.gst, 0, 40) && ok(x.electricityDuty, 0, 10) && ok(x.exportRate, 0, 100);
}
