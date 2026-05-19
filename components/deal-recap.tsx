/**
 * Shared structured-deal recap. Renders the same artifact for the
 * agent sign-off page and the tour-manager view page.
 */

import {
  DEAL_TYPE_LABELS,
  BASIS_LABEL,
  hydrateForm,
  visibilityFor,
} from "@/lib/dealRules";
import { RECOUP_CATEGORY_LABEL, STAGE_LABEL } from "@/lib/dealRules";
import { formatMoney } from "@/lib/format";
import type {
  Deal,
  DealRecoup,
  DeductionStage,
  WalkoutPot,
  Bonus,
} from "@/db/schema";

type Props = {
  deal: Deal;
  /** Show the source email block (collapsed by default). Pass false to hide. */
  includeSource?: boolean;
};

/**
 * Render the deal as the agent (or tour manager) will read it. Stateless,
 * pure presentation — pulls structured form state from hydrateForm.
 */
export function DealRecap({ deal, includeSource = true }: Props) {
  const f = hydrateForm(deal);
  const vis = visibilityFor(f.dealType);

  return (
    <>
      <Section title="Deal structure">
        <Row k="Deal type" v={DEAL_TYPE_LABELS[f.dealType]} />
        {vis.guarantee && f.guaranteeAmount != null && (
          <Row k="Guarantee" v={formatMoney(f.guaranteeAmount)} mono />
        )}
        {vis.percentage && f.percentage != null && (
          <Row
            k="Percentage"
            v={`${Math.round(f.percentage * 100)}% of ${
              BASIS_LABEL[f.dealType].split(" · ")[0].toLowerCase()
            }`}
          />
        )}
        {vis.caps && f.expenseCap != null && (
          <Row k="Expense cap" v={formatMoney(f.expenseCap)} mono />
        )}
        {vis.caps && f.hospitalityCap != null && (
          <Row
            k="Hospitality cap"
            v={`${formatMoney(f.hospitalityCap)} · inside cap`}
            mono
          />
        )}
      </Section>

      {f.recoups.length > 0 && (
        <Section title="Recoups">
          <ul className="divide-y divide-ink-100">
            {f.recoups.map((r) => (
              <RecoupLine key={r.id} r={r} />
            ))}
          </ul>
        </Section>
      )}

      {f.deductionOrder.length > 0 && (
        <Section title="Deduction order">
          <ol className="space-y-1">
            {f.deductionOrder.map((stage, i) => (
              <li
                key={stage}
                className="text-[12.5px] text-ink-800 flex gap-2 items-baseline"
              >
                <span className="font-mono text-[10.5px] text-ink-400 w-4">
                  {i + 1}.
                </span>
                <span>{STAGE_LABEL[stage as DeductionStage]}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {f.walkoutPot && (
        <Section title="Walkout pot">
          <Row k="Floor" v={formatMoney(f.walkoutPot.floor)} mono />
          <Row k="Split" v={`${Math.round(f.walkoutPot.splitPct * 100)}% to artist`} mono />
          <Row k="Pays out" v={paysOutLabel(f.walkoutPot)} />
        </Section>
      )}

      {f.bonuses.length > 0 && (
        <Section title="Bonuses">
          {f.bonuses.map((b, i) => (
            <BonusRow key={i} b={b} />
          ))}
        </Section>
      )}

      <Section title="Comp counting">
        <CompCountingSummary rules={f.compRules} />
      </Section>

      {includeSource && f.sourceEmail && (
        <Section title="Source · original email">
          <pre className="font-mono text-[11.5px] text-ink-700 whitespace-pre-wrap bg-canvas-soft p-3 rounded-md ring-1 ring-ink-100 leading-relaxed">
            {f.sourceEmail}
          </pre>
        </Section>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500 mb-2">
        {title}
      </div>
      <div className="bg-white rounded-lg ring-1 ring-ink-200/70 p-4">
        {children}
      </div>
    </section>
  );
}

export function Row({
  k,
  v,
  mono = false,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline py-1.5 text-[13px]">
      <span className="text-ink-500">{k}</span>
      <span className={mono ? "font-mono tabular-nums text-ink-900" : "text-ink-900"}>
        {v}
      </span>
    </div>
  );
}

function RecoupLine({ r }: { r: DealRecoup }) {
  return (
    <li className="py-2 flex justify-between items-baseline gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-ink-900">{r.label}</div>
        <div className="text-[11px] text-ink-500">
          {RECOUP_CATEGORY_LABEL[r.category]} · {bucketLabel(r.bucket)} ·{" "}
          {r.appliesAt === "before" ? "before split" : "after split"}
        </div>
      </div>
      <div className="font-mono tabular-nums text-[13px] text-ink-900">
        {formatMoney(r.amount)}
      </div>
    </li>
  );
}

function BonusRow({ b }: { b: Bonus }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 text-[13px]">
      <span className="text-ink-700">{bonusLabel(b)}</span>
      <span className="font-mono tabular-nums text-brand-700">
        +{formatMoney(b.amount)}
      </span>
    </div>
  );
}

function CompCountingSummary({
  rules,
}: {
  rules: ReturnType<typeof hydrateForm>["compRules"];
}) {
  const countingTrue = (Object.keys(rules) as (keyof typeof rules)[]).filter(
    (k) => rules[k],
  );
  const countingFalse = (Object.keys(rules) as (keyof typeof rules)[]).filter(
    (k) => !rules[k],
  );

  if (countingTrue.length === 0) {
    return (
      <div className="text-[12.5px] text-ink-700 leading-relaxed">
        No comp categories count toward gross.{" "}
        <span className="text-ink-500">
          Every comped seat is excluded from the gross-based math.
        </span>
      </div>
    );
  }

  return (
    <div className="text-[12.5px] text-ink-700 leading-relaxed space-y-1.5">
      <div>
        <span className="text-amber-800 font-medium">Counts toward gross:</span>{" "}
        {countingTrue.map((k) => compLabel(k)).join(", ")}
      </div>
      <div className="text-ink-500">
        Does not count: {countingFalse.map((k) => compLabel(k)).join(", ")}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Label helpers
// ─────────────────────────────────────────────────────────────────────────

function bucketLabel(bucket: DealRecoup["bucket"]): string {
  switch (bucket) {
    case "inside":
      return "inside cap";
    case "outside":
      return "outside cap";
    case "off-top":
      return "off the top";
  }
}

function paysOutLabel(wp: WalkoutPot): string {
  return wp.paysOut === "same_night_cash" ? "Same night, in cash" : "End of run";
}

function bonusLabel(b: Bonus): string {
  if (b.type === "sellout") return b.label || "Sellout bonus";
  if (b.type === "gross_threshold")
    return `${b.label || "Gross threshold"} (≥ ${formatMoney(b.threshold)})`;
  if (b.type === "attendance_threshold")
    return `${b.label || "Attendance threshold"} (≥ ${b.threshold})`;
  return b.label || "Bonus";
}

function compLabel(k: string): string {
  return (
    {
      artist_gl: "Artist GL",
      label: "Label/management",
      press: "Press",
      venue_staff: "Venue staff",
      sponsor: "Sponsor",
      promo: "Promo/radio",
      other: "Other",
    } as Record<string, string>
  )[k] ?? k;
}
