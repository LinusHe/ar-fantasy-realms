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

  var _useCardAction = window.useCardAction;
  window.useCardAction = function (id) {
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
    if (window.gsap && animate) {
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
  function barH() {
    var bar = document.getElementById('sheet-bar');
    return bar ? bar.offsetHeight : 60;
  }
  function closedY() {
    var sheet = sheetEl();
    return sheet ? sheet.offsetHeight - barH() : 0;
  }

  function layoutSheet(animate) {
    var sheet = sheetEl();
    if (!sheet) return;
    if (mqDesktop.matches) {
      if (window.gsap) gsap.set(sheet, { clearProps: 'transform' });
      else sheet.style.transform = '';
      return;
    }
    var y = sheetOpen ? 0 : closedY();
    if (window.gsap) {
      if (animate) {
        gsap.to(sheet, { y: y, duration: .55, ease: sheetOpen ? 'power4.out' : 'power3.inOut' });
      } else {
        gsap.set(sheet, { y: y });
      }
    } else {
      sheet.style.transform = 'translateY(' + y + 'px)';
    }
  }

  function setSheet(open) {
    if (mqDesktop.matches) return;
    if (sheetOpen === open) return;
    sheetOpen = open;
    var sheet = sheetEl();
    if (sheet) sheet.classList.toggle('is-open', open);
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
    document.dispatchEvent(new CustomEvent('fr:hand-updated'));
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    /* Deck delegation: accordion heads + card taps */
    var cardsRoot = document.getElementById('cards');
    if (cardsRoot) {
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
    }
    var openBtn = document.getElementById('open-settings');
    if (openBtn) openBtn.addEventListener('click', function () { openSettings(true); });
    var closeBtn = document.getElementById('close-settings');
    if (closeBtn) closeBtn.addEventListener('click', function () { openSettings(false); });
    var modal = document.getElementById('settings-modal');
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) openSettings(false); });
    document.addEventListener('keydown', function (e) {
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
