(() => {
  const searchFields = ["name", "description", "author"];
  const searchContainer = document.querySelector(".plugin-search");
  const searchInput = document.getElementById("plugin-search");
  const clearButton = document.getElementById("plugin-search-clear");
  const cards = document.querySelectorAll(".list-item");
  const platformFilter = document.querySelector(".plugin-platform-filter");

  if (!searchContainer || !searchInput || !clearButton || !platformFilter) {
    return;
  }

  const platformOptions = Array.from(platformFilter.querySelectorAll('input[name="platform-filter"]'));
  const allPlatforms = platformOptions.find((option) => option.value === "all");
  const individualPlatforms = platformOptions.filter((option) => option !== allPlatforms);
  if (!allPlatforms) {
    console.error("Platform filter is missing its all-platforms option");
    return;
  }
  platformFilter.hidden = false;
  individualPlatforms.forEach((option) => {
    option.checked = allPlatforms.checked;
  });

  const supportsNativeClear = window.CSS?.supports?.(
    "selector(input[type='search']::-webkit-search-cancel-button)"
  ) || window.CSS?.supports?.(
    "selector(input[type='search']::-moz-search-clear)"
  );
  searchContainer.classList.toggle("has-native-clear", Boolean(supportsNativeClear));

  const filterCards = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const selectedPlatforms = platformOptions
      .filter((option) => option.checked && option !== allPlatforms)
      .map((option) => option.value);

    cards.forEach((card) => {
      const searchableText = searchFields
        .flatMap((field) => Array.from(card.querySelectorAll(`[data-name="${field}"]`)))
        .map((element) => element.textContent || "")
        .join(" ")
        .toLocaleLowerCase();
      const cardPlatforms = Array.from(
        card.querySelectorAll('[data-name="platform"] [data-platform]'),
        (element) => element.dataset.platform
      );
      const matchesPlatform = selectedPlatforms.length > 0 && (
        cardPlatforms.includes("all") ||
        selectedPlatforms.some((platform) => cardPlatforms.includes(platform))
      );
      const matches = searchableText.includes(query) && matchesPlatform;
      card.classList.toggle("hidden", !matches);
    });
  };

  platformOptions.forEach((option) => {
    option.addEventListener("change", () => {
      if (option === allPlatforms) {
        individualPlatforms.forEach((platform) => {
          platform.checked = allPlatforms.checked;
        });
      } else {
        allPlatforms.checked = individualPlatforms.every((platform) => platform.checked);
      }
      filterCards();
    });
  });

  filterCards();
  searchInput.addEventListener("input", filterCards);
  clearButton.addEventListener("click", () => {
    searchInput.value = "";
    filterCards();
    searchInput.focus();
  });
})();
