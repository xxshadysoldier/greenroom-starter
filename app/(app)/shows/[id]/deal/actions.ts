"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { deals, agents, artists, shows } from "@/db/schema";
import { eq } from "drizzle-orm";
import { findMissing, type DealFormState } from "@/lib/dealRules";
import {
  buildLinkUrl,
  createDealLink,
  invalidateActiveLinks,
} from "@/lib/dealLinks";
import { randomUUID } from "crypto";

export type SentLinks = {
  sign: { url: string; recipientName: string; recipientEmail: string };
  view: { url: string };
  sentAt: string; // ISO
};

export type SaveDealResult =
  | { ok: true; sent?: SentLinks }
  | { ok: false; error: string };

/**
 * Upsert the deal for a given show. When `options.andSend` is true, also
 * invalidate any active links for the deal and create a fresh sign + view
 * pair. Returns the new link URLs so the client can update its rail in
 * place — no redirect, the user stays on the form.
 */
export async function saveDeal(
  showId: string,
  state: DealFormState,
  options: { andSend?: boolean } = {},
): Promise<SaveDealResult> {
  // Server-side authoritative validation
  const missing = findMissing(state);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required fields: ${missing.map((m) => m.label).join(", ")}`,
    };
  }

  const now = new Date();

  const payload = {
    dealType: state.dealType,
    guaranteeAmount: state.guaranteeAmount,
    percentage: state.percentage,
    percentageBasis: state.dealType === "flat" ? null : basisFor(state.dealType),
    expenseCap: state.expenseCap,
    hospitalityCap: state.hospitalityCap,
    recoupsJson: state.recoups.length ? JSON.stringify(state.recoups) : null,
    deductionOrderJson: state.deductionOrder.length
      ? JSON.stringify(state.deductionOrder)
      : null,
    compRulesJson: JSON.stringify(state.compRules),
    walkoutPotJson: state.walkoutPot ? JSON.stringify(state.walkoutPot) : null,
    sourceEmail: state.sourceEmail || null,
    bonusesJson: state.bonuses.length ? JSON.stringify(state.bonuses) : null,
    dealNotesFreetext: state.dealNotesFreetext || null,
    updatedAt: now,
  };

  // Upsert the deal row
  const existing = await db.select().from(deals).where(eq(deals.showId, showId));

  let dealId: string;
  if (existing.length > 0) {
    dealId = existing[0].id;
    await db.update(deals).set(payload).where(eq(deals.showId, showId));
  } else {
    dealId = randomUUID();
    await db.insert(deals).values({
      id: dealId,
      showId,
      ...payload,
      createdAt: now,
    });
  }

  // Send flow — invalidate old, create fresh pair
  let sent: SentLinks | undefined;
  if (options.andSend) {
    // Resolve the agent on the artist record (recipient for the sign link).
    // Falls back to a placeholder if the artist somehow has no agent — the
    // form should make that impossible upstream, but we don't want to crash.
    const showRow = (await db.select().from(shows).where(eq(shows.id, showId)))[0];
    if (!showRow) {
      return { ok: false, error: "Show not found." };
    }
    const artistRow = (
      await db.select().from(artists).where(eq(artists.id, showRow.artistId))
    )[0];
    const agentRow = artistRow?.agentId
      ? (await db.select().from(agents).where(eq(agents.id, artistRow.agentId)))[0]
      : null;

    if (!agentRow) {
      return {
        ok: false,
        error: "Can't send — this artist has no agent on file.",
      };
    }

    // Kill any existing live links for this deal so the agent always reviews
    // the latest version (the spec's amendment rule applies to every save).
    await invalidateActiveLinks(dealId);

    const signLink = await createDealLink({
      dealId,
      showId,
      role: "sign",
      recipientName: agentRow.name,
      recipientEmail: agentRow.email,
    });

    const viewLink = await createDealLink({
      dealId,
      showId,
      role: "view",
    });

    sent = {
      sign: {
        url: buildLinkUrl(signLink),
        recipientName: agentRow.name,
        recipientEmail: agentRow.email,
      },
      view: { url: buildLinkUrl(viewLink) },
      sentAt: now.toISOString(),
    };

    // In a real product an email would go out here. For the case-study
    // local dev we just log — Mariana can copy the link from the rail.
    console.log("[deal-link] sign-off email would be sent to", agentRow.email);
    console.log("[deal-link]   sign URL:", sent.sign.url);
    console.log("[deal-link]   view URL:", sent.view.url);
  }

  revalidatePath(`/shows/${showId}`);
  revalidatePath(`/shows/${showId}/deal`);
  revalidatePath("/shows");

  return { ok: true, sent };
}

function basisFor(type: DealFormState["dealType"]): "gross" | "net" | "door" | null {
  switch (type) {
    case "flat":
      return null;
    case "vs":
    case "percentage_of_net":
      return "net";
    case "percentage_of_gross":
      return "gross";
    case "door":
      return "door";
  }
}
