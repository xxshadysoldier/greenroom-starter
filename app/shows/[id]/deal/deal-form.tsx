"use client";

import Link from "next/link";
import { useTransition, useState, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  Clock,
  Lock,
  Plus,
  Send,
  Sparkles,
  Trash2,
  ArrowUp,
  ArrowDown,
  Info,
  AlertCircle,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadge, PlainBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatShowDateFull, relativeShowDate } from "@/lib/format";
import {
  BASIS_LABEL,
  COMP_CATEGORY_LABEL,
  DEAL_TYPE_BADGE,
  DEAL_TYPE_LABELS,
  DEFAULT_WALKOUT_POT,
  RECOUP_CATEGORY_LABEL,
  STAGE_DESC,
  STAGE_LABEL,
  blankForm,
  defaultDeductionOrder,
  readiness,
  visibilityFor,
  type DealFormState,
  type DealType,
} from "@/lib/dealRules";
import type {
  Bonus,
  CompRules,
  DealRecoup,
  DeductionStage,
  WalkoutPot,
} from "@/db/schema";
import { saveDeal, type SaveDealResult } from "./actions";

type Props = {
  showId: string;
  show: {
    date: string;
    doorsTime: string | null;
    setTime: string | null;
    status: "booked" | "advanced" | "day_of" | "settled" | "closed";
  };
  artist: { name: string; genre: string | null } | null;
  agent: { name: string; email: string; agencyName: string | null } | null;
  initial: DealFormState;
  hasSavedDeal: boolean;
};

const DEAL_TYPES: DealType[] = [
  "flat",
  "percentage_of_gross",
  "percentage_of_net",
  "vs",
  "door",
];

