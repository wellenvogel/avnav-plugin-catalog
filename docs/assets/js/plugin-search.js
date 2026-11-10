(() => {
  const searchFields = ["name", "description", "author"];
  const searchContainer = document.querySelector(".plugin-search");
  const searchInput = document.getElementById("plugin-search");
  const clearButton = document.getElementById("plugin-search-clear");
  const cards = document.querySelectorAll(".list-item");
  const platformFilter = document.querySelector(".plugin-platform-filter");
  const typeFilter = document.querySelector(".plugin-type-filter");
  const cardsContainer = document.getElementById("plugin-cards");
  const sortBy = document.getElementById("plugin-sort-by");
  const sortDirection = document.getElementById("plugin-sort-direction");

  if (!searchContainer || !searchInput || !clearButton || !platformFilter || !typeFilter ||
      !cardsContainer || !sortBy || !sortDirection) {
    return;
  }

  const platformOptions = Array.from(platformFilter.querySelectorAll('input[name="platform-filter"]'));
  const typeOptions = Array.from(typeFilter.querySelectorAll('input[name="type-filter"]'));
  const allPlatforms = platformOptions.find((option) => option.value === "all");
  const individualPlatforms = platformOptions.filter((option) => option !== allPlatforms);
  if (!allPlatforms) {
    console.error("Platform filter is missing its all-platforms option");
    return;
  }
  platformFilter.hidden = false;
  typeFilter.hidden = false;
  allPlatforms.checked = individualPlatforms.length > 0 &&
    individualPlatforms.every((option) => option.checked);

  const supportsNativeClear = window.CSS?.supports?.(
    "selector(input[type='search']::-webkit-search-cancel-button)"
  ) || window.CSS?.supports?.(
    "selector(input[type='search']::-moz-search-clear)"
  );
  searchContainer.classList.toggle("has-native-clear", Boolean(supportsNativeClear));

  let sortAscending = sortBy.value === "name";
  const updateSortDirectionControl = () => {
    const label = sortAscending
      ? sortDirection.dataset.descendingLabel
      : sortDirection.dataset.ascendingLabel;
    sortDirection.textContent = sortAscending ? "↑" : "↓";
    sortDirection.setAttribute("aria-label", label);
    sortDirection.title = label;
  };

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const parseVersion = (value) => {
    const match = value.trim().replace(/^[v=]/i, "").match(
      /^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/
    );
    if (!match) return null;
    return {
      core: match[1].split(".").map((part) => part.replace(/^0+(?=\d)/, "")),
      prerelease: match[2] ? match[2].split(".") : null,
    };
  };
  const compareNumericStrings = (left, right) => {
    const normalizedLeft = left.replace(/^0+(?=\d)/, "");
    const normalizedRight = right.replace(/^0+(?=\d)/, "");
    return normalizedLeft.length - normalizedRight.length ||
      (normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0);
  };
  const compareVersions = (left, right) => {
    const parsedLeft = parseVersion(left);
    const parsedRight = parseVersion(right);
    if (!parsedLeft || !parsedRight) return collator.compare(left, right);

    const coreLength = Math.max(parsedLeft.core.length, parsedRight.core.length);
    for (let index = 0; index < coreLength; index += 1) {
      const difference = compareNumericStrings(
        parsedLeft.core[index] || "0",
        parsedRight.core[index] || "0"
      );
      if (difference) return difference;
    }

    if (!parsedLeft.prerelease || !parsedRight.prerelease) {
      return parsedLeft.prerelease ? -1 : parsedRight.prerelease ? 1 : 0;
    }
    const prereleaseLength = Math.max(parsedLeft.prerelease.length, parsedRight.prerelease.length);
    for (let index = 0; index < prereleaseLength; index += 1) {
      const leftPart = parsedLeft.prerelease[index];
      const rightPart = parsedRight.prerelease[index];
      if (leftPart === undefined || rightPart === undefined) {
        return leftPart === undefined ? -1 : 1;
      }
      const leftNumeric = /^\d+$/.test(leftPart);
      const rightNumeric = /^\d+$/.test(rightPart);
      if (leftNumeric && rightNumeric) {
        const difference = compareNumericStrings(leftPart, rightPart);
        if (difference) return difference;
      } else if (leftNumeric !== rightNumeric) {
        return leftNumeric ? -1 : 1;
      } else {
        const difference = leftPart < rightPart ? -1 : leftPart > rightPart ? 1 : 0;
        if (difference) return difference;
      }
    }
    return 0;
  };

  const sortCards = () => {
    const sortField = sortBy.value;
    const direction = sortAscending ? 1 : -1;
    const sortedCards = Array.from(cards).sort((left, right) => {
      let comparison;
      if (sortField === "version") {
        comparison = compareVersions(left.dataset.sortVersion || "", right.dataset.sortVersion || "");
      } else if (sortField === "name") {
        comparison = collator.compare(left.dataset.sortName || "", right.dataset.sortName || "");
      } else {
        const leftDate = Date.parse(left.dataset.sortLastUpdated || "");
        const rightDate = Date.parse(right.dataset.sortLastUpdated || "");
        comparison = Number.isNaN(leftDate) || Number.isNaN(rightDate)
          ? collator.compare(left.dataset.sortLastUpdated || "", right.dataset.sortLastUpdated || "")
          : leftDate - rightDate;
      }
      return comparison * direction;
    });
    sortedCards.forEach((card) => cardsContainer.appendChild(card));
  };

  const filterCards = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const selectedPlatforms = platformOptions
      .filter((option) => option.checked && option !== allPlatforms)
      .map((option) => option.value);
    const selectedType = typeOptions.find((option) => option.checked)?.value;

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
        selectedPlatforms.every((platform) => cardPlatforms.includes(platform))
      );
      const matchesType = selectedType !== undefined &&
        (selectedType === "both" || selectedType === card.dataset.type);
      const matches = searchableText.includes(query) && matchesPlatform && matchesType;
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
  typeOptions.forEach((option) => {
    option.addEventListener("change", filterCards);
  });

  sortBy.addEventListener("change", () => {
    sortAscending = sortBy.value === "name";
    updateSortDirectionControl();
    sortCards();
  });
  sortDirection.addEventListener("click", () => {
    sortAscending = !sortAscending;
    updateSortDirectionControl();
    sortCards();
  });
  updateSortDirectionControl();
  sortCards();
  filterCards();
  searchInput.addEventListener("input", filterCards);
  clearButton.addEventListener("click", () => {
    searchInput.value = "";
    filterCards();
    searchInput.focus();
  });
})();
