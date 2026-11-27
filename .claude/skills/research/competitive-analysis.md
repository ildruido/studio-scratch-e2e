# Branch: competitive analysis

Compare the product with verified competitors on criteria set from the customer's job, find the real gaps and threats, and state honestly where the product is weaker. It adds to the research skill's steps and removes none.

**Needs a finished competitor scan** ([competitor-scan.md](competitor-scan.md)) whose report passed skeptic review. If none exists, run it first. Never analyse a list built from memory. Reuse the scan's verified entries; re-check any entry older than 90 days or about a fast-moving product.

**Default tier: standard.** Use deep when the analysis decides a positioning or pricing bet.

## Core rule: criteria before competitors

Choose and weight the comparison criteria **before** reading any competitor's profile for this analysis. Criteria come from the customer's job and from what the evidence says the customer values (grade A or B), not from the product's feature list. Pre-register them in the protocol with weights and the reason each matters. Add on purpose the criteria the customer cares about where the product is weakest; a criteria set made of the product's strengths is rejected.

Before the protocol is merged, read only two things from the scan's report: its landscape table (the competitor names and classes) and its "Customer-chosen alternatives" section with the customer voices quoted there. Don't open the competitor entries in its evidence log yet: they are the profiles. A criterion added after seeing the data is a logged deviation, and the result is shown with and without it.

## Standard hypotheses

Pre-register these with numbers in each kill criterion. C1 and C2 are key.

| Id | Hypothesis | Null or strongest alternative | Example kill criterion |
| --- | --- | --- | --- |
| C1 Meaningful gap | On the criteria that matter most to the customer, no verified competitor serves the target customer well, and the gap is large enough to matter. | A competitor already serves it well enough. | A verified competitor scores at or above the product's intended level on the top-weighted criteria. |
| C2 Durable | The gap is hard to close: it rests on something competitors cannot copy cheaply or quickly (data, trust, distribution, a different model). | It is a feature competitors can add in a release. | Evidence that a competitor can ship it within the stated horizon, or has started. |
| C3 Customers would switch | The pain of the current solution is larger than the cost of switching. | Customers stay with what they have. | Independent customer evidence that switching costs or habit outweigh the pain. |
| C4 Position is claimable | There is a position customers can understand and believe, which no competitor already holds. | The position is taken or unbelievable. | A competitor already owns the same message, with evidence that customers believe it. |

## Method

1. **Set criteria and weights** (above). Record the evidence for each.
2. **Score from evidence, not impressions.** Score each competitor and the product's intended position on each criterion on a 0 to 3 scale defined in the protocol (for example 0 absent, 1 weak, 2 adequate, 3 strong), each score linked to evidence ids. An unscored cell is allowed and shown as "unknown". Never fill an unknown with a guess.
3. **Score the product by status:** exists, planned, hoped. Only "exists" counts in the base case; show the planned case separately.
4. **Capability matrix and position map.** Build the matrix. Add a two-axis map using the two criteria that best separate the competitors, and say why those two. Show the weighted and the unweighted result, and how the ranking changes when each weight moves by one step.
5. **Run each classic frame as a check, not decoration:** fit with the job, switching barriers, and moats and threats (what stops a competitor, or a large adjacent platform, copying the product). Use SWOT or similar only if it adds something the matrix doesn't.
6. **Anticipate responses.** For the top threats, write the most likely reaction and what evidence would show it starting (hiring, releases, pricing moves). List these as leading indicators to watch.
7. **Pricing and positioning landscape:** what competitors charge and claim, where the unoccupied positions are, and why they may be unoccupied (no demand is a valid reason).

A plugin skill that builds a competitive brief or deck, when the session has one, can present the finished analysis for another audience. It works from this report and adds no claim the evidence log lacks. Without one, the report is the deliverable.

## Honesty section (required): "Where we lose"

Write the strongest case that a customer would choose a competitor, or do nothing, competitor by competitor, in the customer's own reasons. State which of the product's planned advantages are unproven. The skeptic rejects a report whose "Where we lose" section is empty or token.

## Disconfirming search (required)

At least the tier minimum per hypothesis, built to show the gap is not real or is closing: customers praising the incumbent, recent releases or announcements closing the gap, successful entrants holding the same position, failed attempts at it, and reasons the position was left empty.

## Type-specific checks (pre-register in the protocol)

- The criteria, weights and scoring scale; unknown is not zero; only existing capabilities count in the base case.
- The list of competitors taken from the scan, with the scan's study id.
- The skeptic checks that the criteria predate the scoring, that every score has evidence, and that "Where we lose" is real.

## Extra outputs in the report

After Findings, add:

- **Criteria and weights**, with their evidence and the pre-registration commit.
- **Capability matrix** with scores, evidence ids and unknowns.
- **Sensitivity of the ranking** to the weights and to the planned-versus-existing split.
- **Where we lose.**
- **Moats and threats**, with the leading indicators to watch.
- **Positioning options:** two or three, each with its evidence, its risk and what would prove it wrong.
- **Primary research that would settle what desk work could not** (for example a switching test or a message test).

## Verdict mapping

Use the framework's study verdicts. C1 or C2 contradicted at high confidence is Stop; contradicted at medium confidence is Reshape (of the positioning). C1 supported only by "unknown" scores is Insufficient evidence.
