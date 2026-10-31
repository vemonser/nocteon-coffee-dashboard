import type { Journey, JourneyContext } from './journey-kit.ts';
import { click, fill, goto, writeOnly } from './journey-kit.ts';

const NAME_EN = [
  'input[formcontrolname="nameEn"]',
  'input[name="nameEn"]',
  'input[name="name_en"]',
  '#name-en',
  '[data-testid*="name-en"] input',
  'input[placeholder*="English" i]',
];
const NAME_AR = [
  'input[formcontrolname="nameAr"]',
  'input[name="nameAr"]',
  'input[name="name_ar"]',
  '#name-ar',
  '[data-testid*="name-ar"] input',
  'input[placeholder*="Arabic" i]',
];
const SLUG = ['input[formcontrolname="slug"]', 'input[name="slug"]', '#slug'];

export const JOURNEYS: Journey[] = [
  {
    id: 'add-product',
    area: 'Products',
    title: 'Add a product with two variants and a cover image',
    pass: 'The product is saved with two variants and a cover image, and appears on the products list.',
    mutates: true,
    steps: [
      { id: 'open', title: 'Open Products, then "New product"', run: async (ctx) => (await goto(ctx, '/dashboard/products')) && (await click(ctx, ['new product', 'add product', 'create product'])) },
      { id: 'names', title: 'Fill the English and Arabic names', run: async (ctx) => (await fill(ctx, NAME_EN, 'Auditcov Finder product')) && (await fill(ctx, NAME_AR, 'منتج أوديتكوف')) },
      { id: 'slug', title: 'Fill the URL slug', run: async (ctx) => fill(ctx, SLUG, 'auditcov-finder-product') },
      { id: 'summary', title: 'Fill the short description', run: async (ctx) => fill(ctx, ['textarea[formcontrolname="shortDescription"]', 'textarea[name="shortDescription"]', 'textarea'], 'A finder journey product.') },
      { id: 'category', title: 'Choose a category and product type', run: async (ctx) => click(ctx, ['select category', 'category', 'choose category']) },
      { id: 'step2', title: 'Continue to the variants step', run: async (ctx) => click(ctx, ['next', 'continue', 'next step']) },
      { id: 'variants', title: 'Add two variants', run: async (ctx) => (await click(ctx, ['add variant'])) && (await click(ctx, ['add variant'])) },
      { id: 'cover', title: 'Upload a cover image', run: async (ctx) => click(ctx, ['upload', 'add image', 'cover image']) },
      { id: 'save', title: 'Save the product', run: writeOnly('creating a product is a write') },
    ],
  },
  {
    id: 'edit-stock-inline',
    area: 'Products',
    title: 'Edit stock inline',
    pass: 'The stock cell opens an editor, accepts a number and the new value survives a reload.',
    mutates: true,
    steps: [
      { id: 'open', title: 'Open the products list', run: (ctx) => goto(ctx, '/dashboard/products') },
      { id: 'cell', title: 'Click the stock value in the first row', run: async (ctx) => {
        const cell = ctx.page.locator('td[data-column="productStock"] button, tbody tr:first-child td:nth-child(6)').first();
        if (!(await cell.count().catch(() => 0))) return false;
        await cell.click({ timeout: 4000 }).catch(() => {});
        ctx.countClick();
        await ctx.page.waitForTimeout(300);
        return true;
      } },
      { id: 'type', title: 'Type a new stock value', run: async (ctx) => fill(ctx, ['tbody tr:first-child input[type="number"]', 'input[type="number"]'], '25') },
      { id: 'escape', title: 'Escape out without saving', run: async (ctx) => { await ctx.page.keyboard.press('Escape').catch(() => {}); return true; } },
      { id: 'save', title: 'Save and reload to prove it persisted', run: writeOnly('inline save is a write') },
    ],
  },
  {
    id: 'feature-product',
    area: 'Products',
    title: 'Feature a product',
    pass: 'The product is featured and the list shows a Featured mark for it.',
    mutates: true,
    steps: [
      { id: 'open', title: 'Open the products list', run: (ctx) => goto(ctx, '/dashboard/products') },
      { id: 'feature', title: 'Use the featured control on the first row', run: async (ctx) => {
        const marks = ['[data-testid*="featured"] button', 'td[data-column="featured"] button', 'button[aria-label*="featured" i]', 'button[aria-label*="star" i]'];
        for (const selector of marks) {
          const el = ctx.page.locator(selector).first();
          if (await el.count().catch(() => 0)) {
            await el.click({ timeout: 4000 }).catch(() => {});
            ctx.countClick();
            return true;
          }
        }
        return false;
      } },
      { id: 'verify', title: 'The row shows Featured', run: async (ctx) => (await ctx.page.locator('text=/featured/i').count().catch(() => 0)) > 0 },
    ],
  },
  {
    id: 'approve-review',
    area: 'Reviews',
    title: 'Approve a pending review',
    pass: 'The review status becomes Approved and the pending chip count decreases by one.',
    mutates: true,
    steps: [
      { id: 'open', title: 'Open Reviews and filter to Pending', run: async (ctx) => (await goto(ctx, '/dashboard/reviews')) && (await click(ctx, ['pending'])) },
      { id: 'row', title: 'Open the first pending review', run: async (ctx) => click(ctx, ['open', 'view', 'review']) || (await ctx.page.locator('tbody tr, [data-finder-row]').first().click({ timeout: 4000 }).then(() => { ctx.countClick(); return true; }).catch(() => false)) },
      { id: 'approve', title: 'Press Approve', run: writeOnly('approving a review is a write') },
      { id: 'verify', title: 'The pending chip decreased', run: writeOnly('approving a review is a write') },
    ],
  },
  {
    id: 'reply-contact-message',
    area: 'Contact messages',
    title: 'Reply to a contact message and archive it',
    pass: 'The reply is sent and the message moves to Archived.',
    mutates: true,
    steps: [
      { id: 'open', title: 'Open Contact messages', run: (ctx) => goto(ctx, '/dashboard/contact-messages') },
      { id: 'row', title: 'Open the first message', run: async (ctx) => (await ctx.page.locator('tbody tr, [data-finder-row], a[href*="contact"]').first().click({ timeout: 4000 }).then(() => { ctx.countClick(); return true; }).catch(() => false)) },
      { id: 'reply', title: 'Write a reply', run: async (ctx) => fill(ctx, ['textarea[formcontrolname="reply"]', 'textarea[name="reply"]', 'textarea'], 'Thank you for your message.') },
      { id: 'send', title: 'Send the reply', run: writeOnly('sending a reply is a write') },
      { id: 'archive', title: 'Archive the message', run: writeOnly('archiving is a write') },
    ],
  },
  {
    id: 'create-role',
    area: 'Access',
    title: 'Create a custom role and assign it',
    pass: 'The role exists with the chosen permissions and can be assigned to a user.',
    mutates: true,
    steps: [
      { id: 'open', title: 'Open Users, then Roles', run: (ctx) => goto(ctx, '/dashboard/users/roles') },
      { id: 'dialog', title: 'Open the new-role dialog', run: (ctx) => click(ctx, ['new role', 'create role', 'add role']) },
      { id: 'name', title: 'Name the role', run: async (ctx) => fill(ctx, ['input[formcontrolname="name"]', 'input[name="name"]', 'input'], 'Auditcov role') },
      { id: 'permissions', title: 'Pick at least one permission', run: async (ctx) => click(ctx, ['order:read', 'read orders', 'orders']) },
      { id: 'save', title: 'Save and assign it to a user', run: writeOnly('creating a role is a write') },
    ],
  },
  {
    id: 'send-broadcast',
    area: 'Newsletter',
    title: 'Send a broadcast to a test audience',
    pass: 'The broadcast is sent to the test segment and the delivery count is shown.',
    mutates: true,
    steps: [
      { id: 'open', title: 'Open Broadcasts, then New broadcast', run: async (ctx) => (await goto(ctx, '/dashboard/broadcasts')) && (await click(ctx, ['new broadcast', 'create broadcast', 'new'])) },
      { id: 'subject', title: 'Fill the subject', run: async (ctx) => fill(ctx, ['input[formcontrolname="subject"]', 'input[name="subject"]', 'input'], 'Auditcov test broadcast') },
      { id: 'body', title: 'Fill the body', run: async (ctx) => fill(ctx, ['textarea[formcontrolname="body"]', 'textarea[name="body"]', 'textarea'], 'Finder journey body.') },
      { id: 'audience', title: 'Choose the test audience', run: (ctx) => click(ctx, ['test audience', 'audience', 'segment', 'all subscribers']) },
      { id: 'send', title: 'Send', run: writeOnly('sending a broadcast is a write') },
    ],
  },
  {
    id: 'journal-post-bilingual',
    area: 'Content',
    title: 'Create a journal post in both languages',
    pass: 'The post saves with English and Arabic content and renders in both languages.',
    mutates: true,
    steps: [
      { id: 'open', title: 'Open Journal, then New post', run: async (ctx) => (await goto(ctx, '/dashboard/journal')) && (await click(ctx, ['new post', 'new', 'create post'])) },
      { id: 'title-en', title: 'Fill the English title', run: async (ctx) => fill(ctx, NAME_EN, 'Auditcov journal post') },
      { id: 'title-ar', title: 'Fill the Arabic title', run: async (ctx) => fill(ctx, NAME_AR, 'مقال أوديتكوف') },
      { id: 'slug', title: 'Fill the slug', run: async (ctx) => fill(ctx, SLUG, 'auditcov-journal-post') },
      { id: 'body', title: 'Fill both bodies', run: async (ctx) => fill(ctx, ['textarea', '[contenteditable="true"]'], 'Finder journey body.') },
      { id: 'save', title: 'Save and check both languages', run: writeOnly('saving a post is a write') },
    ],
  },
  {
    id: 'find-order-refund',
    area: 'Orders',
    title: 'Find an order by number and issue a refund',
    pass: 'The order is found by its ORD number and the refund is recorded on it.',
    mutates: true,
    steps: [
      { id: 'open', title: 'Open Orders', run: (ctx) => goto(ctx, '/dashboard/orders') },
      { id: 'number', title: 'Read an order number from the list', run: async (ctx) => {
        const cell = ctx.page.locator('text=/ORD-\\d{4}-\\d{6}/').first();
        if (!(await cell.count().catch(() => 0))) return false;
        const value = (await cell.textContent().catch(() => '')) ?? '';
        const match = value.match(/ORD-\d{4}-\d{6}/);
        if (!match) return false;
        await ctx.page.evaluate((orderNumber) => {
          (window as unknown as { __finderOrderNumber?: string }).__finderOrderNumber = orderNumber;
        }, match[0]);
        return true;
      } },
      { id: 'search', title: 'Search for that number', run: async (ctx) => {
        const orderNumber = await ctx.page.evaluate(
          () => (window as unknown as { __finderOrderNumber?: string }).__finderOrderNumber ?? '',
        );
        const done = await fill(ctx, ['input[type="search"]', 'input[placeholder*="search" i]'], orderNumber);
        await ctx.page.keyboard.press('Enter').catch(() => {});
        await ctx.page.waitForTimeout(900);
        return done;
      } },
      { id: 'open-order', title: 'Open the matching order', run: async (ctx) => click(ctx, ['ORD-']) },
      { id: 'refund', title: 'Issue the refund', run: writeOnly('a refund is a write') },
    ],
  },
  {
    id: 'free-shipping-threshold',
    area: 'Store',
    title: 'Change the free shipping threshold',
    pass: 'The threshold saves and the storefront applies the new amount.',
    mutates: true,
    steps: [
      { id: 'open', title: 'Open Store settings', run: (ctx) => goto(ctx, '/dashboard/store-settings') },
      { id: 'field', title: 'Fill a new threshold', run: async (ctx) => fill(ctx, ['input[formcontrolname*="freeShipping" i]', 'input[name*="threshold" i]', 'input[type="number"]'], '700') },
      { id: 'save', title: 'Save', run: writeOnly('saving store settings is a write') },
      { id: 'verify', title: 'The storefront uses the new threshold', run: writeOnly('saving store settings is a write') },
    ],
  },
];

