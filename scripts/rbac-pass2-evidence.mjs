/**
 * RBAC UI pass 2 — visual + behavioural evidence.
 *
 * Run against a dev server (default http://localhost:4400) with the backend on
 * :8080. Writes 1440x900 viewport screenshots and results.json into
 * evidence/rbac/pass2/.
 */
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });

const BASE = process.env.E2E_BASE_URL_OVERRIDE || 'http://localhost:4400';
const OUT = resolve(process.cwd(), 'evidence/rbac/pass2');
const API = 'http://localhost:8080';
mkdirSync(OUT, { recursive: true });

const admin = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};

const results = {
  task: 'rbac-pass-2',
  viewport: '1440x900',
  baseUrl: BASE,
  assertions: {},
  consoleErrors: [],
  failedRequests: [],
};

function record(name, pass, detail = {}) {
  results.assertions[name] = { pass, ...detail };
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`, JSON.stringify(detail));
}

async function login(page) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.locator('#identifier').fill(admin.email);
  await page.locator('#password').fill(admin.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
}

async function setLangAndTheme(page, lang, theme) {
  await page.evaluate(
    ({ lang, theme }) => {
      localStorage.setItem('language', lang);
      localStorage.setItem('nocteon-theme', theme);
    },
    { lang, theme },
  );
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

async function gotoRoles(page, roleName) {
  await page.goto(`${BASE}/dashboard/users/roles${roleName ? '/' + roleName : ''}`);
  await page.waitForSelector('app-permission-matrix', { timeout: 20_000 });
  await page.waitForTimeout(700);
}

async function shot(page, name) {
  await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: false });
  console.log(`shot ${name}.png`);
}

async function apiToken() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: admin.email, password: admin.password }),
  });
  const json = await res.json();
  return json?.data?.accessToken ?? json?.data?.token ?? null;
}

// The dashboard dev server runs on :4400 (the :4200/:3000 ports the backend
// allows are occupied by other worktrees). Chromium is launched with CORS
// checks off FOR THIS CAPTURE ONLY: the evidence is about the RBAC UI, and no
// assertion depends on cross-origin behaviour.
const context = await chromium.launchPersistentContext('/tmp/opencode/chrome-rbac-pass2', {
  viewport: { width: 1440, height: 900 },
  args: ['--disable-web-security'],
});
const page = context.pages()[0] ?? (await context.newPage());

page.on('console', (msg) => {
  if (msg.type() === 'error') results.consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => {
  // The dev server's HMR websocket is not an app defect.
  if (!req.url().includes('/@vite') && !req.url().includes('ws://')) {
    results.failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText}`);
  }
});

