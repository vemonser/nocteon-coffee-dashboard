# TASKS.md — the top tasks per area

The finder's journey runner (`qa/finder/journeys.ts`) executes the reachable prefix of
each task below with Playwright and records clicks, keystrokes, wall-clock time,
dead ends, console errors and workarounds. **Writes are opt-in**:
`FINDER_ALLOW_MUTATIONS=1` is required to perform the final save/send/approve step,
because the finder must never leave test data behind on a shared dev database.

A task is **passing** when its pass condition is met in one uninterrupted run with no
workaround. A step the runner cannot reach is reported as a finding
(`journeys.<task>.<step>`) with the missing control named.

## Products

1. **Add a product with two variants and a cover image**
   1. Open Products → "New product".
   2. Fill the English and Arabic names, the slug and the short description.
   3. Choose a category and a product type.
   4. Continue to variants; add two variants; upload a cover image.
   5. Save.
   - **Pass:** the product is saved with two variants and a cover image, and appears on the products list.

2. **Edit stock inline**
   1. Open Products.
   2. Click the stock value in the first row.
   3. Type a new value and press Enter.
   4. Reload the list.
   - **Pass:** the new stock survives the reload.

3. **Feature a product**
   1. Open Products.
   2. Use the featured control on the first row.
   3. Refresh.
   - **Pass:** the row shows a Featured mark and the filtered list "Featured" contains it.

## Reviews

4. **Approve a pending review**
   1. Open Reviews → Pending.
   2. Open the first pending review.
   3. Press Approve.
   - **Pass:** the review status becomes Approved and the pending chip count drops by one.

## Contact messages

5. **Reply to a contact message and archive it**
   1. Open Contact messages.
   2. Open the first unread message.
   3. Write a reply and send it.
   4. Archive the message.
   - **Pass:** the reply is sent and the message moves to Archived.

## Access

6. **Create a custom role and assign it**
   1. Open Users → Roles.
   2. Open the new-role dialog.
   3. Name the role and pick at least one permission.
   4. Save, then assign the role to a user.
   - **Pass:** the role exists with the chosen permissions and the user's role chip changes.

## Newsletter

7. **Send a broadcast to a test audience**
   1. Open Broadcasts → New broadcast.
   2. Fill the subject and the body.
   3. Choose the test audience.
   4. Send.
   - **Pass:** the broadcast is sent to the test segment and the delivery count is shown.

## Content

8. **Create a journal post in both languages**
   1. Open Journal → New post.
   2. Fill the English and Arabic titles and bodies, and the slug.
   3. Save.
   - **Pass:** the post saves with both languages and renders in each.

## Orders

9. **Find an order by number and issue a refund**
   1. Open Orders.
   2. Search for the ORD number.
   3. Open the matching order.
   4. Issue the refund.
   - **Pass:** the order is found by its number and the refund is recorded on it.

## Store

10. **Change the free shipping threshold**
    1. Open Store settings.
    2. Fill a new threshold.
    3. Save.
    - **Pass:** the threshold saves and the storefront applies the new amount.

## Friction the runner reports

- more than 6 clicks for a task in this list;
- a step that needed a workaround (retry, scroll, fallback selector);
- a control that does nothing (a dead end);
- a missing bulk action or "next" affordance on a list.
