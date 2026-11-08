(() => {
  const searchFields = ["name", "description", "author"];
  const searchContainer = document.querySelector(".plugin-search");
  const searchInput = document.getElementById("plugin-search");
  const clearButton = document.getElementById("plugin-search-clear");
  const cards = document.querySelectorAll(".list-item");

  if (!searchContainer || !searchInput || !clearButton) {
    return;
  }

  const supportsNativeClear = window.CSS?.supports?.(
    "selector(input[type='search']::-webkit-search-cancel-button)"
  ) || window.CSS?.supports?.(
    "selector(input[type='search']::-moz-search-clear)"
  );
  searchContainer.classList.toggle("has-native-clear", Boolean(supportsNativeClear));

  const filterCards = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();

    cards.forEach((card) => {
      const searchableText = searchFields
        .flatMap((field) => Array.from(card.querySelectorAll(`[data-name="${field}"]`)))
        .map((element) => element.textContent || "")
        .join(" ")
        .toLocaleLowerCase();
      const matches = searchableText.includes(query);
      card.classList.toggle("hidden", !matches);
    });
  };

  searchInput.addEventListener("input", filterCards);
  clearButton.addEventListener("click", () => {
    searchInput.value = "";
    filterCards();
    searchInput.focus();
  });
})();
