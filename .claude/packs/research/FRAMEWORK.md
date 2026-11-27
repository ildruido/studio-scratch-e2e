# Research method

How every study in this app is run, so that research informs a decision instead of confirming it. It applies to any kind of research: desk research, interviews, surveys and tests. The `research` skill is the procedure; this file is the method and its rules.

## Why it exists

Everyone running the research wants the idea to work. The App Creator backs the idea. Claude tends to agree with whoever frames the question, and it can misread or invent a source. Left alone, that combination finds what it went looking for. The method makes that hard to do by accident:

- The questions and the pass or fail rules are fixed **before** anyone searches.
- Evidence **against** the idea is searched for as hard as evidence for it.
- Every claim traces to a source someone actually opened.
- Someone who did not do the research attacks it before the App Creator sees it.
- The guardrails get stronger as the cost of being wrong goes up.

## Two layers

- **Generic layer** (every study): this file, the `research` skill's steps, the `research-skeptic` agent, and the protocol and report templates in this folder.
- **Type layer** (one branch file of the skill per kind of research): the standard hypotheses, the source mix, the default tier and the extra outputs for that kind. A branch can add guardrails and **never removes** a generic one.

| Research type | Branch of the `research` skill | Default tier |
| --- | --- | --- |
| Any research without a branch | none: the generic steps | chosen per study |
| User reality check: does the target group exist, does it have the problem, how does it cope today | `user-reality-check.md` | standard |
| Market size: top-down and bottom-up estimates that must agree, assumptions with ranges | `market-size.md` | standard (deep for a go or no-go) |
| Competitor scan: every way the customer gets the job done today, including doing it by hand, doing nothing and dead products | `competitor-scan.md` | standard |
| Competitive analysis: criteria first, then a scored comparison of verified competitors | `competitive-analysis.md` (needs a finished scan) | standard (deep for a positioning bet) |
| Outside research tool: a second route, or sources Claude cannot open | `external-research.md` (an addendum to a study, not a study of its own) | the study's tier |

## Biases the method guards against

| Bias | How it would show up | Guardrail |
| --- | --- | --- |
| Confirmation bias | Searching "<target users> struggle with <problem>" and finding exactly that | Two-sided search with a quota of disconfirming queries; a required "strongest evidence against" section |
| Moving the goalposts | Deciding what counts as success after seeing the data | Kill criteria pre-registered and merged to `main` before the first search; later changes only as logged deviations |
| Anchoring | The original idea frames every question | Each hypothesis has a stated null or strongest alternative; priors are declared up front; the skeptic reads cold |
| Sycophancy (AI) | Claude softens bad news for the person who asked | Verdict rules applied mechanically; an independent skeptic that never sees the conversation |
| Invented or misread sources (AI) | A statistic that does not exist, or says something else | Every cited source opened and the supporting passage quoted; the skeptic re-checks |
| Conflict of interest | "73% of <target users> say…" from a company that sells to them | Source grades and an interest flag; vendor material never carries a claim alone |
| Citation laundering | Ten articles repeating one survey look like ten sources | Statistics traced to their origin and counted once |
| Survivorship and loudness | Online we mostly see successful users and loud complainers | Planned searches for the quiet and the failed (people who quit, tools people abandoned); missing voices named in the report |
| Anecdote as data | One popular thread treated as a segment | Voices and numbers kept apart; confidence rules require independent sources |
| Absence as evidence | "We found nothing against it" read as "it is true" | A separate "Insufficient evidence" verdict; a "what we could not find" section |
| Wrong time or place | Old data from one country used for a launch elsewhere today | Date and geography recorded for every source; scope set in the protocol |
| Overclaiming | "Validated", "proven", "everyone" | Calibrated wording: a hypothesis is "supported at medium confidence", never "validated" by desk research |
| Borrowed confidence | A list of sources from a research tool, or sources someone else says they read, counted as if opened | An **Opened** column in the evidence log; unopened sources carry no weight unless the App Creator accepts them in a recorded decision, and then they keep their label everywhere |

## Roles

| Role | Who | Does | Must not |
| --- | --- | --- | --- |
| Sponsor and decision owner | The App Creator | Names the decision the study informs. At deep tier, approves the kill criteria before the search starts. Reads the report and decides. | Hint at the expected answer while the study runs. Change the kill criteria after seeing results (only as a logged deviation). |
| Lead researcher | Claude, running the study | Writes the protocol, searches, keeps the evidence log, writes the report, answers the skeptic. | Drop inconvenient evidence. Search before the protocol is on `main`. |
| Contrarian | Claude, as a separate pass inside the search step | Runs the disconfirming queries and writes the strongest case against each hypothesis. | Stop at the first weak counter-example. |
| Skeptic | Light: the lead, as a separate self-review pass. Standard and deep: the `research-skeptic` agent, in a fresh context. | Re-checks sources, reaches its own verdict from the evidence before reading the lead's, then attacks the gaps. | See the conversation, the sponsor's hopes or the product pitch before forming its own verdict. |
| Replicator | Deep tier only: a second fresh agent | Runs the same protocol without seeing the first run, so the two can be compared. | Read the first run's evidence or report. |

## Steps (every study)

