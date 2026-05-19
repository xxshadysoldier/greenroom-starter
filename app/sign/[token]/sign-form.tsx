"use client";

import { useState, useTransition, useMemo } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Lock,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DealRecap } from "@/components/deal-recap";
import { SignaturePad, type SignatureValue } from "@/components/signature-pad";
import { formatShowDateFull } from "@/lib/format";
import {
  signDeal,
  declineDeal,
  type SignPayload,
} from "./actions";
import type { Deal } from "@/db/schema";

type Props = {
  token: string;
  deal: Deal;
  showTitle: string;
  showDate: string;
  relativeShowDate: string;
  venueName: string | null;
  venueCity: string | null;
  doorsTime: string | null;
  setTime: string | null;
  recipientName: string;
  agencyName: string | null;
};

export function SignForm({
  token,
  deal,
  showTitle,
  showDate,
  relativeShowDate,
  venueName,
  venueCity,
  doorsTime,
  setTime,
  recipientName,
  agencyName,
}: Props) {
  const [signature, setSignature] = useState<SignatureValue>({ kind: "empty" });
  const [printedName, setPrintedName] = useState(recipientName);
  const [agreed, setAgreed] = useState(false);

  const [showDecline, setShowDecline] = useState(false);
  const [declineComment, setDeclineComment] = useState("");

  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<"sign" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSign = useMemo(
    () =>
      signature.kind !== "empty" &&
      printedName.trim().length > 0 &&
      agreed,
    [signature.kind, printedName, agreed],
  );

  const handleSign = () => {
    if (!canSign) return;
    if (signature.kind === "empty") return;
    const payload: SignPayload = {
      signatureDataUrl: signature.dataUrl,
      signatureType: signature.kind === "drawn" ? "drawn" : "typed",
      printedName: printedName.trim(),
    };
    setError(null);
    setActiveAction("sign");
    startTransition(async () => {
      const res = await signDeal(token, payload);
      setActiveAction(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Server revalidated this path; reload pulls the SignedState branch.
      window.location.reload();
    });
  };

  const handleDecline = () => {
    if (!declineComment.trim()) {
      setError("Add a quick comment so Mariana knows what to change.");
      return;
    }
    setError(null);
    setActiveAction("decline");
    startTransition(async () => {
      const res = await declineDeal(token, {
        comment: declineComment.trim(),
        declinerName: recipientName,
      });
      setActiveAction(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.location.reload();
    });
  };

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-[560px] mx-auto px-4 py-6 sm:py-12">
        <div className="sm:bg-white sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-ink-200/70 sm:overflow-hidden">
          {/* Branded header */}
          <header className="px-1 sm:px-8 sm:pt-8 pb-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-700 mb-2 inline-flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-sm bg-gradient-to-br from-brand-500 to-brand-700" />
              Greenroom · sign deal
            </div>
            <h1
              className="font-display text-[32px] sm:text-[40px] font-medium text-ink-900 leading-[1.04]"
              style={{ letterSpacing: "-0.025em", fontOpticalSizing: "auto" }}
            >
              {showTitle}
            </h1>
            <div className="text-[12.5px] text-ink-500 mt-1.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-ink-700 font-medium">{formatShowDateFull(showDate)}</span>
              <span className="text-ink-300">·</span>
              <span>{relativeShowDate}</span>
              {venueName && (
                <>
                  <span className="text-ink-300">·</span>
                  <span>
                    {venueName}
                    {venueCity && ` · ${venueCity}`}
                  </span>
                </>
              )}
            </div>
            {doorsTime && setTime && (
              <div className="text-[11.5px] text-ink-400 mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                doors {doorsTime} · set {setTime}
              </div>
            )}
          </header>

          {/* Prompt */}
          <div className="mt-5 sm:mx-8 px-4 py-3 sm:px-4 sm:py-3 rounded-xl bg-brand-50/40 ring-1 ring-brand-200/50">
            <p className="text-[13px] text-ink-800 leading-relaxed">
              <strong className="text-ink-900 font-medium">Hi {firstName(recipientName)}.</strong>{" "}
              Mariana sent this deal for your sign-off. Tap{" "}
              <strong className="text-brand-800 font-medium">Sign and confirm</strong>{" "}
              when you&rsquo;re happy with it.
            </p>
          </div>

          {/* Structured deal recap */}
          <div className="mt-6 px-1 sm:px-8">
            <DealRecap deal={deal} includeSource={false} />
          </div>

          {/* Source email collapsed */}
          <SourceEmailCollapse deal={deal} />

          {/* Signature panel */}
          <div className="mt-2 mx-0 sm:mx-8 mb-6 px-4 sm:px-5 py-5 rounded-xl bg-canvas-soft ring-1 ring-ink-200/70">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-700 mb-3">
              Your signature
            </div>
            <SignaturePad
              defaultTypedName={recipientName}
              onChange={setSignature}
            />

            <div className="mt-4">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500 mb-1.5">
                Printed name <span className="text-rose-700">*</span>
              </label>
              <input
                type="text"
                value={printedName}
                onChange={(e) => setPrintedName(e.target.value)}
                className="w-full rounded-lg border border-ink-300/70 bg-white px-3 py-2 text-[14px] text-ink-900 focus:outline-2 focus:outline-brand-700"
                placeholder="Your full name"
              />
            </div>

            <button
              type="button"
              onClick={() => setAgreed(!agreed)}
              className="mt-4 flex items-start gap-2.5 text-left w-full"
            >
              <span
                className={cn(
                  "w-[18px] h-[18px] mt-0.5 rounded border flex-shrink-0 relative transition-colors",
                  agreed
                    ? "bg-brand-700 border-brand-700"
                    : "bg-white border-ink-300",
                )}
              >
                {agreed && (
                  <span className="absolute left-[5px] top-[1px] w-[6px] h-[10px] border-r-2 border-b-2 border-white rotate-45 block" />
                )}
              </span>
              <span className="text-[12.5px] text-ink-700 leading-relaxed">
                <strong className="text-ink-900 font-medium">I agree</strong> this
                constitutes my electronic signature and that I have the authority
                to bind the artist to these terms.
              </span>
            </button>

            <button
              type="button"
              onClick={handleSign}
              disabled={!canSign || isPending}
              className={cn(
                "mt-4 w-full inline-flex items-center justify-center gap-2 h-12 px-5 rounded-lg font-medium text-[14px] transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
                canSign && !isPending
                  ? "bg-brand-700 text-white hover:bg-brand-800 shadow-sm shadow-brand-700/15 ring-1 ring-inset ring-brand-800/20 cursor-pointer active:translate-y-px"
                  : "bg-ink-100 text-ink-400 ring-1 ring-inset ring-ink-200 cursor-not-allowed",
              )}
            >
              {canSign && !isPending && <Check className="h-4 w-4" />}
              {(!canSign && !isPending) && <Lock className="h-3.5 w-3.5" />}
              {isPending && activeAction === "sign"
                ? "Signing…"
                : !canSign
                  ? remainingGateMessage(signature, printedName, agreed)
                  : "Sign and confirm"}
            </button>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowDecline((s) => !s)}
                className="text-[12px] text-ink-500 hover:text-rose-700 hover:underline"
              >
                {showDecline ? "Cancel decline" : "Decline with a comment →"}
              </button>
            </div>

            {/* Decline panel — slides in below */}
            {showDecline && (
              <div className="mt-4 rounded-lg bg-white ring-1 ring-rose-200/70 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-rose-700 mb-2">
                  Decline this deal
                </div>
                <p className="text-[12px] text-ink-500 mb-2.5 leading-relaxed">
                  Leave a quick note for Mariana. She&rsquo;ll amend and re-send.
                  No signature needed.
                </p>
                <textarea
                  value={declineComment}
                  onChange={(e) => setDeclineComment(e.target.value)}
                  placeholder="The 85/15 split looks off — we agreed 87/13 on the call. Can you check?"
                  rows={4}
                  className="w-full rounded-lg border border-ink-300/70 bg-white px-3 py-2 text-[13px] text-ink-900 leading-relaxed focus:outline-2 focus:outline-rose-700"
                />
                <div className="flex justify-end gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDecline(false);
                      setDeclineComment("");
                      setError(null);
                    }}
                    className="px-3 py-1.5 text-[12px] text-ink-600 hover:text-ink-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={isPending || !declineComment.trim()}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[12.5px] font-medium",
                      declineComment.trim() && !isPending
                        ? "bg-rose-700 text-white hover:bg-rose-800"
                        : "bg-ink-100 text-ink-400 cursor-not-allowed",
                    )}
                  >
                    {isPending && activeAction === "decline"
                      ? "Sending…"
                      : "Send decline"}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2 text-[12px] text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-md p-2.5">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Escape hatch */}
          <div className="mt-2 sm:mx-8 mx-0 px-4 sm:px-0 pb-6 sm:pb-2 text-center text-[11.5px] text-ink-500 leading-relaxed">
            Need to talk to Mariana? Reply to the original email instead.
          </div>

          {/* Recipient footer (signing context) */}
          <div className="mt-4 sm:mt-2 mx-0 sm:mx-8 mb-8 sm:mb-8 px-4 sm:px-4 py-3 rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 flex gap-2 items-start text-[11px] text-ink-500 leading-relaxed">
            <Lock className="h-3.5 w-3.5 text-ink-400 mt-0.5 flex-shrink-0" />
            <div>
              Signing as{" "}
              <strong className="text-ink-700 font-medium">{recipientName}</strong>
              {agencyName && <span className="text-ink-400"> · {agencyName}</span>}. Secure
              magic link · single-use · valid 14 days.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bits
