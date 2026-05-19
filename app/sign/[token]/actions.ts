"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { dealLinks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLinkByToken, isActive } from "@/lib/dealLinks";

export type SignPayload = {
  signatureDataUrl: string;
  signatureType: "drawn" | "typed";
  printedName: string;
};

export type SignResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Commit a signature on a sign-role magic link. Idempotent against
 * already-consumed links (returns a clear error) and validates the
 * payload before writing.
 */
export async function signDeal(
  token: string,
  payload: SignPayload,
): Promise<SignResult> {
  const link = await getLinkByToken(token);
  if (!link) return { ok: false, error: "Link not found." };
  if (link.role !== "sign") {
    return { ok: false, error: "This is a view-only link, not a sign link." };
  }
  if (link.consumedAt) {
    return { ok: false, error: "This link has already been used." };
  }
  if (!isActive(link)) {
    return { ok: false, error: "This link is no longer active." };
  }

  // Payload validation
  if (!payload.signatureDataUrl || !payload.signatureDataUrl.startsWith("data:image/")) {
    return { ok: false, error: "Signature is missing or invalid." };
  }
  if (!payload.printedName.trim()) {
    return { ok: false, error: "Printed name is required." };
  }

  const now = new Date();
  await db
    .update(dealLinks)
    .set({
      consumedAt: now,
      outcome: "signed",
      printedName: payload.printedName.trim(),
      signatureDataUrl: payload.signatureDataUrl,
      signatureType: payload.signatureType,
    })
    .where(eq(dealLinks.id, link.id));

  // Revalidate the Mariana-facing surfaces so the rail flips into a
  // "signed" state next time she loads the deal form.
  revalidatePath(`/shows/${link.showId}`);
  revalidatePath(`/shows/${link.showId}/deal`);
  revalidatePath(`/sign/${token}`);

  return { ok: true };
}

export type DeclinePayload = {
  comment: string;
  declinerName?: string;
};

export async function declineDeal(
  token: string,
  payload: DeclinePayload,
): Promise<SignResult> {
  const link = await getLinkByToken(token);
  if (!link) return { ok: false, error: "Link not found." };
  if (link.role !== "sign") {
    return { ok: false, error: "This is a view-only link, not a sign link." };
  }
  if (link.consumedAt) {
    return { ok: false, error: "This link has already been used." };
  }
  if (!isActive(link)) {
    return { ok: false, error: "This link is no longer active." };
  }
  if (!payload.comment.trim()) {
    return { ok: false, error: "A short comment is required to decline." };
  }

  const now = new Date();
  await db
    .update(dealLinks)
    .set({
      consumedAt: now,
      outcome: "declined",
      declineComment: payload.comment.trim(),
      printedName: payload.declinerName?.trim() || null,
    })
    .where(eq(dealLinks.id, link.id));

  revalidatePath(`/shows/${link.showId}`);
  revalidatePath(`/shows/${link.showId}/deal`);
  revalidatePath(`/sign/${token}`);

  return { ok: true };
}
