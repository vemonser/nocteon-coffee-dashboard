# DASHBOARD HOME — ROUND 2 — the acceptance criteria

This file is the authoritative source for the Round-2 evidence manifest.
Every criterion below is one acceptance check from the round's brief; the
ids are stable and are the ids the manifest uses.

## Phase 1 — The numbers reconcile

- **AC-01** Given every revenue/orders widget on the dashboard, when the
  data is reconciled against the API, then each widget's endpoint, whether
  it sends the selected range, its formula and its observed value are
  written down, and the root cause of the mismatch between the revenue
  card and the revenue breakdowns is stated in one paragraph.
- **AC-02** Given the dashboard's order count and the Orders page's order
  count, when a reader compares them, then both state the scope they count
  — identically, from one shared definition — and the refund rate uses the
  same denominator, with "refunded" reported as a payment flag and a
  cancelled order reported as able to be refunded.
- **AC-03** Given the previous period is 0 and the current one is not,
  when a KPI card renders its delta, then it shows an em dash with the
  reason "No data in the previous period" and not a "New" badge, and the
  "New" badge is kept only on the new-customers card; the existing tests
  are kept and the previous = 0 cases are added.
- **AC-04** Given the dashboard, the Orders list, the order detail page,
  the tooltips and the CSV export, when an order number is printed, then
  every one of them uses the one shared helper, and the places that
  formatted it differently are reported.
- **AC-05** Given an amount is printed anywhere in the app, when it is
  formatted, then the one shared formatter is used: "EGP 1,176.25" in
  English and "1,176.25 ج.م" in Arabic (Latin digits, no trailing dot),
  the axis ticks are compact in the same style, the store-currency source
  is reported, and the grep for money formatting outside the formatter is
  empty.
- **AC-06** Given the admin's own account appears as a customer in the
  business widgets, when the data is inspected, then whether the
  dashboard endpoints exclude staff accounts is reported, and no row is
  hidden in the frontend to fake it.
- **AC-07** Given the devices widget counts a large majority on one
  platform, when the endpoint is inspected, then what it counts (sessions
  vs users, and whether dev/bot/admin traffic is filtered) is reported,
  the unit is labelled consistently, and nothing is filtered in the
  frontend.

## Phase 2 — Language and formatting

- **AC-08** Given the Arabic UI, when it is read, then "sessions" is
  translated in the right plural form and the unit follows the number in
  both languages, and the e2e check flags any Latin-only UI word that is
  not an allowlisted proper noun; every other untranslated string found
  is reported.
- **AC-09** Given the Arabic revenue summary line, when it is rendered,
  then the currency, the numbers and the date keep their order, and a
  screenshot assertion covers that line.
- **AC-10** Given a card with tabs, when a tab is active, then the card
  title follows it ("Revenue by origin", "Orders by status") in both
  languages, and the range scope badge is in the same position in every
  card.
- **AC-11** Given a chart axis, when its labels are rendered, then they
  use one style — compact, with the currency — in both languages and both
  modes.
- **AC-12** Given the dashboard's range control and the cards' tabs, when
  they are rendered, then they are the same tab component, and the Revenue
  by card has an Origin, a Roast level and a Category tab.

## Phase 3 — Colour and donuts

- **AC-13** Given a donut's centre, when it is rendered, then it uses the
  foreground token at 4.5:1 or better against the card in both modes, it
  uses the compact currency, it never leaves the ring, and its label says
  what the number is ("Revenue" / "Orders") rather than the tab name.
- **AC-14** Given the dark mode's status colours, when they are
  rendered, then they are the muted semantic values rather than the neon
  green and the bright cyan, the contrast of every swatch against the
  card is reported, and the light mode's palette is unchanged.
- **AC-15** Given two swatches that are shown side by side, when they are
  compared, then their hue distance is reported with a numeric measure
  and the pairs that are too close are listed with the fix.
- **AC-16** Given a chart's legend, when it is rendered, then it is a
  single aligned column — the colour dot, the name, the value and the
  percentage in fixed columns — always below the chart, in the ring's
  order, and readable in RTL.
- **AC-17** Given a breakdown, when it is drawn, then a donut is used
  only for 3-5 slices, every donut on the page has the same diameter, a
  single-slice dataset renders as a stat plus a bar, and the slices per
  donut are reported.

## Phase 4 — KPI cards and layout

- **AC-18** Given the four primary KPI cards, when they are rendered,
  then their padding and their baseline are the same, and the measured
  offsets are reported.
- **AC-19** Given a KPI card's daily series, when it has fewer than three
  points, then no sparkline is drawn and no space is reserved for it,
  and the rule is tested with 1, 2 and 7 points.
- **AC-20** Given the secondary strip, when it is rendered, then its
  labels are the same size and weight as the primary cards', and
  "currently online" stays a live indicator rather than a period KPI.
- **AC-21** Given the cards of a row, when they are rendered, then they
  share one height and no card is more than 1.5x the content it holds;
  each card's content-height ratio and the page height at 1440 are
  reported before and after.
- **AC-22** Given the recent orders, when a row is read, then the
  relative time carries the full date and time in its tooltip, the row
  links to the order, and the customer column shows the order's customer
  name and the order number in the shared format.
- **AC-23** Given the top products, when they are read, then the column
  header states what the bar and the number represent (units sold), the
  Arabic plural is the proper one, and the bar scales to the maximum.

## Phase 5 — Verification

- **AC-24** Given the round is finished, when the evidence is produced,
  then the full matrix is re-run, a before/after contact sheet exists for
  every cell, and design.md and DECISIONS.md are updated.
- **AC-25** Given the round is finished, when the suites are run, then
  the unit tests pass and the e2e passes in every cell, including the
  runtime language switch.
