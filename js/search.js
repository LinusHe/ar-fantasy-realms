(function () {
  // Expose initializeSearch globally so that app.js can call it after language update.
  window.initializeSearch = function () {
    if (typeof deck === "undefined" || !deck.cards) {
      console.error("Deck data is not available to initialize search");
      return;
    }

    // Build card data array with i18n names and suits.
    var cardData = [];
    for (var id in deck.cards) {
      if (deck.cards.hasOwnProperty(id)) {
        var card = deck.cards[id];

        // Get translations safely
        var tName = card.name || "";  // Default to original name
        var tSuit = card.suit || "";  // Default to original suit

        // Only try to get translations if i18n is properly initialized
        if ($.i18n && $.i18n.map) {
          tName = $.i18n.map[id + '.name'] || tName;
          tSuit = $.i18n.map['suit.' + card.suit] || tSuit;
        }

        cardData.push({
          id: card.id,
          name: card.name,              // fallback/original name
          suit: card.suit,
          strength: card.strength,
          i18nName: tName,
          i18nSuit: tSuit
        });
      }
    }

    // Determine current language.
    var currentLang = localStorage.getItem('language') || 'en';

    // Initialize Fuse.js index with all cards
    var options = {
      keys: (currentLang === 'de') ? ['i18nName', 'i18nSuit'] : ['name', 'i18nName', 'suit', 'i18nSuit'],
      threshold: 0.3
    };
    window.fuse = new Fuse(cardData, options);

    // Get the compiled Handlebars template for search results.
    var source = document.getElementById("search-result-template").innerHTML;
    var template = Handlebars.compile(source);

    // Attach input listener (remove any previous listener).
    var searchInput = document.getElementById("card-search-input");
    var resultsContainer = document.getElementById("card-search-results");
    if (searchInput) {
      searchInput.removeEventListener("input", onSearchInput);
      searchInput.addEventListener("input", onSearchInput);
      searchInput.addEventListener("focusout", function () {
        if (searchInput.value.trim().length === 0) {
          resultsContainer.innerHTML = "";
        }
      });
    }

    function onSearchInput(e) {
      var query = e.target.value;
      resultsContainer.innerHTML = "";
      if (query.trim().length > 0) {
        var results = window.fuse.search(query);
        // Filter out cards that are currently in hand
        results = results.filter(result => {
          return !window.hand.containsId(result.item.id);
        });

        results.forEach(function (result) {
          var card = result.item;
          // Compute the suit border color.
          var suitColor = "var(--" + card.suit + "-color)";
          // Render the search result using the Handlebars template.
          var html = template({
            i18nName: card.i18nName,
            i18nSuit: card.i18nSuit,
            suitColor: suitColor
          });

          // Instead of inserting HTML directly, create an element so that we can attach a click event.
          var tempEl = document.createElement('div');
          tempEl.innerHTML = html;
          // Assuming the template returns a single parent element.
          var resultEl = tempEl.firstElementChild;
          // NEW: Attach a click event listener that calls addToView with the card id.
          resultEl.addEventListener('click', function () {
            addToView(card.id);
            searchInput.value = '';

            resultsContainer.innerHTML = "";

            // Only focus if we haven't reached the hand limit 
            if (hand.size() < hand.limit()) {
              searchInput.focus();
            }
          });
          resultsContainer.appendChild(resultEl);
        });
      }
    }
  };

  // Initialize search once the DOM is ready:
  $(document).ready(function () {
    $.i18n.properties({
      name: 'Messages',
      path: 'i18n/',
      mode: 'map',           // Changed to 'map' mode to avoid variable evaluation
      language: localStorage.getItem('language') || 'en',
      callback: function () {
        initializeSearch();
      },
      error: function (xhr, status, error) {
        console.error('Failed to load i18n properties:', status, error);
        // Still initialize search with fallback values
        initializeSearch();
      }
    });
  });
})(); 