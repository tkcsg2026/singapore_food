export type PlanTier = "basic" | "standard" | "premium";

export interface PlanConfig {
  tier: PlanTier;
  /** Numeric weight used for sorting — higher = higher priority */
  weight: number;
  labelEn: string;
  labelJa: string;
  /** Optional short badge label (e.g. "Most Popular") — shown in addition to plan name */
  badgeLabelEn?: string;
  badgeLabelJa?: string;
  /** Tailwind classes for the badge */
  badgeClass: string;
  /** Tailwind border + shadow classes applied to the card */
  borderClass: string;
  /** Extra wrapper classes: size, elevation (e.g. premium = larger, deeper shadow) */
  cardWrapperClass: string;
  /** Title font: larger + bold for premium, medium for basic */
  titleClass: string;
  /** CTA (View Details button) style: prominent for premium, subtle for basic */
  ctaClass: string;
  /** Show WhatsApp button (basic hides it to encourage upgrade) */
  showWhatsApp: boolean;
  /** Max product images shown on detail page */
  maxProducts: number;
  /** Logo/image size on card — Tailwind width/height class (e.g. w-14 h-14) */
  cardImageSize: string;
  /** Featured badge label shown on premium cards (English) */
  featuredLabelEn?: string;
  /** Featured badge label shown on premium cards (Japanese) */
  featuredLabelJa?: string;
  /** CSS class for top accent bar on card */
  accentBarClass?: string;
  /** CSS class for logo ring (premium glow) */
  logoRingClass?: string;
  /** Subtle card background class */
  cardBgClass?: string;
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  premium: {
    tier: "premium",
    weight: 3,
    labelEn: "Premium",
    labelJa: "プレミアム",
    badgeLabelEn: "Trusted supplier",
    badgeLabelJa: "信頼できるサプライヤー",
    badgeClass:
      "premium-badge-shimmer bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/40 dark:to-amber-800/30 text-amber-800 dark:text-amber-200 border border-amber-300/80 dark:border-amber-600/60 font-bold shadow-sm",
    borderClass: "border border-amber-300/60 dark:border-amber-600/50",
    cardWrapperClass: "shadow-lg shadow-amber-200/30 dark:shadow-amber-900/30 ring-1 ring-amber-200/40 dark:ring-amber-700/30",
    titleClass: "text-base font-bold",
    ctaClass: "bg-primary text-primary-foreground border-primary hover:bg-primary/90 font-bold h-10 text-sm",
    showWhatsApp: true,
    maxProducts: 12,
    cardImageSize: "w-20 h-20",
    accentBarClass: "h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400",
    logoRingClass: "ring-2 ring-amber-300/70 dark:ring-amber-600/50",
    cardBgClass: "bg-gradient-to-b from-amber-50/40 via-card to-card dark:from-amber-950/20",
  },
  standard: {
    tier: "standard",
    weight: 2,
    labelEn: "Standard",
    labelJa: "スタンダード",
    badgeLabelEn: "Recommended",
    badgeLabelJa: "おすすめ",
    badgeClass:
      "bg-primary/10 text-primary border border-primary/40 dark:bg-primary/20 dark:text-primary dark:border-primary/50 font-semibold",
    borderClass: "border-2 border-primary/50",
    cardWrapperClass: "shadow-md shadow-primary/10 dark:shadow-primary/20",
    titleClass: "text-[15px] font-semibold",
    ctaClass: "border-primary text-primary hover:bg-primary/10 font-semibold h-9 text-sm",
    showWhatsApp: true,
    maxProducts: 6,
    cardImageSize: "w-16 h-16",
  },
  basic: {
    tier: "basic",
    weight: 1,
    labelEn: "Basic",
    labelJa: "ベーシック",
    badgeClass: "bg-muted text-muted-foreground border border-border",
    borderClass: "border border-border",
    cardWrapperClass: "shadow-sm",
    titleClass: "text-sm font-medium",
    ctaClass: "border-border text-muted-foreground hover:bg-muted hover:text-foreground h-9 text-xs font-medium",
    showWhatsApp: false,
    maxProducts: 3,
    cardImageSize: "w-12 h-12",
  },
};

export function getPlanConfig(plan?: string | null): PlanConfig {
  return PLANS[(plan as PlanTier) ?? "basic"] ?? PLANS.basic;
}

/**
 * Mulberry32 — deterministic PRNG seeded with an integer.
 * Returns values in [0, 1).
 */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a seed integer derived from today's local date string (YYYY-MM-DD).
 * Changes every day at midnight → different shuffle every day.
 */
export function dailySeed(): number {
  const dateStr = new Date().toLocaleDateString("en-CA"); // "2024-06-15"
  return dateStr.split("-").reduce((acc, part) => acc * 1000 + parseInt(part, 10), 0);
}

/** Fisher-Yates shuffle using a seeded PRNG — same seed → same order. */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Sorts suppliers by plan tier (premium first), featured first within each tier,
 * then shuffles within featured and within non-featured using today's date as seed.
 */
export function sortSuppliersByPlan<T extends { plan?: string | null; featured?: boolean }>(
  suppliers: T[]
): T[] {
  const premium = suppliers.filter((s) => s.plan === "premium");
  const standard = suppliers.filter((s) => s.plan === "standard");
  const basic = suppliers.filter((s) => !s.plan || s.plan === "basic");

  const seed = dailySeed();
  const sortTier = (tier: T[], baseSeed: number) => {
    const featured = tier.filter((s) => s.featured);
    const rest = tier.filter((s) => !s.featured);
    return [
      ...seededShuffle(featured, baseSeed),
      ...seededShuffle(rest, baseSeed + 1),
    ];
  };

  return [
    ...sortTier(premium, seed),
    ...sortTier(standard, seed + 10),
    ...sortTier(basic, seed + 20),
  ];
}