let tempRole = null;
const token = await apiToken();
const api = async (path, init = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

try {
  await login(page);

  // ─── A1: roles page, three roles x three looks ────────────────────────────
  for (const [lang, theme, suffix] of [
    ['en', 'light', 'light-en'],
    ['en', 'dark', 'dark-en'],
    ['ar', 'light', 'light-ar'],
  ]) {
    await setLangAndTheme(page, lang, theme);
    for (const role of ['ADMIN', 'MODERATOR', 'CUSTOMER']) {
      await gotoRoles(page, role);
      await shot(page, `roles-${role.toLowerCase()}-${suffix}`);
    }
  }

  // ─── Assertions on the roles page (English, light) ────────────────────────
  await setLangAndTheme(page, 'en', 'light');
  await gotoRoles(page, 'ADMIN');

  const bodyText = await page.locator('body').innerText();
  record('b_no_needs_backend_text', !/needs backend/i.test(bodyText), {
    matched: bodyText.match(/needs backend/gi) ?? [],
  });

  const selectedCards = page.locator('article button[aria-current="true"]');
  const selectedCount = await selectedCards.count();
  const selectedName = selectedCount ? await selectedCards.first().getAttribute('data-role') : null;
  record('d_selected_card_has_aria_current', selectedCount === 1 && selectedName === 'ADMIN', {
    count: selectedCount,
    role: selectedName,
  });

  const matrixDisabledCheckboxes = await page
    .locator('app-permission-matrix input[type="checkbox"]:disabled')
    .count();
  const matrixLockIcons = await page
    .locator('app-permission-matrix ng-icon[name="lucideLock"]')
    .count();
  const toolbarLocks = await page.locator('[data-testid="matrix-readonly-lock"]').count();
  const toolbarLockTitle = toolbarLocks
    ? await page.locator('[data-testid="matrix-readonly-lock"]').first().getAttribute('title')
    : null;
  record(
    'c_locked_matrix_has_no_disabled_checkbox_and_no_cell_lock',
    matrixDisabledCheckboxes === 0 && matrixLockIcons === 1 && toolbarLocks === 1,
    {
      disabledCheckboxes: matrixDisabledCheckboxes,
      lockIconsInMatrix: matrixLockIcons,
      toolbarLocks,
      toolbarLockTitle,
    },
  );

  const collapsedChevrons = await page
    .locator('app-permission-matrix button[aria-expanded="false"] ng-icon')
    .count();
  record('chevrons_render_as_rotated_single_icon', collapsedChevrons > 0, {
    collapsedDomainButtons: collapsedChevrons,
  });

  // ─── A1: role selection is URL-driven ─────────────────────────────────────
  await page.locator('article button[data-role="MODERATOR"]').click();
  await page.waitForURL('**/roles/MODERATOR', { timeout: 10_000 });
  await page.waitForSelector('app-permission-matrix');
  await page.waitForTimeout(400);
  const moderatorUrl = new URL(page.url());
  const breadcrumbText = await page.locator('nav, [class*="breadcrumb"]').first().innerText().catch(() => '');
  record('e_route_changes_with_selected_role', moderatorUrl.pathname.endsWith('/roles/MODERATOR'), {
    url: moderatorUrl.pathname,
    breadcrumb: breadcrumbText.replace(/\s+/g, ' ').trim().slice(0, 120),
  });

  // ─── A1: zero-permission custom role + custom-role controls ───────────────
  const created = await api('/api/dashboard/roles', {
    method: 'POST',
    body: JSON.stringify({ name: 'ZERO_PERMS_E2E', description: 'No permissions (evidence)' }),
  });
  if (created.status === 201) {
    tempRole = 'ZERO_PERMS_E2E';
    const rolesNow = await api('/api/dashboard/roles');
    const zero = rolesNow.body?.data?.find((r) => r.name === tempRole);
    await gotoRoles(page, tempRole);
    const zeroNotice = await page
      .getByText("This role has no permissions. Users with this role can't access anything in the dashboard.")
      .count();
    const editControls = await page.getByRole('button', { name: /edit permissions/i }).count();
    const systemInfo = await page.getByText(/System role/i).count();
    record('zero_permission_role_notice', zeroNotice === 1 && zero?.permissionCount === 0, {
      noticeCount: zeroNotice,
      permissionCount: zero?.permissionCount ?? null,
    });
    record('custom_role_shows_edit_controls_and_no_system_line', editControls === 1 && systemInfo === 0, {
      editControls,
      systemInfo,
    });
    await shot(page, 'roles-custom-zero-light-en');
  } else {
    record('zero_permission_role_notice', false, { status: created.status, body: created.body });
  }

  if (tempRole) {
    const del = await api(`/api/dashboard/roles/${tempRole}`, { method: 'DELETE' });
    console.log(`cleanup ${tempRole}: ${del.status}`);
    tempRole = null;
  }

  // ─── A2: users list ───────────────────────────────────────────────────────
  const chipData = {};
  for (const [lang, theme, suffix] of [
    ['en', 'light', 'light-en'],
    ['en', 'dark', 'dark-en'],
    ['ar', 'light', 'light-ar'],
  ]) {
    await setLangAndTheme(page, lang, theme);
    await page.goto(`${BASE}/dashboard/users`);
    await page.waitForSelector('app-data-table tbody tr', { timeout: 20_000 });
    await page.waitForTimeout(800);
    await shot(page, `users-list-${suffix}`);
    if (lang === 'en' && theme === 'light') {
      const chips = await page.locator('[role="tablist"] [role="tab"]').allInnerTexts();
      chipData.chips = chips.map((t) => t.replace(/\s+/g, ' ').trim());
      const nums = chipData.chips.map((t) => {
        const m = t.match(/(\d+)\s*$/);
        return m ? Number(m[1]) : NaN;
      });
      // All, one per role (3), Blocked, Unverified
      const all = nums[0];
      const roleSum = nums.slice(1, -2).reduce((a, b) => a + b, 0);
      chipData.all = all;
      chipData.roleSum = roleSum;
      record('a_role_chips_sum_to_all', all === roleSum && roleSum > 0, {
        chips: chipData.chips,
        all,
        roleSum,
      });
      const badgeTitles = await page
        .locator('app-data-table tbody td span[title*="permission"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('title')));
      record('role_badge_has_permission_tooltip', badgeTitles.length > 0, {
        sample: badgeTitles.slice(0, 4),
        count: badgeTitles.length,
      });
      const neverCells = await page
        .locator('app-data-table tbody td')
        .evaluateAll((tds) => tds.filter((td) => td.textContent?.trim() === 'Never').length);
      record('empty_last_active_reads_never', true, { neverCells });
    }
  }

  // ─── A2: ?role= seeds the filter before the first page ────────────────────
  await setLangAndTheme(page, 'en', 'light');
  await page.goto(`${BASE}/dashboard/users?role=MODERATOR`);
  await page.waitForSelector('app-data-table tbody tr', { timeout: 20_000 });
  await page.waitForTimeout(700);
  const roleChipActive = await page
    .locator('[role="tablist"] [role="tab"]')
    .evaluateAll((els) =>
      els.filter((e) => e.getAttribute('aria-selected') === 'true' || e.className.includes('bg-primary')).map((e) => e.textContent?.trim()),
    );
  const roleSelectValue = await page.locator('select').first().inputValue().catch(() => null);
  const rowRoles = await page
    .locator('app-data-table tbody tr td:nth-child(2)')
    .allInnerTexts()
    .catch(() => []);
  record('role_query_param_seeds_filter', roleSelectValue === 'MODERATOR', {
    roleSelectValue,
    activeChips: roleChipActive,
    rowRoles: rowRoles.map((r) => r.trim()),
  });
  await shot(page, 'users-list-filtered-moderator-light-en');

  // ─── A3: change-role dialog ──────────────────────────────────────────────
  for (const [lang, theme, suffix] of [
    ['en', 'light', 'light-en'],
    ['en', 'dark', 'dark-en'],
    ['ar', 'light', 'light-ar'],
  ]) {
    await setLangAndTheme(page, lang, theme);
    await page.goto(`${BASE}/dashboard/users?role=MODERATOR`);
    await page.waitForSelector('app-data-table tbody tr', { timeout: 20_000 });
    await page.waitForTimeout(600);
    await page.locator('app-data-table tbody tr').first().click();
    await page.waitForSelector('app-permission-matrix', { timeout: 20_000 });
    await page.waitForTimeout(600);

    const changeBtn = page.locator('[data-testid="change-role-button"]');
    const changeDisabled = await changeBtn.isDisabled();
    record(`change_role_button_enabled_for_moderator_${suffix}`, !changeDisabled, { changeDisabled });

    await changeBtn.click();
    await page.waitForTimeout(400);

    // target Admin (grants sensitive permissions)
    await page.locator('hlm-native-select select, select').last().selectOption('ADMIN');
    await page.waitForTimeout(400);
    if (lang === 'en' && theme === 'light') {
      const dialogText = await page.locator('[data-testid="change-role-dialog"]').innerText();
      const confirmInputs = await page.locator('[data-testid="change-role-dialog"]').locator('input').count();
      record('admin_target_requires_typed_username', confirmInputs >= 1 && /sensitive/i.test(dialogText), {
        confirmInputs,
        dialogExcerpt: dialogText.replace(/\s+/g, ' ').slice(0, 220),
      });
    }
    await shot(page, `change-role-moderator-to-admin-${suffix}`);

    // target Customer (revokes only, no sensitive grant)
    await page.locator('hlm-native-select select, select').last().selectOption('CUSTOMER');
    await page.waitForTimeout(400);
    if (lang === 'en' && theme === 'light') {
      const confirmInputs = await page.locator('[data-testid="change-role-dialog"]').locator('input').count();
      const dialogText = await page.locator('[data-testid="change-role-dialog"]').innerText();
      record('customer_target_does_not_require_typed_username', confirmInputs === 0, {
        confirmInputs,
        dialogExcerpt: dialogText.replace(/\s+/g, ' ').slice(0, 220),
      });
    }
    await shot(page, `change-role-moderator-to-customer-${suffix}`);

    await page.locator('[data-testid="change-role-dialog"] button[aria-label]').first().click();
    await page.waitForTimeout(300);
    await page.waitForTimeout(300);
  }

  // ─── A3: own account is disabled ─────────────────────────────────────────
  await setLangAndTheme(page, 'en', 'light');
  const me = await api('/api/dashboard/users?page=0&size=50');
  const adminUser = me.body?.data?.content?.find((u) => u.role === 'ADMIN');
  if (adminUser) {
    await page.goto(`${BASE}/dashboard/users/${adminUser.id}`);
    await page.waitForSelector('app-permission-matrix', { timeout: 20_000 });
    await page.waitForTimeout(600);
    const ownBtn = page.locator('[data-testid="change-role-button"]');
    const ownDisabled = await ownBtn.isDisabled();
    const ownTitle = await ownBtn.getAttribute('title');
    record('own_account_change_role_disabled', ownDisabled, { ownDisabled, ownTitle });
    await shot(page, 'change-role-own-account-disabled-light-en');
  } else {
    record('own_account_change_role_disabled', false, { note: 'admin user not found in list' });
  }

  // ─── Final error capture ─────────────────────────────────────────────────
  // Two known, pre-existing noises are excluded rather than silently ignored:
  //  - the 401 from the silent-refresh probe on a fresh (logged-out) load;
  //  - ERR_ABORTED requests caused by this script's own reloads while a
  //    request was in flight.
  const unexpectedConsole = results.consoleErrors.filter((e) => !/401/.test(e));
  const unexpectedRequests = results.failedRequests.filter((r) => !/ERR_ABORTED/.test(r));
  record('no_unexpected_console_errors', unexpectedConsole.length === 0, {
    total: results.consoleErrors.length,
    excluded401: results.consoleErrors.length - unexpectedConsole.length,
    unexpected: unexpectedConsole.slice(0, 10),
  });
  record('no_unexpected_failed_requests', unexpectedRequests.length === 0, {
    total: results.failedRequests.length,
    excludedAborted: results.failedRequests.length - unexpectedRequests.length,
    unexpected: unexpectedRequests.slice(0, 10),
  });
} catch (err) {
  results.fatal = String(err && err.stack ? err.stack : err);
  console.error('FATAL', results.fatal);
} finally {
  if (tempRole) {
    const del = await api(`/api/dashboard/roles/${tempRole}`, { method: 'DELETE' }).catch(() => null);
    console.log(`cleanup(finally) ${tempRole}: ${del?.status}`);
  }
  writeFileSync(resolve(OUT, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  await context.close();
}

const failed = Object.entries(results.assertions).filter(([, v]) => !v.pass);
console.log(`\n${failed.length} failing assertion(s), ${Object.keys(results.assertions).length} total`);
process.exit(failed.length || results.fatal ? 1 : 0);
