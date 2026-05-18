"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { findMissing, type DealFormState } from "@/lib/dealRules";
import { randomUUID } from "crypto";

export type SaveDealResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

/**
 * Upsert the deal for a given show.
 *
 * The form gates "Send for sign-off" client-side via the same readiness
 * math we run here, but we re-validate on the server too — if a state
 * with missing required fields somehow gets posted, we return an error
 * instead of writing a partial deal.
 */
export async function saveDeal(
  showId: string,
  state: DealFormState,
  options: { andRedirect?: boolean } = {},
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

  const existing = await db
    .select()
    .from(deals)
    .where(eq(deals.showId, showId));

  if (existing.length > 0) {
    await db.update(deals).set(payload).where(eq(deals.showId, showId));
  } else {
    await db.insert(deals).values({
      id: randomUUID(),
      showId,
      ...payload,
      createdAt: now,
    });
  }

  revalidatePath(`/shows/${showId}`);
  revalidatePath(`/shows/${showId}/deal`);
  revalidatePath("/shows");

  if (options.andRedirect) {
    redirect(`/shows/${showId}`);
  }
  return { ok: true, redirectTo: `/shows/${showId}` };
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
