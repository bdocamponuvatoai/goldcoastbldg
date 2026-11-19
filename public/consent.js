/*! consent.js: Google Tag Manager behind an analytics consent card. No dependencies.

   Contract (do not trade any of this away):
   - Nothing from Google loads until the visitor clicks Accept. There is no
     GTM snippet in <head> and no <noscript><iframe>; the container is
     injected from here, once, after consent.
   - Production only: a container ID (rendered only in Vercel production
     builds, see src/lib/analytics.ts) AND an allowlisted hostname.
   - The choice is kept for 12 months under a versioned localStorage key,
     and every open tab follows it.

   Configured from data-* attributes on its own <script> tag in
   src/layouts/Base.astro; the copy comes from "consent" in src/data/site.json.
   Served as a file rather than inline, so the CSP keeps script-src 'self'. */
(function () {
  'use strict';

  var tag = document.currentScript;
  var d = (tag && tag.dataset) || {};

  var copy = null;
  try { copy = JSON.parse(d.copy || 'null'); } catch (e) { copy = null; }
  var hasCopy = !!(copy && copy.heading && copy.body && copy.decline && copy.accept);

  var CONFIG = {
    gtmId: d.gtmId || '',
    hosts: (d.productionHosts || '').toLowerCase().split(',')
      .map(function (h) { return h.trim(); }).filter(Boolean),
    privacyUrl: d.privacyUrl || '',
    side: d.side === 'left' ? 'left' : 'right',
    buttonClass: d.buttonClass || 'btn outline',
    storageKey: d.storageKey || 'site:consent',
    version: 1,                              // bump when what the visitor agrees to changes
    maxAgeMs: 365 * 24 * 60 * 60 * 1000,     // ask again after 12 months
    appearDelayMs: Number(d.appearDelay) || 900,
    exitMs: 320                              // keep equal to the closed transition in style.css
  };

  var SCRIPT_ID = 'gtm-script';
  // Production only: a valid container AND an allowlisted host.
  var ENABLED = /^GTM-[A-Z0-9]+$/.test(CONFIG.gtmId) &&
    CONFIG.hosts.indexOf(location.hostname.toLowerCase()) !== -1;

  /* ── storage ─────────────────────────────────────────────────────────── */
  function read() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || s.v !== CONFIG.version) return null;
      if (s.analytics !== 'granted' && s.analytics !== 'denied') return null;
      if (typeof s.at !== 'number' || Date.now() - s.at > CONFIG.maxAgeMs) return null;
      return s.analytics;
    } catch (e) { return null; }
  }
  var choice = read();

  function store(next) {
    choice = next;
    try {
      localStorage.setItem(CONFIG.storageKey,
        JSON.stringify({ v: CONFIG.version, analytics: next, at: Date.now() }));
    } catch (e) { /* storage unavailable: holds for this page only */ }
    apply();
  }

  /* ── Tag Manager ─────────────────────────────────────────────────────── */
  function loadTagManager() {
    if (!ENABLED || document.getElementById(SCRIPT_ID)) return; // exactly one, ever
    var dl = (window.dataLayer = window.dataLayer || []);
    // Must push `arguments`, not an array: GTM only reads commands in that shape.
    window.gtag = function () { dl.push(arguments); };
    // The visitor agreed to analytics only; ad signals stay denied even if
    // Ads tags are ever added to the container.
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    var s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(CONFIG.gtmId);
    document.head.appendChild(s);
  }

  /** _ga, _ga_<id>, _gid, _gat* on the host and every parent domain. */
  function clearAnalyticsCookies() {
    var parts = location.hostname.split('.');
    var domains = [''];
    for (var i = 0; i < parts.length - 1; i++) domains.push('.' + parts.slice(i).join('.'));
    document.cookie.split(';').forEach(function (part) {
      var name = part.split('=')[0].trim();
      if (!/^(_ga($|_)|_gid$|_gat)/.test(name)) return;
      domains.forEach(function (dom) {
        document.cookie = name + '=; Max-Age=0; path=/' + (dom ? '; domain=' + dom : '');
      });
    });
  }

  function apply() {
    if (choice === 'granted') { loadTagManager(); return; }
    if (choice === 'denied') {
      clearAnalyticsCookies();
      if (document.getElementById(SCRIPT_ID)) {
        if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied' });
        location.reload(); // a loaded container cannot be unloaded
      }
    }
  }

  /* ── the card ────────────────────────────────────────────────────────── */
  var root = null, heading = null, btnDecline = null, btnAccept = null;
  var mode = null, returnFocus = null, leaving = null, leaveTimer = 0;

  function el(tagName, className, text) {
    var n = document.createElement(tagName);
    if (className) n.className = className;
    if (text) n.textContent = text; // textContent, never innerHTML
    return n;
  }

  function build() {
    var section = el('section', 'consent');
    section.id = 'consent';
    section.setAttribute('aria-labelledby', 'consent-title');
    section.setAttribute('aria-describedby', 'consent-body');
    section.setAttribute('data-nosnippet', '');
    section.setAttribute('data-side', CONFIG.side);
    section.setAttribute('data-state', 'closed');

    var card = el('div', 'consent-card');
    var rule = el('span', 'consent-rule');
    rule.setAttribute('aria-hidden', 'true');
    heading = el('h2', 'consent-title', copy.heading);
    heading.id = 'consent-title';
    heading.tabIndex = -1;
    var body = el('p', 'consent-body', copy.body);
    body.id = 'consent-body';
    card.appendChild(rule);
    card.appendChild(heading);
    card.appendChild(body);

    // Rendered only when a policy URL is configured. Never invent one.
    var policy = copy.privacyPolicy || {};
    if (CONFIG.privacyUrl && policy.label) {
      var link = el('a', 'consent-link', policy.label);
      link.href = CONFIG.privacyUrl;
      if (/^https?:\/\//.test(CONFIG.privacyUrl) && link.hostname !== location.hostname) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.appendChild(el('span', 'sr-only', ' (opens in a new tab)'));
      }
      card.appendChild(link);
    }

    // Equal weight: the same classes on both buttons.
    var actions = el('div', 'consent-actions');
    btnDecline = el('button', CONFIG.buttonClass, copy.decline);
    btnAccept = el('button', CONFIG.buttonClass, copy.accept);
    btnDecline.type = btnAccept.type = 'button';
    btnDecline.addEventListener('click', function () { decide('denied'); });
    btnAccept.addEventListener('click', function () { decide('granted'); });
    actions.appendChild(btnDecline);
    actions.appendChild(btnAccept);
    card.appendChild(actions);
    section.appendChild(card);

    section.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mode === 'settings') { e.stopPropagation(); hide(); }
    });
    return section;
  }

  function syncPressed() {
    if (!root) return;
    [[btnDecline, 'denied'], [btnAccept, 'granted']].forEach(function (pair) {
      if (mode === 'settings') pair[0].setAttribute('aria-pressed', String(choice === pair[1]));
      else pair[0].removeAttribute('aria-pressed');
    });
  }

  function show(nextMode) {
    if (!hasCopy) return;
    if (leaving) { clearTimeout(leaveTimer); leaving.remove(); leaving = null; }
    if (!root) {
      root = build();
      // Early in the DOM (after the skip link), fixed to the viewport by CSS.
      var first = document.body.firstElementChild;
      var after = first && first.matches('a[href^="#"]') ? first : null;
      document.body.insertBefore(root, after ? after.nextSibling : document.body.firstChild);
    }
    mode = nextMode;
    syncPressed();
    var r = root;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { r.setAttribute('data-state', 'open'); });
    });
    // First visit: never take focus. From "Cookie settings": focus the heading.
    if (mode === 'settings') heading.focus({ preventScroll: true });
  }

  function hide() {
    if (!root) return;
    leaving = root;
    root = null;
    mode = null;
    leaving.setAttribute('data-state', 'closed');
    leaveTimer = setTimeout(function () {
      if (leaving) { leaving.remove(); leaving = null; }
      if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    }, CONFIG.exitMs);
  }

  function decide(value) {
    hide();
    store(value); // may reload the page (declining after GTM loaded)
  }

  /* ── "Cookie settings" controls: any [data-consent-settings] element ─── */
  // They ship `hidden` and are revealed here, so without script (when there
  // is nothing to consent to) they never appear.
  function refresh() {
    if (!hasCopy) return;
    document.querySelectorAll('[data-consent-settings]').forEach(function (b) { b.hidden = false; });
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-consent-settings]');
    if (!t) return;
    e.preventDefault();
    returnFocus = t;
    show('settings');
  });

  /* ── other tabs ──────────────────────────────────────────────────────── */
  window.addEventListener('storage', function (e) {
    if (e.key !== CONFIG.storageKey) return;
    choice = read();
    if (choice !== null && mode === 'ask') hide();
    else syncPressed();
    apply();
  });

  /* ── boot ────────────────────────────────────────────────────────────── */
  window.SiteConsent = {
    open: function () { returnFocus = document.activeElement; show('settings'); },
    refresh: refresh,
    get: function () { return choice; }
  };
  refresh();
  apply();
  if (choice === null) {
    var start = function () {
      setTimeout(function () { if (choice === null && !root) show('ask'); }, CONFIG.appearDelayMs);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }
})();
