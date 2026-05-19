import { notFound } from "next/navigation";
import { getShowById } from "@/lib/queries";
import { hydrateForm } from "@/lib/dealRules";
import {
  buildLinkUrl,
  getActiveLinksForDeal,
  getLastConsumedLink,
  statusOf,
} from "@/lib/dealLinks";
import { DealForm, type ActiveSendState, type LastSignoff } from "./deal-form";

export default async function DealEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const initial = hydrateForm(data.deal);

  // Pull any live magic links so the rail starts in link-ready mode if a
  // sign-off is already in flight. Sign + view links can exist independently:
  // after the sign link is consumed, the view link may still be active for
  // preview, so we surface activeSend whenever EITHER role is live.
  let activeSend: ActiveSendState | null = null;
  let lastSignoff: LastSignoff | null = null;
  if (data.deal) {
    const links = await getActiveLinksForDeal(data.deal.id);
    const sign = links.find((l) => l.role === "sign");
    const view = links.find((l) => l.role === "view");
    if (sign || view) {
      activeSend = {
        sentAt: (sign?.sentAt ?? view!.sentAt).toISOString(),
        sign: sign
          ? {
              url: buildLinkUrl(sign),
              recipientName: sign.recipientName ?? "—",
              recipientEmail: sign.recipientEmail ?? "—",
              status: statusOf(sign),
              openedAt: sign.openedAt?.toISOString() ?? null,
            }
          : null,
        view: view ? { url: buildLinkUrl(view) } : null,
      };
    }

    // Always look up the last consumed sign link. Used by:
    //   - the pre-send rail's "Previously signed" / "Agent feedback" banners
    //   - the link-ready panel's signer attribution on the disabled sign btn
    //     when activeSend.sign is null because the link was just signed.
    const last = await getLastConsumedLink(data.deal.id);
    if (last && last.outcome) {
      lastSignoff = {
        outcome: last.outcome,
        consumedAt: last.consumedAt!.toISOString(),
        signedBy: last.printedName ?? last.recipientName ?? null,
        declinerName: last.recipientName ?? last.printedName ?? null,
        declineComment: last.declineComment ?? null,
        invalidated: !!last.invalidatedAt,
      };
    }
  }

  return (
    <DealForm
      showId={data.show.id}
      show={{
        date: data.show.date,
        doorsTime: data.show.doorsTime,
        setTime: data.show.setTime,
        status: data.show.status,
      }}
      artist={
        data.artist ? { name: data.artist.name, genre: data.artist.genre } : null
      }
      agent={
        data.agent
          ? {
              name: data.agent.name,
              email: data.agent.email,
              agencyName: data.agency?.name ?? null,
            }
          : null
      }
      initial={initial}
      hasSavedDeal={!!data.deal}
      activeSend={activeSend}
      lastSignoff={lastSignoff}
    />
  );
}
