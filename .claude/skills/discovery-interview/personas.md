# Branch: target users and personas

Builds on: the product foundation and a finished **user reality check** (a study run with the `research` skill; `docs/research/studies.md` lists it). Without a finished reality check whose verdict the App Creator has seen, do not write personas: say so and recommend running the study first. If its verdict was Reshape or Stop, the App Creator's recorded decision on it comes before any persona.

Build from the report's evidence-backed traits, segment candidates and look-alikes. Personas split where the evidence splits, not where imagination does.

## Outline

- **Evidence:** the study the personas rest on, the share of traits backed by evidence, and any persona marked speculative (filled in by the audit below).
- **Two to four personas.** For each: role, goals, pains, what they use today, budget and time, what would make them pay, and one quote.
- **The primary persona** for the MVP, with the reason.
- **At least one anti-persona:** someone who looks like a target user but is not, from the report's look-alikes.
- **Assumptions:** every `(Assumption)` in the document, each with how it could be tested.
- **Open questions.**

## Rules this document adds

- Every trait carries its evidence id from the study (`[E-NN]`) or `(Assumption)`.
- A quote is real, short and taken from the study's evidence log with its source, or it is labelled "illustrative". Never present an invented quote as real.
- Names, ages, pictures and similar colour are labelled illustrative.

## Evidence audit (before the PR)

Run it as a separate pass after the draft: re-read the reality check's report, then check the draft against it line by line.

1. **Every trait is tagged** with an evidence id or `(Assumption)`.
2. **The core is evidence-backed:** each persona's main pain and what they use today rest on evidence the study rated medium or high confidence. The primary persona cannot be the exception. A persona that fails this is marked **speculative**, with the reason, or removed.
3. **No contradictions:** no trait goes against the evidence, and no persona exists that the evidence did not suggest unless it is marked speculative.
4. **Honest quotes and details:** as in the rules above.
5. **At least one anti-persona** from the study.
6. **Assumptions are listed** with a way to test each; they are candidates for the next studies and for the riskiest hypotheses.

Write the result in the **Evidence** section. If the audit leaves the primary persona speculative, say so first in your message to the App Creator: it is the main finding.
