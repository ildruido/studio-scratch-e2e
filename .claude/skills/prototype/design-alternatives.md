# Branch: design alternatives, then pick

For when a prototype was rejected, or the whole look and feel of the product is undecided. Instead of iterating on a direction that was turned down, show three deliberately different ones side by side and let the App Creator pick. It replaces the steps of the prototype skill for this run; the first run command and the rules still apply.

## Steps

1. **Restate what the rejected version taught:** what worked, what was turned down and why, in the App Creator's words where you have them. Read its row in `<docs>/prototypes.md`, the MVP and the personas.
2. **Produce three alternatives on one board** (one self-contained page, published or saved like a prototype). They must differ in the idea of the whole journey, not in colours: a different organising idea, a different first screen, a different way through the core flow. For each alternative show:
   - the journey from first open to the MVP's core result, as a simple map;
   - its key screens, as sketches with sample data;
   - for a product people come back to, its main screen at a few points in time (first use, after some weeks, after a long gap), so it is clear how it ages;
   - strengths, weaknesses, and a rough build effort (small, medium, large) against the others.
3. **Mark what is beyond the MVP or the roadmap** as an idea, not a commitment.
4. **Recommend one,** and name the ideas worth borrowing from the other two.
5. **The App Creator picks:** one question, with your recommendation. Do not build the next prototype before the answer.
6. **Record the pick** with `node .claude/hooks/decisions.mjs add .. --fetch`: the direction chosen, the ideas kept from the others, the ideas parked.
7. **Write `<docs>/design-alternatives.md`:** what the rejected version taught, the three alternatives in a few lines each, the link to the board, the pick with the kept and parked ideas, and what was **not** checked (a real phone, real users). Add the board to `<docs>/prototypes.md` as its own row (outcome `closed` once picked; "Cannot test": demand, and anything about real use). Update the Discovery profile's Prototype look and feel row to the chosen direction (`discovery-profile set`), and your row in `<docs>/status.md`.
8. **Open one PR** titled `docs(discovery): design alternatives`, follow the Sign-off mode, and hand back. The next prototype version, in the chosen direction, is a new run of the prototype skill.

## Rules

- Three real alternatives. If two are variations of one idea, replace one.
- A board looks convincing and proves nothing about demand. Say so on the board itself and in the document.
