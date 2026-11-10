const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const script = readFileSync(path.join(__dirname, "../docs/assets/js/plugin-search.js"), "utf8");

function setup(extraCards = []) {
  function control(value, checked = false) {
    return {
      value,
      checked,
      listeners: {},
      addEventListener(event, callback) { this.listeners[event] = callback; },
      trigger(event) { this.listeners[event](); },
    };
  }

  function card(name, platforms, version, lastUpdated = "", type = "zip") {
    return {
      hidden: false,
      dataset: { sortName: name, sortVersion: version, sortLastUpdated: lastUpdated, type },
      classList: {
        toggle(name, hidden) { this.owner.hidden = hidden; },
      },
      querySelectorAll(selector) {
        if (selector === '[data-name="platform"] [data-platform]') {
          return platforms.map((platform) => ({ dataset: { platform } }));
        }
        return selector === '[data-name="name"]' ? [{ textContent: name }] : [];
      },
    };
  }

  const cards = [
    card("Android plugin", ["android"], "2.0.0", "2024-01-01T00:00:00Z"),
    card("Linux plugin", ["linux"], "10", "2025-01-01T00:00:00Z"),
    card("Universal", ["all"], "1.0.0-rc.2", "2026-01-01T00:00:00Z"),
    card("Unknown", [], "1.0.0"),
    ...extraCards.map(({ name, platforms, type }) => card(name, platforms, "1.0.0", "", type)),
  ];
  cards.forEach((item) => { item.classList.owner = item; });
  const cardsContainer = {
    children: [...cards],
    appendChild(item) {
      this.children = this.children.filter((child) => child !== item);
      this.children.push(item);
      return item;
    },
  };
  const all = control("all");
  const android = control("android");
  const linux = control("linux", true);
  const raspberry = control("raspberry", true);
  const windows = control("windows");
  const options = [all, android, linux, raspberry, windows];
  const platformFilter = { hidden: true, querySelectorAll: () => options };
  const bothTypes = control("both", true);
  const zipType = control("zip");
  const packageType = control("package");
  const typeOptions = [bothTypes, zipType, packageType];
  const typeFilter = { hidden: true, querySelectorAll: () => typeOptions };
  const input = control("");
  const sortBy = control("version");
  const sortDirection = control("");
  sortDirection.dataset = {
    ascendingLabel: "Sort ascending",
    descendingLabel: "Sort descending",
  };
  sortDirection.setAttribute = (name, value) => { sortDirection[name] = value; };
  sortDirection.textContent = "↓";
  input.focus = () => { input.focused = true; };
  const clear = control("");
  const search = { classList: { toggle() {} } };
  const document = {
    querySelector(selector) {
      return {
        ".plugin-search": search,
        ".plugin-platform-filter": platformFilter,
        ".plugin-type-filter": typeFilter,
      }[selector];
    },
    querySelectorAll() { return cards; },
    getElementById(id) {
      return {
        "plugin-search": input,
        "plugin-search-clear": clear,
        "plugin-cards": cardsContainer,
        "plugin-sort-by": sortBy,
        "plugin-sort-direction": sortDirection,
      }[id];
    },
  };
  vm.runInNewContext(script, { document, window: {}, console });
  return { cards, cardsContainer, all, android, linux, raspberry, windows, input, clear, platformFilter, typeFilter, bothTypes, zipType, packageType, sortBy, sortDirection };
}

