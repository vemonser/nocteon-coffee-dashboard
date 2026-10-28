# Nocteon admin dashboard: rules for every task

## Workflow
- One branch per task; commit per sub-task "area: <ID> <title>"; run build + lint before each commit; paste `git diff --stat` in the report.
- Never mark a task Done without evidence (a viewport screenshot, a measured value in results.json, or a passing test). Report table: Task | Done/Partial/Skipped | files | evidence | notes.
- Screenshots are VIEWPORT captures (1440x900). Full-page captures of tall pages show fake clipped text at fixed screen heights (around y=880 and y=1530): that is a capture artifact, not a bug.
- Never invent backend endpoints or fields. Write what is missing under "Needs backend" in DECISIONS.md and build a safe fallback. Never run seeds or migrations against production data.
- Source of truth for tokens and components: design.md.

## UI rules (the QA harness checks these)
1. i18n: every visible string goes through en + ar translations. No raw keys on screen, no hardcoded text, no unresolved placeholders like {n}, correct plural forms (Arabic has all forms). `npm run i18n:check` must pass.
2. Sentence case for page titles, labels, buttons, menu items, table headers and nav items ("Contact messages", not "Contact Messages"). Proper nouns are the only exception.
3. Dates, numbers and money use the shared helpers only (formatDate, formatDateTime, formatRelative, the currency formatter "EGP 650.00"). No ad-hoc formats.
4. Layout: logical CSS only (ms/me/ps/pe/text-start/text-end), colors from tokens, check light, dark and RTL.
5. Filter rows: the search input and the selects share one compact height (38px). Row actions live in a kebab menu (no always-visible red trash icon). Icon-only buttons have an aria-label and a tooltip.
6. Lists: fixed row height (72px), a bulk bar when rows are selected, loading skeleton, empty state and error state with a retry.
7. Dialogs: footer order = destructive at the start, then secondary, then primary at the end. The primary button names the action ("Add option", not "Save changes" when creating). Esc closes, focus is trapped and returns to the trigger.
8. Forms: Save is disabled until the form is dirty and valid; one Save per page (sticky footer bar); dirty = deep-compare of a normalized snapshot (trim, number formatting, null vs empty); errors appear only after blur or a submit attempt. Leaving a dirty form shows the app's "Unsaved changes" modal. window.alert, window.confirm and window.prompt are forbidden (the no-alert lint rule is an error): use ConfirmDialogService.
9. No developer text on screen ("Needs backend", TODO, undefined, null, NaN, {placeholder}).
10. Permissions: gate the UI with PermissionService (has('x:y'), *appCan). The server stays the source of truth; handle 403 with one de-duplicated toast.
11. One shared selector per metric (open orders, low stock, pending reviews, unread messages...). Never duplicate the logic.
12. Seeds are deterministic: timestamps are never in the future and always in order, numbers increase with time, every order has at least one line.
13. Status vocabulary: Active / Blocked, Verified / Unverified, Enabled / Disabled (products), order statuses from the shared map, one badge component.

# Dashboard UX program
- Goal: turn this admin dashboard from a set of CRUD pages into a fast, consistent, keyboard-friendly experience with a calm, purposeful motion system. Load the `dashboard-ux` skill before any UI work.
- Check the Angular version in package.json first. The app has light/dark themes and English + Arabic (RTL).
- Tokens and branding come from design.md. Never change branding, palette or the layout structure without writing it in UX_DECISIONS.md and waiting for my answer.
- Evidence: a change is Done only with measurements or viewport screenshots before and after. Viewport captures only (full-page captures show fake clipped text).
- Never invent backend endpoints: write what is missing under "Needs backend" in DECISIONS.md and build a safe fallback.
- No window.alert, confirm or prompt: use the app's dialog service; reversible actions use undo toasts.
- Ask me only through UX_DECISIONS.md (two options + a recommendation) and keep working on other items meanwhile.