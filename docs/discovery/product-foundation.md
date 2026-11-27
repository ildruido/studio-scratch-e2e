# Product foundation

Refined from `starting-idea.md`. Decisions: D-001.

## Problem
Friends splitting a restaurant bill do the sum on a phone calculator: add the tip, divide by the people. It is slow, easy to get wrong, and nobody trusts the result. (Assumption)

## Target market
People splitting a restaurant bill with friends, at the table, on a phone. Not for: groups that split unevenly by item, or businesses. Launches as a single page for anyone with the link.

## Vision
At the table, one person enters the bill, taps a tip and the number of people, and everyone sees the same share within seconds.

## Value proposition
Faster and more trustworthy than a calculator, because it does the tip and the division in one screen. Reasons: preset tips (D-001), one result everybody can read, no sign-in.

## Key concepts
- **Bill:** the amount before tip.
- **Tip:** a percentage of the bill, picked from presets or typed (D-001).
- **Share:** total with tip, divided by the number of people, rounded up to the cent.

## Principles
- One screen, no sign-in: every extra step is a reason to fall back to the calculator.
- The result is always shown with its working (bill, tip, total), so people can check it.
- Money is never rounded down: the shares always add up to at least the total.

## Assumptions
- Most users split evenly. (Assumption)
- Rounding up per person is acceptable. (Assumption)

## Open questions
- Currency and locale formats.
