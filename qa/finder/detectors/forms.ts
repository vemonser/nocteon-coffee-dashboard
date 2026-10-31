import type { Detector, Issue } from './types.ts';
import { buttons, css, qsa, rectOf, selectorOf, text, visible } from './util.ts';

const SAVE_LABELS = /^(save|save changes|update|apply|حفظ|تحديث)$/i;

const DICTIONARY = new Set(
  `add address amount apply arabic archive back cancel cart category change
  checkout close code confirm contact cost count country create currency
  customer dashboard date day delete description details discount display
  edit email enabled english enter error export featured field filter find
  first free from full name help image includes item journal language last
  level light link list loading low manage message method minimum maximum
  name new next note notes number only open option order page password
  payment pending phone place please post price product profile publish
  quantity rate read reason refund region remove reply required reset review
  role roast save search select send settings shipping short slug sort status
  stock store subject submit successful summary tag taste text theme threshold
  title total type update upload user value variant verified view weight
  welcome write zone shipment session notification broadcast subscriber
  automation welcome language arabic english egypt cairo coffee nocteon
  firstname lastname fullname line summary shown cards basic information
  optional choose upload replace preview collapse expand show hide copy
  copied unsaved changes leave continue discard confirm accept decline
  previous current all none any other others select choose pick enter
  street city state postal country code phone website social media
  followers following published draft scheduled archived active blocked
  enabled disabled verified unverified featured standard premium`.split(/\s+/),
);

const FIELD_WORDS = new Set(
  `product category origin farm roast variety tasting note processing brew
  pairing method journal promo code zone shipping cart order review user role
  broadcast subscriber message description title slug price stock weight
  quantity threshold percentage amount currency image url phone email
  address name password confirm website instagram facebook`.split(/\s+/),
);

const AUTOCOMPLETE_HINTS: Array<{ test: RegExp; expected: string }> = [
  { test: /email|e-mail/i, expected: 'email' },
  { test: /phone|mobile|tel/i, expected: 'tel' },
  { test: /password|passwd/i, expected: 'current-password' },
  { test: /street|address/i, expected: 'street-address' },
  { test: /postal|zip/i, expected: 'postal-code' },
];

const NUMERIC_HINTS =
  /(price|stock|quantity|qty|threshold|percentage|amount|count|weight|number|numberof|max|min|size|limit)/i;

function fieldLabel(el: Element): string {
  const id = el.getAttribute('id');
  if (id) {
    const label = el.ownerDocument.querySelector(`label[for="${id}"]`);
    if (label) return text(label);
  }
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((x) => text(el.ownerDocument.getElementById(x)))
      .join(' ');
  }
  const wrapping = el.closest('label');
  if (wrapping) return text(wrapping);
  return '';
}

function isDirty(form: Element): boolean {
  if (form.getAttribute('data-dirty') === 'true') return true;
  for (const input of qsa(form, 'input,textarea,select')) {
    const el = input as HTMLInputElement;
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked !== el.defaultChecked) return true;
    } else if (el.type !== 'file' && el.value !== el.defaultValue) {
      return true;
    }
  }
  return false;
}

function forms(doc: Document): Element[] {
  return qsa(doc, 'form,[role="dialog"],[role="alertdialog"],[data-finder-form]').filter(
    (el) => visible(el) && qsa(el, 'input,textarea,select').length > 0,
  );
}

