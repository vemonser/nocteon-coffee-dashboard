# Orders v5 — the dashboard criteria

The acceptance criteria of the dashboard half of the orders work. They are
numbered with the same ids as the plan
(`docs/superpowers/plans/2026-10-22-orders-list-v4-order-detail-v5.md`) so a
criterion can be cited from either side. The backend half lives in the
backend repo's `docs/orders-v5-criteria.md`, under the first eleven
ids.

Each criterion names what must be true of the RUNNING screen — the evidence
is a real browser run, not a claim.

| Id | The criterion |
|----|---------------|
| AC-12 | The order types carry `NOT_COLLECTED`, the badge kind, and the `can*` helpers |
| AC-13 | The average is the revenue over the paid orders, and the cancel rate is the cancelled orders over the orders shown |
| AC-14 | Every key the pages use exists in English and in Arabic |
| AC-15 | The four cards are the backend's numbers, the seven tabs are the named ones, and the table never scrolls sideways at 1440 |
| AC-16 | A list with no rows offers a Clear filters action |
| AC-17 | The badges carry the theme's tokens in light and in dark |
| AC-18 | The orders list E2E suite passes |
| AC-19 | The actions that cannot apply are hidden, and the status change offers only the allowed transitions |
| AC-20 | The timeline shows every step with its recorded date, its actor and its note |
| AC-21 | The customer card shows the CUSTOMER's numbers, not the store's |
| AC-22 | The SKU appears once, and the catalog's regular price is a reference, never a discount on the order |
| AC-23 | The discount and the tax rows appear only when the order has them, and the settlement is honest |
| AC-24 | The carrier, the tracking number and the ETA are editable |
| AC-25 | In Arabic the breadcrumb, the numbers, the icons and the text flow right to left |
| AC-26 | The order detail E2E suite passes |
| AC-27 | The living docs say what the orders pages now do |
| AC-28 | The build passes and the evidence chain is intact |

## The rules behind them

**One set.** The rows, the pager, the header count and the four cards all
describe the same view: the filtered set intersected with the selected tab.
A card can never contradict the rows under it.

**The numbers come from the API.** The revenue, the average and the cancel
rate are the backend's aggregates. The browser never reads the whole set to
add it up.

**Nothing is invented.** A step with no recorded date says so. A value the
store does not record is "Not recorded", never a zero. An order with no line
items is flagged, not silently shown as "0 items".

**Every action follows the order's state.** A delivered order offers no
status change, a cancelled one cannot be cancelled again, and a status
change offers only the transitions the backend allows.
