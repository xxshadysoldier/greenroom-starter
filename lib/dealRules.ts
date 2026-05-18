/**
 * Per-deal-type rules for the entry form.
 *
 * One form, adaptive fields. The user picks a deal type first; this module
 * decides which sections render, which fields are required, what the
 * percentage basis is locked to, and whether the recoup bucket question
 * is even a question.
 *
 * Source of truth for: deal-types-and-fields.md.
 *
 * Everything here is pure — no DB, no JSX. Consumed by both the client
 * form (for visibility + live readiness math) and the server action (for
 * authoritative validation).
 */

import type {
  Deal,
  DealRecoup,
  DeductionStage,
  CompRules,
  WalkoutPot,
  Bonus,
} from "@/db/schema";

export type DealType = Deal["dealType"];

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  flat: "Flat",
  vs: "Vs deal",
  percentage_of_net: "% of net",
  percentage_of_gross: "% of gross",
  door: "Door",
};

export const DEAL_TYPE_BADGE: Record<
  DealType,
  "default" | "amber" | "brand" | "rose" | "sky"
> = {
  flat: "default",
  vs: "brand",
  percentage_of_net: "sky",
  percentage_of_gross: "amber",
  door: "rose",
};

/**
 * Percentage basis is locked per deal type. The form never asks.
 * Flat is null (no percentage at all).
 */
export const BASIS_FOR: Record<DealType, "gross" | "net" | "door" | null> = {
  flat: null,
  vs: "net",
  percentage_of_net: "net",
  percentage_of_gross: "gross",
  door: "door",
};

export const BASIS_LABEL: Record<DealType, string> = {
  flat: "n/a · no percentage",
  vs: "Net · after expenses",
  percentage_of_net: "Net · after expenses",
  percentage_of_gross: "Gross box office",
  door: "Door cash",
};

/** Which sections of the form render for each deal type. */
export type SectionVisibility = {
  guarantee: boolean; // visible at all
  guaranteeRequired: boolean;
  percentage: boolean;
  caps: boolean; // expense + hospitality cap row
  recoups: boolean;
  recoupBucketChoice: boolean; // false → auto-resolved to off-top
  deductionOrder: boolean;
  compRules: boolean;
  walkoutPot: boolean;
  bonuses: boolean;
  sourceEmail: boolean;
};

export function visibilityFor(type: DealType): SectionVisibility {
  switch (type) {
    case "flat":
      return {
        guarantee: true,
        guaranteeRequired: true,
        percentage: false,
        caps: false,
        recoups: false, // rare; we hide for v1
        recoupBucketChoice: false,
        deductionOrder: false,
        compRules: true,
        walkoutPot: false,
        bonuses: true,
        sourceEmail: true,
      };
    case "vs":
      return {
        guarantee: true,
        guaranteeRequired: true,
        percentage: true,
        caps: true,
        recoups: true,
        recoupBucketChoice: true,
        deductionOrder: true,
        compRules: true,
        walkoutPot: false,
        bonuses: true,
        sourceEmail: true,
      };
    case "percentage_of_net":
      return {
        guarantee: false,
        guaranteeRequired: false,
        percentage: true,
        caps: true,
        recoups: true,
        recoupBucketChoice: true,
        deductionOrder: true,
        compRules: true,
        walkoutPot: false,
        bonuses: true,
        sourceEmail: true,
      };
    case "percentage_of_gross":
      return {
        guarantee: false,
        guaranteeRequired: false,
        percentage: true,
        caps: false,
        recoups: true,
        recoupBucketChoice: false, // auto-resolves to off-top
        deductionOrder: true, // simplified 3-stage
        compRules: true,
        walkoutPot: false,
        bonuses: true,
        sourceEmail: true,
      };
    case "door":
      return {
        guarantee: true, // optional
        guaranteeRequired: false,
        percentage: true,
        caps: false,
        recoups: true,
        recoupBucketChoice: false,
        deductionOrder: true,
        compRules: true,
        walkoutPot: true,
        bonuses: true,
        sourceEmail: true,
      };
  }
}

/**
 * Default deduction order for a deal type. Used when first picking a type.
 * Vs/Net get the full 5 stages; gross/door get a simplified 3.
 */
export function defaultDeductionOrder(type: DealType): DeductionStage[] {
  switch (type) {
    case "vs":
    case "percentage_of_net":
      return [
        "fees",
        "off_top_recoups",
        "expenses",
        "in_cap_recoups",
        "artist_split",
      ];
    case "percentage_of_gross":
    case "door":
      return ["fees", "off_top_recoups", "artist_split"];
    case "flat":
      return [];
  }
}

