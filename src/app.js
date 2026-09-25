/* Gold Coast Build — progressive enhancement.
   Everything here is optional: with JS off or failed, the nav links, the
   project grid and the gallery photographs all still work as plain HTML.
   Each block feature-detects its own element so a page that lacks the
   markup (most pages have no gallery) costs nothing and throws nothing. */
(function () {
  'use strict';

  var DESKTOP = window.matchMedia ? window.matchMedia('(min-width:761px)') : null;

  /* ------------------------------------------------------ mobile nav */
  var menu = document.querySelector('.menu');
  var nav = document.querySelector('#navigation');

  if (menu && nav) {
    var setNav = function (open) {
      menu.setAttribute('aria-expanded', String(open));
      menu.textContent = open ? 'Close' : 'Menu';
      nav.classList.toggle('open', open);
    };

    menu.addEventListener('click', function () {
      setNav(menu.getAttribute('aria-expanded') !== 'true');
    });

    // Following a link should not leave the panel stuck open on back-nav.
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setNav(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
        setNav(false);
        menu.focus();
      }
    });

    // Rotating to landscape can cross the breakpoint while the panel is open;
    // drop the class so the desktop bar is not left in the "open" state.
    if (DESKTOP) {
      var onBreakpoint = function (e) { if (e.matches) setNav(false); };
      if (DESKTOP.addEventListener) DESKTOP.addEventListener('change', onBreakpoint);
      else if (DESKTOP.addListener) DESKTOP.addListener(onBreakpoint); // Safari < 14
    }
  }

  /* --------------------------------------------------- project filter */
  var filters = document.querySelectorAll('[data-filter]');
  if (filters.length) {
    var cards = document.querySelectorAll('[data-category]');
    Array.prototype.forEach.call(filters, function (button) {
      button.addEventListener('click', function () {
        var want = button.dataset.filter;
        Array.prototype.forEach.call(filters, function (b) {
          var on = b === button;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        Array.prototype.forEach.call(cards, function (card) {
          card.hidden = want !== 'all' && card.dataset.category !== want;
        });
      });
    });
  }

  /* -------------------------------------------------------- lightbox */
  var dialog = document.querySelector('.lightbox');
  var triggers = document.querySelectorAll('[data-full]');
  if (!dialog || !triggers.length) return;

  var img = dialog.querySelector('.viewer-image img');
  var caption = dialog.querySelector('.viewer-caption');
  var count = dialog.querySelector('.viewer-count');
  var closeBtn = dialog.querySelector('.viewer-close');
  var prevBtn = dialog.querySelector('.viewer-prev');
  var nextBtn = dialog.querySelector('.viewer-next');

  // <dialog>.showModal() landed in Safari 15.4. Older engines keep the plain
  // links: the button falls back to opening the full photograph directly
  // rather than throwing and leaving the gallery inert.
  var supported = typeof dialog.showModal === 'function';
  var active = 0;
  var lastFocus = null;

  var show = function (index) {
    if (!img) return;
    active = (index + triggers.length) % triggers.length;
    var trigger = triggers[active];
    var thumb = trigger.querySelector('img');
    img.src = trigger.dataset.full;
    img.alt = thumb ? thumb.alt : '';
    if (caption) caption.textContent = trigger.dataset.caption || '';
    if (count) count.textContent = (active + 1) + ' / ' + triggers.length;
  };

  Array.prototype.forEach.call(triggers, function (button, index) {
    button.addEventListener('click', function (e) {
      if (!supported) return; // let the fallback below handle it
      e.preventDefault();
      lastFocus = button;
      show(index);
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    });
    if (!supported) {
      button.addEventListener('click', function () {
        window.open(button.dataset.full, '_blank', 'noopener');
      });
    }
  });

  if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });
  if (prevBtn) prevBtn.addEventListener('click', function () { show(active - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { show(active + 1); });

  dialog.addEventListener('close', function () {
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus(); // return the caret to where it came from
  });

  // Click on the backdrop (the dialog element itself) closes it.
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(active - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(active + 1); }
  });
})();
