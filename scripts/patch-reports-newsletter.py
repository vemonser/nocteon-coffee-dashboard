"""Add the newsletter page and the broadcasts additions to the reports."""
import io
import re

REPORT = "FINAL_REPORT.md"
DECISIONS = "DECISIONS.md"

REPORT_BLOCK = """
## 1c. The newsletter page, and what the broadcasts page was missing

A second, later task: **a newsletter page** — the addresses you can send
a newsletter to, as a TABLE like every other list, and an **export** of
those addresses. Plus: **the broadcasts page gets what it was missing.**

### The newsletter page (`/dashboard/newsletter`)

| Piece | What it is |
|---|---|
| The list | the store's CUSTOMERS (`GET /api/dashboard/users?role=CUSTOMER`) — the same audience a broadcast reaches, so the two pages agree |
| The table | the shared `app-data-table`: email, name, joined, last active — the email is the first column and is wide enough for a real address (the longest in the store is 28 characters, and it is NOT truncated) |
| The export | `Export emails` → a CSV of **every** address of the audience, not the rows on the page. The API caps a page at 100 rows (a bigger `size` is a 400), so the export walks the pages |
| The header | the TOTAL of the audience, with a label that agrees in number ("1 address in the audience" / "10 addresses in the audience") |
| The help line | what the list IS: the audience of a newsletter is the store's customers, **and the API does not carry a per-address newsletter flag**, so an address that unsubscribed is still listed |

The last line is the honest one: `NewsletterService` is the ONLY subscriber
list the API offers, and the admin `UserResponse` has no `isSubscribed`
field, so the page cannot tell a subscribed customer from an unsubscribed
one. It says so instead of pretending the list is a subscription list.

### The broadcasts page — what was missing

| Missing | Now |
|---|---|
| The header printed **the page's row count, the word "of" and a bell** — "2 of 🔔" | the TOTAL, with a label that agrees in number ("1 broadcast") |
| The status badge printed **the raw enum** ("PENDING", "IN_PROGRESS", "COMPLETED") — an untranslated string on the Arabic page | "Queued" / "Sending" / "Sent" (في الانتظار / جارٍ الإرسال / تم الإرسال) |
| **The audience was never stated** | the create dialog says the message goes to every customer of the store, and every row carries the recipient count the backend counted |
| **The broadcast could not be deleted** — the frontend's `callDelete` threw, although the backend HAS `DELETE /api/dashboard/broadcasts/{id}` | the delete action, with a confirmation, and it deletes the broadcast AND its recipient rows |
| **There was no export** | `Export broadcasts` → a CSV of every broadcast (the pages are walked — the API caps a page at 100) |

**What is still a backend gap:** the deployed backend has no SENDER. Its
broadcast package is `BroadcastCreationService` and nothing else — no
sender, no scheduler, no `send` endpoint — so a broadcast is created with
its recipient rows and stays `PENDING` with `sentCount = 0` forever
(verified against the API and against the `broadcast_recipients` table).
The page therefore says "Queued" and shows what HAS been sent, instead of
pretending the delivery happened. **The backend needs a sender**: a
`POST /api/dashboard/broadcasts/{id}/send`, or a scheduled job that walks
the `PENDING` recipient rows and mails them through the existing
`EmailService`.
"""

DECISIONS_BLOCK = """
## NEWSLETTER — a page for the addresses, and an export

The newsletter page is a LIST like every other list — the shared
`app-data-table`, the search, the pager, the count in the header — with
one thing it exists for: **the export of the addresses**.

- The audience is the store's CUSTOMERS (`GET
  /api/dashboard/users?role=CUSTOMER`), because that is the same set a
  broadcast reaches (`findByRoleAndSubscribedTrue(CUSTOMER)`), so the two
  pages cannot disagree about who the audience is.
- The export covers **every** address, not the rows on the page, and it
  walks the pages: the API caps a page at 100 rows and answers a bigger
  `size` with a 400. Asking for a thousand rows in one request exports
  NOTHING — which is what the first version did.
- The count agrees in number ("1 address in the audience"), through the
  app's plural family (`<base>_<Intl.PluralRules category>`), because
  "1 addresses" is the kind of small wrongness the rest of the app does
  not have.
- **The page says what the list IS.** The admin `UserResponse` carries no
  newsletter flag and the list has no `subscribed` filter, so the page
  cannot tell a subscribed customer from an unsubscribed one. The help
  line says so instead of pretending the list is a subscription list. The
  backend needs a subscriber list (or a `subscribed` filter) for that to
  change.

## BROADCASTS — what the page was missing

- The header printed **the page's row count, the word "of" and a bell**
  ("2 of 🔔"). It prints the TOTAL, with a label that agrees in number.
- The status badge printed **the raw enum** ("PENDING") — an untranslated
  string on the Arabic page. It is "Queued" / "Sending" / "Sent".
- **The audience is now stated**: the create dialog says the message goes
  to every customer of the store, and every row carries the recipient
  count the backend counted.
- **The broadcast can be deleted.** The backend HAS
  `DELETE /api/dashboard/broadcasts/{id}` (it removes the broadcast and
  its recipient rows); the frontend threw instead, so there was no way to
  get rid of a broadcast.
- **The broadcasts export** as a CSV, walking the pages like the
  newsletter export.

**The delivery is still a backend gap.** The deployed backend has no
sender: its broadcast package is `BroadcastCreationService` and nothing
else — no sender, no scheduler, no `send` endpoint — so a broadcast is
created with its recipient rows and stays `PENDING` with `sentCount = 0`
forever. The page says "Queued" and shows what HAS been sent rather than
pretending the delivery is done. The backend needs a sender: a `POST
/api/dashboard/broadcasts/{id}/send`, or a scheduled job that walks the
`PENDING` recipient rows through the existing `EmailService`.
"""


def insert_before(path: str, marker: str, block: str) -> None:
    with io.open(path, encoding="utf-8") as handle:
        text = handle.read()
    if block.splitlines()[1] in text:
        print("already there:", path)
        return
    index = text.index(marker)
    text = text[:index] + block.lstrip("\n") + "\n" + text[index:]
    with io.open(path, "w", encoding="utf-8") as handle:
        handle.write(text)
    print("patched", path)


insert_before(REPORT, "## 2. The backend contract gaps", REPORT_BLOCK)

with io.open(DECISIONS, "a", encoding="utf-8") as handle:
    handle.write(DECISIONS_BLOCK)
print("appended", DECISIONS)
