---
description: Add or fix motion in one area following the motion system
agent: build
---
Load the dashboard-ux skill. Area: $ARGUMENTS ("global" = create the foundation).
1. If global: create the motion tokens (CSS variables), motion.css utilities, the directives (appCountUp, appStagger, appReveal) and the route transition, once.
2. Apply the motion patterns of the skill to the area (dialogs, popovers, menus, lists, tabs, toasts, KPI numbers, skeletons).
3. Verify with a Playwright script: document.getAnimations() durations at most 400ms and only opacity/transform; with reducedMotion "reduce" nothing above 100ms remains; CLS below 0.02; no replay on refetch. Report the table of animations found (element, property, duration, easing).
4. Commit "motion: <area>".