function add(
  out: Issue[],
  seen: Set<string>,
  el: Element,
  id: string,
  severity: Issue['severity'],
  message: string,
  evidence: string,
): void {
  const selector = selectorOf(el);
  const key = `${id}|${selector}|${evidence.slice(0, 20)}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ detector: 'forms', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

function isRed(el: Element): boolean {
  if (el.getAttribute('aria-invalid') === 'true') return true;
  if (el.matches('button,a,[role="button"]')) return false;
  const tokens = (el.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter((t) => /error|invalid|destructive/.test(t) && !t.includes(':'));
  if (tokens.length) return true;
  const c = parseColor(css(el).borderColor);
  if (!c) return false;
  // A red border: red clearly dominates both other channels and is not a
  // warm brown (the brand's copper is 138,75,34 — its green is not < 2*blue).
  return c.r > 140 && c.g < 90 && c.b < 90 && c.r > c.g * 1.6 && c.r > c.b * 1.6;
}

function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
}

/** A pristine form must not already show errors. */
export const detectPristineErrors: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const form of forms(doc)) {
    if (isDirty(form)) continue;
    // An error is a VISIBLE MESSAGE or a red (non-variant) class on a
    // control. `aria-invalid` alone is not enough: component libraries set
    // it from validators that may legitimately run before any interaction.
    for (const el of qsa(form, '[role="alert"],[class*="error"],[class*="invalid"]')) {
      if (!visible(el)) continue;
      const leaf = el.children.length === 0;
      const isAlert = el.getAttribute('role') === 'alert';
      const hasText = text(el).length > 2;
      if (!hasText) continue;
      if (!leaf && !isAlert) continue;
      if (!isAlert && !isRed(el)) continue;
      add(out, seen, el, 'forms.pristine-error', 'high',
        'A form that the user has not touched already shows an error.',
        `"${text(el).slice(0, 60)}"`);
    }
    for (const el of qsa(form, '[aria-invalid="true"]')) {
      if (!visible(el)) continue;
      if (!isRed(el)) continue;
      add(out, seen, el, 'forms.pristine-error', 'high',
        'A form that the user has not touched already shows an error.',
        'aria-invalid with an error border on a pristine field');
    }
  }
  return out;
};

/** Required fields must be marked in their visible label. */
export const detectRequiredMarkers: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of qsa(doc, 'input[required],textarea[required],select[required],[aria-required="true"]')) {
    if (!visible(el) || (el as HTMLInputElement).disabled) continue;
    const label = fieldLabel(el);
    if (!label) continue;
    if (/[*∗]|required|مطلوب/.test(label)) continue;
    add(out, seen, el, 'forms.required-no-marker', 'medium',
      'A required field is not marked as required in its label.', `label "${label.slice(0, 50)}"`);
  }
  return out;
};

/** Save must be disabled while the form is pristine. */
export const detectEnabledSave: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const form of forms(doc)) {
    if (isDirty(form)) continue;
    const saves = buttons(doc).filter(
      (b) => form.contains(b) && SAVE_LABELS.test(text(b)) && !b.hasAttribute('disabled'),
    );
    for (const save of saves) {
      add(out, seen, save, 'forms.save-enabled-pristine', 'high',
        'Save is enabled before the form has been changed.', `button "${text(save)}"`);
    }
  }
  return out;
};

/** One Save per page. */
export const detectTwoSaves: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const saves = buttons(doc).filter((b) => /^save( changes)?$|^حفظ$/i.test(text(b).trim()));
  if (saves.length > 1) {
    add(out, seen, saves[1], 'forms.two-save-buttons', 'high',
      'Two Save buttons are offered on one page.', `${saves.length} buttons: ${saves.map((b) => `"${text(b)}"`).join(', ')}`);
  }
  return out;
};

/** Free-text inputs need a maxlength; a long one needs a counter. */
export const detectMaxlength: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const raw of qsa(doc, 'input,textarea')) {
    const el = raw as HTMLInputElement;
    if (!visible(el) || el.disabled || el.readOnly) continue;
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (!['text', 'email', 'tel', 'url', 'search', ''].includes(type)) continue;
    if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete')) continue;
    const hint = `${el.getAttribute('name') ?? ''} ${el.id} ${el.placeholder ?? ''} ${el.getAttribute('aria-label') ?? ''}`;
    if (/search|بحث/i.test(hint) || type === 'search') continue;
    const max = Number(el.getAttribute('maxlength') ?? el.getAttribute('data-maxlength') ?? '');
    if (!max) {
      add(out, seen, el, 'forms.no-maxlength', 'low',
        'A free-text field has no maximum length.', `${el.tagName.toLowerCase()} "${el.getAttribute('name') || el.id || 'field'}"`);
      continue;
    }
    if (max >= 100) {
      const parent = el.closest('div,label,fieldset') ?? el.parentElement;
      const nearby = parent
        ? qsa(parent, 'span,small,p,[class*="counter"],[data-finder-counter]')
            .filter(visible)
            .map(text)
        : [];
      const hasCounter = nearby.some((t) => new RegExp(`\\d+\\s*/\\s*${max}\\b`).test(t));
      if (!hasCounter) {
        add(out, seen, el, 'forms.no-counter', 'low',
          'A field with a long maximum length has no character counter.', `maxlength=${max}`);
      }
    }
  }
  return out;
};

/** Placeholder spelling, against the UI dictionary plus the brand/field nouns. */
export const detectPlaceholderTypos: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const known = new Set([...DICTIONARY, ...FIELD_WORDS]);

  const near = (word: string): string | null => {
    for (const candidate of known) {
      if (Math.abs(candidate.length - word.length) > 1) continue;
      let diff = 0;
      let i = 0;
      let j = 0;
      while (i < word.length && j < candidate.length) {
        if (word[i] === candidate[j]) {
          i += 1;
          j += 1;
          continue;
        }
        diff += 1;
        if (diff > 1) break;
        if (word.length > candidate.length) i += 1;
        else if (word.length < candidate.length) j += 1;
        else {
          i += 1;
          j += 1;
        }
      }
      if (diff <= 1) return candidate;
    }
    return null;
  };

  for (const el of qsa(doc, '[placeholder]')) {
    if (!visible(el)) continue;
    const value = el.getAttribute('placeholder') ?? '';
    for (const word of value.match(/[A-Za-z]{5,}/g) ?? []) {
      const lower = word.toLowerCase();
      const singular = lower.replace(/ies$/, 'y').replace(/es$/, '').replace(/s$/, '');
      if (known.has(lower) || known.has(singular)) continue;
      const suggestion = near(lower);
      if (suggestion) {
        add(out, seen, el, 'forms.placeholder-typo', 'low',
          'A placeholder contains a misspelled word.',
          `"${word}" → "${suggestion}" in "${value.slice(0, 50)}"`);
        break;
      }
    }
  }
  return out;
};

/** type/inputmode/autocomplete for the fields browsers autofill. */
export const detectInputAttributes: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const raw of qsa(doc, 'input')) {
    const el = raw as HTMLInputElement;
    if (!visible(el) || el.disabled) continue;
    const type = (el.getAttribute('type') ?? '').toLowerCase();
    if (['hidden', 'checkbox', 'radio', 'file', 'submit', 'button', 'range', 'color'].includes(type)) continue;
    const inForm = !!el.closest('form,[role="dialog"],[data-finder-form]');
    const hint = `${el.getAttribute('name') ?? ''} ${el.id} ${el.getAttribute('formcontrolname') ?? ''} ${el.placeholder ?? ''} ${el.getAttribute('aria-label') ?? ''}`;

    const auto = inForm ? AUTOCOMPLETE_HINTS.find((h) => h.test.test(hint)) : undefined;
    if (auto && !el.getAttribute('autocomplete')) {
      add(out, seen, el, 'forms.missing-autocomplete', 'low',
        'A field the browser can autofill has no autocomplete hint.', `expected "${auto.expected}"`);
    }

    if (inForm && NUMERIC_HINTS.test(hint) && !el.getAttribute('inputmode') && type !== 'number') {
      add(out, seen, el, 'forms.missing-inputmode', 'low',
        'A numeric field has no numeric input mode.', `field "${hint.trim()}"`);
    }

    if (!type && !el.getAttribute('inputmode') && !el.getAttribute('autocomplete')) {
      add(out, seen, el, 'forms.missing-type', 'low',
        'A text field declares no type, inputmode or autocomplete.', `field "${hint.trim() || 'unnamed'}"`);
    }
  }
  return out;
};
