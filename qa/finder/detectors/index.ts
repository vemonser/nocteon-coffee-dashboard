import type { Detector, DetectorContext, Issue } from './types.ts';
import { detectCamelLabels, detectI18n } from './i18n.ts';
import {
  detectDateText,
  detectGluedScripts,
  detectTitleCase,
  detectWordHygiene,
} from './text.ts';
import {
  detectButtonSpacing,
  detectDuplicateActions,
  detectMultiplePrimary,
  detectStepAndFooterDuplicates,
} from './actions.ts';
import {
  detectEmptyColumns,
  detectMisalignedHeaders,
  detectNumericAlignment,
  detectRowHeights,
  detectTruncationWithoutTooltip,
} from './tables.ts';
import {
  detectCappedBadges,
  detectChipSums,
  detectPaginationRange,
  detectTotalCounts,
} from './counts.ts';
import {
  detectEnabledSave,
  detectInputAttributes,
  detectMaxlength,
  detectPlaceholderTypos,
  detectPristineErrors,
  detectRequiredMarkers,
  detectTwoSaves,
} from './forms.ts';
import { detectIndicatorOutside } from './indicators.ts';
import { detectOverlays } from './overlays.ts';
import {
  detectCreateSaveChanges,
  detectFooterOrder,
  detectNativeDialogs,
  detectUnnamedIconButtons,
  detectVisibleDestructiveIcons,
} from './consistency.ts';
import {
  detectClippedText,
  detectHorizontalScroll,
  detectLargeGaps,
  detectOrphanGridCells,
  detectOversizedMedia,
  detectSmallTargets,
  detectTextSizeAndContrast,
} from './layout.ts';
import { detectFutureDates, detectMixedDateFormats, detectTestRecords } from './hygiene.ts';
import { collectFingerprints, collectTokens, type Fingerprint } from './fingerprints.ts';

/** Every detector, in report order. */
export const DETECTORS: Detector[] = [
  detectI18n,
  detectCamelLabels,
  detectGluedScripts,
  detectTitleCase,
  detectDateText,
  detectWordHygiene,
  detectButtonSpacing,
  detectDuplicateActions,
  detectMultiplePrimary,
  detectStepAndFooterDuplicates,
  detectEmptyColumns,
  detectMisalignedHeaders,
  detectNumericAlignment,
  detectRowHeights,
  detectTruncationWithoutTooltip,
  detectChipSums,
  detectCappedBadges,
  detectPaginationRange,
  detectTotalCounts,
  detectPristineErrors,
  detectRequiredMarkers,
  detectEnabledSave,
  detectTwoSaves,
  detectMaxlength,
  detectPlaceholderTypos,
  detectInputAttributes,
  detectIndicatorOutside,
  detectOverlays,
  detectVisibleDestructiveIcons,
  detectUnnamedIconButtons,
  detectNativeDialogs,
  detectCreateSaveChanges,
  detectFooterOrder,
  detectHorizontalScroll,
  detectTextSizeAndContrast,
  detectClippedText,
  detectOversizedMedia,
  detectOrphanGridCells,
  detectLargeGaps,
  detectSmallTargets,
  detectTestRecords,
  detectFutureDates,
  detectMixedDateFormats,
];

/** Run every detector once. */
export function run(ctx: DetectorContext): Issue[] {
  const out: Issue[] = [];
  for (const detector of DETECTORS) {
    try {
      out.push(...detector(document, ctx));
    } catch (error) {
      out.push({
        detector: 'finder',
        id: 'finder.detector-crash',
        severity: 'high',
        selector: 'document',
        message: 'A detector threw while inspecting the page.',
        evidence: String(error).slice(0, 200),
      });
    }
  }
  return out;
}

/** F3 — the style fingerprint of every role on the page. */
export function fingerprints(ctx: DetectorContext): Fingerprint[] {
  return collectFingerprints(document, ctx);
}

/** The design tokens the page actually exposes, for off-token reporting. */
export function tokens(): { colors: string[]; fontSizes: number[] } {
  return collectTokens(document);
}
