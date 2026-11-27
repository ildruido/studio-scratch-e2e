// Share maths for the tip splitter. Pure and DOM-free; money is whole cents so there is no float drift.

export type Split = { billCents: number; tipCents: number; totalCents: number; shareCents: number };

/** Parses "50", "50.5" or "50,25" into cents; null when empty, not a number or negative. */
export function parseMoney(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;
  return Math.round(Number(t) * 100);
}

/** The tip is rounded to the cent; each share is rounded UP to the cent, so shares never add up to less than the total. */
export function split(billCents: number, tipPercent: number, people: number): Split | null {
  if (!Number.isFinite(billCents) || billCents <= 0) return null;
  if (!Number.isFinite(tipPercent) || tipPercent < 0) return null;
  if (!Number.isInteger(people) || people < 1) return null;
  const tipCents = Math.round((billCents * tipPercent) / 100);
  const totalCents = billCents + tipCents;
  return { billCents, tipCents, totalCents, shareCents: Math.ceil(totalCents / people) };
}

export const money = (cents: number): string => (cents / 100).toFixed(2);
