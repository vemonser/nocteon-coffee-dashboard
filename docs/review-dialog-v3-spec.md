# The review details dialog — acceptance criteria (ui/review-dialog-v3)

The scope is the REVIEW DETAILS DIALOG, opened from the Reviews table and
the Reviews grid. The table and the grid are NOT changed. The branch is
`ui/review-dialog-v3`, cut from `main` (e9bedb65).

Each criterion is one promise the dialog makes. The evidence path of each
one is in `FINAL_REPORT` (the round report) and in
`evidence/review-dialog/{before,after}/results.json`.

## The criteria

- **AC-01** — Given the review details dialog is open, when its title is
  read, then it says "Review details" in sentence case, in English and in
  Arabic.

- **AC-02** — Given the review details dialog is open, when the footer is
  measured, then the two buttons on the end side are 12px apart, and they
  do not look the same: Close is a ghost, and the action of the review is
  the filled one.

- **AC-03** — Given the review details dialog is open, when the rating is
  read, then the stars are the large ones and the number sits right next
  to them, as "4 / 5".

- **AC-04** — Given the review details dialog is open, when the status is
  read, then it is a labelled row — "Status: Approved" — and not a badge
  that floats on its own.

- **AC-05** — Given the review details dialog is open, when the product
  name is clicked, then it opens the product page that EXISTS
  (`/dashboard/products/{slug}/edit`).

- **AC-06** — Given a VERIFIED review, when the API sends the order behind
  the purchase, then the dialog shows a "View order ORD-…" link to that
  order; and while the API does NOT send it, the link is absent and
  nothing is invented to fill it. (Blocked on the backend today.)

- **AC-07** — Given a review with a long comment, when the dialog is
  open, then the comment is a quote that keeps its line breaks, and it
  scrolls inside its own area instead of growing the dialog past the
  viewport.

- **AC-08** — Given the review details dialog is open, when Escape is
  pressed, then the dialog closes; the focus is trapped inside it while
  it is open; and when it closes, the focus returns to the row or card
  control that opened it.

- **AC-09** — Given the review details dialog is open, when the tab order
  is walked, then it is: the close X, the product link, the order link
  (when it is there), the footer.

- **AC-10** — Given a 390px viewport, when the review details dialog is
  open, then it is a full-width sheet with a sticky footer, and the long
  comment scrolls inside the body.

- **AC-11** — Given the Arabic UI, when the review details dialog is
  open, then the footer is mirrored (Delete stays on the start side), the
  stars fill from the start side, and the numerals read "4 / 5" and not
  "5 / 4".

- **AC-12** — Given approve, withdraw or delete is pressed in the dialog,
  then the outcome is toasted — success or failure — and the button is
  disabled and labelled while the request is in flight.

- **AC-13** — Given Delete is pressed in the review details dialog, then
  a confirmation opens that NAMES the review (its product and its
  reviewer) before anything is removed.

- **AC-14** — Given a PENDING review, when the dialog is open, then the
  action of the review is Approve, as the primary button; a Reject action
  exists only if the backend supports it.

- **AC-15** — Given the evidence harness runs, then it captures the
  dialog in four states (approved, pending, verified, a 600+ character
  comment) in the four language/theme cells at 1440 and at 390, and
  results.json carries the footer gap, the dialog height against the
  viewport, the tab order, the Escape/focus-return result, and the badge
  contrast.

- **AC-16** — Given the admin wants to answer a review publicly, then the
  answer can be sent. (Optional, and SKIPPED: the backend has no endpoint
  and no column for it. Logged in API_GAPS.md.)

- **AC-17** — Given a review with a 600+ character comment, when the
  REVIEWS TABLE shows it, then the cell is two lines with an ellipsis (the
  full text in the title), and the row stays a row instead of growing to
  half a page.
