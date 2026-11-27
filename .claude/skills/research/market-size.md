# Branch: market size

Size a market (total, reachable, obtainable: TAM, SAM, SOM) with estimates from two directions that must agree, explicit assumptions with ranges, and a search for the lower number. It adds to the research skill's steps and removes none.

**Default tier: standard.** Use deep when a go or no-go, an investment or a price rests on the number. A market size is the easiest figure to inflate, so the guardrails are strict.

## Before pre-registering

Fix the **sizing definition** with the App Creator if the app's documents don't settle it. One question at a time, each with your recommended answer:

- **Unit of count:** who or what is counted (customers, accounts, households, organisations)?
- **Value basis:** revenue per year at which price and model?
- **Geography and time:** which markets, which year, which horizon (now, three years)?
- **Segment boundary:** who is in, who is out.
- **Minimum threshold:** the reachable market the business needs, set before the search.

Record it in the protocol. Changing it later is a logged deviation.

## Standard hypotheses

Pre-register all of these, with numbers in each kill criterion set before searching. M1 and M2 are key unless the protocol says otherwise. You may add more; don't drop these.

| Id | Hypothesis | Null or strongest alternative | Example kill criterion |
| --- | --- | --- | --- |
| M1 Big enough | The reachable market (SAM) clears the minimum threshold. | It is too small to sustain the business. | Sourced estimates put the base case and the high case of SAM below the threshold. No usable estimate is Insufficient evidence, not a trigger. |
| M2 Methods agree | Top-down and bottom-up estimates fall within 3x of each other, or the gap has a sourced explanation. | The two disagree and we cannot tell which is right. | A method check, so no kill criterion of its own: a gap above 3x with no sourced explanation gives Insufficient evidence, never an average and never Proceed. |
| M3 Payers exist | The target segment already spends money on comparable solutions. | They get this done free or not at all. | Independent evidence that the segment does not pay for comparable solutions. No evidence either way is Insufficient evidence. |
| M4 Healthy trend | The segment is stable or growing over the last 3 to 5 years. | It is shrinking or the spend is moving elsewhere. | Independent evidence of decline in the unit count or the spend. |
| M5 Reachable | There is an identifiable, affordable way to reach the buyers at the assumed cost. | Buyers exist but cannot be reached at a viable cost. | Every identified channel costs more per customer than the customer is worth. |

## Method

1. **Count units before money.** Establish the number of units from the most primary source available (registries, official statistics, platform data, trade bodies). Then apply price.
2. **Bottom-up:** reachable units x share that has the need x share that would realistically pay x realistic price x purchase frequency. Every factor is an entry on the assumptions register.
3. **Top-down:** start from a published larger market and narrow by segment, geography and who pays. Trace the larger figure to its origin. If the origin is a paid report's summary, treat it as grade D and find the underlying data, or say it is a lead only.
4. **Third check when possible (analogue or proxy):** the size or spend of a similar market, or the revenue of known players divided by their likely share. This catches errors the first two share.
5. **Ranges, not points.** Every assumption has low, base and high values and an evidence id or the label `(Assumption)`. Compute TAM, SAM and SOM at low, base and high. A point estimate alone is a failed output.
6. **Sensitivity.** Vary each assumption alone across its range and rank by swing. Report the top three. If one assumption drives more than half the swing and has no grade A or B source, say the number rests on it.
7. **Reconcile.** Compare the methods. Explain any gap with named assumptions. Never average two methods to hide a gap.
8. **Penetration reality check:** SOM follows from a stated reach, conversion and time path, not from "1% of the market". Compare it with the share comparable products really reached, with evidence.

Use `.claude/packs/research/sizing-sheet-template.md`, saved as `sizing.md` in the study folder. A spreadsheet or market-sizing skill, when the session has one, may do the arithmetic or the presentation afterwards; every input still comes from the evidence log. Without one, the sheet is enough.

## Source rules

- A market size from a vendor, a seller of market reports or an AI summary is a lead. Trace it to its method; if it has none, it cannot carry a claim.
- Count a statistic once however many pages repeat it. Record its date, geography and definition; mismatched definitions ("users" versus "paying customers") are the commonest error. Reject or adjust, and log it.
- Record currency, year and price basis for every figure. Convert explicitly.
- Growth forecasts from sellers of reports are grade D. Prefer observed history to forecasts.

## Disconfirming search (required)

Per hypothesis, at least the tier minimum of searches built to find it false: evidence the segment is smaller, shrinking or doesn't pay; reasons similar markets stayed small; failed companies that targeted this segment and why; estimates well below yours. Search for the figure that would embarrass you. Log what was found and what was not.

## Type-specific checks (pre-register in the protocol)

- The sizing definition, the threshold and the file name `sizing.md`. The skeptic reads the sheet's inputs (definition, assumptions, bottom-up, top-down, third check) first, and its Reconciliation, Sensitivity and Result sections only after forming its own view.
- Any size claim without a traced origin is rejected.
- Definitions of the counted unit match across sources.
- Base-case numbers lie within the sourced range, not outside it.
- The SOM path is stated and is not a flat percentage.
- At least one estimate lower than the lead's was sought and logged.

## Extra outputs in the report

After Findings, add:

- **Sizing summary:** TAM, SAM and SOM at low, base and high, each with the method and confidence.
- **Assumptions register:** every assumption, its range, evidence id or `(Assumption)`, grade and sensitivity rank.
- **Reconciliation:** how the methods compare and why any gap exists.
- **Cheapest ways to firm up the top three assumptions** (the primary research that would settle them).

## Verdict mapping

Use the framework's study verdicts. M1 contradicted at high confidence is Stop. M2 insufficient is Needs primary research, never Proceed.
