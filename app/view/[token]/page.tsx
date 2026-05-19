import { notFound } from "next/navigation";
import { Lock, Clock, AlertCircle } from "lucide-react";
import { db } from "@/db";
import { deals, shows, artists, agents, agencies, venues } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLinkByToken, markLinkOpened, isActive, isExpired } from "@/lib/dealLinks";
import { formatShowDateFull, relativeShowDate } from "@/lib/format";
import { DealRecap } from "@/components/deal-recap";

export const metadata = {
  title: "Deal recap · Greenroom",
};

export default async function TourManagerViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await getLinkByToken(token);

  if (!link) notFound();
  if (link.role !== "view") {
    return (
      <FriendlyError
        title="Wrong link type"
        body="This link is for the agent to sign. Ask Mariana for the tour-manager view link instead."
      />
    );
  }

  if (link.invalidatedAt) {
    return (
      <FriendlyError
        title="This link is out of date"
        body="The deal was edited after this link was sent. Ask Mariana for a fresh link."
      />
    );
  }
  if (isExpired(link)) {
    return (
      <FriendlyError
        title="This link has expired"
        body="Links are valid for 14 days. Ask Mariana to resend if you still need access."
      />
    );
  }
  if (!isActive(link)) {
    return (
      <FriendlyError
        title="This link is no longer active"
        body="Ask Mariana for a fresh link."
      />
    );
  }

  await markLinkOpened(link);

  const dealRow = (await db.select().from(deals).where(eq(deals.id, link.dealId)))[0];
  const showRow = (await db.select().from(shows).where(eq(shows.id, link.showId)))[0];
  const artistRow = showRow
    ? (await db.select().from(artists).where(eq(artists.id, showRow.artistId)))[0]
    : null;
  const agentRow = artistRow?.agentId
    ? (await db.select().from(agents).where(eq(agents.id, artistRow.agentId)))[0]
    : null;
  const agencyRow = agentRow?.agencyId
    ? (await db.select().from(agencies).where(eq(agencies.id, agentRow.agencyId)))[0]
    : null;
  const venueRow = showRow
    ? (await db.select().from(venues).where(eq(venues.id, showRow.venueId)))[0]
    : null;

  if (!dealRow || !showRow) notFound();

  return (
    <div className="min-h-full bg-canvas">
      <div className="max-w-xl mx-auto px-4 pt-6 pb-12">
        <div className="rounded-xl bg-gradient-to-r from-brand-700 to-brand-800 text-white px-5 py-4 mb-6 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-100 mb-1">
            For the tour manager
          </div>
          <div className="text-[13px] leading-relaxed">
            <strong className="font-semibold">This is the structured deal Mariana sent.</strong>
            {" "}Show it to the venue at settlement if anything looks off.
          </div>
        </div>

        <header className="mb-6">
          <div className="eyebrow text-[10px] text-brand-700 mb-1">Read-only deal</div>
          <h1
            className="font-display text-[36px] font-medium text-ink-900 leading-[1.04]"
            style={{ letterSpacing: "-0.025em", fontOpticalSizing: "auto" }}
          >
            {artistRow?.name ?? "—"}
          </h1>
          <div className="text-[12.5px] text-ink-500 mt-1.5">
            {formatShowDateFull(showRow.date)} · {relativeShowDate(showRow.date)}
            {venueRow && (
              <>
                <span className="text-ink-300"> · </span>
                {venueRow.name} · {venueRow.city}
              </>
            )}
          </div>
          {showRow.doorsTime && showRow.setTime && (
            <div className="text-[12px] text-ink-400 mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              doors {showRow.doorsTime} · set {showRow.setTime}
            </div>
          )}
        </header>

        <DealRecap deal={dealRow} />

        <div className="mt-6 px-4 py-3 rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 flex gap-2 items-start text-[11.5px] text-ink-500">
          <Lock className="h-3.5 w-3.5 text-ink-400 mt-0.5 flex-shrink-0" />
          <div>
            Read-only.{" "}
            {agentRow ? (
              <>
                <strong className="text-ink-700 font-medium">{agentRow.name}</strong>
                {agencyRow && <span className="text-ink-400"> · {agencyRow.name}</span>}
                {" "}is the signing agent.
              </>
            ) : (
              <>Signing agent on file.</>
            )}
            {" "}Link sent {formatShowDateFull(link.sentAt.toISOString().slice(0, 10))}.
          </div>
        </div>
      </div>
    </div>
  );
}

function FriendlyError({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-full bg-canvas">
      <div className="max-w-md mx-auto px-4 pt-20 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center mb-4">
          <AlertCircle className="h-5 w-5 text-amber-700" />
        </div>
        <h1
          className="font-display text-[28px] font-medium text-ink-900 leading-tight"
          style={{ letterSpacing: "-0.02em", fontOpticalSizing: "auto" }}
        >
          {title}
        </h1>
        <p className="text-[13px] text-ink-500 mt-2 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
