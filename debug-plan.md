# Debug Plan for Nocteon Dashboard Issues

## Overview
Systematic debugging of the reported issues in the Nocteon Dashboard application:

### Critical Issues Identified:
1. **Data State Issue**: All 7 products showing as "Disabled" under "Enabled 7" tab
2. **Translation Issues**: Raw values (COFFEE, coffee, ethiopia, yirgacheffe) displayed instead of translated names
3. **Form Interaction Issues**: Product Options value chips deleted immediately on X click without confirmation
4. **UI Layout Issues**: Inconsistent page container margins across different pages
5. **Component Display Issues**: Various UI/UX problems in products list, filters, pricing, featured status

## Phase 1: Root Cause Investigation

### Investigation Priority:
1. **Data Access/API Issue** - Products showing as disabled
   - Investigate API response format
   - Check filtering logic in products-list.component.ts
   - Verify isActive field handling

2. **Translation Issue** - Raw values instead of names
   - Trace data flow for productType field
   - Check translation helper usage
   - Verify display logic in products list and edit forms

3. **Form Interaction Issue** - Product Options delete behavior
   - Investigate confirmDeleteValue method
   - Check delete confirmation logic
   - Review UI confirmation dialogs

4. **UI Layout Issues** - Container inconsistencies
   - Check CSS styling
   - Verify page shell classes
   - Compare different page templates

## Test Strategy

Create failing tests for each major issue area before implementing fixes:

### Test 1: Product Status Display
- **Test**: Verify products are correctly displayed with their actual active/inactive status
- **Expected**: Products should show as "Active" or "Inactive" based on actual data, not all as disabled
- **Location**: products-list.component.ts load() method, filter logic

### Test 2: Translation Display
- **Test**: Verify product types and categories display translated names, not raw slugs
- **Expected**: "Coffee" should display instead of "COFFEE", translated category names instead of slugs
- **Location**: Products list display, basic-info-step display logic

### Test 3: Product Options Delete Confirmation
- **Test**: Verify Product Options value chips require confirmation before deletion
- **Expected**: X icon should show confirmation dialog, not delete immediately
- **Location**: product-option-list.component.ts confirmDeleteValue method

## Investigation Commands

### 1. Check Current API Data
```bash
# Check if products are actually disabled in database
# Need backend access - investigate API endpoints
```

### 2. Trace Product Type Field Usage
```bash
# Find where ProductType enum values are displayed
# products-list.component.ts column definitions
# basic-info-step component display logic
```

### 3. Verify Translation Helper Usage
```bash
# Check translation helper implementation
# Verify buildArray and patchArray methods
# Check if translations are being populated correctly
```

## Immediate Action Items

1. **Fix Product Status Display** - Most critical issue affecting functionality
2. **Fix Translation Display** - Major UX impact
3. **Fix Product Options Delete** - UX issue but less critical
4. **Fix UI Layout** - Cosmetic but impacts consistency

## Risk Assessment

- **High Risk**: Product Status Display issue - affects core functionality
- **Medium Risk**: Translation Display - affects user experience
- **Low Risk**: Product Options Delete, UI Layout - cosmetic improvements

## Next Steps

1. Create failing tests for the critical issues
2. Investigate API responses and filtering logic
3. Implement fixes in priority order
4. Verify fixes with tests and manual testing