# Product Spec: Structured Deal + Mutual Sign-Off

**Slice:** Deal modeling + upstream sign-off

---

## What we're building

A new deal-capture and sign-off flow that replaces today's ambiguous prose-plus-fields model. Mariana enters the deal into a structured form that won't accept ambiguous terms. The agent receives a magic-link email, reviews the structured version of the deal, and either signs it or declines with a comment. Once both parties sign, the deal is frozen as the canonical version everyone refers to at settlement.

---

## Features

**1. Structured deal capture.** Mariana enters deals into a form designed to model what real deals actually contain — including recoups, deduction order, cap relationships, and comp rules. The form will not let her send a deal for sign-off until every term is unambiguous.

**2. Mutual sign-off via magic link.** When Mariana finishes entering a deal, the system emails the agent a one-click link. The agent reviews the structured recap (no login required) and either signs, declines with a comment, or ignores it.

**3. Decline with reason.** If the agent disagrees with something, they leave a free-text comment that lands directly on the deal record. Mariana sees it, edits the deal, and re-sends. The negotiation stays visible inside the product instead of getting lost in email.

**4. Version history.** Every edit, send, sign, and decline is timestamped and attributed. The full history of how a deal got to its final form is visible on the show page.

**5. Sign-off status on the dashboard.** Every upcoming show shows its current sign-off state at a glance — signed, pending, declined, or unsigned-near-showday. Resend takes one click.

**6. Amendments after sign-off.** If a deal term needs to change after it's been signed (e.g. the guarantee gets bumped because the opener dropped), Mariana edits the deal, the existing signature is invalidated, and the agent gets a fresh sign-off request. Routine expense entries do *not* trigger this — only changes to deal *terms*.

**7. Tour manager pre-read.** The artist's tour manager can pull up the signed deal on their phone before walking into the back office on show night. The 2am conversation starts at agreement, not at interpretation.

**8. Settlement-time fallback.** If a show settles on an unsigned deal, the settlement page surfaces a clear warning and requires Mariana to acknowledge before proceeding. Settlement isn't blocked — reality won't always cooperate — but the friction nudges chasing the signature to happen before show day, not at 2am.

---

## What a deal needs to capture

The current deal model has eight fields and a free-text notes field. The new model adds shape for the things that actually cause disputes:

- **Deal type, guarantee, percentage, percentage basis** — unchanged
- **Expense cap, hospitality cap** — unchanged
- **Recoups (new)** — each recoup is a structured line item with: category, label, amount, **which bucket it lives in** (inside the expense cap, outside the expense cap, or off gross before the split), and **when it applies** (before or after the percentage). This is the Coastal Spell question, made into required fields.
- **Deduction order (new)** — an explicit, ordered list of what comes off the gross first: fees, recoups, expenses, etc.
- **Comp counting rules (new)** — per-category rules for which comps count toward gross, declared at the deal level
- **Bonuses** — unchanged
- **Source email (kept, renamed)** — the original agent email is preserved as source material the structure was derived from, not as the truth itself

The point isn't the exact field list. The point is that every term parties argue about at settlement is now a structured field they had to fill in on Wednesday. Ambiguity becomes impossible because the form won't let it through.

---

## Screens

### Deal entry — Mariana's working surface

A structured form with sections for deal type, guarantee and percentage, caps, recoups (a repeating block where each recoup forces a bucket and an applies-at choice), deduction order (drag to reorder), bonuses, and a textarea for pasting the original agent email as source reference.

A "Send for sign-off" button at the top is disabled until all required fields are complete. Drafts can be saved at any time. When ready, Mariana clicks send, confirms the agent's email address, and the magic link goes out.

### Agent sign-off page — what the agent sees

The agent clicks the magic link and lands on a clean, branded page with the show name and date at the top, a "Please review and sign the deal below" prompt, and the structured deal rendered as a readable table. Every term — including the recoup bucket and the deduction order — is rendered explicitly. The original source email is collapsed below for reference if the agent wants to compare.

**Signature capture.** Below the deal, the agent sees a signature panel with two tabs:

- **Draw** — a canvas area where the agent draws their signature with their mouse, trackpad, or finger (on touch devices). A small "Clear" link lets them redo it.
- **Type** — a single text field where the agent types their full name; the system renders it in a signature-style script font as a preview.

Below the signature canvas, a required text field for the agent's printed full name, and a checkbox: *"I agree this constitutes my electronic signature and that I have the authority to bind the artist to these terms."* The **Sign and confirm** button stays disabled until the agent has provided a signature (drawn or typed), printed their name, and checked the agreement box.

The decline path is separate and lighter: clicking **Decline with comment** opens a textarea and submit, no signature required.

A small "Need to talk to Mariana? Reply to the original email" link sits at the bottom as an escape hatch.

After signing, the agent sees a confirmation screen showing their signature, the timestamp, and a summary of what they agreed to. Mariana gets notified. The deal is now signed, and the captured signature image is attached to the sign-off event in the audit trail.

### Dashboard — sign-off at a glance

The upcoming shows list shows a status badge next to each deal:

- **Signed** (green) — agent name and date on hover
- **Pending** (gray) — number of days since sent
- **Declined** (yellow) — hover to see the agent's comment, click to jump to the deal
- **Unsigned** (red) — only shown if the show is within 48 hours and the deal still isn't signed

A one-click **Resend** button sits on any pending row.