1. **Frame.** Name the decision the study informs and what would be done differently on a yes and on a no. If nothing would change, don't run the study.
2. **Pick the tier** by the cost of being wrong, not by the time available (table below).
3. **Pre-register.** Write `protocol.md` from the template: the hypotheses as falsifiable claims, each with its null and a kill criterion that could really happen (triggered by evidence, never by finding nothing; a pure method check may instead state what its failure yields, such as Insufficient evidence), the scope, the search plan (neutral and disconfirming queries), the time box, and Claude's declared priors (what it already believes and has already seen). Merge it to `main` in its own small PR **before the first search**. That commit on `main`, earlier than the report's, is the proof.
4. **Search both ways.** Neutral wording, never leading queries. At least as many disconfirming queries as supportive ones. Look for the people who are missing.
5. **Log every relevant source** in the evidence log as it is found, against as carefully as for. Exclude only by the protocol's rules, and say why.
6. **Verify.** Open each cited source and quote the passage that supports the claim. Trace statistics to their origin. A source that can't be opened is marked unverified and carries no weight.
7. **Grade and conclude** with the rules below. Write `report.md` from the template: verdict first, then the strongest evidence against, then the findings.
8. **Skeptic review** at the strength the tier asks for. The lead fixes or rebuts every must-fix item in the report. Disagreements stay visible.
9. **Decide.** The App Creator reads the report and decides. The decision is recorded in the app's decision log with a link to the report.

## Tiers

| Guardrail | Light | Standard | Deep |
| --- | --- | --- | --- |
| Pre-registered protocol, merged to `main` before searching | yes | yes | yes |
| Kill criteria approved by the App Creator before searching | no | no | yes |
| Disconfirming queries per hypothesis (minimum) | 1 | 2 | 3, plus a search for failed or abandoned cases |
| Evidence log with grades and verified quotes | yes | yes | yes |
| Skeptic review | self-review pass | `research-skeptic` agent | `research-skeptic` agent plus a pre-mortem |
| Skeptic re-checks sources | a sample of 5 | every source behind a high or medium confidence claim, plus 5 others | all |
| Independent replication | no | no | yes |
| Use it for | quick fact checks, low-stakes scoping | inputs that shape a product decision or a document others rely on | go or no-go calls, pricing, big bets |
| Extra cost | none | one agent run | two agent runs and the App Creator's time up front |

When unsure between two tiers, take the higher one.

## Evidence grades

| Grade | Source type | Can carry a claim? |
| --- | --- | --- |
| A | Primary data with a stated method: official statistics, academic studies, surveys with a stated sample and method, platform data reports with a methodology | yes |
| B | First-hand voices of the people the claim is about: forum and community threads, published interviews, posts by people in the target group | yes, but they show that something happens, not how common it is |
| C | Secondary commentary: journalism, blogs and talks that cite data or experience | only alongside A or B |
| D | Interested or unsourced material: vendor marketing and vendor surveys, AI-generated summaries and research-tool output, claims with no traceable source | never on its own; use it as a lead to an A or B source |

Every entry also records the publisher, date, geography, sample (if any), whether it was **opened**, and an **interest flag**: does the source benefit if the claim is true?

**Independence:** two sources are independent only if neither relies on the other or on a shared origin. Ten articles quoting one survey count as one source, graded as the survey.

**Opened:** a source counts only when the lead opened it and quoted the passage. The Opened column says `yes`, `no (unverified)` or `no (accepted, not opened)`. The last is used only for sources that an outside tool or person reports and the App Creator accepted in a recorded decision (`external-research.md`); that label is repeated wherever the source or a verdict resting on it is mentioned, and the report shows the verdict with and without those sources.

## Confidence and verdicts

Confidence in a claim:

- **High:** at least two independent sources, at least one graded A, no A-grade evidence against, and any B-grade evidence against coming from fewer independent communities than the evidence for.
- **Medium:** one A source, or B voices from at least three independent communities (different platforms, niches or countries), with the evidence against weaker than the evidence for.
- **Low:** anything less, or strong evidence on both sides.
- **Unverified:** the source could not be opened or did not say what was claimed. It carries no weight.

Voices show that something happens, never how common it is. A claim about size, share or frequency ("most users…", "thousands of…") needs an A source to reach medium or high confidence.

Verdict per hypothesis:

- **Supported:** medium or high confidence, and the kill criterion not triggered.
- **Contradicted:** the kill criterion is triggered, or the opposite claim reaches medium or high confidence.
- **Mixed:** credible evidence on both sides.
- **Insufficient evidence:** too little to say. This is not a pass.

Study verdict, for the App Creator. Each protocol marks which hypotheses are **key**: the ones the decision can't survive without.

- **Proceed:** every key hypothesis is supported.
- **Reshape:** something important is mixed or contradicted; the report proposes what to change.
- **Stop:** a key hypothesis is contradicted at high confidence.
- **Needs primary research:** desk research can't settle a key hypothesis; the report says which test would.

A triggered kill criterion forces Reshape or Stop, whatever the lead's view. The App Creator can still overrule it; the override is recorded as a decision with its reason.

## What desk research cannot tell

Desk research shows whether a group exists, what it does and what it says hurts. It cannot show whether people would switch to the product, use it or pay for it: what people say and what they do often differ. Every report names the primary research that would settle what it couldn't (interviews, a fake-door test, a prototype test), as candidates for the next studies.

## Ethics

Quote public posts briefly and link to them. Don't record usernames or personal details beyond what a claim needs. Respect each site's terms.

## Where studies live

Each study gets a folder `docs/research/R-NNN-<slug>/` holding `protocol.md` (merged first, in its own PR), `report.md` with the evidence log, `replication.md` at deep tier, and any working files its branch defines (a sizing sheet, an outside tool's prompt and pasted output). A study reaches `main` in two PRs: the protocol with its index row before the first search, then everything else once the skeptic's review is answered. The app squashes each PR into one commit, so only a protocol merged on its own keeps a commit that is visibly earlier than the report's. The index of all studies is `docs/research/studies.md`. The id and the index row come from `node .claude/packs/research/studies.mjs`, never picked or typed by hand, so two threads don't take the same id once the first has pushed.
