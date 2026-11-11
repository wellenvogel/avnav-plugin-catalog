import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import updateGithub from "../tools/update_github.js";
import { updatePlugins } from "../tools/update.js";

const release = {
  name: "2.0",
  assets: [
    { name: "plugin-2.0-2.0.zip", browser_download_url: "https://example.com/plugin-2.0.zip" },
  ],
};
const entry = {
  name: "plugin",
  src_url: "https://github.com/owner/repo",
  version: "1.0",
  filename: "plugin-$version-$version.zip",
  download_url: "https://example.com/old.zip",
};

test("GitHub release assets update plugin entries", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  const errors = [];
  globalThis.fetch = async () => ({ ok: true, json: async () => release });
  console.log = () => {};
  console.error = (...args) => errors.push(args);

  try {
    await t.test("updates version, substituted asset URL, and timestamp", async () => {
      const before = Date.now();
      const result = await updateGithub(entry);
      assert.equal(result.version, "2.0");
      assert.equal(result.download_url, "https://example.com/plugin-2.0.zip");
      assert.ok(Date.parse(result.last_updated) >= before);
      assert.ok(Date.parse(result.last_updated) <= Date.now());
    });

    await t.test("updates a changed asset URL even if the version is unchanged", async () => {
      const result = await updateGithub({ ...entry, version: "2.0" });
      assert.equal(result.version, undefined);
      assert.equal(result.download_url, "https://example.com/plugin-2.0.zip");
      assert.ok(Number.isFinite(Date.parse(result.last_updated)));
    });

    await t.test("returns no changes when version and asset URL are unchanged", async () => {
      assert.equal(await updateGithub({
        ...entry,
        version: "2.0",
        download_url: "https://example.com/plugin-2.0.zip",
      }), undefined);
    });

    await t.test("updates only the version when no filename is configured", async () => {
      const result = await updateGithub({ ...entry, filename: undefined });
      assert.equal(result.version, "2.0");
      assert.equal(result.download_url, undefined);
    });

    await t.test("does not partially update when the asset is missing", async () => {
      await assert.rejects(updateGithub({ ...entry, filename: "missing.zip" }), /not found/);
    });

    await t.test("rejects assets without download URLs", async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ name: "2.0", assets: [{ name: "plugin-2.0-2.0.zip" }] }),
      });
      await assert.rejects(updateGithub(entry), /no download URL/);
      globalThis.fetch = async () => ({ ok: true, json: async () => release });
    });

    await t.test("persists an asset-only update and marker through the dispatcher", async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-github-update-"));
      try {
        const plugins = path.join(directory, "plugins.yml");
        const marker = path.join(directory, ".update");
        await writeFile(plugins, `- name: plugin\n  src_url: https://github.com/owner/repo\n  version: "2.0"\n  filename: plugin-$version-$version.zip\n  download_url: https://example.com/old.zip\n  update: github\n`);
        assert.equal(await updatePlugins(plugins, marker), true);
        assert.match(await readFile(plugins, "utf8"), /download_url: https:\/\/example\.com\/plugin-2\.0\.zip/);
        const report = await readFile(marker, "utf8");
        assert.match(report, /^UPDATED\n"plugin": /);
        assert.match(report, /"download_url":"https:\/\/example\.com\/plugin-2\.0\.zip"/);
        assert.match(report, /"last_updated":/);
        assert.doesNotMatch(report, /"version":/);
        assert.doesNotMatch(report, /\nERROR\n/);
        assert.equal(await updatePlugins(plugins, marker), false);
        await assert.rejects(readFile(marker), { code: "ENOENT" });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    await t.test("logs missing asset and continues to later entries", async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-github-missing-"));
      try {
        const plugins = path.join(directory, "plugins.yml");
        const marker = path.join(directory, ".update");
        await writeFile(plugins, `- name: missing\n  src_url: https://github.com/owner/repo\n  version: "1.0"\n  filename: missing.zip\n  update: github\n- name: valid\n  src_url: https://github.com/owner/repo\n  version: "1.0"\n  update: github\n`);
        assert.equal(await updatePlugins(plugins, marker), true);
        const output = await readFile(plugins, "utf8");
        assert.match(output, /name: missing[\s\S]*version: "1\.0"/);
        assert.match(output, /name: valid[\s\S]*version: "2\.0"/);
        assert.ok(errors.some((args) => String(args[0]).includes("missing")));
        const report = await readFile(marker, "utf8");
        assert.match(report, /^UPDATED\n"valid": .*"version":"2\.0".*\nERROR\n"missing": .*not found.*\n$/);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
  }
});