/** Run one journey with instrumentation (clicks, keys, time, dead ends). */
export async function runJourney(
  journey: Journey,
  baseUrl: string,
  page: import('playwright').Page,
): Promise<import('./journey-kit.ts').JourneyResult> {
  const started = Date.now();
  let clicks = 0;
  let keystrokes = 0;
  const deadEnds: string[] = [];
  const workarounds: string[] = [];
  const consoleErrors: string[] = [];
  const notes: string[] = [];
  const steps: Array<{ id: string; title: string; done: boolean }> = [];

  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  };
  page.on('console', onConsole);

  const ctx: JourneyContext = {
    page,
    baseUrl,
    clicks: () => clicks,
    keystrokes: () => keystrokes,
    countClick: () => { clicks += 1; },
    countKeys: (n) => { keystrokes += n; },
    workaround: (step, note) => workarounds.push(`${step}: ${note}`),
  };

  try {
    for (const step of journey.steps) {
      const before = await page.evaluate(() => document.body?.innerText.length ?? 0).catch(() => 0);
      let done = false;
      try {
        done = await Promise.race([
          step.run(ctx),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 20_000)),
        ]);
      } catch (error) {
        notes.push(`${step.id}: ${String(error).slice(0, 160)}`);
        done = false;
      }
      steps.push({ id: step.id, title: step.title, done });
      if (done && !/write|save|send|approve|refund|archive|verify/i.test(step.id)) {
        const after = await page.evaluate(() => document.body?.innerText.length ?? 0).catch(() => 0);
        if (after === before && !page.url().includes(step.id)) {
          // A control that changes nothing on a click is a dead end; the
          // step itself may still have succeeded (a toggle that re-renders
          // the same text is a false positive, so this stays a note).
          notes.push(`${step.id}: no visible change after the action`);
        }
      }
      if (!done) break;
    }
  } finally {
    page.off('console', onConsole);
  }

  const doneCount = steps.filter((s) => s.done).length;
  const status: 'pass' | 'partial' | 'blocked' =
    doneCount === journey.steps.length ? 'pass' : doneCount > 0 ? 'partial' : 'blocked';

  return {
    id: journey.id,
    area: journey.area,
    title: journey.title,
    pass: journey.pass,
    status,
    steps,
    clicks,
    keystrokes,
    ms: Date.now() - started,
    deadEnds,
    workarounds,
    consoleErrors,
    notes,
  };
}
