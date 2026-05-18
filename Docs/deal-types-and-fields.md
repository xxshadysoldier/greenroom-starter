# Deal Types & Fields

One form, adaptive fields. The user picks a deal type first; the form reveals only the sections that apply to that type.

---

## Field matrix

| Field | Flat | Vs | % of Net | % of Gross | Door |
|---|---|---|---|---|---|
| Guarantee amount | **Required** | **Required** | — | — | Optional |
| Percentage | — | **Required** | **Required** | **Required** | **Required** |
| Percentage basis | — | Net (locked) | Net (locked) | Gross (locked) | Door (locked) |
| Expense cap | — | Recommended | Recommended | — | — |
| Hospitality cap | — | Recommended | Recommended | — | — |
| Recoups | Rare | **Common** | **Common** | Sometimes | Sometimes |
| Deduction order | — | Required if recoups | Required if recoups | Simplified | Simplified |
| Comp counting rules | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| Bonuses / tier ratchets | Possible | **Common** | **Common** | Possible | Possible |
| Walkout pot | — | Rare | Rare | — | **Common** |

---

## Form behavior by deal type

**Flat.** Just guarantee + optional bonuses + comp counting rules. Most of the form is hidden. No caps, no recoups, no deduction order.

**Vs.** The most complete form. Shows everything: guarantee, percentage, both caps, recoups (with full bucket and applies-at questions), deduction order, comp rules, bonuses.

**% of net.** Same as Vs minus the guarantee field. No floor.

**% of gross.** Percentage + recoups (simplified: bucket auto-set to "off gross pre-split" because there's no cap) + comp rules. No expense or hospitality cap.

**Door.** Percentage of door + optional guarantee + walkout pot + comp rules. Simpler recoup model.

---

## Field-level rules

- **Percentage basis is locked per deal type.** Don't ask the user to pick — derive it from the deal type and show it as a read-only label.
- **Recoup card adapts.** On Vs and % of net, the bucket question (inside cap / outside cap / off gross pre-split) is required. On % of gross and Door, the bucket auto-resolves to "off gross pre-split" with no choice shown.
- **Deduction order section is conditional.** Skip rendering it entirely if the deal has zero recoups and no expense cap — there's nothing to order.
- **Comp counting rules apply universally.** Show for every deal type, including flat.

---

## Validation principle

Required fields change with deal type. The "Send for sign-off" button is gated by the required-field set for the *currently selected* deal type, not a global one. This is what enforces "the form cannot send an ambiguous deal."

---

## Implementation hint

One form component, one data model (the union of all fields). Sections render conditionally based on `deal.dealType`. Validation rules are a function of `deal.dealType`. Do not build five separate forms.
