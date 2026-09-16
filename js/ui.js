/* ============================================================
   Fantasy Realms — UI layer
   Accordion deck, card search with auto-expand, hand bottom
   sheet (mobile) and settings modal. The scoring logic lives
   untouched in app.js / deck.js / hand.js.
   ============================================================ */
(function () {
  'use strict';

  var openSuit = null;      // currently expanded accordion group
  var sheetOpen = false;
  var mqDesktop = window.matchMedia('(min-width: 900px)');
  function isClassic() { return document.documentElement.dataset.design === 'classic'; }

  function applyDesign(design) {
    document.documentElement.dataset.design = design === 'classic' ? 'classic' : 'modern';
    try { localStorage.setItem('fr-design', document.documentElement.dataset.design); } catch (_) {}
    document.querySelector('meta[name="theme-color"]').content = isClassic() ? '#6f292b' : '#0b0714';
    document.querySelectorAll('[data-design-choice]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.designChoice === document.documentElement.dataset.design));
    });
    sheetOpen = false;
    sheetEl().classList.remove('is-open');
    document.getElementById('sheet-bar').setAttribute('aria-expanded', 'false');
    document.getElementById('sheet-scrim').classList.remove('is-visible');
    document.body.classList.remove('no-scroll');
    layoutSheet(false);
  }

  var _updateLabels = window.updateLabels;
  window.updateLabels = function (lang) {
    _updateLabels(lang);
    var t = function (key) { return jQuery.i18n.prop(key); };
    document.documentElement.lang = lang;
    document.title = t('app.title');
    document.querySelector('meta[name="description"]').content = t('app.description');
    document.getElementById('settings-title').textContent = t('ui.settings');
    document.getElementById('card-search').placeholder = t('ui.search');
    document.getElementById('card-search').setAttribute('aria-label', t('ui.search'));
    document.getElementById('fr-no-results').textContent = t('ui.no-results');
    document.getElementById('design-label').textContent = t('ui.design');
    document.getElementById('hand-label').textContent = t('ui.hand');
    document.getElementById('expansion-title').textContent = t('label.cursed-hoard');
    document.querySelector('.fr-set-block-head img').alt = t('label.cursed-hoard');
    document.querySelector('.fr-legal').textContent = t('ui.legal');
    document.querySelector('[data-design-choice="modern"]').textContent = t('ui.modern');
    document.querySelector('[data-design-choice="classic"]').textContent = t('ui.classic');
    [['open-settings', t('ui.settings')], ['close-settings', t('ui.close')],
      ['card-search-clear', t('ui.clear-search')], ['clear', t('button.reset')], ['language-selector', t('ui.language')]].forEach(function (entry) {
      document.getElementById(entry[0]).setAttribute('aria-label', entry[1]);
      document.getElementById(entry[0]).title = entry[1];
    });
    document.getElementById('hand').dataset.emptyLabel = t('ui.empty-hand');
  };

  /* ---------- wrap app.js render functions ---------- */
  var _showCards = window.showCards;
  window.showCards = function () {
    var r = _showCards.apply(this, arguments);
    onCardsRendered();
    return r;
  };

  var _updateHandView = window.updateHandView;
  window.updateHandView = function () {
    var r = _updateHandView.apply(this, arguments);
    onHandUpdated();
    return r;
  };

  var _updateDiscardAreaView = window.updateDiscardAreaView;
  window.updateDiscardAreaView = function () {
    var r = _updateDiscardAreaView.apply(this, arguments);
    onHandUpdated();
    return r;
  };

  var _useCardAction = window.useCardAction;
  window.useCardAction = function (id) {
    // Clear a previous search so it cannot hide action targets.
    document.getElementById('card-search').value = '';
    var r = _useCardAction.apply(this, arguments);
    // Card actions need the deck panel — drop the sheet on mobile
    setSheet(false);
    return r;
  };

  var _switchToDiscardArea = window.switchToDiscardArea;
  window.switchToDiscardArea = function () {
    var r = _switchToDiscardArea.apply(this, arguments);
    var sheet = document.getElementById('hand-sheet');
    if (sheet) sheet.classList.add('discard-mode');
    return r;
  };

  var _switchToHand = window.switchToHand;
  window.switchToHand = function () {
    var r = _switchToHand.apply(this, arguments);
    var sheet = document.getElementById('hand-sheet');
    if (sheet) sheet.classList.remove('discard-mode');
    return r;
  };

  /* ---------- deck accordion ---------- */
  function groups() {
    return Array.prototype.slice.call(document.querySelectorAll('#cards .fr-group'));
  }

  function setGroupOpen(group, open, animate) {
    var body = group.querySelector('.fr-group-body');
    if (!body) return;
    group.classList.toggle('is-open', open);
    group.querySelector('.fr-group-head').setAttribute('aria-expanded', String(open));
    if (window.gsap && animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (open) {
        gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: .45, ease: 'power3.out' });
      } else {
        gsap.to(body, { height: 0, duration: .32, ease: 'power3.inOut' });
      }
    } else {
      body.style.height = open ? 'auto' : '0px';
    }
  }

  function toggleGroup(suit) {
    var next = (openSuit === suit) ? null : suit;
    groups().forEach(function (g) {
      var s = g.getAttribute('data-suit');
      if (s === openSuit && s !== next) setGroupOpen(g, false, true);
      if (s === next) setGroupOpen(g, true, true);
    });
    openSuit = next;
  }

  function onCardsRendered() {
    var root = document.getElementById('cards');
    if (!root) return;
    // A filtered deck (card action in progress) is small — show everything
    var gs = groups();
    root.classList.toggle('is-action', gs.length > 0 && gs.length <= 8);
    gs.forEach(function (g) {
      setGroupOpen(g, g.getAttribute('data-suit') === openSuit, false);
    });
    applyFilter();
    document.dispatchEvent(new CustomEvent('fr:cards-rendered'));
  }

  /* ---------- search ---------- */
  function applyFilter() {
    var input = document.getElementById('card-search');
    var root = document.getElementById('cards');
    if (!input || !root) return;
    var q = input.value.trim().toLowerCase();
    root.classList.toggle('is-searching', !!q);

    var total = 0;
    groups().forEach(function (group) {
      var all = group.querySelectorAll('.fr-card');
      var visible = 0;
      all.forEach(function (item) {
        var nameEl = item.querySelector('.fr-card-name');
        var name = (nameEl ? nameEl.textContent : item.textContent).trim().toLowerCase();
        var match = !q || name.indexOf(q) !== -1;
        item.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      group.style.display = (q && !visible) ? 'none' : '';
      var badge = group.querySelector('.fr-group-count');
      if (badge) badge.textContent = q ? visible : all.length;
      total += visible;
    });

    var empty = document.getElementById('fr-no-results');
    if (empty) empty.style.display = (q && groups().length && !total) ? 'block' : 'none';

    var clearBtn = document.getElementById('card-search-clear');
    if (clearBtn) clearBtn.style.display = q ? 'inline-flex' : 'none';
  }

  /* ---------- hand sheet ---------- */
  function sheetEl() { return document.getElementById('hand-sheet'); }
  function layoutSheet(animate) {
    var sheet = sheetEl();
    if (!sheet) return;
    // CSS collapses the actual panel height. Translating a full-size panel
    // below the viewport creates an invisible, scrollable area on mobile.
    sheet.style.transform = 'none';
    document.getElementById('sheet-bar').setAttribute('aria-expanded', String(isClassic() || mqDesktop.matches || sheetOpen));
    sheet.querySelector('.fr-sheet-body').inert = !isClassic() && !mqDesktop.matches && !sheetOpen;
  }

  function setSheet(open) {
    if (mqDesktop.matches || isClassic()) return;
    if (sheetOpen === open) return;
    sheetOpen = open;
    var sheet = sheetEl();
    if (sheet) sheet.classList.toggle('is-open', open);
    document.getElementById('sheet-bar').setAttribute('aria-expanded', String(open));
    var scrim = document.getElementById('sheet-scrim');
    if (scrim) scrim.classList.toggle('is-visible', open);
    document.body.classList.toggle('no-scroll', open);
    layoutSheet(true);
  }
  window.frSetSheet = setSheet;

  /* ---------- hand updates ---------- */
  function onHandUpdated() {
    var handEl = document.getElementById('hand');
    if (handEl) handEl.classList.toggle('is-empty', !handEl.querySelector('.card'));
    var count = document.getElementById('cardCount');
    var limit = document.getElementById('cardLimit');
    var pill = document.getElementById('sheet-count');
    if (count && limit && pill) pill.textContent = count.textContent + '/' + limit.textContent;
    document.getElementById('sheet-points').textContent = document.getElementById('points').textContent;
    document.dispatchEvent(new CustomEvent('fr:hand-updated'));
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    applyDesign(document.documentElement.dataset.design);
    document.querySelectorAll('[data-design-choice]').forEach(function (button) {
      button.addEventListener('click', function () { applyDesign(button.dataset.designChoice); });
    });
    /* Deck delegation: accordion heads + card taps */
    var cardsRoot = document.getElementById('cards');
    if (cardsRoot) {
      cardsRoot.addEventListener('keydown', function (e) {
        if (e.target.matches('.fr-card') && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.target.click();
        }
      });
      cardsRoot.addEventListener('click', function (e) {
        var head = e.target.closest('.fr-group-head');
        if (head) {
          toggleGroup(head.getAttribute('data-suit'));
          return;
        }
        var card = e.target.closest('.fr-card');
        if (card && typeof window.addToView === 'function') {
          var before = window.hand.size() + window.discard.size();
          window.addToView(card.getAttribute('data-id'));
          var after = window.hand.size() + window.discard.size();
          if (after > before && window.frFx) {
            window.frFx.cardAdded(card);
          }
        }
      });
    }

    /* Search */
    var search = document.getElementById('card-search');
    if (search) search.addEventListener('input', applyFilter);
    var clearBtn = document.getElementById('card-search-clear');
    if (clearBtn && search) {
      clearBtn.addEventListener('click', function () {
        search.value = '';
        applyFilter();
        search.focus();
      });
    }

    /* Sheet */
    var bar = document.getElementById('sheet-bar');
    if (bar) bar.addEventListener('click', function () { setSheet(!sheetOpen); });
    var scrim = document.getElementById('sheet-scrim');
    if (scrim) scrim.addEventListener('click', function () { setSheet(false); });
    layoutSheet(false);
    window.addEventListener('resize', function () { layoutSheet(false); });
    var onBreakpoint = function () {
      sheetOpen = false;
      var sheet = sheetEl();
      if (sheet) sheet.classList.remove('is-open');
      if (scrim) scrim.classList.remove('is-visible');
      document.body.classList.remove('no-scroll');
      layoutSheet(false);
    };
    if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onBreakpoint);

    /* Settings modal */
    function openSettings(open) {
      var modal = document.getElementById('settings-modal');
      if (!modal) return;
      modal.classList.toggle('is-open', open);
      document.getElementById('app').inert = open;
      if (open) document.getElementById('close-settings').focus();
      else document.getElementById('open-settings').focus();
    }
    var openBtn = document.getElementById('open-settings');
    if (openBtn) openBtn.addEventListener('click', function () { openSettings(true); });
    var closeBtn = document.getElementById('close-settings');
    if (closeBtn) closeBtn.addEventListener('click', function () { openSettings(false); });
    var modal = document.getElementById('settings-modal');
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) openSettings(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && modal.classList.contains('is-open')) {
        var controls = Array.from(modal.querySelectorAll('button, input, a[href]')).filter(function (el) { return el.getClientRects().length; });
        var first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      if (e.key === 'Escape') {
        openSettings(false);
        setSheet(false);
      }
    });

    /* Language dropdown */
    var langWrap = document.getElementById('language');
    var langBtn = document.getElementById('language-selector');
    if (langWrap && langBtn) {
      langBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        langWrap.classList.toggle('is-open');
      });
      langWrap.querySelectorAll('.dropdown-item').forEach(function (a) {
        a.addEventListener('click', function () { langWrap.classList.remove('is-open'); });
      });
      document.addEventListener('click', function () { langWrap.classList.remove('is-open'); });
    }

    onHandUpdated();
  });
})();