test("all checkbox controls individual platforms and filtering uses only individual selections", () => {
  const { cards, all, android, linux, raspberry, windows, input, clear, platformFilter } = setup();
  const hidden = () => cards.map((card) => card.hidden);
  assert.equal(platformFilter.hidden, false);
  assert.equal(all.checked, false);
  assert.equal(android.checked, false);
  assert.equal(linux.checked, true);
  assert.equal(raspberry.checked, true);
  assert.equal(windows.checked, false);
  assert.deepEqual(hidden(), [true, true, false, true]);

  input.value = "universal";
  input.trigger("input");
  assert.deepEqual(hidden(), [true, true, false, true]);
  clear.trigger("click");
  assert.equal(input.focused, true);
  assert.deepEqual(hidden(), [true, true, false, true]);

  all.checked = true;
  all.trigger("change");
  assert.equal(android.checked, true);
  assert.equal(linux.checked, true);
  assert.equal(raspberry.checked, true);
  assert.equal(windows.checked, true);
  assert.deepEqual(hidden(), [true, true, false, true]);

  all.checked = false;
  all.trigger("change");
  assert.deepEqual(hidden(), [true, true, true, true]);
  assert.equal(android.checked, false);
  assert.equal(linux.checked, false);

  android.checked = true;
  android.trigger("change");
  assert.equal(all.checked, false);
  assert.deepEqual(hidden(), [false, true, false, true]);

  linux.checked = true;
  linux.trigger("change");
  assert.deepEqual(hidden(), [true, true, false, true]);

  all.checked = true;
  all.trigger("change");
  assert.deepEqual(hidden(), [true, true, false, true]);
  assert.equal(android.checked, true);
  assert.equal(linux.checked, true);
  assert.equal(raspberry.checked, true);
  assert.equal(windows.checked, true);

  android.checked = false;
  android.trigger("change");
  assert.equal(all.checked, false);
  assert.equal(linux.checked, true);
  assert.deepEqual(hidden(), [true, true, false, true]);

  android.checked = true;
  android.trigger("change");
  assert.equal(all.checked, true);
  assert.deepEqual(hidden(), [true, true, false, true]);

  all.checked = false;
  all.trigger("change");
  assert.deepEqual(hidden(), [true, true, true, true]);
});

test("platform filtering requires every selected platform and combines with text search", () => {
  const { cards, linux, raspberry, input } = setup([
    { name: "Both platforms", platforms: ["linux", "raspberry"] },
  ]);
  const hidden = () => cards.map((card) => card.hidden);

  assert.deepEqual(hidden(), [true, true, false, true, false]);

  input.value = "both";
  input.trigger("input");
  assert.deepEqual(hidden(), [true, true, true, true, false]);

  input.value = "";
  raspberry.checked = false;
  raspberry.trigger("change");
  assert.deepEqual(hidden(), [true, false, false, true, false]);

  linux.checked = false;
  linux.trigger("change");
  assert.deepEqual(hidden(), [true, true, true, true, true]);
});

test("type filter combines both, zip and package choices with platform and search", () => {
  const { cards, input, raspberry, typeFilter, bothTypes, zipType, packageType, sortBy } = setup([
    { name: "Compatible ZIP", platforms: ["linux", "raspberry"], type: "zip" },
    { name: "Compatible package", platforms: ["linux", "raspberry"], type: "package" },
    { name: "Linux package", platforms: ["linux"], type: "package" },
  ]);
  const hidden = () => cards.map((card) => card.hidden);
  const selectType = (selected) => {
    for (const option of [bothTypes, zipType, packageType]) option.checked = option === selected;
    selected.trigger("change");
  };
  assert.equal(typeFilter.hidden, false);
  assert.deepEqual(hidden(), [true, true, false, true, false, false, true]);
  selectType(zipType);
  assert.deepEqual(hidden(), [true, true, false, true, false, true, true]);
  selectType(packageType);
  assert.deepEqual(hidden(), [true, true, true, true, true, false, true]);
  input.value = "linux";
  input.trigger("input");
  assert.deepEqual(hidden(), [true, true, true, true, true, true, true]);
  raspberry.checked = false;
  raspberry.trigger("change");
  assert.deepEqual(hidden(), [true, true, true, true, true, true, false]);
  sortBy.value = "name";
  sortBy.trigger("change");
  assert.deepEqual(hidden(), [true, true, true, true, true, true, false]);
  input.value = "";
  input.trigger("input");
  selectType(bothTypes);
  assert.deepEqual(hidden(), [true, false, false, true, false, false, false]);
});

test("sort options sort numeric and SemVer versions and allow either direction", () => {
  const { cardsContainer, sortBy, sortDirection } = setup();
  const names = () => cardsContainer.children.map((item) => item.dataset.sortName);

  assert.deepEqual(names(), ["Linux plugin", "Android plugin", "Unknown", "Universal"]);

  sortBy.value = "name";
  sortBy.trigger("change");
  assert.deepEqual(names(), ["Android plugin", "Linux plugin", "Universal", "Unknown"]);

  sortDirection.trigger("click");
  assert.deepEqual(names(), ["Unknown", "Universal", "Linux plugin", "Android plugin"]);

  sortBy.value = "last_updated";
  sortBy.trigger("change");
  assert.deepEqual(names(), ["Universal", "Linux plugin", "Android plugin", "Unknown"]);

  sortBy.value = "version";
  sortBy.trigger("change");
  sortDirection.trigger("click");
  assert.deepEqual(names(), ["Universal", "Unknown", "Android plugin", "Linux plugin"]);
});
