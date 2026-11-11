const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const script = readFileSync(path.join(__dirname, "../docs/assets/js/repository-dialog.js"), "utf8");

function setup(ids, dialogs) {
  const links = ids.map((id) => ({
    getAttribute(name) { return name === "aria-controls" ? id : null; },
    addEventListener(event, callback) { this[event] = callback; },
  }));
  const errors = [];
  const document = {
    querySelectorAll(selector) {
      assert.equal(selector, ".repository-dialog-open");
      return links;
    },
    getElementById(id) { return dialogs[id]; },
  };
  vm.runInNewContext(script, { document, console: { error: (message) => errors.push(message) } });
  return { links, errors };
}

test("each repository link opens its own dialog", () => {
  const opened = [];
  const dialogs = {
    first: { showModal() { opened.push("first"); } },
    second: { showModal() { opened.push("second"); } },
  };
  const { links, errors } = setup(["first", "second"], dialogs);
  let prevented = false;
  links[1].click({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(opened, ["second"]);
  assert.deepEqual(errors, []);
});

test("a missing dialog is reported without suppressing the link", () => {
  const { links, errors } = setup(["missing"], {});
  let prevented = false;
  links[0].click({ preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
  assert.deepEqual(errors, ["Repository dialog not found: missing"]);
});
