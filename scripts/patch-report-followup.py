"""Add the follow-up summary to the final report (idempotent)."""
import io

REPORT = "FINAL_REPORT.md"

BLOCK = """
---

## 6. The follow-up round (the newsletter page, the broadcasts, the page size)

**What was asked:** a newsletter page — export the addresses, see them as a
table like the other pages — the broadcasts page fixed, and then push
everything.

| Item | Status | Where | Evidence |
|---|---|---|---|
| The newsletter page (`/dashboard/newsletter`) | **done** | `src/app/features/newsletter/` | `e2e/newsletter-broadcast.spec.ts` — 4/4 |
| The export covers EVERY address (not the page) | **done** | `newsletter.service.ts` → `getEveryAddress()` | the e2e reads the downloaded CSV and compares its rows with the table |
| The address is never truncated | **done** | the email column is 260px | the e2e compares the cell's text with the rendered span |
| The count agrees in number ("1 address") | **done** | the app's plural family | the e2e matches `/\\d+\\s+address/` |
| The page says WHAT the list is | **done** | the help line under the header | read in the screenshots |
| The broadcasts: the count, the translated status, the audience, the DELETE, the export | **done** | `broadcast-list.component.{ts,html}` | the e2e + the delete test (it creates and removes its own broadcast) |
| **The page size: the API caps a page at 100** — a request above the cap is a 400, not a bigger page | **done** | `base-crud.service.ts`, `order.service.ts`, `product.service.ts` | the orders page loads again; `orders` 21/23 (was 11/23) |
| The Arabic UI carries no Latin string | **done** | the "Ctrl K" hint is LTR-only | `dashboard-round2` 10/10 |
| The e2e login reads the body at response time | **done** | `e2e/helpers/auth.ts` | no suite aborts on a false "requires an ADMIN" |

### What the follow-up found that was not asked for

**The orders page never loaded.** The orders list asked the API for
`size: 1000`; the API validates `size` on every dashboard list endpoint and
answers **400** for anything above **100** ("must be less than or equal to
100" — verified against orders, users, categories and broadcasts). The 400
sat inside the list's `forkJoin`, so the rows, the counts AND the KPIs
never arrived: the page stayed on "Loading..." and ten orders tests failed
with it. The size is now clamped to 100 in the base CRUD service and in the
product service, and a caller that needs the whole set **walks the pages**
(the orders KPI read, the newsletter export, the broadcasts export). The
clamp also unbreaks the journal form's preloader and the product wizard's
dropdowns, which asked for 200 rows and were getting an error instead of a
list.

### The verification of this round (production build, on a private port)

| Suite | Result |
|---|---|
| `dashboard-round2` | **10/10** |
| `dashboard-language` | **20/20** (every cell) |
| `dashboard-states` | 5/5 |
| `auth` | 10/10 |
| `newsletter-broadcast` | **4/4** |
| `orders` | 21/23 — the two failures are the other session's |
| `orders-states` | 10/11 — the same failure |

**The three remaining failures are all in the OTHER session's orders
redesign, and the app itself is right.** Both failing specs assert on the
payment-status STAT CARD (`[data-testid="orders-stat-card"]` → the second
card), and that card is gone: the redesign's cards are Revenue, Open
orders, Avg order value and Cancel rate. The second card is now "Open
orders", which is **0** for the `paymentStatus=FAILED` filter the test
uses — so the assertion "the count is greater than 0" fails on a correct
page. A probe of the same scenario (`evidence/probes/probe-filter-switch.mjs`)
delays the first orders request by 2.5s, switches the filter, and reads the
ROWS: the screen holds the four FAILED-payment orders and no PAID row, so
the "a fast filter switch never shows the data of an older request"
property **holds** — the specs point at a card the redesign replaced and
have to follow the new design. That is the other session's contract to
re-align, not a defect in the app.

### The environment, and how the round was verified

The repository is shared with a second session that takes **:4200** (the
only origin the backend's CORS allows), builds, commits, switches branches
and cleans the working tree — during this round it reset the working tree
twice, which cost one of my commits (recovered from the reflog and
re-applied). The suite therefore ran against a **private** static server
that also proxies the API server-side (`scripts/serve-with-proxy.mjs`), so
the CORS dance never happens and the port cannot be taken away:
`E2E_BASE_URL=http://localhost:4300`. The build is a real production build
(`ng build --output-path …`), not the dev server — the dev server's
first-paint latency made the fixed-wait tests fail for reasons that have
nothing to do with the app.
"""


def main() -> None:
    with io.open(REPORT, encoding="utf-8") as handle:
        text = handle.read()
    if "## 6. The follow-up round" in text:
        print("already there")
        return
    with io.open(REPORT, "a", encoding="utf-8") as handle:
        handle.write(BLOCK)
    print("appended", REPORT)


main()
