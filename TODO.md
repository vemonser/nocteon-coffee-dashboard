# Nocteon Dashboard - Tickets V1-V5 Implementation Plan

## V1: Add Dialog Fixes
- [ ] Reset all form state including ImageUpload preview every time dialog opens
- [ ] Verify: upload image, cancel, reopen → preview empty and button reads "Upload image"
- [ ] Footer buttons compact and aligned to inline-end, primary last in LTR, first in RTL
- [ ] Submitting empty shows inline errors and focuses first invalid field

## V2: Lists Fixes
- [ ] Add centered content max-width (1280-1440px) to list and detail pages
- [ ] Entity column fixed ~30%, capped near 360px
- [ ] Other-language name column flexible, long names truncated with ellipsis + accessible tooltip
- [ ] Trash "Deleted" shows "Just now" instead of "now"
- [ ] Verify pencil icon is anchor with href to `/categories/:id`
- [ ] Measure pixel gap between first and second name text at 1440/1920, sidebar open/collapsed, EN/AR

## V3: Category Detail Fixes
- [ ] Remove empty strip under image (put "Change image" over/under image, left-aligned, size card to content)
- [ ] Make both columns end at same height or let each size to content without visible mismatch
- [ ] Confirm "Save changes" disabled until field changes, enabled on first change, confirm on leave with unsaved changes
- [ ] Sentence case everywhere: grep for "Add [A-Z]" and fix every instance

## V4: Sidebar Fixes
- [ ] Item height 36-40px (currently ~48px)
- [ ] Allow several groups open at once, persist state
- [ ] Always open group of current page on load
- [ ] Measure computed height of item and group header
- [ ] Verify Catalog and Settings can be open simultaneously

## V5: Screenshots & Evidence
- [ ] Capture Categories list (Active and Trash), Add dialog, Detail page at 375, 768, 1024, 1440, 1920 widths
- [ ] Light and dark, English and Arabic
- [ ] Use one saved login session (storageState)
- [ ] List every overflow, clipped text, or horizontal scroll
- [ ] Generate results.json with measurements