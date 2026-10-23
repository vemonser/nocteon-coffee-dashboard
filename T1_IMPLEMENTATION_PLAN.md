# T1 Implementation Plan: KPI Card Refactor

## Overview
Refactor the existing `kpi-card` component and dashboard implementation to meet all T1 requirements:
- ONE shared KPI component with new inputs (label, value, prefix?, suffix?, hint?, subline?, delta?, icon)
- Consistent styling (28px value font, min-h 112px) for all 8 cards
- Remove joined strip from second row, use 4 separate cards
- Fixed footer slot (min-h 20px) for delta, subline, or "No prior data"
- Remove sparkline from Total revenue card
- Update delta logic (special handling for Refund rate/Refunded)
- Remove "New" badge from New customers card
- Add ⓘ tooltips to ALL 8 cards (en+ar)
- Fix Paid orders card subline format
- Fix Online users status dot positioning and pulse

## Files to Modify

### 1. `src/app/shared/components/dashboard/kpi-card/kpi-card.component.ts`
**Create/refactor with new inputs and logic:**
- Add: `hint?`, `subline?`, `currency?`, `paidCount?`, `refundedCount?`
- Remove: sparkline rendering
- Update: delta logic (invert for refund/refunded, remove new badge)
- Add: tooltip support
- Add: online users status dot and pulse
- Add: fixed footer slot

### 2. `src/app/features/dashboard/dashboard.component.ts`
**Update dashboard component:**
- Remove sparkline from Total revenue card
- Add tooltips to all 8 cards
- Fix Paid orders card subline: "{paid} paid · {refunded} refunded"
- Fix Online users card: status dot after label, pulse when > 0
- Separate second row into 4 individual cards (remove joined strip)
- Update delta logic for Refund rate/Refunded (invert colors)

### 3. `src/app/core/dashboard/delta.ts`
**Update delta logic:**
- Create single delta function with proper T1 rules
- Invert colors for refund/refunded metrics
- Remove "New" badge logic

### 4. `public/assets/i18n/en.json` and `public/assets/i18n/ar.json`
**Add new translation keys for tooltips**

### 5. `src/app/features/dashboard/services/dashboard-stats.service.ts`
**Update stats to include paid/refunded counts for Paid orders card**

## Implementation Steps

### Step 1: Create Delta Function (priority 1)
- Implement single delta function in delta.ts
- Test edge cases: null/0 previous, flat, up, down
- Invert colors for refund/refunded metrics

### Step 2: Refactor KPI Card Component (priority 2)
- Add new inputs to component
- Update template to match T1 requirements
- Remove sparkline support
- Add fixed footer slot
- Add online users status dot and pulse

### Step 3: Update Dashboard Component (priority 3)
- Remove sparkline from Total revenue
- Add tooltips to all cards
- Fix Paid orders subline
- Fix Online users card
- Separate second row

### Step 4: Update Translations (priority 4)
- Add 8 tooltip keys in English and Arabic

### Step 5: Update Dashboard Stats Service (priority 5)
- Add paid/refunded counts to statsCards

### Step 6: Testing and Validation (priority 6)
- Unit test delta function
- Visual regression test
- e2e tests for functionality

## Success Criteria
1. 8 KPI cards with consistent styling (28px value font, min-h 112px)
2. Second row uses 4 separate cards (no joined strip)
3. Every card has fixed footer (min-h 20px) with content
4. Total revenue card has no sparkline
5. Delta logic: null/0 previous → "No prior data", up green/down red (except refund/refunded inverted)
6. No "New" badge on New customers card
7. All 8 cards have ⓘ tooltips with correct definitions
8. Paid orders subline: "{paid} paid · {refunded} refunded"
9. Online users: status dot after label, green when >0, grey when 0, pulse when >0
10. Build passes with no errors, lint passes

## Acceptance Gates
- Build passes ✓
- Lint passes ✓
- Visual regression ✓
- e2e tests pass ✓
- No hardcoded strings (all through i18n) ✓
- RTL support ✓
- Design tokens used ✓