import { money, parseMoney, split } from "../split";

const PRESETS = [15, 18, 20];

/** The tip splitter page: bill, tip (preset or custom), people, and each person's share with the working. */
export function mount(root: HTMLElement): void {
  const section = document.createElement("section");
  section.innerHTML = `
    <label>Bill <input id="bill" inputmode="decimal" autocomplete="off" placeholder="0.00" /></label>
    <fieldset>
      <legend>Tip</legend>
      ${PRESETS.map((p) => `<button type="button" class="tip" data-tip="${p}" aria-pressed="false">${p}%</button>`).join("")}
      <label>Custom % <input id="tip-custom" inputmode="decimal" autocomplete="off" /></label>
    </fieldset>
    <label>People <input id="people" type="number" min="1" step="1" value="2" /></label>
    <output id="result" aria-live="polite"></output>`;
  root.append(section);

  const $ = <T extends HTMLElement>(id: string) => section.querySelector<T>(`#${id}`)!;
  let tip: number | null = null;

  const render = () => {
    const bill = parseMoney($<HTMLInputElement>("bill").value);
    const people = Number($<HTMLInputElement>("people").value);
    const out = $("result");
    const result = bill !== null && tip !== null ? split(bill, tip, people) : null;
    if (!result) {
      out.textContent = "Enter the bill, pick a tip and set at least 1 person to see each share.";
      return;
    }
    out.innerHTML = `<strong id="share">Each person pays ${money(result.shareCents)}</strong>
      <span id="working">Bill ${money(result.billCents)} + tip ${money(result.tipCents)} = total ${money(result.totalCents)}</span>`;
  };

  const setTip = (value: number | null) => {
    tip = value;
    section
      .querySelectorAll<HTMLButtonElement>(".tip")
      .forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.tip) === value)));
    render();
  };

  section.querySelectorAll<HTMLButtonElement>(".tip").forEach((b) =>
    b.addEventListener("click", () => {
      $<HTMLInputElement>("tip-custom").value = "";
      setTip(Number(b.dataset.tip));
    }),
  );
  $("tip-custom").addEventListener("input", () => {
    const v = parseMoney($<HTMLInputElement>("tip-custom").value);
    setTip(v === null ? null : v / 100);
  });
  $("bill").addEventListener("input", render);
  $("people").addEventListener("input", render);
  render();
}
