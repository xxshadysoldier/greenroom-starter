import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, Lock, XCircle } from "lucide-react";
import { db } from "@/db";
import { deals, shows, artists, agents, agencies, venues } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLinkByToken, markLinkOpened, isActive, isExpired } from "@/lib/dealLinks";
import { formatShowDateFull, relativeShowDate } from "@/lib/format";
import { SignForm } from "./sign-form";

export const metadata = {
  title: "Sign deal · Greenroom",
};

export default async function AgentSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await getLinkByToken(token);

  if (!link) notFound();
  if (link.role !== "sign") {
    return (
      <FriendlyState
        tone="amber"
        Icon={AlertCircle}
        title="Wrong link type"
        body="This is the tour-manager view link. The agent's sign link is different — ask Mariana to resend if you need one."
      />
    );
  }
  if (link.invalidatedAt) {
    return (
      <FriendlyState
        tone="amber"
        Icon={AlertCircle}
        title="This link is out of date"
        body="The deal was edited after this link was sent. Ask Mariana for a fresh link — it'll have any updated terms."
      />
    );
  }
  if (isExpired(link)) {
    return (
      <FriendlyState
        tone="amber"
        Icon={Clock}
        title="This link has expired"
        body="Links are valid for 14 days. Ask Mariana to resend if you still need to sign."
      />
    );
  }

  // Load full deal context
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

  // Already-acted-on states render their confirmation pages
  if (link.consumedAt && link.outcome === "signed") {
    return (
      <SignedState
        showTitle={artistRow?.name ?? "—"}
        showDate={showRow.date}
        venueName={venueRow?.name ?? null}
        signedAt={link.consumedAt}
        printedName={link.printedName}
        signatureDataUrl={link.signatureDataUrl}
      />
    );
  }
  if (link.consumedAt && link.outcome === "declined") {
    return (
      <DeclinedState
        showTitle={artistRow?.name ?? "—"}
        showDate={showRow.date}
        comment={link.declineComment ?? ""}
        declinedAt={link.consumedAt}
      />
    );
  }
  if (!isActive(link)) {
    return (
      <FriendlyState
        tone="amber"
        Icon={AlertCircle}
        title="This link is no longer active"
        body="Ask Mariana to resend the deal."
      />
    );
  }

  // First-view side-effect — stamp openedAt so Mariana's rail shows "Opened".
  await markLinkOpened(link);

  return (
    <SignForm
      token={token}
      deal={dealRow}
      showTitle={artistRow?.name ?? "—"}
      showDate={showRow.date}
      relativeShowDate={relativeShowDate(showRow.date)}
      venueName={venueRow?.name ?? null}
      venueCity={venueRow?.city ?? null}
      doorsTime={showRow.doorsTime}
      setTime={showRow.setTime}
      recipientName={link.recipientName ?? agentRow?.name ?? ""}
      agencyName={agencyRow?.name ?? null}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Post-action confirmation surfaces (server-rendered)
// ─────────────────────────────────────────────────────────────────────────

function SignedState({
  showTitle,
  showDate,
  venueName,
  signedAt,
  printedName,
  signatureDataUrl,
}: {
  showTitle: string;
  showDate: string;
  venueName: string | null;
  signedAt: Date;
  printedName: string | null;
  signatureDataUrl: string | null;
}) {
  return (
    <PageShell>
      <header className="text-center mb-6">
        <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 ring-1 ring-brand-200 flex items-center justify-center mb-3">
          <CheckCircle2 className="h-5 w-5 text-brand-700" />
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-700 mb-1">
          Signed · {formatTimestamp(signedAt)}
        </div>
        <h1
          className="font-display text-[28px] sm:text-[32px] font-medium text-ink-900 leading-tight"
          style={{ letterSpacing: "-0.02em", fontOpticalSizing: "auto" }}
        >
          {showTitle} — deal is signed
        </h1>
        <p className="text-[13px] text-ink-500 mt-2 leading-relaxed">
          {formatShowDateFull(showDate)}
          {venueName && <> · {venueName}</>}.
        </p>
      </header>

      <div className="rounded-xl bg-white ring-1 ring-ink-200/70 p-5 mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500 mb-3">
          Signature receipt
        </div>
        <div className="border border-dashed border-ink-200 rounded-lg bg-canvas-soft py-5 px-6 mb-3 text-center">
          {signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signatureDataUrl}
              alt="Signature"
              className="max-h-20 mx-auto"
            />
          ) : (
            <div className="text-ink-400 text-[12px]">No signature image on file.</div>
          )}
        </div>
        <div className="text-[12px] text-ink-700 text-center">
          {printedName && <strong className="text-ink-900 font-medium">{printedName}</strong>}
          {printedName && " · "}
          {formatTimestamp(signedAt)}
        </div>
      </div>

      <p className="text-[12px] text-ink-500 text-center leading-relaxed">
        Mariana&rsquo;s been notified. If anything looks wrong,
        reply to her email — she can amend and re-send.
      </p>
    </PageShell>
  );
}

function DeclinedState({
  showTitle,
  showDate,
  comment,
  declinedAt,
}: {
  showTitle: string;
  showDate: string;
  comment: string;
  declinedAt: Date;
}) {
  return (
    <PageShell>
      <header className="text-center mb-6">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center mb-3">
          <XCircle className="h-5 w-5 text-amber-700" />
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700 mb-1">
          Declined · {formatTimestamp(declinedAt)}
        </div>
        <h1
          className="font-display text-[28px] sm:text-[32px] font-medium text-ink-900 leading-tight"
          style={{ letterSpacing: "-0.02em", fontOpticalSizing: "auto" }}
        >
          {showTitle} — sent back to Mariana
        </h1>
        <p className="text-[13px] text-ink-500 mt-2 leading-relaxed">
          {formatShowDateFull(showDate)}.
        </p>
      </header>

      <div className="rounded-xl bg-white ring-1 ring-ink-200/70 p-5 mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500 mb-2">
          Your comment
        </div>
        <p className="text-[13px] text-ink-800 leading-relaxed whitespace-pre-wrap">
          {comment}
        </p>
      </div>

      <p className="text-[12px] text-ink-500 text-center leading-relaxed">
        Mariana&rsquo;s been notified. She&rsquo;ll review your comment, amend the
        deal, and send a fresh link.
      </p>
    </PageShell>
  );
}

function FriendlyState({
  tone,
  Icon,
  title,
  body,
}: {
  tone: "amber" | "brand";
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  const ring =
    tone === "brand"
      ? "bg-brand-50 ring-brand-200 text-brand-700"
      : "bg-amber-50 ring-amber-200 text-amber-700";
  return (
    <PageShell>
      <div className="text-center pt-8">
        <div className={`mx-auto w-12 h-12 rounded-full ring-1 flex items-center justify-center mb-4 ${ring}`}>
          <Icon className="h-5 w-5" />
        </div>
        <h1
          className="font-display text-[26px] sm:text-[28px] font-medium text-ink-900 leading-tight"
          style={{ letterSpacing: "-0.02em", fontOpticalSizing: "auto" }}
        >
          {title}
        </h1>
        <p className="text-[13px] text-ink-500 mt-3 leading-relaxed max-w-sm mx-auto">
          {body}
        </p>
      </div>
    </PageShell>
  );
}

/**
 * Responsive shell: full-bleed on phones, centered card on desktop.
 */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-[560px] mx-auto px-4 py-6 sm:py-12">
        <div className="sm:bg-white sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-ink-200/70 sm:px-8 sm:py-10">
          {children}
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
