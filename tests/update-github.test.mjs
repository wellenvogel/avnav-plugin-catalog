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

    await t.test("extracts SemVer including prerelease and build metadata for asset substitution", async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          name: "v1.0.2-beta1+build.3",
          assets: [{ name: "plugin-1.0.2-beta1+build.3-1.0.2-beta1+build.3.zip", browser_download_url: "https://example.com/new.zip" }],
        }),
      });
      try {
        const result = await updateGithub({ ...entry, release_pattern: "^v#semver#$" });
        assert.equal(result.version, "1.0.2-beta1+build.3");
        assert.equal(result.download_url, "https://example.com/new.zip");
        assert.ok(Number.isFinite(Date.parse(result.last_updated)));
        assert.equal(await updateGithub({
          ...entry, release_pattern: "^v#semver#$", version: "1.0.2-beta1+build.3",
          download_url: "https://example.com/new.zip",
        }), undefined);
      } finally {
        globalThis.fetch = async () => ({ ok: true, json: async () => release });
      }
    });

    await t.test("extracts simple and custom patterns, including whole matches", async () => {
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ name: "release v20260101", assets: [] }) });
      try {
        for (const pattern of ["v#simple#", "v([0-9]+)", "[0-9]+"]) {
          const result = await updateGithub({ ...entry, filename: undefined, release_pattern: pattern });
          assert.equal(result.version, "20260101");
        }
        const result = await updateGithub({ ...entry, filename: undefined, release_pattern: "(?:release )v#simple#" });
        assert.equal(result.version, "20260101");
      } finally {
        globalThis.fetch = async () => ({ ok: true, json: async () => release });
      }
    });

    await t.test("tries the tag when the release name cannot yield a version", async () => {
      for (const name of ["Stable release", "", null, undefined, "v"]) {
        globalThis.fetch = async () => ({
          ok: true,
          json: async () => ({
            name, tag_name: "v20260101",
            assets: [{ name: "plugin-20260101-20260101.zip", browser_download_url: "https://example.com/tag.zip" }],
          }),
        });
        const result = await updateGithub({ ...entry, release_pattern: "^v#simple#$" });
        assert.equal(result.version, "20260101");
        assert.equal(result.download_url, "https://example.com/tag.zip");
      }
      globalThis.fetch = async () => ({ ok: true, json: async () => release });
    });

    await t.test("prefers a valid name match to the tag and preserves name-only behavior without a pattern", async () => {
      globalThis.fetch = async () => ({
        ok: true, json: async () => ({ name: "v2025", tag_name: "v2026", assets: [] }),
      });
      assert.equal((await updateGithub({ ...entry, filename: undefined, release_pattern: "^v#simple#$" })).version, "2025");
      assert.equal((await updateGithub({ ...entry, filename: undefined })).version, "v2025");
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ name: null, tag_name: "v2026", assets: [] }) });
      await assert.rejects(updateGithub({ ...entry, filename: undefined }), /has no name/);
      globalThis.fetch = async () => ({ ok: true, json: async () => release });
    });

    await t.test("reports an error when neither name nor tag yields a version", async () => {
      for (const tag_name of ["bad", "v", null, undefined, 12]) {
        globalThis.fetch = async () => ({
          ok: true, json: async () => ({ name: "release", tag_name, assets: [] }),
        });
        await assert.rejects(updateGithub({ ...entry, release_pattern: "^v#simple#$" }), /release name or tag/);
      }
      globalThis.fetch = async () => ({ ok: true, json: async () => release });
    });

    await t.test("includes the pattern, expanded expression, release name and tag in errors", async () => {
      globalThis.fetch = async () => ({
        ok: true, json: async () => ({ name: 'Release "stable"\nnotes', tag_name: "tag-1", assets: [] }),
      });
      try {
        await assert.rejects(updateGithub({ ...entry, release_pattern: "^v#simple#$" }), (error) => {
          assert.ok(error.message.includes('release_pattern="^v#simple#$"'));
          assert.ok(error.message.includes('expanded pattern="^v([0-9]*)$"'));
          assert.ok(error.message.includes('release name="Release \\"stable\\"\\nnotes"'));
          assert.ok(error.message.includes('release tag="tag-1"'));
          return true;
        });
        await assert.rejects(updateGithub({ ...entry, release_pattern: "[#simple#" }), (error) => {
          assert.ok(error.message.includes('release_pattern="[#simple#"'));
          assert.ok(error.message.includes('expanded pattern="[([0-9]*)"'));
          assert.ok(error.message.includes('release tag="tag-1"'));
          return true;
        });
        await assert.rejects(updateGithub({ ...entry, release_pattern: "" }), (error) => {
          assert.ok(error.message.includes('release_pattern=""'));
          assert.ok(error.message.includes('release tag="tag-1"'));
          return true;
        });
      } finally {
        globalThis.fetch = async () => ({ ok: true, json: async () => release });
      }
    });

    await t.test("rejects invalid patterns and missing or empty extracted versions", async () => {
      for (const pattern of ["[", "", 123, "^v#semver#$", "^#simple#$", "(x)?2.0"]) {
        await assert.rejects(updateGithub({ ...entry, release_pattern: pattern }), /release_pattern/);
      }
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ name: "v", assets: [] }) });
      try {
        await assert.rejects(updateGithub({ ...entry, release_pattern: "v#simple#" }), /Could not extract/);
      } finally {
        globalThis.fetch = async () => ({ ok: true, json: async () => release });
      }
    });

    await t.test("reports extraction errors and continues updating other entries", async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-github-pattern-"));
      try {
        const plugins = path.join(directory, "plugins.yml");
        const marker = path.join(directory, ".update");
        await writeFile(plugins, `- name: invalid\n  type: package\n  src_url: https://github.com/owner/repo\n  version: "1.0"\n  update: github\n  release_pattern: "^v#semver#$"\n- name: valid\n  type: package\n  src_url: https://github.com/owner/repo\n  version: "1.0"\n  update: github\n  release_pattern: "#simple#"\n`);
        assert.equal(await updatePlugins(plugins, marker), true);
        const output = await readFile(plugins, "utf8");
        assert.match(output, /name: invalid[\s\S]*version: "1\.0"/);
        assert.match(output, /name: valid[\s\S]*version: "2"/);
        const report = await readFile(marker, "utf8");
        assert.match(report, /^UPDATED\n"valid": .*"version":"2".*\nERROR\n"invalid": .*Could not extract.*\n$/);
        const errorMessage = JSON.parse(report.split("\n")[3].slice('"invalid": '.length));
        assert.ok(errorMessage.includes('release_pattern="^v#semver#$"'));
        assert.ok(errorMessage.includes('release name="2.0"'));
        assert.ok(errorMessage.includes("release tag=undefined"));
        assert.ok(errorMessage.includes("expanded pattern="));
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    await t.test("persists an asset-only update and marker through the dispatcher", async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "avnav-github-update-"));
      try {
        const plugins = path.join(directory, "plugins.yml");
        const marker = path.join(directory, ".update");
        await writeFile(plugins, `- name: plugin\n  type: package\n  src_url: https://github.com/owner/repo\n  version: "2.0"\n  filename: plugin-$version-$version.zip\n  download_url: https://example.com/old.zip\n  update: github\n`);
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
        await writeFile(plugins, `- name: missing\n  type: package\n  src_url: https://github.com/owner/repo\n  version: "1.0"\n  filename: missing.zip\n  update: github\n- name: valid\n  type: package\n  src_url: https://github.com/owner/repo\n  version: "1.0"\n  update: github\n`);
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