export function DealForm({
  showId,
  show,
  artist,
  agent,
  initial,
  hasSavedDeal,
}: Props) {
  const [state, setState] = useState<DealFormState>(initial);
  const [isPending, startTransition] = useTransition();
  const [saveResult, setSaveResult] = useState<SaveDealResult | null>(null);
  const [saveMode, setSaveMode] = useState<"draft" | "send" | null>(null);

  const vis = useMemo(() => visibilityFor(state.dealType), [state.dealType]);
  const ready = useMemo(() => readiness(state), [state]);
  const canSend = ready.missing.length === 0;

  // ─── Setters
  const setType = useCallback((dealType: DealType) => {
    setState((s) => {
      const newVis = visibilityFor(dealType);
      // Reset deduction order to the default for the new type if it doesn't
      // match (avoid carrying a 5-stage order into a gross deal).
      const defaultOrder = defaultDeductionOrder(dealType);
      const orderMatches =
        s.deductionOrder.length > 0 &&
        s.deductionOrder.every((stage) => defaultOrder.includes(stage));
      return {
        ...s,
        dealType,
        deductionOrder: orderMatches ? s.deductionOrder : defaultOrder,
        walkoutPot:
          newVis.walkoutPot && !s.walkoutPot
            ? { ...DEFAULT_WALKOUT_POT }
            : !newVis.walkoutPot
              ? null
              : s.walkoutPot,
        // If recoups exist but bucket choice is no longer a question on the new
        // type, auto-resolve their buckets to off-top so the data stays valid.
        recoups: s.recoups.map((r) =>
          newVis.recoupBucketChoice
            ? r
            : { ...r, bucket: "off-top", appliesAt: r.appliesAt || "before" },
        ),
      };
    });
  }, []);

  const set = <K extends keyof DealFormState>(key: K, value: DealFormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const handleSave = (mode: "draft" | "send") => {
    setSaveMode(mode);
    setSaveResult(null);
    startTransition(async () => {
      const result = await saveDeal(showId, state, { andRedirect: mode === "send" });
      setSaveResult(result);
      setSaveMode(null);
    });
  };

  const isDisputed = false; // disputed state lives on settlement, not deal

  return (
    <div className="max-w-7xl">
      {/* Poster header — mirrors show detail */}
      <div
        className={cn(
          "px-12 pt-10 pb-12",
          isDisputed
            ? "bg-gradient-to-b from-rose-50/40 to-canvas"
            : "bg-gradient-to-b from-brand-50/30 to-canvas",
        )}
      >
        <Link
          href={`/shows/${showId}`}
          className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to show
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-1.5 mb-4">
              <StatusBadge status={show.status} />
              <PlainBadge variant={DEAL_TYPE_BADGE[state.dealType]}>
                {DEAL_TYPE_LABELS[state.dealType]}
              </PlainBadge>
              {hasSavedDeal ? (
                <PlainBadge variant="default">Editing</PlainBadge>
              ) : (
                <PlainBadge variant="brand">New deal</PlainBadge>
              )}
            </div>
            <div className="eyebrow mb-2">Deal entry</div>
            <h1
              className="font-display text-[52px] font-medium text-ink-900 leading-[1.02]"
              style={{ letterSpacing: "-0.025em", fontOpticalSizing: "auto" }}
            >
              {artist?.name ?? "—"}
            </h1>
            <div className="text-[13.5px] text-ink-400 mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-ink-600 font-medium">
                {formatShowDateFull(show.date)}
              </span>
              <span className="text-ink-300">·</span>
              <span>{relativeShowDate(show.date)}</span>
              {(show.doorsTime || show.setTime) && (
                <>
                  <span className="text-ink-200">·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {show.doorsTime && `doors ${show.doorsTime}`}
                    {show.doorsTime && show.setTime && " · "}
                    {show.setTime && `set ${show.setTime}`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form body — two-column grid (form left, sticky rail right) */}
      <div className="px-12 pb-16 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-7 items-start">
        {/* ─── LEFT: the form ─────────────────────────────────────── */}
        <div className="space-y-7 min-w-0">
          {/* SECTION: Deal structure */}
          <FormSection
            title="Deal structure"
            description="Pick the shape first — the rest of the form rebuilds itself around it."
          >
            <div className="mb-5">
              <FieldLabel>Deal type *</FieldLabel>
              <SegControl
                value={state.dealType}
                onChange={setType}
                options={DEAL_TYPES.map((t) => ({
                  value: t,
                  label: DEAL_TYPE_LABELS[t],
                }))}
              />
              <Hint>
                {DEAL_TYPE_HINT[state.dealType]}{" "}
                <span className="text-brand-700">
                  Changing this rewires the sections below.
                </span>
              </Hint>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {vis.guarantee && (
                <div>
                  <FieldLabel>
                    Guarantee
                    {vis.guaranteeRequired && <Req />}
                  </FieldLabel>
                  <MoneyInput
                    value={state.guaranteeAmount}
                    onChange={(v) => set("guaranteeAmount", v)}
                    placeholder="0.00"
                  />
                  <Hint>{GUARANTEE_HINT[state.dealType]}</Hint>
                </div>
              )}
              {vis.percentage && (
                <div>
                  <FieldLabel>
                    Percentage <Req />
                  </FieldLabel>
                  <PercentInput
                    value={state.percentage}
                    onChange={(v) => set("percentage", v)}
                  />
                  <Hint>Stored as a decimal; e.g. 85 → 0.85.</Hint>
                </div>
              )}
              <div>
                <FieldLabel>Percentage basis</FieldLabel>
                <LockedField
                  value={BASIS_LABEL[state.dealType]}
                  tag={
                    state.dealType === "flat"
                      ? "n/a on flat"
                      : `locked by ${DEAL_TYPE_LABELS[state.dealType]}`
                  }
                />
                <Hint>Not editable — basis is derived from deal type.</Hint>
              </div>
            </div>

            {vis.caps && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <FieldLabel>Expense cap</FieldLabel>
                  <MoneyInput
                    value={state.expenseCap}
                    onChange={(v) => set("expenseCap", v)}
                    placeholder="0.00"
                  />
                  <Hint>Hard cap on what comes off the top before the split.</Hint>
                </div>
                <div>
                  <FieldLabel>Hospitality cap</FieldLabel>
                  <MoneyInput
                    value={state.hospitalityCap}
                    onChange={(v) => set("hospitalityCap", v)}
                    placeholder="0.00"
                  />
                  <Hint>Counts inside the expense cap unless agent says otherwise.</Hint>
                </div>
              </div>
            )}
          </FormSection>

          {/* SECTION: Recoups */}
          {vis.recoups && (
            <FormSection
              title="Recoups"
              description="Each recoup must declare what bucket it lives in and when it applies. Ambiguity is impossible because the form won't allow it."
              meta={`${state.recoups.length} entered`}
            >
              <ConditionalNote tone="brand">
                {vis.recoupBucketChoice ? (
                  <>
                    <span className="font-medium text-ink-800">
                      {DEAL_TYPE_LABELS[state.dealType]}
                    </span>{" "}
                    — bucket & applies-at are required.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-ink-800">
                      {DEAL_TYPE_LABELS[state.dealType]}
                    </span>{" "}
                    — bucket auto-resolves to{" "}
                    <em>off-gross, before split</em>. No choice shown.
                  </>
                )}
              </ConditionalNote>

              <div className="space-y-3 mt-4">
                {state.recoups.map((r, i) => (
                  <RecoupRow
                    key={r.id}
                    index={i}
                    recoup={r}
                    bucketChoice={vis.recoupBucketChoice}
                    onChange={(updated) =>
                      set(
                        "recoups",
                        state.recoups.map((rr, idx) => (idx === i ? updated : rr)),
                      )
                    }
                    onRemove={() =>
                      set(
                        "recoups",
                        state.recoups.filter((_, idx) => idx !== i),
                      )
                    }
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  set("recoups", [
                    ...state.recoups,
                    {
                      id: cryptoRandomId(),
                      label: "",
                      category: "marketing",
                      amount: 0,
                      bucket: vis.recoupBucketChoice ? "inside" : "off-top",
                      appliesAt: "before",
                    },
                  ])
                }
                className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-300 bg-white/60 hover:bg-white hover:border-ink-400 transition-colors py-2.5 text-[13px] text-ink-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add recoup
              </button>
            </FormSection>
          )}

          {/* SECTION: Deduction order */}
          {vis.deductionOrder && state.deductionOrder.length > 0 && (
            <FormSection
              title="Deduction order"
              description="What comes off the gross first. Reorder with the arrows — this is how the agent will read it."
              meta={`${state.deductionOrder.length} stages`}
            >
              <ConditionalNote tone="brand">
                {DEDUCTION_ORDER_NOTE[state.dealType]}
              </ConditionalNote>
              <ol className="mt-4 space-y-2">
                {state.deductionOrder.map((stage, i) => (
                  <StageRow
                    key={stage}
                    index={i}
                    stage={stage}
                    canUp={i > 0}
                    canDown={i < state.deductionOrder.length - 1}
                    onMove={(dir) => {
                      const next = [...state.deductionOrder];
                      const target = dir === "up" ? i - 1 : i + 1;
                      [next[i], next[target]] = [next[target], next[i]];
                      set("deductionOrder", next);
                    }}
                  />
                ))}
              </ol>
            </FormSection>
          )}

          {/* SECTION: Walkout pot (Door only) */}
          {vis.walkoutPot && (
            <FormSection
              title="Walkout pot"
              description="Cash on the floor at end-of-night after splits and recoups settle. Door deals settle that night."
            >
              <WalkoutPotEditor
                value={state.walkoutPot ?? DEFAULT_WALKOUT_POT}
                onChange={(v) => set("walkoutPot", v)}
              />
            </FormSection>
          )}

          {/* SECTION: Comp counting */}
          {vis.compRules && (
            <FormSection
              title="Comp counting"
              description="Per-category rule for whether comps count toward gross. Settled once at the deal level."
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.keys(state.compRules) as (keyof CompRules)[]).map(
                  (key) => (
                    <CompRuleCheckbox
                      key={key}
                      label={COMP_CATEGORY_LABEL[key]}
                      checked={state.compRules[key]}
                      onChange={(checked) =>
                        set("compRules", { ...state.compRules, [key]: checked })
                      }
                    />
                  ),
                )}
              </div>
              <Hint>
                Default: a comp does <strong>not</strong> count unless explicitly
                checked. Checked categories appear in gross calculations the agent
                sees.
              </Hint>
            </FormSection>
          )}

          {/* SECTION: Bonuses */}
          {vis.bonuses && (
            <FormSection
              title="Bonuses & escalators"
              description="Structured only — if it isn't on this list the in-app tool can't read it."
              meta={`${state.bonuses.length} entered`}
            >
              <div className="space-y-3">
                {state.bonuses.map((b, i) => (
                  <BonusRow
                    key={i}
                    bonus={b}
                    onChange={(updated) =>
                      set(
                        "bonuses",
                        state.bonuses.map((bb, idx) => (idx === i ? updated : bb)),
                      )
                    }
                    onRemove={() =>
                      set(
                        "bonuses",
                        state.bonuses.filter((_, idx) => idx !== i),
                      )
                    }
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() =>
                    set("bonuses", [
                      ...state.bonuses,
                      { type: "sellout", label: "Sellout bonus", amount: 0 } as Bonus,
                    ])
                  }
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-300 bg-white/60 hover:bg-white hover:border-ink-400 py-2.5 text-[12.5px] text-ink-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Sellout bonus
                </button>
                <button
                  type="button"
                  onClick={() =>
                    set("bonuses", [
                      ...state.bonuses,
                      {
                        type: "gross_threshold",
                        label: "",
                        threshold: 0,
                        amount: 0,
                      } as Bonus,
                    ])
                  }
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-300 bg-white/60 hover:bg-white hover:border-ink-400 py-2.5 text-[12.5px] text-ink-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Gross threshold
                </button>
              </div>
            </FormSection>
          )}

          {/* SECTION: Source email */}
          {vis.sourceEmail && (
            <FormSection
              title="Source · agent email"
              description="Paste the original email. Preserved as source material — the structure above is what gets signed."
            >
              <FieldLabel>
                Email text or short note <Req />
              </FieldLabel>
              <textarea
                value={state.sourceEmail}
                onChange={(e) => set("sourceEmail", e.target.value)}
                className="w-full rounded-lg border border-ink-300/70 bg-white px-3 py-2.5 font-mono text-[12.5px] text-ink-900 leading-relaxed focus:outline-2 focus:outline-brand-700"
                rows={6}
                placeholder="From: agent@agency.com&#10;Subject: RE: ..."
              />
              <Hint>
                Required across all deal types — the agent sees this collapsed below the
                structured recap. A 1-line summary is fine for simple deals.
              </Hint>
            </FormSection>
          )}
        </div>

        {/* ─── RIGHT: sticky readiness rail ──────────────────────── */}
        <aside className="lg:sticky lg:top-4 self-start space-y-3">
          <Card>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="eyebrow text-[10px] text-ink-500">
                  Sign-off readiness
                </div>
                <PlainBadge variant={DEAL_TYPE_BADGE[state.dealType]}>
                  {DEAL_TYPE_LABELS[state.dealType]}
                </PlainBadge>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="font-display text-[32px] font-medium text-ink-900 leading-none"
                  style={{ letterSpacing: "-0.025em" }}
                >
                  {ready.done}
                </span>
                <span className="font-mono text-[12px] text-ink-300">
                  / {ready.total}
                </span>
                <span className="font-mono text-[11px] text-ink-400 ml-1">
                  required complete
                </span>
              </div>
              <div className="h-1 bg-ink-100 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-200"
                  style={{
                    width: `${Math.round((ready.done / Math.max(ready.total, 1)) * 100)}%`,
                  }}
                />
              </div>

              <div className="mt-4 pt-3 border-t border-ink-100">
                <div className="eyebrow text-[10px] text-ink-500 mb-2">
                  {ready.missing.length === 0
                    ? "Ready for sign-off"
                    : "Still missing"}
                </div>
                {ready.missing.length === 0 ? (
                  <div className="text-[12px] text-brand-700 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    All required fields complete.
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {ready.missing.slice(0, 6).map((m) => (
                      <li
                        key={m.key}
                        className="text-[12px] text-ink-700 flex items-center gap-2"
                      >
                        <span className="w-1 h-1 rounded-full bg-rose-700 flex-shrink-0" />
                        {m.label}
                      </li>
                    ))}
                    {ready.missing.length > 6 && (
                      <li className="text-[11px] text-ink-400 italic">
                        and {ready.missing.length - 6} more…
                      </li>
                    )}
                  </ul>
                )}
                <div className="text-[10.5px] text-ink-400 mt-3 pt-2 border-t border-dashed border-ink-200 leading-snug">
                  Required set is gated by deal type. Switch above — counts and
                  sections update live.
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="px-5 py-4">
              <div className="eyebrow text-[10px] text-ink-500 mb-2">Send to</div>
              {agent ? (
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-canvas-soft ring-1 ring-ink-200/70 mb-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-300 to-brand-700 text-white flex items-center justify-center text-[10.5px] font-semibold tracking-wide">
                    {initials(agent.name)}
                  </div>
                  <div className="leading-tight min-w-0">
                    <div className="text-[12.5px] font-medium text-ink-900 truncate">
                      {agent.name}
                    </div>
                    <div className="font-mono text-[10.5px] text-ink-500 truncate">
                      {agent.email}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-ink-400 italic mb-3">
                  No agent on file for this artist.
                </div>
              )}

              <button
                type="button"
                disabled={!canSend || isPending}
                onClick={() => handleSave("send")}
                title={
                  canSend
                    ? "Send the structured deal to the agent for sign-off"
                    : `${ready.missing.length} required field${ready.missing.length === 1 ? "" : "s"} still missing`
                }
                className={cn(
                  "w-full h-10 px-5 inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
                  canSend && !isPending
                    ? "bg-brand-700 text-white hover:bg-brand-800 shadow-sm shadow-brand-700/15 ring-1 ring-inset ring-brand-800/20 cursor-pointer active:translate-y-px"
                    : "bg-ink-100 text-ink-400 ring-1 ring-inset ring-ink-200 cursor-not-allowed",
                )}
              >
                {!canSend && !isPending && <Lock className="h-3 w-3" />}
                {canSend && !isPending && <Send className="h-3.5 w-3.5" />}
                {isPending && saveMode === "send"
                  ? "Saving…"
                  : !canSend
                    ? `${ready.missing.length} field${ready.missing.length === 1 ? "" : "s"} to go`
                    : hasSavedDeal
                      ? "Save & re-send"
                      : "Save & continue"}
              </button>
              <div className="flex items-center justify-between text-[11px] mt-2.5">
                <span
                  className={cn(
                    canSend ? "text-brand-700 font-medium" : "text-ink-400",
                  )}
                >
                  {canSend
                    ? "All required fields complete"
                    : `${ready.missing.length} required field${ready.missing.length === 1 ? "" : "s"} left`}
                </span>
                <button
                  type="button"
                  onClick={() => handleSave("draft")}
                  disabled={isPending}
                  className="text-ink-600 hover:text-ink-900 disabled:opacity-50"
                >
                  {isPending && saveMode === "draft" ? "Saving…" : "Save draft →"}
                </button>
              </div>

              {saveResult && !saveResult.ok && (
                <div className="mt-3 text-[12px] text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-md p-2.5 flex gap-2">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{saveResult.error}</span>
                </div>
              )}
              {saveResult?.ok && saveMode === null && (
                <div className="mt-3 text-[12px] text-brand-700 bg-brand-50 ring-1 ring-brand-200 rounded-md p-2.5">
                  Saved. Back on the show page when you&rsquo;re ready.
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Section + small primitives
// ─────────────────────────────────────────────────────────────────────────

function FormSection({
  title,
  description,
  meta,
  children,
}: {
  title: string;
  description?: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2
            className="font-display text-[22px] font-medium text-ink-900 leading-tight"
            style={{ letterSpacing: "-0.018em", fontOpticalSizing: "auto" }}
          >
            {title}
          </h2>
          {description && (
            <p className="text-[12.5px] text-ink-500 mt-1 leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {meta && (
          <span className="font-mono text-[11px] text-ink-400 tracking-wide">
            {meta}
          </span>
        )}
      </div>
      <Card>
        <CardContent className="px-5 py-4">{children}</CardContent>
      </Card>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block eyebrow text-[10px] text-ink-500 mb-1.5">
      {children}
    </label>
  );
}

function Req() {
  return <span className="text-rose-700 ml-0.5">*</span>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] text-ink-400 mt-1.5 leading-relaxed">
      {children}
    </div>
  );
}

function ConditionalNote({
  tone,
  children,
}: {
  tone: "brand" | "amber";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "brand"
      ? "bg-brand-50 ring-brand-200/60 text-brand-800"
      : "bg-amber-50 ring-amber-200/70 text-amber-800";
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3.5 py-2 rounded-md ring-1 text-[12px] leading-snug",
        toneClass,
      )}
    >
      <Info className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function SegControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex bg-canvas-soft border border-ink-200/80 rounded-[10px] p-[3px] gap-[2px] flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3.5 py-1.5 rounded-[7px] text-[12.5px] font-medium transition-all",
            value === o.value
              ? "bg-white text-ink-900 shadow-[0_1px_2px_rgba(26,24,20,0.06),inset_0_0_0_1px_rgba(228,223,210,0.7)]"
              : "text-ink-500 hover:text-ink-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LockedField({ value, tag }: { value: string; tag?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-canvas-soft border border-dashed border-ink-300/80 text-[13.5px] text-ink-900">
      <Lock className="h-3.5 w-3.5 text-ink-400 flex-shrink-0" />
      <span className="font-medium flex-1 truncate">{value}</span>
      {tag && (
        <span className="font-mono text-[10.5px] text-ink-400 uppercase tracking-wide flex-shrink-0">
          {tag}
        </span>
      )}
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-stretch border border-ink-300/70 bg-white rounded-lg overflow-hidden focus-within:outline focus-within:outline-2 focus-within:outline-brand-700">
      <span className="bg-canvas-soft border-r border-ink-200/70 px-2.5 inline-flex items-center font-mono text-[12px] text-ink-500">
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value == null ? "" : formatNumberForInput(value)}
        placeholder={placeholder}
        onChange={(e) => onChange(parseNumberInput(e.target.value))}
        className="flex-1 font-mono tabular-nums px-2.5 py-2 text-[13.5px] text-ink-900 focus:outline-none placeholder:text-ink-300"
      />
    </div>
  );
}

function PercentInput({
  value, // 0–1
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const display = value == null ? "" : Math.round(value * 100).toString();
  return (
    <div className="flex items-stretch border border-ink-300/70 bg-white rounded-lg overflow-hidden focus-within:outline focus-within:outline-2 focus-within:outline-brand-700">
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, "");
          if (raw === "") return onChange(null);
          const n = parseFloat(raw);
          if (Number.isNaN(n)) return;
          onChange(Math.min(100, Math.max(0, n)) / 100);
        }}
        className="flex-1 font-mono tabular-nums px-2.5 py-2 text-[13.5px] text-ink-900 focus:outline-none placeholder:text-ink-300"
      />
      <span className="bg-canvas-soft border-l border-ink-200/70 px-2.5 inline-flex items-center font-mono text-[12px] text-ink-500">
        %
      </span>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-ink-300/70 bg-white rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-2 focus:outline-brand-700 placeholder:text-ink-300"
    />
  );
}

function SelectInput<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full border border-ink-300/70 bg-white rounded-lg px-3 py-2 text-[13.5px] text-ink-900 focus:outline-2 focus:outline-brand-700"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Recoup row
// ─────────────────────────────────────────────────────────────────────────

function RecoupRow({
  index,
  recoup,
  bucketChoice,
  onChange,
  onRemove,
}: {
  index: number;
  recoup: DealRecoup;
  bucketChoice: boolean;
  onChange: (r: DealRecoup) => void;
  onRemove: () => void;
}) {
  const update = <K extends keyof DealRecoup>(key: K, value: DealRecoup[K]) =>
    onChange({ ...recoup, [key]: value });

  return (
    <div className="rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10.5px] text-ink-400 tracking-wider">
          RECOUP · {String(index + 1).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-rose-700"
        >
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.7fr_1fr_1fr] gap-3">
        <div>
          <FieldLabel>
            Label <Req />
          </FieldLabel>
          <TextInput
            value={recoup.label}
            onChange={(v) => update("label", v)}
            placeholder="Local radio buy · WNXP"
          />
        </div>
        <div>
          <FieldLabel>
            Category <Req />
          </FieldLabel>
          <SelectInput
            value={recoup.category}
            onChange={(v) => update("category", v)}
            options={(Object.keys(RECOUP_CATEGORY_LABEL) as DealRecoup["category"][]).map(
              (c) => ({
                value: c,
                label: RECOUP_CATEGORY_LABEL[c],
              }),
            )}
          />
        </div>
        <div>
          <FieldLabel>
            Amount <Req />
          </FieldLabel>
          <MoneyInput
            value={recoup.amount || null}
            onChange={(v) => update("amount", v ?? 0)}
            placeholder="0.00"
          />
        </div>
      </div>

      {bucketChoice ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <FieldLabel>
              Bucket <Req />
            </FieldLabel>
            <PillGroup
              value={recoup.bucket}
              onChange={(v) => update("bucket", v as DealRecoup["bucket"])}
              options={[
                { value: "inside", label: "Inside expense cap", dot: "sky" },
                { value: "outside", label: "Outside cap", dot: "amber" },
                { value: "off-top", label: "Off gross, before split", dot: "rose" },
              ]}
            />
            {recoup.bucket === "outside" && (
              <Hint>
                <span className="text-amber-800 inline-flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Outside-cap recoups raise the artist&rsquo;s share — double-check with
                  the agent.
                </span>
              </Hint>
            )}
          </div>
          <div>
            <FieldLabel>
              Applies <Req />
            </FieldLabel>
            <PillGroup
              value={recoup.appliesAt}
              onChange={(v) => update("appliesAt", v as DealRecoup["appliesAt"])}
              options={[
                { value: "before", label: "Before the percentage" },
                { value: "after", label: "After the percentage" },
              ]}
            />
          </div>
        </div>
      ) : (
        <div className="mt-3 text-[11.5px] text-ink-500 flex items-center gap-2">
          <PlainBadge variant="rose">Auto-resolved</PlainBadge>
          <span>Off-gross, before split. No cap to live inside, so no bucket choice.</span>
        </div>
      )}
    </div>
  );
}

function PillGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; dot?: "sky" | "amber" | "rose" }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const dotClass: Record<string, string> = {
          sky: "bg-sky-700",
          amber: "bg-amber-700",
          rose: "bg-rose-700",
        };
        const isOn = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all",
              isOn
                ? "bg-ink-900 text-white border border-ink-900"
                : "bg-white text-ink-700 border border-ink-300/70 hover:border-ink-400",
            )}
          >
            {o.dot && (
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  isOn ? "ring-1 ring-white/40" : "",
                  dotClass[o.dot],
                )}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Deduction order
// ─────────────────────────────────────────────────────────────────────────

function StageRow({
  index,
  stage,
  canUp,
  canDown,
  onMove,
}: {
  index: number;
  stage: DeductionStage;
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: "up" | "down") => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5 bg-white border border-ink-200/80 rounded-lg">
      <GripVertical className="h-4 w-4 text-ink-300 flex-shrink-0" />
      <span className="font-mono text-[11px] text-ink-400 w-4 text-center">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-ink-900">
          {STAGE_LABEL[stage]}
        </div>
        <div className="text-[11.5px] text-ink-500">{STAGE_DESC[stage]}</div>
      </div>
      <div className="flex gap-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => onMove("up")}
          disabled={!canUp}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Move up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          disabled={!canDown}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Move down"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Walkout pot (Door only)
// ─────────────────────────────────────────────────────────────────────────

function WalkoutPotEditor({
  value,
  onChange,
}: {
  value: WalkoutPot;
  onChange: (v: WalkoutPot) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <FieldLabel>
          Pot floor <Req />
        </FieldLabel>
        <MoneyInput
          value={value.floor}
          onChange={(v) => onChange({ ...value, floor: v ?? 0 })}
          placeholder="0.00"
        />
        <Hint>Minimum the artist takes home if door is light.</Hint>
      </div>
      <div>
        <FieldLabel>
          Pot split <Req />
        </FieldLabel>
        <PercentInput
          value={value.splitPct}
          onChange={(v) => onChange({ ...value, splitPct: v ?? 0 })}
        />
        <Hint>Of remaining cash after guarantee &amp; expenses.</Hint>
      </div>
      <div>
        <FieldLabel>
          Pays out <Req />
        </FieldLabel>
        <SelectInput
          value={value.paysOut}
          onChange={(v) => onChange({ ...value, paysOut: v })}
          options={[
            { value: "same_night_cash", label: "Same night, in cash" },
            { value: "end_of_run", label: "End of run" },
          ]}
        />
        <Hint>Door deals settle that night, not on Monday.</Hint>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Comp rules
// ─────────────────────────────────────────────────────────────────────────

function CompRuleCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-start gap-2.5 text-left px-3 py-2.5 rounded-lg ring-1 transition-all",
        checked
          ? "bg-brand-50/40 ring-brand-200/60"
          : "bg-canvas-soft ring-ink-200/70 hover:ring-ink-300",
      )}
    >
      <span
        className={cn(
          "w-4 h-4 rounded border flex-shrink-0 mt-0.5 relative transition-colors",
          checked
            ? "bg-brand-700 border-brand-700"
            : "bg-white border-ink-300",
        )}
      >
        {checked && (
          <span className="absolute left-[4px] top-[1px] w-[5px] h-[9px] border-r-2 border-b-2 border-white rotate-45 block" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] text-ink-900 leading-tight">{label}</div>
        <div
          className={cn(
            "text-[10.5px] mt-0.5",
            checked ? "text-amber-800 font-medium" : "text-ink-400",
          )}
        >
          {checked ? "counts toward gross" : "does not count"}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bonus row
// ─────────────────────────────────────────────────────────────────────────

function BonusRow({
  bonus,
  onChange,
  onRemove,
}: {
  bonus: Bonus;
  onChange: (b: Bonus) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10.5px] text-ink-400 tracking-wider">
          BONUS · {bonus.type.replace(/_/g, " ").toUpperCase()}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-rose-700"
        >
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>

      {bonus.type === "sellout" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel>Label</FieldLabel>
            <TextInput
              value={bonus.label}
              onChange={(v) => onChange({ ...bonus, label: v })}
              placeholder="Sellout bonus"
            />
          </div>
          <div>
            <FieldLabel>
              Amount <Req />
            </FieldLabel>
            <MoneyInput
              value={bonus.amount || null}
              onChange={(v) => onChange({ ...bonus, amount: v ?? 0 })}
            />
          </div>
        </div>
      )}

      {bonus.type === "gross_threshold" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <FieldLabel>Label</FieldLabel>
            <TextInput
              value={bonus.label}
              onChange={(v) => onChange({ ...bonus, label: v })}
              placeholder="Stretch goal"
            />
          </div>
          <div>
            <FieldLabel>Gross threshold</FieldLabel>
            <MoneyInput
              value={bonus.threshold || null}
              onChange={(v) => onChange({ ...bonus, threshold: v ?? 0 })}
            />
          </div>
          <div>
            <FieldLabel>
              Amount <Req />
            </FieldLabel>
            <MoneyInput
              value={bonus.amount || null}
              onChange={(v) => onChange({ ...bonus, amount: v ?? 0 })}
            />
          </div>
        </div>
      )}

      {bonus.type === "attendance_threshold" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <FieldLabel>Label</FieldLabel>
            <TextInput
              value={bonus.label}
              onChange={(v) => onChange({ ...bonus, label: v })}
            />
          </div>
          <div>
            <FieldLabel>Attendance threshold</FieldLabel>
            <input
              type="number"
              value={bonus.threshold || ""}
              onChange={(e) =>
                onChange({
                  ...bonus,
                  threshold: parseInt(e.target.value || "0", 10),
                })
              }
              className="w-full border border-ink-300/70 bg-white rounded-lg px-3 py-2 text-[13.5px] text-ink-900 font-mono tabular-nums focus:outline-2 focus:outline-brand-700"
            />
          </div>
          <div>
            <FieldLabel>
              Amount <Req />
            </FieldLabel>
            <MoneyInput
              value={bonus.amount || null}
              onChange={(v) => onChange({ ...bonus, amount: v ?? 0 })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Copy + helpers
// ─────────────────────────────────────────────────────────────────────────

const DEAL_TYPE_HINT: Record<DealType, string> = {
  flat: "Flat — one number, no math. Most of the form is hidden.",
  vs: "Vs — artist gets the greater of guarantee or percentage after expenses. Most common at The Crescent.",
  percentage_of_net: "% of net — pure percentage of net. No floor.",
  percentage_of_gross:
    "% of gross — no caps, no bucket choices. Recoups land off-top.",
  door: "Door — door cash, optional floor, walkout pot. Settles that night.",
};

const GUARANTEE_HINT: Record<DealType, string> = {
  flat: "Required. The number.",
  vs: "Required. The floor for the Vs comparison.",
  percentage_of_net: "Hidden — net deals have no floor.",
  percentage_of_gross: "Hidden — gross deals have no floor.",
  door: "Optional — a floor for slow nights.",
};

const DEDUCTION_ORDER_NOTE: Record<DealType, string> = {
  flat: "Section hidden — no recoups, no cap, nothing to order.",
  vs: "Full 5-stage order: fees → off-top → expenses → in-cap recoups → split.",
  percentage_of_net:
    "Full 5-stage order: fees → off-top → expenses → in-cap recoups → split.",
  percentage_of_gross:
    "Simplified 3-stage order: fees → off-top recoups → split.",
  door: "Simplified 3-stage order: fees → off-top recoups → split.",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

function formatNumberForInput(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseNumberInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (cleaned === "" || cleaned === ".") return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