export const STAGE_LABEL: Record<DeductionStage, string> = {
  fees: "Ticketing fees",
  off_top_recoups: "Off-top recoups",
  expenses: "Show expenses (in cap)",
  in_cap_recoups: "In-cap recoups",
  artist_split: "Artist split",
};

export const STAGE_DESC: Record<DeductionStage, string> = {
  fees: "facility, convenience · auto-pulled from ticketing",
  off_top_recoups: "off the gross before split",
  expenses: "production, sound, lights, hospitality",
  in_cap_recoups: "included inside the expense cap",
  artist_split: "% of the remainder",
};

export const DEFAULT_COMP_RULES: CompRules = {
  artist_gl: false,
  label: false,
  press: false,
  venue_staff: false,
  sponsor: false,
  promo: false,
  other: false,
};

export const COMP_CATEGORY_LABEL: Record<keyof CompRules, string> = {
  artist_gl: "Artist guest list",
  label: "Label · management",
  press: "Press",
  venue_staff: "Venue staff",
  sponsor: "Sponsor",
  promo: "Promo · radio",
  other: "Other",
};

export const RECOUP_CATEGORY_LABEL: Record<DealRecoup["category"], string> = {
  marketing: "Marketing",
  hospitality_overage: "Hospitality overage",
  production_overage: "Production overage",
  prior_advance: "Prior advance",
  damages: "Damages",
  other: "Other",
};

export const DEFAULT_WALKOUT_POT: WalkoutPot = {
  floor: 0,
  splitPct: 1.0,
  paysOut: "same_night_cash",
};

// ─────────────────────────────────────────────────────────────────────────
// Readiness math
// ─────────────────────────────────────────────────────────────────────────

/**
 * The shape the form holds in client state. Server action takes the same.
 */
export type DealFormState = {
  dealType: DealType;
  guaranteeAmount: number | null;
  // percentage stored as 0–1 to match schema (e.g. 0.85 not 85)
  percentage: number | null;
  expenseCap: number | null;
  hospitalityCap: number | null;
  recoups: DealRecoup[];
  deductionOrder: DeductionStage[];
  compRules: CompRules;
  walkoutPot: WalkoutPot | null;
  bonuses: Bonus[];
  sourceEmail: string;
  dealNotesFreetext: string;
};

/** A single thing the user still needs to fill in. */
export type MissingItem = { key: string; label: string };

/**
 * Walk the form state against the rules and return what's still missing.
 * Anything in the returned list blocks the Send-for-sign-off button.
 */
export function findMissing(state: DealFormState): MissingItem[] {
  const vis = visibilityFor(state.dealType);
  const missing: MissingItem[] = [];

  if (
    vis.guaranteeRequired &&
    (state.guaranteeAmount == null || state.guaranteeAmount <= 0)
  ) {
    missing.push({ key: "guarantee", label: "Guarantee amount" });
  }
  if (
    vis.percentage &&
    (state.percentage == null || state.percentage <= 0 || state.percentage > 1)
  ) {
    missing.push({ key: "percentage", label: "Percentage" });
  }

  // Recoups: every entry must have a label and amount. On vs/net, bucket
  // + applies-at are required. On gross/door they're auto-resolved.
  state.recoups.forEach((r, i) => {
    const idx = String(i + 1).padStart(2, "0");
    if (!r.label.trim()) {
      missing.push({ key: `recoup-${i}-label`, label: `Recoup ${idx} · label` });
    }
    if (r.amount <= 0) {
      missing.push({
        key: `recoup-${i}-amount`,
        label: `Recoup ${idx} · amount`,
      });
    }
    if (vis.recoupBucketChoice && !r.bucket) {
      missing.push({
        key: `recoup-${i}-bucket`,
        label: `Recoup ${idx} · bucket`,
      });
    }
    if (vis.recoupBucketChoice && !r.appliesAt) {
      missing.push({
        key: `recoup-${i}-applies`,
        label: `Recoup ${idx} · applies-at`,
      });
    }
  });

  // Walkout pot on Door — floor, splitPct, paysOut all required
  if (vis.walkoutPot) {
    const wp = state.walkoutPot;
    if (!wp) {
      missing.push({ key: "walkout", label: "Walkout pot · all fields" });
    } else {
      if (wp.floor < 0) {
        missing.push({ key: "walkout-floor", label: "Walkout pot · floor" });
      }
      if (wp.splitPct <= 0 || wp.splitPct > 1) {
        missing.push({ key: "walkout-split", label: "Walkout pot · split %" });
      }
    }
  }

  // Bonus entries: if the user added one, its required fields must be filled.
  // Bonuses themselves are optional, but a partially-filled bonus row is not.
  state.bonuses.forEach((b, i) => {
    const idx = String(i + 1).padStart(2, "0");
    if (!b.amount || b.amount <= 0) {
      missing.push({ key: `bonus-${i}-amount`, label: `Bonus ${idx} · amount` });
    }
    if (b.type === "gross_threshold" && (!b.threshold || b.threshold <= 0)) {
      missing.push({
        key: `bonus-${i}-threshold`,
        label: `Bonus ${idx} · gross threshold`,
      });
    }
    if (b.type === "attendance_threshold" && (!b.threshold || b.threshold <= 0)) {
      missing.push({
        key: `bonus-${i}-threshold`,
        label: `Bonus ${idx} · attendance threshold`,
      });
    }
  });

  // Source email — the agent's original message. Required across all deal
  // types because the agent's sign-off page renders it collapsed below the
  // structured recap, and the absence of any source material makes the deal
  // feel like it came from nowhere. Tiny shows can paste a 1-line email; the
  // form just requires *something*.
  if (vis.sourceEmail && state.sourceEmail.trim().length < 10) {
    missing.push({
      key: "source-email",
      label: "Source · agent email (or short note)",
    });
  }

  return missing;
}

