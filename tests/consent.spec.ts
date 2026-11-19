import { test as base, expect, type Page } from '@playwright/test';
import { COLLECT, GOOGLE, PAGES, seedChoice, serveSite } from './site';

/**
 * The analytics consent contract (public/consent.js), end to end against a
 * production build served at the production hostname.
 */
const test = base.extend<{ google: string[]; problems: string[] }>({
  // Serve the build at whatever origin the test runs on.
  context: async ({ context, baseURL }, use) => {
    await serveSite(context, new URL(baseURL!).origin);
    await use(context);
  },
  // Every request from the page to Google, in order.
  google: async ({ context }, use) => {
    const urls: string[] = [];
    context.on('request', (r) => { if (GOOGLE.test(r.url())) urls.push(r.url()); });
    await use(urls);
  },
  // Any console error (which is how Chrome reports a CSP violation) or
  // uncaught exception fails the test.
  problems: [
    async ({ context }, use) => {
      const problems: string[] = [];
      context.on('console', (m) => {
        if (m.type() !== 'error') return;
        // the deliberate 404 page reports its own status
        if (/status of 404/.test(m.text()) && m.location().url.endsWith('/no-such-page/')) return;
        problems.push(m.text());
      });
      context.on('weberror', (e) => problems.push(e.error().message));
      await use(problems);
      expect(problems, 'console errors or CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

const card = (page: Page) => page.locator('#consent');
const gtm = (page: Page) => page.locator('script[src^="https://www.googletagmanager.com/gtm.js"]');
const button = (page: Page, name: 'Accept' | 'Decline') =>
  card(page).getByRole('button', { name, exact: true });

async function cardOpens(page: Page) {
  await expect(card(page)).toHaveAttribute('data-state', 'open', { timeout: 10_000 });
}
/** Wait for the entrance transition, so measurements see the resting position. */
async function cardSettles(page: Page) {
  await cardOpens(page);
  await card(page).evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
}
async function gaCookies(page: Page) {
  return (await page.context().cookies()).filter((c) => /^(_ga|_gid|_gat)/.test(c.name));
}

test('first visit: nothing from Google before a choice; the card does not take focus', async ({ page, google }) => {
  await page.goto('/');
  await cardOpens(page);
  await expect(page.getByRole('region', { name: 'Analytics cookies' })).toBeVisible();
  await expect(card(page)).toHaveAttribute('aria-describedby', 'consent-body');
  await expect(card(page)).toHaveAttribute('data-nosnippet', '');
  expect(google).toEqual([]);

  // It did not steal focus, and it is the first thing after the skip link.
  await expect(page.locator('body')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('a.skip')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(button(page, 'Decline')).toBeFocused();

  // Equal weight: the same classes on both buttons.
  expect(await button(page, 'Decline').getAttribute('class'))
    .toBe(await button(page, 'Accept').getAttribute('class'));

  await page.waitForTimeout(1500);
  expect(google).toEqual([]);
});

test('accept: one gtm.js, consent default queued first, a GA4 hit; remembered on reload', async ({ page }) => {
  // Record what was on the dataLayer at the moment gtm.js was added.
  await page.addInitScript(() => {
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) {
        if (n instanceof HTMLScriptElement && n.src.includes('/gtm.js')) {
          (window as any).__dataLayerAtGtm = ((window as any).dataLayer || []).map((e: any) => e[0]);
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto('/');
  await cardOpens(page);
  const hit = page.waitForRequest(COLLECT, { timeout: 20_000 });
  await button(page, 'Accept').click();

  await expect(card(page)).toHaveCount(0);
  await expect(gtm(page)).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__dataLayerAtGtm)).toEqual(['consent', 'js']);
  const consent = await page.evaluate(() => Array.from((window as any).dataLayer[0]));
  expect(consent).toEqual(['consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  }]);
  await hit; // answered locally by tests/site.ts

  // Returning visitor: no card, and Tag Manager loads straight away.
  await page.reload();
  await expect(gtm(page)).toHaveCount(1);
  await page.waitForTimeout(1500); // longer than the card's appear delay
  await expect(card(page)).toHaveCount(0);
});

test('Cookie settings: focus, pressed state, Escape; declining after accepting clears cookies and unloads GTM', async ({ page, context }) => {
  await seedChoice(context, 'granted');
  await page.goto('/');
  await expect(gtm(page)).toHaveCount(1);
  await expect.poll(() => gaCookies(page).then((c) => c.length), { timeout: 20_000 }).toBeGreaterThan(0);

  const settings = page.getByRole('button', { name: 'Cookie settings' });
  await settings.focus();
  await page.keyboard.press('Enter');
  await cardOpens(page);
  await expect(page.locator('#consent-title')).toBeFocused();
  await expect(button(page, 'Accept')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Decline')).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
  await expect(settings).toBeFocused();

  await page.keyboard.press('Enter');
  await cardOpens(page);
  await Promise.all([page.waitForEvent('load'), button(page, 'Decline').click()]);
  await expect(gtm(page)).toHaveCount(0);
  expect(await gaCookies(page)).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gcb:consent')!).analytics))
    .toBe('denied');
});

test('accepting from Cookie settings after declining loads GTM without a reload', async ({ page, context, google }) => {
  await seedChoice(context, 'denied');
  await page.goto('/');
  await page.getByRole('button', { name: 'Cookie settings' }).click();
  await cardOpens(page);
  await expect(button(page, 'Decline')).toHaveAttribute('aria-pressed', 'true');
  expect(google).toEqual([]);
  await page.evaluate(() => ((window as any).__samePage = true));
  await button(page, 'Accept').click();
  await expect(gtm(page)).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).__samePage)).toBe(true);
});

test('decline on a first visit: nothing from Google across several pages', async ({ page, google }) => {
  await page.goto('/');
  await cardOpens(page);
  await button(page, 'Decline').click();
  await expect(card(page)).toHaveCount(0);
  for (const path of ['/about/', '/projects/', PAGES[7], '/contact/', '/']) await page.goto(path);
  await page.waitForTimeout(1500);
  await expect(card(page)).toHaveCount(0);
  expect(google).toEqual([]);
});

test('a choice made in one tab applies to every open tab', async ({ context, page }) => {
  const other = await context.newPage();
  await page.goto('/');
  await other.goto('/about/');
  await cardOpens(page);
  await cardOpens(other);
  await button(page, 'Accept').click();
  await expect(card(other)).toHaveCount(0);
  await expect(gtm(other)).toHaveCount(1);
});

test('asks again after 12 months, and when the stored version is out of date', async ({ browser, baseURL }) => {
  for (const seed of [{ ageMs: 366 * 24 * 60 * 60 * 1000 }, { v: 0 }]) {
    const context = await browser.newContext({ baseURL });
    await serveSite(context, baseURL!);
    await seedChoice(context, 'granted', seed);
    const page = await context.newPage();
    const google: string[] = [];
    page.on('request', (r) => { if (GOOGLE.test(r.url())) google.push(r.url()); });
    await page.goto('/');
    await cardOpens(page);
    expect(google, JSON.stringify(seed)).toEqual([]);
    await context.close();
  }
});

test('without storage the choice holds for the current page only', async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('blocked', 'SecurityError'); },
    });
  });
  await page.goto('/');
  await cardOpens(page);
  await button(page, 'Accept').click();
  await expect(gtm(page)).toHaveCount(1);
  await page.goto('/about/');
  await cardOpens(page);
  await expect(gtm(page)).toHaveCount(0);
});

test('text and controls meet contrast minimums (measured from computed styles)', async ({ page, context }) => {
  await seedChoice(context, 'denied');
  await page.goto('/');
  await page.getByRole('button', { name: 'Cookie settings' }).focus();
  await page.keyboard.press('Enter');
  await cardSettles(page);
  await page.keyboard.press('Tab'); // heading -> Decline, so its focus ring is drawn
  await expect(button(page, 'Decline')).toBeFocused();
  await page.waitForTimeout(300); // .btn colour transitions

  const measured = await page.evaluate(() => {
    type C = { r: number; g: number; b: number; a: number };
    const parse = (s: string): C => {
      const [r, g, b, a = 1] = (s.match(/[\d.]+/g) || []).map(Number);
      return { r, g, b, a };
    };
    const over = (fg: C, bg: C): C => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = (c: C) => {
      const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a: C, b: C) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    const css = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    const cardBg = parse(css('#consent .consent-card').backgroundColor);
    const footerBg = parse(css('footer').backgroundColor);
    const pressed = css('#consent [aria-pressed="true"]');
    const unpressed = css('#consent [aria-pressed="false"]');
    const focused = css('#consent button:focus-visible');
    const bgOf = (s: CSSStyleDeclaration) => over(parse(s.backgroundColor), cardBg);
    return {
      text: {
        heading: ratio(parse(css('#consent-title').color), cardBg),
        body: ratio(parse(css('#consent-body').color), cardBg),
        button: ratio(parse(unpressed.color), bgOf(unpressed)),
        'pressed button': ratio(parse(pressed.color), bgOf(pressed)),
        'footer control': ratio(parse(css('.consent-settings').color), footerBg),
      },
      ui: {
        'button border': ratio(over(parse(unpressed.borderTopColor), cardBg), cardBg),
        'focus ring': ratio(over(parse(focused.outlineColor), cardBg), cardBg),
      },
    };
  });
  console.log('contrast', JSON.stringify(measured));
  for (const [what, r] of Object.entries(measured.text)) expect(r, what).toBeGreaterThanOrEqual(4.5);
  for (const [what, r] of Object.entries(measured.ui)) expect(r, what).toBeGreaterThanOrEqual(3);
});

test.describe('at 320px', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the card fits: 12px margins, buttons side by side, ≥44px tall, labels unclipped', async ({ page }) => {
    await page.goto('/');
    await cardSettles(page);
    const m = await page.evaluate(() => {
      const c = document.querySelector('#consent')!;
      const box = c.getBoundingClientRect();
      return {
        left: box.left,
        right: document.documentElement.clientWidth - box.right,
        bottom: innerHeight - box.bottom,
        contentFits: c.scrollWidth <= c.clientWidth,
        buttons: [...c.querySelectorAll('button')].map((b) => ({
          top: b.getBoundingClientRect().top,
          height: b.getBoundingClientRect().height,
          fits: b.scrollWidth <= b.clientWidth,
        })),
        bodyPx: parseFloat(getComputedStyle(document.querySelector('#consent-body')!).fontSize),
      };
    });
    expect(m.left).toBe(12);
    expect(m.right).toBe(12);
    expect(m.bottom).toBe(12);
    expect(m.contentFits).toBe(true);
    expect(m.bodyPx).toBeGreaterThanOrEqual(14);
    expect(m.buttons[0].top).toBe(m.buttons[1].top);
    for (const b of m.buttons) {
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.fits).toBe(true);
    }
  });
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
  test.describe(`placement at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    for (const path of PAGES) {
      test(`covers no H1, button or navigation on ${path}`, async ({ page }) => {
        await page.goto(path);
        await cardSettles(page);
        const r = await page.evaluate(() => {
          const box = (el: Element) => {
            const b = el.getBoundingClientRect();
            return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
          };
          const cardEl = document.querySelector('#consent .consent-card')!;
          const guarded = [...document.querySelectorAll('h1, header, .btn')]
            .filter((el) => !cardEl.contains(el))
            .map((el) => ({ what: `${el.tagName} ${(el.textContent || '').trim().slice(0, 40)}`, box: box(el) }))
            .filter(({ box: b }) => b.bottom > 0 && b.top < innerHeight && b.right > b.left);
          return { card: box(cardEl), guarded, navRight: box(document.querySelector('#navigation')!).right };
        });
        const overlaps = (a: typeof r.card, b: typeof r.card) =>
          !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        expect(r.guarded.filter((g) => overlaps(r.card, g.box)).map((g) => g.what)).toEqual([]);
        // the card's outer edge sits on the site container's edge, in line with the nav
        expect(Math.abs(r.card.right - r.navRight)).toBeLessThan(1);
      });
    }
  });
}

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('the card appears without animating', async ({ page }) => {
    await page.goto('/');
    await cardOpens(page);
    const state = await card(page).evaluate((el) => ({
      opacity: getComputedStyle(el).opacity,
      running: el.getAnimations({ subtree: true }).length,
    }));
    expect(state).toEqual({ opacity: '1', running: 0 });
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('no card, no Cookie settings control, and the page still works', async ({ page, google }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Explore our work' })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    await expect(page.locator('[data-consent-settings]')).toBeHidden();
    await page.getByRole('link', { name: 'Explore our work' }).click();
    await expect(page).toHaveURL(/\/projects\/$/);
    expect(google).toEqual([]);
  });
});

test.describe('a production build on any other host', () => {
  test.use({ baseURL: 'https://gold-coast-build-git-main.vercel.app' });

  test('shows the card but never loads Tag Manager, even after Accept', async ({ page, google }) => {
    await page.goto('/');
    await cardOpens(page);
    await button(page, 'Accept').click();
    await expect(card(page)).toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(gtm(page)).toHaveCount(0);
    expect(google).toEqual([]);
  });
});
