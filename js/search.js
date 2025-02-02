class Search {
  /**
   * Initializes the search index and binds event listeners.
   *
   * Checks that deck data is available, builds a complete list of cards,
   * compiles the Handlebars template for results, and binds input events
   * to offer live search functionality.
   */
  initialize() {
    if (typeof deck === "undefined") {
      console.error("Deck data is not available to initialize search");
      return;
    }

    // Create a complete collection of cards including cursed items (if enabled).
    const allCards = this.getAllCards();
    const cardData = this.buildCardData(allCards);

    // Determine language-specific options for searching.
    const currentLang = localStorage.getItem("language") || "en";
    const fuseOptions =
      currentLang === "de"
        ? { keys: ["i18nName", "i18nSuit"], threshold: 0.3 }
        : { keys: ["name", "i18nName", "suit", "i18nSuit"], threshold: 0.3 };

    // Initialize the Fuse.js search index.
    window.fuse = new Fuse(cardData, fuseOptions);

    // Compile the Handlebars template used to render search results.
    const template = this.getCompiledTemplate();
    if (!template) {
      return;
    }

    // Get the reference to the DOM elements used for searching.
    const searchInput = document.getElementById("card-search-input");
    const resultsContainer = document.getElementById("card-search-results");

    // Bind the input event if the search input exists.
    if (searchInput) {
      this.bindSearchInput(searchInput, resultsContainer, template);
    }
  }

  /**
   * Builds an array of card data objects with internationalized names and suits.
   *
   * Maps each card from the deck to an object with both raw and translated (i18n)
   * values, which are used by the search index.
   *
   * @param {Object} cards - A collection of card objects from the deck.
   * @returns {Array} Array of card objects for searching.
   */
  buildCardData(cards) {
    return Object.keys(cards).map((id) => {
      const card = cards[id];
      let tName = card.name || "";
      let tSuit = card.suit || "";

      // If i18n mapping is available, get the translated texts.
      if ($.i18n && $.i18n.map) {
        tName = $.i18n.map[`${id}.name`] || tName;
        tSuit = $.i18n.map[`suit.${card.suit}`] || tSuit;
      }

      return {
        id: card.id,
        name: card.name,
        suit: card.suit,
        strength: card.strength,
        i18nName: tName,
        i18nSuit: tSuit,
        cursedItem: card.cursedItem || false
      };
    });
  }

  /**
   * Retrieves the full set of cards from the deck.
   *
   * Combines the regular cards with cursed items if the cursed hoard mode is active.
   *
   * @returns {Object} A combined object of all available cards.
   */
  getAllCards() {
    let allCards = { ...deck.cards };
    // Include cursed items if the global flag for them is set.
    if (window.cursedHoardItems) {
      allCards = { ...allCards, ...deck.cursedItems };
    }
    return allCards;
  }

  /**
   * Compiles and returns the Handlebars template for displaying search results.
   *
   * Fetches the template from the DOM and compiles it. If not found, logs an error.
   *
   * @returns {Function|null} The compiled Handlebars template function or null if not found.
   */
  getCompiledTemplate() {
    const templateElem = document.getElementById("search-result-template");
    if (!templateElem) {
      console.error("Search result template not found");
      return null;
    }
    return Handlebars.compile(templateElem.innerHTML);
  }

  /**
   * Binds event listeners to the search input element.
   *
   * Listens for input changes to perform live search using Fuse.js and renders
   * the results using the compiled Handlebars template. Also clears results on focus-out.
   *
   * @param {HTMLElement} searchInput - The search input field.
   * @param {HTMLElement} resultsContainer - The container where search results are displayed.
   * @param {Function} template - The Handlebars template for a search result.
   */
  bindSearchInput(searchInput, resultsContainer, template) {
    // Define the input event handler.
    const onSearchInput = (e) => {
      const query = e.target.value.trim();
      resultsContainer.innerHTML = "";

      // Only search if the input query is non-empty.
      if (query.length > 0) {
        // Execute the search query against the Fuse.js index.
        let results = window.fuse.search(query);

        // Filter out cards that are already in the player's hand.
        results = results.filter(
          (result) => !window.hand.containsId(result.item.id)
        );

        // Render each search result.
        results.forEach((result) => {
          const card = result.item;
          const suitColor = `var(--${card.suit}-color)`;
          const html = template({
            i18nName: card.i18nName,
            i18nSuit: card.i18nSuit,
            suitColor,
            isCursedItem: card.cursedItem,
          });

          // Create a temporary element to convert the HTML string to a DOM node.
          const wrapper = document.createElement("div");
          wrapper.innerHTML = html;
          const resultEl = wrapper.firstElementChild;

          // Setup the click event to add the card to the view
          // and to clear the search afterwards.
          resultEl.addEventListener("click", () => {
            addToView(card.id);
            searchInput.value = "";
            resultsContainer.innerHTML = "";
            // Return focus to the search input if the hand is not at its limit.
            if (hand.size() < hand.limit()) {
              searchInput.focus();
            }
          });
          resultsContainer.appendChild(resultEl);
        });
      }
    };

    // Remove any previously bound 'input' listener before attaching the new one.
    searchInput.removeEventListener("input", onSearchInput);
    searchInput.addEventListener("input", onSearchInput);

    // Clear search results when the input loses focus and is empty.
    searchInput.addEventListener("focusout", () => {
      if (searchInput.value.trim() === "") {
        resultsContainer.innerHTML = "";
      }
    });
  }

  /**
   * Patches deck methods to update the search index automatically.
   *
   * Overrides specific methods on the deck so that whenever they are called
   * (typically to add, remove, or modify cards), the search index is reinitialized.
   */
  static patchDeckMethods() {
    if (typeof deck === "undefined") {
      return;
    }

    const methodsToPatch = [
      "enableCursedHoardSuits",
      "disableCursedHoardSuits",
      "enableCursedHoardItems",
      "disableCursedHoardItems",
    ];

    methodsToPatch.forEach((methodName) => {
      if (typeof deck[methodName] === "function") {
        // Save the original method.
        const originalMethod = deck[methodName];
        // Override the deck method.
        deck[methodName] = function (...args) {
          const result = originalMethod.apply(this, args);
          // Reinitialize the search index after the deck has been updated.
          window.initializeSearch();
          return result;
        };
      }
    });
  }
}

// Expose a global initializeSearch method, similar to how the Hand global instance is created.
window.initializeSearch = () => {
  const searchInstance = new Search();
  searchInstance.initialize();
};

// Patch deck methods so that any changes to the deck automatically refresh the search index.
Search.patchDeckMethods();

// Initialize search after the DOM is ready and i18n properties are loaded.
document.addEventListener("DOMContentLoaded", () => {
  $.i18n.properties({
    name: "Messages",
    path: "i18n/",
    mode: "map",
    language: localStorage.getItem("language") || "en",
    callback: () => {
      window.initializeSearch();
    },
    error: (xhr, status, error) => {
      console.error("Failed to load i18n properties:", status, error);
      window.initializeSearch();
    },
  });
}); 