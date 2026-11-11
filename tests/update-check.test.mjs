import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { updatePlugins } from "../tools/update.js";

const require = createRequire(new URL("../tools/package.json", import.meta.url));
const YAML = require("yaml");

test("checks changed candidate entries and rejects only failed updates", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-check-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  const options = { example: "option" };
  const checked = [];
  try {
    await writeFile(plugins, `- name: reject
  type: zip
  version: "1"
  description: {en: original}
- name: accept
  type: package
  version: "1"
  description: {en: original}
- name: unchanged
  type: zip
  version: "1"
- name: skipped
  type: zip
  version: "1"
`);
    const updater = async (entry) => {
      if (entry.name === "skipped") return undefined;
      if (entry.name === "unchanged") return { version: "1" };
      return { version: "2", download_url: "https://example.com/new" };
    };
    const checker = async (entry, receivedOptions) => {
      assert.equal(receivedOptions, options);
      checked.push(structuredClone(entry));
      entry.description.en = "checker mutation";
      if (entry.name === "reject") throw new Error("validation failed");
    };
    assert.equal(await updatePlugins(plugins, marker, updater, options, checker), true);
    assert.deepEqual(checked.map((entry) => entry.name), ["reject", "accept"]);
    for (const entry of checked) {
      assert.equal(entry.version, "2");
      assert.equal(entry.download_url, "https://example.com/new");
      assert.equal(entry.description.en, "original");
    }
    const entries = YAML.parse(await readFile(plugins, "utf8"));
    assert.equal(entries[0].version, "1");
    assert.equal(entries[0].download_url, undefined);
    assert.equal(entries[1].version, "2");
    assert.equal(entries[1].download_url, "https://example.com/new");
    assert.equal(entries[1].description.en, "original");
    assert.equal(await readFile(marker, "utf8"),
      'UPDATED\n"accept": {"version":"2","download_url":"https://example.com/new"}\nERROR\n"reject": "check (type: \\"zip\\"): validation failed"\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("dispatches package checker and reports invalid or missing types", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-check-types-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  try {
    await writeFile(plugins, `- name: package
  type: package
- name: unknown
  type: missing
- name: invalid
  type: ../bad
- name: absent
`);
    assert.equal(await updatePlugins(plugins, marker, async () => ({ version: "2" })), true);
    const entries = YAML.parse(await readFile(plugins, "utf8"));
    assert.deepEqual(entries.map((entry) => entry.version), ["2", undefined, undefined, undefined]);
    assert.equal(await readFile(marker, "utf8"),
      'UPDATED\n"package": {"version":"2"}\nERROR\n"unknown": "check (type: \\"missing\\"): Unknown check module: missing"\n"invalid": "check (type: \\"../bad\\"): Invalid check module name: ../bad"\n"absent": "check (type: undefined): Invalid check module name: undefined"\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("checker-only errors create a marker without writing the catalog", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-check-failure-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  const source = '- name: reject\n  type: zip\n  version: "1"\n';
  try {
    await writeFile(plugins, source);
    assert.equal(await updatePlugins(plugins, marker, async () => ({ version: "2" }), {}, async () => {
      throw new Error("check failed");
    }), false);
    assert.equal(await readFile(plugins, "utf8"), source);
    assert.equal(await readFile(marker, "utf8"), 'ERROR\n"reject": "check (type: \\"zip\\"): check failed"\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("console and marker distinguish updater errors from proposed-type checker errors", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-check-log-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  const originalError = console.error;
  const logs = [];
  try {
    await writeFile(plugins, '- name: update-fails\n  type: zip\n  update: github\n- name: check-fails\n  type: zip\n  update: github\n');
    console.error = (...args) => logs.push(args);
    const updater = async (entry) => {
      if (entry.name === "update-fails") throw new Error("same failure");
      return { type: "package" };
    };
    const checker = async () => { throw new Error("same failure"); };
    assert.equal(await updatePlugins(plugins, marker, updater, {}, checker), false);
    assert.equal(logs[0][0], 'update (mode: "github") failed for update-fails:');
    assert.equal(logs[1][0], 'check (type: "package") failed for check-fails:');
    assert.equal(logs[0][1].message, "same failure");
    assert.equal(logs[1][1].message, "same failure");
    assert.equal(await readFile(marker, "utf8"),
      'ERROR\n"update-fails": "update (mode: \\"github\\"): same failure"\n"check-fails": "check (type: \\"package\\"): same failure"\n');
  } finally {
    console.error = originalError;
    await rm(directory, { recursive: true, force: true });
  }
});

test("check-all checks updated, unchanged, skipped and failed updates exactly once", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-check-all-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  const checked = [];
  try {
    await writeFile(plugins, `- name: changed
  type: package
  version: "1"
- name: unchanged
  type: package
  version: "1"
- name: skipped
  type: package
  version: "1"
- name: failed
  type: package
  version: "1"
`);
    const updater = async (entry) => {
      if (entry.name === "failed") throw new Error("update error");
      if (entry.name === "skipped") return undefined;
      return { version: entry.name === "changed" ? "2" : "1" };
    };
    const checker = async (entry) => {
      checked.push([entry.name, entry.version]);
      if (entry.name === "failed") throw new Error("check error");
    };
    assert.equal(await updatePlugins(plugins, marker, updater, { checkAll: true }, checker), true);
    assert.deepEqual(checked, [["changed", "2"], ["unchanged", "1"], ["skipped", "1"], ["failed", "1"]]);
    const report = await readFile(marker, "utf8");
    assert.match(report, /^UPDATED\n"changed": {"version":"2"}\nERROR\n/);
    assert.match(report, /"failed": "update .*update error"\n"failed": "check .*check error"\n$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("skip-update checks all existing entries without invoking updater or modifying catalog", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-check-only-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  const source = '- name: first\n  type: package\n- name: second\n  type: package\n';
  const seen = [];
  try {
    await writeFile(plugins, source);
    const updater = async () => { throw new Error("updater must not run"); };
    const checker = async (entry) => {
      seen.push(entry.name);
      if (entry.name === "first") throw new Error("check failed");
    };
    assert.equal(await updatePlugins(plugins, marker, updater, { skipUpdate: true }, checker), false);
    assert.deepEqual(seen, ["first", "second"]);
    assert.equal(await readFile(plugins, "utf8"), source);
    assert.equal(await readFile(marker, "utf8"), 'ERROR\n"first": "check (type: \\"package\\"): check failed"\n');
    assert.equal(await updatePlugins(plugins, marker, updater, { skipUpdate: true }, async () => {}), false);
    await assert.rejects(readFile(marker), { code: "ENOENT" });
    assert.equal(await readFile(plugins, "utf8"), source);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
