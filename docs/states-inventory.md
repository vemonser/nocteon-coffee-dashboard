# Console states inventory — FE-27

Every console page that renders a list, audited for the three states a list can
be in. A page is only "done" when a reader on a slow connection, an empty
dataset and a failed request all see something designed.

Legend: **skeleton** = rows/shape while loading · **empty** = designed empty
state · **action** = the control that resolves it · **error** = failure with
retry. "In-state" means the action is inside the empty state; "header" means
the page's primary action is visible beside it; "—" means no console action can
resolve it, and the state says where the data comes from instead.

| Page | Skeleton | Empty | Action | Error + retry | Fixed in FE-27 |
|---|---|---|---|---|---|
| Dashboard | card skeletons + `app-widget-state` | per widget | — (aggregates) | page-level `app-error-state`, previously **nothing** | **yes** |
| Orders | in-table skeleton | table empty state | clear filters (only when a filter is set) | shared error state | FE-26 |
| Carts | page pulse rows | table empty state | clear search | yes | **yes** (hint + action) |
| Reviews | in-table skeleton | table empty state | clear filters | yes | **yes** (translated copy, hint, action) |
| Contact messages | pulse rows | shared empty state | clear filters | **added** (was a misleading empty list) | **yes** |
| Users | pulse rows | table empty state | clear search / add user | **added** | **yes** |
| Roles | card skeletons | grid empty copy | header "New role" | yes | a11y (`role=alert`) |
| Journal | card skeletons | shared empty state | clear search / new post | **added** | **yes** |
| Journal categories | pulse rows | dashed empty copy | header "New category" | yes (now announced) | a11y (`role=alert`) |
| Broadcasts | pulse rows | shared empty state | clear search / new broadcast | **added** | **yes** |
| Newsletter | pulse rows | table empty state | clear search only (audience comes from the store) | **added** | **yes** |
| Notifications | page skeleton | designed empty block | — (system-generated) | yes (now announced) | a11y (`role=alert`) |
| Products | in-table skeleton | table empty state | clear search / add product | shared error state | FE-26 |
| Product tags | pulse rows | dashed empty copy | header "Add tag" | yes (now announced) | a11y (`role=alert`) |
| Product options | pulse rows | shared empty state | clear search / add option | **added** | **yes** |
| Categories | in-table skeleton | two-state block (search vs empty, + cross-tab) | in-state clear search / switch tab | yes | — (already best-in-class) |
| Origins | in-table skeleton | shared empty state | clear search / add origin | yes | **yes** |
| Farms | in-table skeleton | shared empty state | clear search / add farm | yes | **yes** |
| Roast levels | in-table skeleton | shared empty state | clear search / add roast level | yes | **yes** |
| Processing methods | in-table skeleton | shared empty state | clear search / add processing method | yes | **yes** |
| Coffee varieties | in-table skeleton | shared empty state | clear search / add coffee variety | yes | **yes** |
| Tasting notes | in-table skeleton | shared empty state | clear search / add tasting note | yes | **yes** |
| Shipping zones | in-table skeleton | shared empty state | clear search / add shipping zone | yes | **yes** |
| Promo codes | pulse rows | table empty state | clear search / add promo code | **added** | **yes** |
| Brewing methods | in-table skeleton | shared empty state | clear search / add brewing method | yes | **yes** |
| Pairings | in-table skeleton | shared empty state | clear search / add pairing | yes | **yes** |
| Store settings | pulse rows | table empty state | — (settings are edited, not created) | **added** | **yes** |

Form and detail pages (`/dashboard/products/new`, `/dashboard/products/:slug/edit`,
`/dashboard/orders/:id`, `/dashboard/users/:id`, the catalog detail pages,
`/dashboard/profile`) are outside this table: they are one record, not a list,
and they already render an inline failure message inside their own form. Their
state contract is the form contract (Save bar, dirty guard), covered by the
form specs.

## How this is enforced

- `src/app/shared/components/state-coverage.spec.ts` derives the three states
  from each page's own source and fails when one disappears. Pages whose state
  is deliberately different are listed there **with a written reason**.
- `e2e/blank-body.spec.ts` renders every console page in a browser and fails
  one that has no content, no skeleton, no empty state and no error with a
  retry. Its last four tests run the same detector against synthetic DOMs
  (blank, designed-empty, error-without-retry, error-with-retry) so the check
  cannot pass by being vacuous.

## Copy added (en + ar)

`common.clearSearch`, `common.add`, `common.noSearchResults`,
`users.empty` / `users.emptyHint`, `promoCodes.empty` / `promoCodes.emptyHint`,
`newsletter.emptyHint`, `StoreSettingPage.empty` / `StoreSettingPage.emptyHint`,
`products.empty.hintNone` / `hintSearch` / `hintTrash`, `carts.emptyHint`,
`reviews.emptyState.noReviewsHint` (+ the two existing `noReviews`/`noResults`
keys are now actually used), `contactMessages.emptyHint`, `journal.emptyHint`,
`broadcasts.emptyHint`, `productOptions.emptyHint`,
`dashboard.overviewErrorTitle`.
