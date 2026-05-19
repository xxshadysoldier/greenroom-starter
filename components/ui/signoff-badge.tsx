import { cn } from "@/lib/utils";
import type { SignoffSnapshot } from "@/lib/dealLinks";

/**
 * Dashboard sign-off badge — slice 06, variation A (inline badge).
 *
 * Renders one of five states with a dot + label, plus an HTML `title`
 * tooltip carrying the contextual detail (signer name + date, decline
 * comment, days since sent, etc.). No inline action buttons here — the
 * action lives on the show detail page.
 */
export function SignoffBadge({ snapshot }: { snapshot: SignoffSnapshot }) {
  if (!snapshot) return null;
  const { status } = snapshot;

  const variantClass: Record<typeof status, string> = {
    signed: "bg-brand-50 text-brand-800 ring-brand-200/80",
    pending: "bg-ink-100 text-ink-700 ring-ink-200/80",
    declined: "bg-amber-50 text-amber-800 ring-amber-200/80",
    unsigned: "bg-rose-50 text-rose-800 ring-rose-200/80",
    not_sent: "bg-canvas-soft text-ink-500 ring-ink-200/80",
  };
  const dotClass: Record<typeof status, string> = {
    signed: "bg-brand-700",
    pending: "bg-ink-500",
    declined: "bg-amber-700",
    unsigned: "bg-rose-700 animate-pulse",
    not_sent: "bg-ink-300",
  };

  return (
    <span
      title={tooltipFor(snapshot)}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md",
        "text-[10.5px] font-medium ring-1 ring-inset whitespace-nowrap",
        variantClass[status],
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dotClass[status])} />
      {labelFor(snapshot)}
    </span>
  );
}

function labelFor(snapshot: SignoffSnapshot): string {
  switch (snapshot.status) {
    case "signed":
      return "Signed";
    case "declined":
      return "Declined";
    case "pending": {
      const d = snapshot.daysSinceSent ?? 0;
      if (d <= 0) return "Pending · today";
      if (d === 1) return "Pending · 1d";
      return `Pending · ${d}d`;
    }
    case "unsigned": {
      const d = snapshot.daysToShow ?? 0;
      if (d <= 0) return "Unsigned · today";
      if (d === 1) return "Unsigned · 1d";
      return `Unsigned · ${d}d`;
    }
    case "not_sent":
      return "Not sent";
  }
}

function tooltipFor(snapshot: SignoffSnapshot): string {
  switch (snapshot.status) {
    case "signed": {
      const who = snapshot.signedBy ?? "the agent";
      const when = snapshot.consumedAt ? formatTooltipDate(snapshot.consumedAt) : "";
      return when ? `Signed by ${who} on ${when}` : `Signed by ${who}`;
    }
    case "declined": {
      const when = snapshot.consumedAt ? formatTooltipDate(snapshot.consumedAt) : "";
      const head = when ? `Declined on ${when}` : "Declined";
      const c = snapshot.declineComment?.trim();
      return c ? `${head}: "${c}"` : head;
    }
    case "pending": {
      const d = snapshot.daysSinceSent ?? 0;
      if (d <= 0) return "Sent today, awaiting open";
      if (d === 1) return "Sent 1 day ago, awaiting open";
      return `Sent ${d} days ago, awaiting open`;
    }
    case "unsigned": {
      const d = snapshot.daysToShow ?? 0;
      if (d <= 0) return "Show is today and still not signed";
      if (d === 1) return "Show is tomorrow and still not signed";
      return `Show is in ${d} days and still not signed`;
    }
    case "not_sent":
      return "Deal saved but no sign-off link sent yet";
  }
}

function formatTooltipDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
