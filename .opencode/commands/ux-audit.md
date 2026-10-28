---
description: Audit one area for UX friction, consistency and motion; write UX_AUDIT_<area>.md (no code changes)
agent: build
---
Load the dashboard-ux skill. Area: $ARGUMENTS (a page or flow name; "all" = every sidebar page one by one, resuming from UX_AUDIT_STATE.md).
REPORT ONLY: do not modify anything under src/ or the backend.
1. Follow the audit procedure of the skill.
2. Write UX_AUDIT_<area>.md with: the ranked table where every row starts with a checkbox "[ ]" for me to approve; a "Quick wins" section (small effort, high impact); a "Needs decision" section (two options + a recommendation each); the measured values and the screenshot paths.
3. Run `git status --short` and confirm that only report and evidence files changed.
