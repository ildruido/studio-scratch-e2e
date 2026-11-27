# Backlog

## In progress

## To test
### TS-001 Split a bill with a tip
- Why: Someone at the table gets each person's share in a few taps.
- Acceptance criteria:
  - [ ] Given the page is open, when I enter a bill of 100, tap 20% and set 4 people, then it shows each person pays 30.00 and the working (bill 100.00, tip 20.00, total 120.00).
  - [ ] Given a bill that does not divide evenly (50.00, 18%, 3 people), when the share is shown, then it is rounded up to the cent (19.67), never down.
  - [ ] Given the tip buttons 15%, 18% and 20%, when I type my own percentage instead, then the share uses my percentage.
  - [ ] Given no bill or fewer than 1 person, when I look at the result, then a short hint is shown instead of a share.
- Notes: plain module for the share maths with unit tests; no capability needed.

## Ready
### TS-002 Remember my last tip and group size
- Why: Next visit starts where the last one ended.
- Acceptance criteria:
  - [ ] Given I chose 18% and 4 people, when I reopen the page, then 18% and 4 people are already selected.
  - [ ] Given saving is unavailable or denied, when I use the page, then it still calculates and says nothing is saved.
- Notes: uses the `db` capability (`{"db": {}}`); adding it is a release-note item. Depends on TS-001.

## Backlog

## Later

## Done
