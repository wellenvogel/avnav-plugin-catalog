import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { fillLastUpdated } from "../tools/fill_last_updated.js";

const require = createRequire(new URL("../tools/package.json", import.meta.url));
const YAML = require("yaml");
const run = promisify(execFile);
const script = fileURLToPath(new URL("../tools/fill_last_updated.js", import.meta.url));

test("fills only missing timestamps and is idempotent", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-last-updated-"));
  const file = path.join(directory, "plugins.yml");
  try {
    await writeFile(file, `# Plugins
- name: missing
  platform: [linux, raspberry]
- name: null
  last_updated:
- name: empty
  last_updated: ""
- name: existing
  last_updated: "2020-01-02T03:04:05Z"
`);
    const before = Date.now();
    assert.equal(await fillLastUpdated(file), 3);
    const after = Date.now();
    const result = await readFile(file, "utf8");
    const entries = YAML.parse(result);
    for (const entry of entries.slice(0, 3)) {
      assert.ok(Date.parse(entry.last_updated) >= before);
      assert.ok(Date.parse(entry.last_updated) <= after);
      assert.equal(entry.last_updated, entries[0].last_updated);
    }
    assert.equal(entries[3].last_updated, "2020-01-02T03:04:05Z");
    assert.match(result, /# Plugins/);
    assert.match(result, /platform: \[linux, raspberry\]/);
    assert.equal(await fillLastUpdated(file), 0);
    assert.equal(await readFile(file, "utf8"), result);
  } finally {
    await unlink(file);
    await rmdir(directory);
  }
});

test("invalid catalogs fail without writing changes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-last-updated-invalid-"));
  const file = path.join(directory, "plugins.yml");
  try {
    for (const source of ["name: not-a-list\n", "- name: valid\n- invalid\n", "- name: [broken\n"]) {
      await writeFile(file, source);
      await assert.rejects(fillLastUpdated(file));
      assert.equal(await readFile(file, "utf8"), source);
    }
  } finally {
    await unlink(file);
    await rmdir(directory);
  }
});

test("CLI updates the requested file and reports errors", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-last-updated-cli-"));
  const file = path.join(directory, "plugins.yml");
  try {
    await writeFile(file, "- name: example\n");
    const result = await run(process.execPath, [script, file]);
    assert.match(result.stdout, /Updated 1 plugin entry/);
    assert.match(await readFile(file, "utf8"), /last_updated:/);
    await assert.rejects(run(process.execPath, [script]), (error) => {
      assert.match(error.stderr, /Usage:/);
      return true;
    });
    await assert.rejects(run(process.execPath, [script, path.join(directory, "missing.yml")]), (error) => {
      assert.match(error.stderr, /Failed to fill last_updated:/);
      return true;
    });
  } finally {
    await unlink(file);
    await rmdir(directory);
  }
});