/**
 * Total expected required fields for a deal type — used to render the
 * "14 / 21 required complete" ticker. Counted by walking a fully-empty
 * state through findMissing + the bookkeeping fields the form always
 * exposes.
 */
export function totalRequiredFor(type: DealType): number {
  const vis = visibilityFor(type);
  // dealType itself (1) + the conditional required fields. Recoups +
  // bonuses are counted dynamically per row, so we ignore them in the
  // floor count.
  let n = 1;
  if (vis.guaranteeRequired) n += 1;
  if (vis.percentage) n += 1;
  if (vis.walkoutPot) n += 3; // floor / split / paysOut
  if (vis.sourceEmail) n += 1; // source email — universal across all types
  return n;
}

/**
 * Count of currently-completed required fields. The total grows with
 * each added recoup, so we use a single function for both numerator
 * and denominator to keep them in sync.
 */
export function readiness(state: DealFormState): {
  done: number;
  total: number;
  missing: MissingItem[];
} {
  const vis = visibilityFor(state.dealType);
  const missing = findMissing(state);

  // total = base required for the type + 1 per recoup * (slots per recoup)
  const perRecoupSlots = vis.recoupBucketChoice ? 4 : 2;
  const total = totalRequiredFor(state.dealType) + state.recoups.length * perRecoupSlots;
  const done = total - missing.length;
  return { done, total, missing };
}

// ─────────────────────────────────────────────────────────────────────────
// Hydration helpers — read existing rows from the DB into form state
// ─────────────────────────────────────────────────────────────────────────

export function hydrateForm(deal: Deal | null | undefined): DealFormState {
  if (!deal) {
    return blankForm("vs");
  }
  return {
    dealType: deal.dealType,
    guaranteeAmount: deal.guaranteeAmount,
    percentage: deal.percentage,
    expenseCap: deal.expenseCap,
    hospitalityCap: deal.hospitalityCap,
    recoups: parseJsonArray<DealRecoup>(deal.recoupsJson),
    deductionOrder: parseJsonArray<DeductionStage>(
      deal.deductionOrderJson,
    ).length
      ? parseJsonArray<DeductionStage>(deal.deductionOrderJson)
      : defaultDeductionOrder(deal.dealType),
    compRules: parseJsonObject<CompRules>(deal.compRulesJson, DEFAULT_COMP_RULES),
    walkoutPot: deal.walkoutPotJson
      ? parseJsonObject<WalkoutPot | null>(deal.walkoutPotJson, null)
      : null,
    bonuses: parseJsonArray<Bonus>(deal.bonusesJson),
    sourceEmail: deal.sourceEmail ?? "",
    dealNotesFreetext: deal.dealNotesFreetext ?? "",
  };
}

export function blankForm(type: DealType): DealFormState {
  const vis = visibilityFor(type);
  return {
    dealType: type,
    guaranteeAmount: null,
    percentage: null,
    expenseCap: null,
    hospitalityCap: null,
    recoups: [],
    deductionOrder: defaultDeductionOrder(type),
    compRules: { ...DEFAULT_COMP_RULES },
    walkoutPot: vis.walkoutPot ? { ...DEFAULT_WALKOUT_POT } : null,
    bonuses: [],
    sourceEmail: "",
    dealNotesFreetext: "",
  };
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}
