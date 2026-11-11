import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { updatePlugins } from "../tools/update.js";

test("reports updates, errors, and no-op runs", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-marker-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  const source = `- name: first
  type: package
  update: github
  version: "1"
- name: second
  type: package
  update: github
  version: "1"
- name: third
  type: package
  version: "1"
`;
  try {
    await writeFile(plugins, source);
    const updater = async (entry) => {
      if (entry.name === "first") return { version: "2", text: "one\ntwo" };
      if (entry.name === "second") throw new Error("failed\nreason");
      return { version: "1" };
    };
    assert.equal(await updatePlugins(plugins, marker, updater), true);
    assert.equal(await readFile(marker, "utf8"),
      'UPDATED\n"first": {"version":"2","text":"one\\ntwo"}\nERROR\n"second": "update (mode: \\"github\\"): failed\\nreason"\n');

    const afterUpdate = await readFile(plugins, "utf8");
    assert.equal(await updatePlugins(plugins, marker, async (entry) => {
      if (entry.name !== "third") throw new Error(`error in ${entry.name}`);
    }), false);
    assert.equal(await readFile(marker, "utf8"),
      'ERROR\n"first": "update (mode: \\"github\\"): error in first"\n"second": "update (mode: \\"github\\"): error in second"\n');
    assert.equal(await readFile(plugins, "utf8"), afterUpdate);

    assert.equal(await updatePlugins(plugins, marker, async () => undefined), false);
    await assert.rejects(readFile(marker), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("YAML parse diagnostics include every error and location in stderr and marker", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-yaml-error-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  const script = fileURLToPath(new URL("../tools/update.js", import.meta.url));
  const source = "- name: first\n  name: second\n- name: [broken\n";
  try {
    await writeFile(plugins, source);
    await assert.rejects(promisify(execFile)(process.execPath, [script, plugins, marker]), (error) => {
      assert.equal(error.code, 1);
      assert.ok(error.stderr.includes(`Failed to parse ${plugins}`));
      assert.match(error.stderr, /\[DUPLICATE_KEY\].*line 2, column 3/);
      assert.match(error.stderr, /\[BAD_INDENT\].*line 4, column 1/);
      assert.match(error.stderr, /name: second/);
      assert.match(error.stderr, /name: \[broken/);
      return true;
    });
    const report = await readFile(marker, "utf8");
    const lines = report.trimEnd().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[0], "ERROR");
    assert.ok(lines[1].startsWith('"Updater": '));
    const message = JSON.parse(lines[1].slice('"Updater": '.length));
    assert.ok(message.includes(`Failed to parse ${plugins}`));
    assert.match(message, /\[DUPLICATE_KEY\].*line 2, column 3/);
    assert.match(message, /\[BAD_INDENT\].*line 4, column 1/);
    assert.match(message, /name: second/);
    assert.match(message, /name: \[broken/);
    assert.equal(await readFile(plugins, "utf8"), source);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reports fatal catalog errors without saving pending updates", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-marker-invalid-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  try {
    const source = "- name: first\n  type: package\n- invalid\n";
    await writeFile(plugins, source);
    await assert.rejects(updatePlugins(plugins, marker, async () => ({ version: "2" })), /every entry/);
    assert.equal(await readFile(plugins, "utf8"), source);
    assert.match(await readFile(marker, "utf8"), /^ERROR\n"Updater": .*every entry.*\n$/);

    await writeFile(plugins, "- name: [broken\n");
    await assert.rejects(updatePlugins(plugins, marker), /Failed to parse/);
    assert.match(await readFile(marker, "utf8"), /^ERROR\n"Updater": .*Failed to parse.*\n$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reports invalid or unknown updater modules and continues", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-marker-module-"));
  const plugins = path.join(directory, "plugins.yml");
  const marker = path.join(directory, ".update");
  try {
    const source = "- name: invalid\n  update: ../bad\n- name: unknown\n  update: missing_module\n";
    await writeFile(plugins, source);
    assert.equal(await updatePlugins(plugins, marker), false);
    assert.match(await readFile(marker, "utf8"),
      /^ERROR\n"invalid": "update \(mode: \\"\.\.\/bad\\"\): Invalid update module name: \.\.\/bad"\n"unknown": "update \(mode: \\"missing_module\\"\): Unknown update module: missing_module"\n$/);
    assert.equal(await readFile(plugins, "utf8"), source);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
