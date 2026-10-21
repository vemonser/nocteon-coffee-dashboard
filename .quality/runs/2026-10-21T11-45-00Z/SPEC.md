# Order Details v3 — acceptance spec

Source of truth for the Evidence Gate. Scope: the order DETAIL page
(`/dashboard/orders/:id`) only. The Orders list, Reviews and every other page
are out of scope.

Branch: `ui/order-details-v3`, cut from `main` at `e9bedb65`.
Design reference: `design.md` (tokens only). Deliverables: `DECISIONS.md`,
`SEED_PROPOSAL.md`, `API_GAPS.md`, `evidence/order-details-v3/{before,after,extra}`.

Data reality this spec is written against: history/notes are empty, no order
has a shipment, no payment has `paidAt` or `transactionReference`, all 17 orders
share one `createdAt`, and orders 6/7/9/10/12/14/15 have no items.

---

## Page contract

- **AC-01** — Given the detail page is open, when it renders, then the
  breadcrumb reads `Operations > Orders > ORD-…` and the `Orders` crumb links
  to the orders list **with the list's filters preserved** when the user came
  from a filtered list.
- **AC-02** — Given an order in a mutable status, when the status dialog opens,
  then it offers only the transitions the state machine allows, plus a note
  field and a notify-customer control, and it resets between opens.
- **AC-03** — Given an action the store cannot perform, when the header
  renders, then the action is visibly disabled and exposes the reason (tooltip
  + accessible title), never a silent no-op.
- **AC-04** — Given the overflow menu is opened, when it renders, then it
  contains the contextual Cancel, Refund, Copy link and Copy order number
  actions (each only where it applies).
- **AC-05** — Given the progress tracker, when a step is complete, then it
  shows a check rather than a number, the current step is visually distinct,
  and a DELIVERED order shows DELIVERED as complete.
- **AC-06** — Given a CANCELLED or REFUNDED order, when the tracker renders,
  then it shows a distinct terminal state (destructive branch / refunded
  terminal strip) instead of drawing a normal linear progress.
- **AC-07** — Given the activity log, when it renders, then entries are newest
  first and every entry comes from a recorded timestamp (order, history,
  notes, shipment, payment, refund); no transition, actor or e-mail is invented.
- **AC-08** — Given an order with items, when the items card renders, then each
  line shows the resolved variant (weight/grind), unit price, line total, a
  product link and the SKU exactly as recorded; a catalog compare-at price is
  struck through and labelled as the regular price, never presented as an
  order discount or counted in the totals.
- **AC-09** — Given the totals card, when it renders, then it shows Subtotal,
  Discount (only when non-zero), Shipping, Tax (only when non-zero), Total,
  Paid, Refunded and Balance due; the old "Net paid" row is absent; an unknown
  refund is "Not recorded", never 0.
- **AC-10** — Given the payment card, when the payment is PAID without
  `paidAt`/reference, then an inline warning explains the gap; when the method
  is cash on delivery, then the card says the money is collected at delivery;
  a transaction reference can be copied and a refund can be recorded.
- **AC-11** — Given the shipment card, when no shipment is recorded, then it
  shows an honest empty state plus a working record-shipment dialog; when the
  order is shipped/delivered without a shipment, a subtle warning appears; no
  apology prose stands in for fields.
- **AC-12** — Given the page, when it renders, then the dead Tags card and the
  DECISIONS changelog card are absent.
- **AC-13** — Given the customer card, when the customer has orders, then it
  shows orders count and lifetime spend computed from recorded orders (basis
  stated), or an explicit gap instead of an invented number.
- **AC-14** — Given a shipping address, when city equals governorate or the
  address name/phone repeat the customer, then the duplicate is not repeated.
- **AC-15** — Given internal notes, when a note is shown or written, then it
  carries author and time, `Ctrl/Cmd+Enter` submits, and the textarea
  auto-grows.
- **AC-16** — Given the invoice is printed, when print media is active, then
  chrome and actions are hidden and the sheet uses light tokens even when the
  screen is dark.
- **AC-17** — Given the page loads, fails or 404s, then a loading skeleton, an
  error state with retry, and a not-found state are each rendered.
- **AC-18** — Given a 1024 px viewport, when the page renders, then the layout
  stacks into one column with no horizontal overflow, clipping or ellipsis.
- **AC-19** — Given Arabic/RTL, when the page renders, then the layout mirrors
  (timeline, icons, back arrow) and numerals render consistently in every cell.
- **AC-20** — Given dark mode, when the page renders, then every cell remains
  readable (text/surface contrast holds) in both languages.
- **AC-21** — Given both languages, when the page renders, then every string is
  translated (no raw i18n key) and EN + AR key sets are complete.
- **AC-22** — Given the implementation, when it is reviewed, then it uses
  design tokens (no raw hex) and keeps Spartan UI primitives.
- **AC-23** — Given a backend fact the store does not record, when the page
  needs it, then the UI shows an honest empty/"not recorded" state and the gap
  is written in `API_GAPS.md`; production code never fakes it.
- **AC-24** — Given a shared primitive is touched, when its API changes, then
  every usage is updated and listed in `DECISIONS.md`; new shared additions are
  add-only.
- **AC-25** — Given the evidence matrix, when it is captured, then the five
  states (Delivered, Shipped, Cancelled, Refunded, no items) exist before/after
  at 1440 and 1024, light/dark, EN/AR, with `results.json` measurements.
- **AC-26** — Given the pure derivations (settlement, activity, items,
  customer summary), when their unit specs run, then they pass.
- **AC-27** — Given the branch, when the production build runs, then it
  succeeds under the project's strict TypeScript settings.
- **AC-28** — Given the diff, when it is inspected, then it is on
  `ui/order-details-v3` (never `main`), contains no whitespace-only/formatting-only
  changes, and the scope is the order detail page plus its shared additions.
