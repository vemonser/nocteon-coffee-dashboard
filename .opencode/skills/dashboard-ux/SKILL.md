---
name: dashboard-ux
description: UX, consistency and motion rules for this admin dashboard (Angular, RTL-aware). Load before auditing or changing any UI, interaction or animation.
---
# What "a better experience" means here (measurable)
1. Speed to task: common tasks take at most 3 clicks or one shortcut. A command palette (Ctrl/Cmd+K) searches entities and actions; shortcuts are listed in a "?" help dialog.
2. Context is never lost: filters, sort, page size and the selected tab live in the URL; Back restores the list state and scroll; breadcrumbs; recent items.
3. Fewer interruptions: reversible actions run immediately with an Undo toast (8s). Confirm dialogs only for destructive or irreversible actions and they state the consequence ("This will email 128 customers").
4. Feedback within 100ms: optimistic UI with rollback; skeletons shaped like the content; buttons show progress; "Saved just now"; autosaved drafts for long forms (journal, broadcast); unsaved-changes modal when leaving a dirty form.
5. More per screen: inline edit in tables where safe (status, stock, price, featured), bulk actions, a row peek drawer (preview without leaving the list), keyboard list navigation (j/k, Enter), next/previous record in detail pages.
6. Clarity: every number links to its list already filtered; metric tooltips; empty states say what to do next; errors say what happened and how to fix it; one status vocabulary and badge style.
7. The dashboard home is action-first: "Needs attention" and today's work at the top, deltas versus the previous period, drill-down on every number, a last-updated indicator.
8. Accessibility and RTL are features: full keyboard use, visible focus, contrast, logical CSS properties, mirrored motion direction, reduced motion.

# Motion system (define these once as CSS variables in the global styles)
- Durations: instant 100ms (hover, press), fast 160ms (toggles, tooltips, chips), base 220ms (dialogs, popovers, menus, toasts), slow 320ms (drawers, section and page transitions). Never above 400ms.
- Easing: enter = cubic-bezier(0.16, 1, 0.3, 1); exit = cubic-bezier(0.4, 0, 1, 1) at about 70% of the enter duration; move = cubic-bezier(0.4, 0, 0.2, 1).
- Animate only transform and opacity (clip-path or filter sparingly). Never animate width, height, top or left. Expand/collapse uses grid-template-rows 0fr to 1fr.
- Patterns: dialog = fade + scale 0.97 to 1 from the trigger; popover/menu = fade + 4px translate in the opening direction; drawer = translate from its edge (mirrors in RTL through a --dir variable of 1 or -1); toast = slide + fade; list rows = fade + 6px translate-y on FIRST load only, stagger 30ms for at most 8 items, never on refetch or polling; tabs = a sliding indicator; KPI numbers = count-up once per page view (600ms max); charts = draw-in once (600ms max); skeleton = a very subtle pulse; route change = View Transition cross-fade 150-200ms; removing an item = collapse + fade; success = a tiny check scale pulse.
- Honor prefers-reduced-motion: replace movement with a fade of 100ms or less, or nothing.
- Motion must explain a state change (what appeared, moved or was removed), never decorate. No animation may cause layout shift (CLS below 0.02), block input, or replay on every poll or refresh.
- Verify motion with a script, not by eye: in Playwright read document.getAnimations() and check that every animation lasts 400ms or less and animates only opacity/transform; emulate reducedMotion "reduce" and check that no animation above 100ms remains.

# Angular specifics
- If Angular is 20.2 or newer, use `animate.enter` and `animate.leave` with CSS classes (and @starting-style where needed). The @angular/animations package is deprecated (removal planned for v23): do not introduce it, and migrate existing usage opportunistically. If Angular is older, use CSS transitions plus the View Transitions API (`withViewTransitions()` in provideRouter).
- Use the ANIMATIONS_DISABLED token (or a global reduced-motion class) in tests so they stay deterministic.
- Keep motion in shared CSS (motion.css) and tiny directives (appCountUp, appStagger, appReveal). No bespoke keyframes per component unless justified.
- Use @if and @for with track expressions so enter animations do not replay on refetch.

# Audit procedure (what /ux-audit does)
1. Open the page with the Playwright MCP and capture viewport states (default, hover/focus, dialogs, empty, loading, error, long data) in light/dark and en/ar.
2. Walk the 3 most common tasks of the page; count clicks and keystrokes; note friction (extra steps, lost context, unclear feedback, dead ends).
3. Check the eight principles and the motion system; record measured values.
4. Output a ranked table: problem or opportunity | evidence | impact (H/M/L) | effort (S/M/L) | proposed change | needs decision?
5. Wait for me to mark items with [x].

# Guardrails
- Consistency before novelty: reuse a pattern from a page that already does it well.
- Prefer boring and fast over fancy. If a motion does not help the user understand something, remove it.
- Never change data semantics, permissions, the wording of translations or backend contracts as part of UX work.
