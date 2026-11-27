# Branch: competitor scan

Find and profile every way the target customer gets the job done today: direct and indirect competitors, substitutes, doing it by hand, doing nothing, and products that tried and died. Each one is verified at its primary source. It adds to the research skill's steps and removes none. A competitive analysis ([competitive-analysis.md](competitive-analysis.md)) builds on a finished scan.

**Default tier: standard.** A missed competitor invalidates every later comparison, so coverage matters more than depth here.

## Define competition from the customer's side

Start from the **job the customer is trying to get done**, not from the product's category. Competitors are anything the customer uses, or could use, to get that job done. Write the job statement in the protocol before searching ("When ___, I want to ___, so I can ___").

Classify every candidate:

| Class | Meaning |
| --- | --- |
| Direct | Same job, same customer, same kind of solution. |
| Indirect | Same job, different kind of solution (another product category, a service, a feature of a platform). |
| Substitute | Meets the underlying need differently (a different behaviour altogether). |
| Non-consumption and DIY | The customer does it by hand, with free tools, friends or freelancers, or does nothing. Often the biggest competitor. |
| Adjacent entrant | Not in the space now, but already has the customers, data or distribution to enter (a larger platform adding the feature). |
| Dead or failed | Products that tried and stopped, and why. They are evidence, not trivia. |

## Standard hypotheses

Pre-register these, with numbers in each kill criterion set before searching. S1 and S2 are key.

| Id | Hypothesis | Null or strongest alternative | Example kill criterion |
| --- | --- | --- | --- |
| S1 Coverage | The scan found the relevant ways the job gets done, in every class above. | Important competitors are missing. | A discovery route not yet used still turns up a relevant competitor in its last round, or fewer classes are covered than the minimum set in the protocol. |
| S2 Gap exists | No competitor serves the target customer's job well on the criterion the product cares about. | An existing solution already serves it. | A verified competitor offers it to the target customer at a price and effort they can bear. |
| S3 Crowding | The space is not so crowded that a new entrant cannot get attention. | Strong incumbents hold the customer's attention. | The leading players' share is above the threshold set in the protocol, with evidence. |
| S4 Incumbent inertia | Direct incumbents and adjacent platforms are not about to close the gap. | A visible roadmap or trend is closing it. | Dated evidence (releases, announcements, hiring, funding) that an incumbent is moving into the gap. |

## Discovery: many routes, stop on saturation

Single-route searches miss competitors. Use at least five of these routes, and log which found what:

1. Search by the **job** in the customer's words, not by category names.
2. Search by the **category** names (and their synonyms in each launch language).
3. App stores and marketplaces, with the category and the job words.
4. "Alternatives to X" and "X vs Y" pages for names already known (leads only: they are often affiliate content).
5. Community threads where target customers ask "what do you use for…?" (grade B; also read what they say about leaving a tool).
6. Review sites and complaint threads.
7. Funding, accelerator and launch databases (new entrants), and shut-down announcements (dead products).
8. Job postings, patents or integration directories of adjacent platforms (entrants).
9. Ask the evidence: what do the customers in the sources actually use? A name customers mention and the list lacks is added.

**Saturation rule (pre-register the numbers):** stop only when two successive routes yield no new relevant competitor and at least the minimum number of routes ran. A scan that stopped when the list "felt complete" is unsound.

## Profile each competitor

Use `.claude/packs/research/competitor-entry-template.md`: each entry gets an evidence id and sits in the report's evidence log. The rules:

- Verify every fact at the **primary source** (the competitor's own site, pricing page, store listing, terms, changelog, filings) and quote it with the access date. Nothing from memory.
- Separate **what they claim** from **what customers say**. Marketing claims are grade D for quality; customer voices are grade B.
- Record the real price (plan, limits, currency, date), including free tiers.
- Record traction signals only with a source (review count, downloads, funding, headcount, last update). Mark a product with no update in 12 months as stale.
- Record weaknesses from customer complaints and independent reviews, not from guesses.
- A product you could not try or open is profiled from what you could read, and the entry says so. When the gap matters, ask the App Creator for a hands-on check or use [external-research.md](external-research.md).

## Disconfirming search (required)

Per hypothesis, at least the tier minimum of searches built to find it false: a competitor that already does the product's job; customers saying an existing tool is good enough; evidence that incumbents are adding the feature. Search the DIY and non-consumption class on purpose, because it is the easiest to overlook. Search for dead products in the same space and read why they died.

## Type-specific checks (pre-register in the protocol)

- The job statement; the minimum number of routes and the saturation numbers; the rule for what counts as relevant.
- Every profile fact has a primary-source quote and date.
- The skeptic runs two discovery routes of its own and logs any competitor the scan missed. A missed relevant competitor is a must-fix.

## Extra outputs in the report

After Findings, add:

- **Landscape table:** every candidate, its class, its status (active, stale, dead) and the evidence ids.
- **Discovery log:** routes used, queries, what each found, and the result of the saturation test.
- **Excluded candidates** and the reason for each, so the exclusion can be challenged.
- **Customer-chosen alternatives:** what customers actually use, ranked by evidence, whether or not it looks like a competitor.
- **Open gaps in coverage:** languages, regions, closed communities or paywalled sources not searched.