### Show detail — sign-off card

The existing show detail page gets a new "Deal sign-off" card showing the current status, version number, the captured agent signature (when signed), and a timeline of events (sent → opened → declined with comment → re-sent → signed). The card includes a link to the read-only deal view (what the agent saw, with the signature affixed at the bottom) and an "Edit deal" button that creates a new version if the deal is already signed.

### Tour manager view

The tour manager can be granted a read-only magic link to the signed deal. Same recap layout as the agent view, but no sign or decline buttons. A banner at the top reads: "This is the deal your agent signed off on. Show to the venue at settlement if any questions come up."

### Settlement page warning

If the deal hasn't been signed by the time the show is being settled, the settlement page shows a banner at the top:

> ⚠️ This deal was never countersigned. You're settling on the venue's interpretation only.
>
> [Resend sign-off link]   [I acknowledge — proceed to settle]

Mariana has to acknowledge to proceed. She can still settle, but she's making a conscious choice rather than blindly working from an unsigned deal.

---

## Product behaviors

**Versioning.** Every time Mariana sends a deal for sign-off, the system snapshots the current state as a new version. Old sign-off links are invalidated when the deal changes. The agent always reviews the latest version; nothing about the negotiation history is lost.

**Magic link mechanics.** Links are single-use for sign/decline actions, last 14 days by default, and require no login on the agent's side. Opening the link doesn't count as signing — only the explicit button click does.

**Signature capture.** When an agent signs, the system captures a drawn or typed signature image, their printed name, their email, the timestamp, and the exact deal version they agreed to. The signature image is affixed to the read-only deal view and the show detail card from that point forward. If a deal is amended and re-signed, the new signature replaces the old one on the current view, but both signatures remain in the version history.

**Amendments.** A deal that's already signed and then edited becomes an "amendment." The signature is invalidated, status flips back to pending, the agent gets a fresh link. Edits to expenses or comps (which are not deal terms) do not trigger this.

**Source vs. structure.** The free-text agent email is preserved as the *source material* the structured deal was derived from. It's visible but not authoritative. When the agent reviews the deal, they see the structure first; the source is collapsed below for reference. This makes clear that the structure is what got signed, not the email.

---

## Device support

Every screen in this slice works on phone, tablet, and desktop. This isn't cosmetic — the research is explicit about where these interactions actually happen:

- **Agents read most email on their phones.** When Daniel-at-WME gets the magic-link email, the most likely device he opens it on is the phone in his pocket between meetings, not a laptop at his desk. If the sign-off page doesn't work on phone, sign-off doesn't happen.
- **Tour managers pre-read deals from the road.** Diego said it directly: "on the drive between load-out and the back office, I'd love to pull up the venue's settlement on my phone." The tour manager view is phone-first.
- **GMs sign off from the couch.** Marcus reviews settlements "via text from my couch, half-asleep." Anything he touches has to render cleanly on a phone.
- **Mariana works on a laptop.** The deal entry form is the only screen that's desktop-primary. She enters deals during the workday from her laptop, so a fuller form layout is appropriate there — though it should still degrade gracefully on tablet for the moments she's away from her desk.

What this means concretely for each screen:

- **Deal entry form** — desktop-primary; responsive enough that Mariana can review or fix a deal from a tablet if needed. Repeating recoup blocks stack vertically on narrow screens; drag-to-reorder for deduction order falls back to up/down arrow buttons on touch.
- **Agent sign-off page** — mobile-first. The structured recap table reflows from columns into stacked label/value pairs on phone. The collapsed source email stays collapsed by default to keep the page short. The **Draw** signature tab uses the phone's touch surface as the canvas — this is the most natural input on mobile and probably the dominant signing method. The **Type** tab is a fine fallback for desktop or when fingers aren't behaving.
- **Dashboard** — works on phone with status badges visible at a glance; the upcoming-shows list condenses but stays scannable. Resend is one tap.
- **Show detail sign-off card** — readable on phone, including the captured signature image and the timeline.
- **Tour manager view** — phone-first, same reflow as the agent view. No signature capture needed (read-only), so simpler.
- **Settlement page warning** — readable on phone for Marcus's couch reviews.

The signature capture in particular needs to feel good on touch. A signature drawn with a finger on a phone should feel natural and the canvas should be large enough to write at a comfortable size. This is the moment that converts the magic link into actual product value — it's worth getting right on the device most agents will actually use.

---

## Out of scope (explicit cuts)

- **AI-assisted email ingest.** Designed-for, deferred. Once we've watched Mariana enter 50 real deals manually, we'll know enough to build the paste-and-parse flow with confidence. Shipping it in v1 introduces failure modes (mis-parses, hallucinated terms) we don't want to debug alongside the core flow.
- **The Vs / % of net calculator.** The signed structured deal becomes the input to the existing settlement calculator, but the calculator's math gaps are left as follow-on work. This slice fixes the deal, not the math.
- **The agent-facing settlement statement.** The Monday-morning PDF is a separate downstream artifact and a separate slice.
- **Live settlement during the show.** Not part of this slice.
- **Structured redlining.** When the agent declines, they leave a free-text comment, not a field-level proposed edit. This is a deliberate cut for v1 because it maps to how agents communicate today.
- **Agent accounts and login.** The magic-link approach sidesteps this. If agents engage deeply over time, we can formalize accounts later.
