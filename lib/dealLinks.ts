/**
 * Magic-link mechanics for deal sign-off and tour-manager view.
 *
 * One module owns token shape, URL building, lifecycle predicates, and
 * the DB ops for creating + invalidating links. Routes + server actions
 * call into here so the rules live in one place.
 */

import { randomBytes } from "crypto";
import { db } from "@/db";
import { dealLinks, type DealLink } from "@/db/schema";
import { and, eq, isNull, gt, desc, inArray } from "drizzle-orm";

export const LINK_LIFETIME_DAYS = 14;

/** App URL for building magic-link URLs. Falls back to localhost in dev. */
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** 32-char URL-safe random token. */
export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function buildLinkUrl(link: Pick<DealLink, "token" | "role">): string {
  const path = link.role === "sign" ? "sign" : "view";
  return `${APP_URL}/${path}/${link.token}`;
}

export function isExpired(link: Pick<DealLink, "expiresAt">): boolean {
  return link.expiresAt.getTime() < Date.now();
}

/** A link counts as "active" if it can still do its job. */
export function isActive(link: DealLink): boolean {
  return !link.invalidatedAt && !link.consumedAt && !isExpired(link);
}

export type DealLinkStatus =
  | "sent"
  | "opened"
  | "signed"
  | "declined"
  | "expired"
  | "invalidated";

/**
 * Derived status for the rail timeline. We don't yet model the difference
 * between "signed" and "declined" — that lives in step 4 (agent sign-off).
 * For now any consumedAt counts as "signed".
 */
export function statusOf(link: DealLink): DealLinkStatus {
  if (link.invalidatedAt) return "invalidated";
  if (link.consumedAt) return "signed";
  if (isExpired(link)) return "expired";
  if (link.openedAt) return "opened";
  return "sent";
}

// ─────────────────────────────────────────────────────────────────────────
// DB ops
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fetch all live links for a deal — most recent first.
 * "Live" means not invalidated, not consumed, not expired.
 */
