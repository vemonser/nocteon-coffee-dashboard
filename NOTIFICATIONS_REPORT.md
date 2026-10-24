# Notifications — Pass 1 Discovery (N0)

Read-only investigation before any UI change. Sources: the Angular client in this
repo and the running backend source at
`../nocteon-backend/src/main/java/com/nocteon/nocteon_api/notifications/`.

## 1. What the bell calls today

The bell (`src/app/features/notification/components/notification.component.ts`)
injects `features/notification/services/notification.service.ts` and uses these
dashboard endpoints:

| Action | Method + path | Query / body | Response |
|---|---|---|---|
| Unread badge | `GET /api/dashboard/notifications/unread-count` | — | `ApiResponse<number>` |
| Popover list | `GET /api/dashboard/notifications` | `unreadOnly=true&page=0&size=10` (bell only shows unread) | `ApiResponse<PageResponse<NotificationResponse>>` |
| Mark one read | `PATCH /api/dashboard/notifications/{id}/read` | empty | `ApiResponse<void>` |
| Mark all read | `PATCH /api/dashboard/notifications/read-all` | empty | `ApiResponse<void>` |

`PageResponse<T>` = `{ content, page, size, totalElements, totalPages, first, last }`.
Every payload is wrapped in `ApiResponse<T>` =
`{ success, message, data, errors, summary, timestamp }`.

The old bell polled `unread-count` every **150 000 ms (150 s)** — the inline
comment claimed 15 s, the code did not. The full list page
(`features/notifications-list`) kept a second, duplicate copy of the same
service. Both are consolidated in N3.

### Notification model fields (current backend)

`Notification` entity / `NotificationResponse` DTO:

| Field | Type | Notes |
|---|---|---|
| `id` | `Long` | numeric |
| `type` | enum `ORDER_CREATED \| PAYMENT_SUCCEEDED \| PAYMENT_FAILED \| REVIEW_CREATED` | stored as STRING |
| `title` | `String` | **server-rendered English**, not an i18n key |
| `message` | `TEXT` | server-rendered English |
| `link` | `String` | already a dashboard path, e.g. `/dashboard/orders/1042` |
| `isRead` (Java) / `read` (JSON) | `boolean` | the Lombok `isRead()` getter serializes as `read`; the client model uses `read` |
| `createdAt` | `Instant` | inherited from `BaseEntity` |

There is no `titleKey`, `params`, `entityType`, `entityId`, `readAt`,
`customerName`, or `deleted` field.

### How read/unread is stored

A single `is_read BOOLEAN NOT NULL DEFAULT false` column. Read is a one-way
transition exposed today:

- `markAsRead(id)` → `notification.setRead(true)`.
- `markAllAsRead()` → `notificationRepository.markAllAsRead()`.

No unread transition and no delete exist. The UI therefore cannot honestly
offer "mark unread", single delete, or bulk delete against the current backend.

## 2. Who creates notifications today

Creation is **system events for admins**, not admin→customer broadcasts.
`NotificationService` registers `@TransactionalEventListener(AFTER_COMMIT)`
handlers:

| Event | Type written | Link |
|---|---|---|
| `OrderCreatedEvent` | `ORDER_CREATED` | `/dashboard/orders/{id}` |
| `PaymentSucceededEvent` | `PAYMENT_SUCCEEDED` | `/dashboard/orders/{id}` |
| `ReviewCreatedEvent` | `REVIEW_CREATED` | `/dashboard/reviews/{id}` |

Admin broadcasts (`/dashboard/broadcasts`) target **customer email addresses**;
they do not write rows into `notifications` and are not a source of admin
notifications.

### Transport

**No SSE and no WebSocket.** There is no `/stream`, `EventSource`, STOMP or
socket endpoint in the backend or the client. The client polls
`unread-count`. The only push-like channel in the backend is email.

## 3. Event coverage for the six requested events

| Event | Admin notification today? | Evidence |
|---|---|---|
| New order | **Yes** | `onOrderCreated` → `ORDER_CREATED` |
| Payment failed | **No** | `PAYMENT_FAILED` exists in the enum but no listener publishes it |
| Review pending moderation | **Partial** | `REVIEW_CREATED` is written on submit; the row has no moderation status and the title is "Review Created" |
| New contact message | **No** | no listener / event |
| Low stock | **No** | no listener / event |
| New customer registered | **No** | no listener / event |

### Backend contracts we must not invent

The current DTO is `{ id, type, title, message, link, isRead, createdAt }` (JSON: `read`).
The richer frontend contract below is a **request**, not an assumption. Until
the backend ships it, the client renders the server `title`/`message` as-is and
falls back to the unknown-type Bell treatment when `type` is not registered.

Requested per-notification contract (see `DECISIONS.md` → "Needs backend"):

```json
{
  "type": "order.new",
  "titleKey": "notifications.types.order_new.title",
  "params": { "orderId": 1042, "total": "1,240.00 EGP" },
  "entityType": "order",
  "entityId": 1042,
  "createdAt": "2026-10-24T12:00:00Z",
  "readAt": null
}
```

Also missing: `DELETE /api/dashboard/notifications/{id}`,
`PATCH /api/dashboard/notifications/{id}/unread`, a `type` query filter, and a
bulk endpoint. The pass-1 UI only calls endpoints that exist; the unsupported
controls are documented as gaps rather than faked.

## Current routes and permissions

- Page: `/dashboard/notifications` (guard `notification:read`), plus
  `:id` child used by the old detail dialog.
- Bell: always rendered in the navbar; no permission check in the old code.
- Backend: every notification endpoint is `@PreAuthorize("hasAuthority('notification:read')")`.
  `notification:update` / `notification:delete` exist in the permission catalog
  (`ALL_PERMISSIONS`) but are not enforced by any notification endpoint.

## What N1–N4 change

1. One type registry (`notification-type.registry.ts`) with icon, tint,
   i18n title/body templates, and a route builder; unknown types fall back to
   the Bell with the payload title/body.
2. Bell + 380 px popover: badge, All/Unread tabs, Today/Earlier groups, unread
   dot, kebab, keyboard navigation, empty/loading/error states.
3. One signal-based data service: start-up unread count, 20-item first page,
   load-more, 60 s polling **only while the tab is visible**, optimistic
   mark-read/delete with rollback, and a dev-only mock behind
   `?mockNotifications=1` that is replaced by a stub in production builds.
4. Full page at `/dashboard/notifications` (plus a `/notifications` redirect)
   reusing the same row component, type filter, pagination, and bulk actions.
