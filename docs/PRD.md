# Tip Splitter — product requirements

## Goal
A one-page tip splitter: enter the bill, pick a tip, say how many people, and see each person's share. Source: `docs/discovery/product-foundation.md`.

## Users
Someone splitting a restaurant bill with friends, on a phone, at the table.

## Principles
- One screen, no sign-in.
- Show the working (bill, tip, total) next to each share.
- Never round down: shares add up to at least the total.

## Features
1. **Split calculator:** bill, tip (presets 15%, 18%, 20% or a custom percentage, D-001), number of people, each person's share rounded up to the cent.
2. **Remember my last choices:** the last tip and group size come back next visit (D-003).

## Out of scope
Uneven splits by item, currencies, sign-in, AI.

## Decisions
Product decisions are in `docs/discovery/decision-log.md` (D-001 to D-003).

## Change log
- 2026-11-27: first version from the product foundation.
