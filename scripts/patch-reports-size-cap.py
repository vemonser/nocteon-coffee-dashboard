"""Add the page-size finding to the reports (idempotent)."""
import io

DECISIONS = "DECISIONS.md"
REPORT = "FINAL_REPORT.md"

DECISIONS_BLOCK = """
## THE PAGE SIZE — the API caps a page at 100, and a bigger one is a 400

Found while re-running the suites after the newsletter work: the **orders
page never loaded** — it sat on "Loading..." forever, and ten orders tests
failed with it.

The cause was one line in the orders list: a full read of the filtered set
for the revenue KPI asked for `size: 1000`. The API validates `size` on
**every** dashboard list endpoint and answers **400**
(`"must be less than or equal to 100"`) for anything bigger — verified
against orders, users, categories and broadcasts, one shared cap. So the
request was not a bigger page, it was a **failed** page, and a 400 inside
the list's `forkJoin` took the rows, the counts and the KPIs down with it.

Two rules now hold everywhere:

- **The size is clamped, once, in the base CRUD service** (`MAX_PAGE_SIZE
  = 100`), and in the product service (which does not extend the base).
  A caller that asks for 200 gets 100 rows, not a 400. This also unbreaks
  the preloader of the journal form and the product wizard's dropdowns,
  which asked for 200 rows and silently got an error.
- **A caller that needs MORE than a page walks the pages** — the orders
  KPI read, the newsletter export and the broadcasts export all page until
  a page comes back short. A "size: 1000" request is never sent.

The rule for the future: the API's cap is 100 rows per page. Anything that
wants the whole set asks for page 0, 1, 2 … until one page is short.
"""

REPORT_BLOCK = """
### The page size — a contract constraint, and a bug it caused

| Fact | Where it shows |
|---|---|
| Every dashboard list endpoint validates `size` and answers **400** for anything above **100** | verified against `/api/dashboard/orders`, `/users`, `/categories`, `/broadcasts` — one shared cap, not a per-endpoint one |
| A request above the cap is a **failed** page, not a bigger one | the orders list asked for `size: 1000` for its revenue KPI, the 400 killed the whole `forkJoin`, and the page sat on "Loading..." — ten orders tests failed with it |
| The fix | the size is clamped to 100 in the base CRUD service and in the product service; a caller that needs the whole set **walks the pages** (the orders KPI read, the newsletter export, the broadcasts export) |
| Also unblocked | the journal form's preloader and the product wizard's dropdowns asked for 200 rows and were getting an error instead of the list |

**The backend could raise the cap** (or expose an export endpoint) — but
until it does, the client walks the pages.
"""


def append_once(path: str, block: str, marker: str) -> None:
    with io.open(path, encoding="utf-8") as handle:
        text = handle.read()
    if marker in text:
        print("already there:", path)
        return
    with io.open(path, "a", encoding="utf-8") as handle:
        handle.write(block)
    print("appended", path)


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


append_once(DECISIONS, DECISIONS_BLOCK, "## THE PAGE SIZE")
insert_before(REPORT, "## 2. The backend contract gaps", REPORT_BLOCK)