export async function getActiveLinksForDeal(dealId: string): Promise<DealLink[]> {
  const rows = await db
    .select()
    .from(dealLinks)
    .where(
      and(
        eq(dealLinks.dealId, dealId),
        isNull(dealLinks.invalidatedAt),
        isNull(dealLinks.consumedAt),
        gt(dealLinks.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(dealLinks.sentAt));
  return rows;
}

export async function getLinkByToken(token: string): Promise<DealLink | null> {
  const rows = await db.select().from(dealLinks).where(eq(dealLinks.token, token));
  return rows[0] ?? null;
}

/** First view stamps openedAt; subsequent views are no-ops. */
export async function markLinkOpened(link: DealLink): Promise<void> {
  if (link.openedAt) return;
  await db
    .update(dealLinks)
    .set({ openedAt: new Date() })
    .where(eq(dealLinks.id, link.id));
}

/**
 * Mark every non-invalidated link for a deal as invalidated — including
 * already-signed ones. Called from saveDeal when the deal is amended after
 * being sent. Per spec §6: "the existing signature is invalidated, and the
 * agent gets a fresh sign-off request."
 *
 * The signature audit fields (printedName, signatureDataUrl, etc.) are
 * preserved on the row; only invalidatedAt is stamped. So the audit trail
 * still shows "Pat Cho signed v1 on May 19, then the deal was amended on
 * May 20 and re-signed."
 */
export async function invalidateActiveLinks(dealId: string): Promise<void> {
  await db
    .update(dealLinks)
    .set({ invalidatedAt: new Date() })
    .where(
      and(
        eq(dealLinks.dealId, dealId),
        isNull(dealLinks.invalidatedAt),
      ),
    );
}

/**
 * Most recent consumed (signed or declined) link for a deal, regardless of
 * whether it's since been invalidated. Used to render the "previously
 * signed by X" banner in Mariana's rail so she knows a save+send will be
 * an amendment, not a first send.
 */
export async function getLastConsumedLink(dealId: string): Promise<DealLink | null> {
  const rows = await db
    .select()
    .from(dealLinks)
    .where(and(eq(dealLinks.dealId, dealId), eq(dealLinks.role, "sign")))
    .orderBy(desc(dealLinks.consumedAt));
  return rows.find((r) => !!r.consumedAt) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// Sign-off snapshot — derived state used by the shows-list badges (slice 06)
// ─────────────────────────────────────────────────────────────────────────

export type SignoffStatus =
  | "signed"
  | "declined"
  | "pending"
  | "unsigned"
  | "not_sent";

export type SignoffSnapshot = {
  status: SignoffStatus;
  /** Signer (signed only) — pulled from printedName or falls back to recipientName. */
  signedBy?: string | null;
  /** ISO timestamp of the consumption (signed/declined). */
  consumedAt?: string | null;
  /** Decline reason (declined only). */
  declineComment?: string | null;
  /** ISO of when the latest active link was sent (pending only). */
  sentAt?: string | null;
  /** Whole days since the link was sent (pending only). */
  daysSinceSent?: number | null;
  /** Whole days from now until the show (unsigned only — used by the ≤48h badge). */
  daysToShow?: number | null;
};

const DAY_MS = 1000 * 60 * 60 * 24;
const UNSIGNED_WINDOW_DAYS = 2;

/**
 * Derive the dashboard-facing sign-off state for one show from its
 * sign-role links and date. Pure — no DB calls.
 */
export function computeSignoffSnapshot(args: {
  links: DealLink[];
  /** Show date as YYYY-MM-DD. */
  showDate: string;
  hasDeal: boolean;
  /** Override "now" for tests. */
  now?: Date;
}): SignoffSnapshot {
  const { links, showDate, hasDeal } = args;
  const now = args.now ?? new Date();

  // No deal → never any sign-off to surface.
  if (!hasDeal) return { status: "not_sent" };

  // Latest non-invalidated sign-role link wins. Earlier amendments are
  // invalidated and so ignored here.
  const active = links
    .filter((l) => l.role === "sign" && !l.invalidatedAt)
    .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  const sign = active[0];

  if (!sign) {
    // No live sign link. If the show is within the unsigned window,
    // surface a red badge; otherwise keep it quiet as "not sent".
    const showTs = parseShowDate(showDate);
    const days = Math.ceil((showTs - now.getTime()) / DAY_MS);
    if (days >= 0 && days <= UNSIGNED_WINDOW_DAYS) {
      return { status: "unsigned", daysToShow: Math.max(0, days) };
    }
    return { status: "not_sent" };
  }

  if (sign.consumedAt) {
    if (sign.outcome === "signed") {
      return {
        status: "signed",
        signedBy: sign.printedName ?? sign.recipientName ?? null,
        consumedAt: sign.consumedAt.toISOString(),
      };
    }
    if (sign.outcome === "declined") {
      return {
        status: "declined",
        declineComment: sign.declineComment ?? null,
        consumedAt: sign.consumedAt.toISOString(),
      };
    }
  }

  const daysSinceSent = Math.floor((now.getTime() - sign.sentAt.getTime()) / DAY_MS);
  return {
    status: "pending",
    sentAt: sign.sentAt.toISOString(),
    daysSinceSent,
  };
}

function parseShowDate(yyyyMmDd: string): number {
  // Treat show date as start-of-day in local time. Good enough for the
  // ≤48h window — we're not splitting hairs across timezones here.
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

/**
 * Batch-fetch sign-role links for many deals at once. Used by the
 * shows-list query to avoid an N+1.
 */
export async function getSignLinksByDealIds(
  dealIds: string[],
): Promise<Map<string, DealLink[]>> {
  const grouped = new Map<string, DealLink[]>();
  if (dealIds.length === 0) return grouped;
  const rows = await db
    .select()
    .from(dealLinks)
    .where(and(inArray(dealLinks.dealId, dealIds), eq(dealLinks.role, "sign")));
  for (const row of rows) {
    const list = grouped.get(row.dealId);
    if (list) list.push(row);
    else grouped.set(row.dealId, [row]);
  }
  return grouped;
}

export type CreateLinkInput = {
  dealId: string;
  showId: string;
  role: DealLink["role"];
  recipientName?: string | null;
  recipientEmail?: string | null;
};

export async function createDealLink(input: CreateLinkInput): Promise<DealLink> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LINK_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  const id = generateToken().slice(0, 16);
  const row = {
    id,
    dealId: input.dealId,
    showId: input.showId,
    token: generateToken(),
    role: input.role,
    recipientName: input.recipientName ?? null,
    recipientEmail: input.recipientEmail ?? null,
    sentAt: now,
    expiresAt,
    openedAt: null,
    consumedAt: null,
    invalidatedAt: null,
  };
  await db.insert(dealLinks).values(row);
  return row as DealLink;
}