// ─────────────────────────────────────────────────────────────────────────

function SourceEmailCollapse({ deal }: { deal: Deal }) {
  const [open, setOpen] = useState(false);
  if (!deal.sourceEmail) return null;
  return (
    <div className="mx-0 sm:mx-8 mt-1 mb-4 rounded-lg ring-1 ring-ink-200/70 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-[12px] text-ink-600 hover:text-ink-900"
      >
        <span className="inline-flex items-center gap-2">
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
          />
          Original email from Mariana
        </span>
        <span className="font-mono text-[10.5px] text-ink-400">
          {open ? "hide" : "expand"}
        </span>
      </button>
      {open && (
        <pre className="px-4 pb-4 pt-1 font-mono text-[11.5px] text-ink-700 whitespace-pre-wrap leading-relaxed border-t border-ink-100">
          {deal.sourceEmail}
        </pre>
      )}
    </div>
  );
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || "there";
}

function remainingGateMessage(
  sig: SignatureValue,
  printedName: string,
  agreed: boolean,
): string {
  const missing: string[] = [];
  if (sig.kind === "empty") missing.push("signature");
  if (!printedName.trim()) missing.push("printed name");
  if (!agreed) missing.push("agreement");
  if (missing.length === 0) return "Sign and confirm";
  if (missing.length === 1) return `Add your ${missing[0]} to continue`;
  if (missing.length === 2) return `${missing[0]} + ${missing[1]} required`;
  return `${missing.length} more steps`;
}
